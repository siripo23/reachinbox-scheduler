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
    removeOnComplete: false,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const MIN_DELAY_MS = parseInt(process.env.MIN_SEND_DELAY_MS || '2000', 10);

export const scheduleEmail = async (jobData: any, delayMs: number) => {
  const job = await emailQueue.add('send-email', jobData, {
    delay: delayMs,
    jobId: `email-${jobData.scheduledEmailId}`,
  });
  return job.id;
};

const incrementSenderCount = async (senderId: string): Promise<number> => {
  const hourKey = `rate-limit:${senderId}:${new Date().toISOString().slice(0, 13)}`;
  const count = await connection.incr(hourKey);
  if (count === 1) {
    await connection.expire(hourKey, 3600);
  }
  return count;
};

const notifySlack = async (token: string, channel: string, message: string) => {
  if (!token) return;
  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel: channel || '#general', text: message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    console.error('Slack notification failed:', error);
  }
};

export const setupWorker = () => {
  const worker = new Worker(
    'email-sending',
    async (job: Job) => {
      const { scheduledEmailId, to, subject, body, hourlyLimit, userId } = job.data;

      const existing = await prisma.scheduledEmail.findUnique({
        where: { id: scheduledEmailId },
      });
      if (existing?.status === 'SENT') {
        return;
      }

      const currentCount = await incrementSenderCount(userId);
      const limit = hourlyLimit ?? parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10);

      if (currentCount > limit) {
        if (currentCount === limit + 1) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.slackToken) {
            await notifySlack(
              user.slackToken,
              user.slackChannel || '#general',
              `Rate limit of ${limit} emails/hour reached for sender ${userId}. Emails rescheduled to next hour.`
            );
          }
        }

        const msUntilNextHour = 3600000 - (Date.now() % 3600000) + 1000;
        await emailQueue.add('send-email', job.data, {
          delay: msUntilNextHour,
          jobId: `email-${scheduledEmailId}-retry-${Date.now()}`,
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));

      try {
        await sendEmail(to, subject, body);

        const updated = await prisma.scheduledEmail.update({
          where: { id: scheduledEmailId },
          data: { status: 'SENT', sentAt: new Date() },
        });

        indexEmail({ ...updated, subject, body }).catch(() => {});
      } catch (error) {
        await prisma.scheduledEmail.update({
          where: { id: scheduledEmailId },
          data: { status: 'FAILED' },
        });
        throw error;
      }
    },
    { connection, concurrency: WORKER_CONCURRENCY }
  );

  worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed: ${err.message}`));
};
