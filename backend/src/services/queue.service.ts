import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { sendEmail } from './email.service';
import prisma from '../db';
import { indexEmail } from './elasticsearch.service';
import axios from 'axios';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-sending', {
  connection,
  defaultJobOptions: {
    removeOnComplete: false, // keep completed jobs for visibility
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Configurable concurrency via env (default: 5)
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

// Minimum delay between individual email sends in ms (default: 2s)
const MIN_DELAY_MS = parseInt(process.env.MIN_SEND_DELAY_MS || '2000', 10);

export const scheduleEmail = async (jobData: any, delayMs: number) => {
  const job = await emailQueue.add('send-email', jobData, {
    delay: delayMs,
    jobId: `email-${jobData.scheduledEmailId}`, // idempotency key
  });
  return job.id;
};

/**
 * Redis-backed per-sender hourly rate limiter.
 * Key format: rate-limit:<userId>:<YYYY-MM-DDTHH>  (rolls over each hour)
 */
const incrementSenderCount = async (senderId: string): Promise<number> => {
  const hourKey = `rate-limit:${senderId}:${new Date().toISOString().slice(0, 13)}`;
  const count = await connection.incr(hourKey);
  if (count === 1) {
    await connection.expire(hourKey, 3600);
  }
  return count;
};

const notifySlack = async (slackToken: string, channel: string, message: string) => {
  if (!slackToken) return;
  // Fall back to #general if no specific channel stored
  const targetChannel = channel || '#general';
  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel: targetChannel, text: message },
      { headers: { Authorization: `Bearer ${slackToken}` } }
    );
    console.log(`Slack notification sent to ${targetChannel}`);
  } catch (error) {
    console.error('Failed to notify Slack', error);
  }
};

export const setupWorker = () => {
  const worker = new Worker(
    'email-sending',
    async (job: Job) => {
      const { scheduledEmailId, to, subject, body, hourlyLimit, userId } = job.data;

      // Check idempotency — if already SENT, skip
      const existing = await prisma.scheduledEmail.findUnique({
        where: { id: scheduledEmailId },
      });
      if (existing?.status === 'SENT') {
        console.log(`Job ${job.id}: email ${scheduledEmailId} already sent. Skipping.`);
        return;
      }

      // Redis-backed hourly rate limiting
      const currentCount = await incrementSenderCount(userId);
      const limit = hourlyLimit ?? parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10);

      if (currentCount > limit) {
        console.log(`Rate limit exceeded for user ${userId} (${currentCount}/${limit}). Rescheduling...`);

        // Notify Slack only on the first over-limit hit each hour
        if (currentCount === limit + 1) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.slackToken) {
            await notifySlack(
              user.slackToken,
              user.slackChannel || '#general',
              `⚠️ *ReachInbox Rate Limit Hit*\nSender \`${userId}\` reached the hourly limit of *${limit}* emails.\nFuture emails are rescheduled to next hour.`
            );
          }
        }

        // Reschedule into the next full hour window
        const msUntilNextHour =
          3600000 - (Date.now() % 3600000) + 1000; // +1s safety buffer
        await emailQueue.add('send-email', job.data, {
          delay: msUntilNextHour,
          jobId: `email-${scheduledEmailId}-retry-${Date.now()}`,
        });
        return;
      }

      // Minimum delay between sends (mimics provider throttling)
      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));

      try {
        await sendEmail(to, subject, body);

        const updatedEmail = await prisma.scheduledEmail.update({
          where: { id: scheduledEmailId },
          data: { status: 'SENT', sentAt: new Date() },
        });

        // Index in Elasticsearch (non-blocking — failures don't break the job)
        indexEmail({ ...updatedEmail, subject, body }).catch((err) =>
          console.error('ES index failed:', err)
        );
      } catch (error) {
        console.error(`Job ${job.id} failed to send email:`, error);
        await prisma.scheduledEmail.update({
          where: { id: scheduledEmailId },
          data: { status: 'FAILED' },
        });
        throw error; // trigger BullMQ retry
      }
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed: ${err.message}`);
  });

  console.log(
    `BullMQ worker started (concurrency=${WORKER_CONCURRENCY}, minDelay=${MIN_DELAY_MS}ms)`
  );
};
