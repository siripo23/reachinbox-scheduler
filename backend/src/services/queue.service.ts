import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
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

export const emailQueue = new Queue('email-sending', { connection });

// Set concurrency for BullMQ worker
const WORKER_CONCURRENCY = 5; 

export const scheduleEmail = async (jobData: any, delayMs: number) => {
  const job = await emailQueue.add('send-email', jobData, { delay: delayMs });
  return job.id;
};

// Rate limiting setup via Redis keys (to handle per sender hourly limit)
const incrementSenderCount = async (senderId: string): Promise<number> => {
  const hourKey = `rate-limit:${senderId}:${new Date().toISOString().slice(0, 13)}`;
  const count = await connection.incr(hourKey);
  if (count === 1) {
    await connection.expire(hourKey, 3600);
  }
  return count;
};

const notifySlack = async (slackToken: string, message: string) => {
  if (!slackToken) return;
  try {
    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: '#general', // simplified for demo
      text: message,
    }, {
      headers: { Authorization: `Bearer ${slackToken}` }
    });
  } catch (error) {
    console.error('Failed to notify Slack', error);
  }
};

export const setupWorker = () => {
  const worker = new Worker('email-sending', async (job: Job) => {
    const { scheduledEmailId, to, subject, body, hourlyLimit, userId } = job.data;
    
    // Check rate limit
    const currentCount = await incrementSenderCount(userId);
    if (currentCount > hourlyLimit) {
      console.log(`Rate limit exceeded for user ${userId}. Rescheduling job...`);
      // Find user to notify
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.slackToken && currentCount === hourlyLimit + 1) {
         await notifySlack(user.slackToken, `⚠️ Hourly limit of ${hourlyLimit} emails reached. Emails are being rescheduled.`);
      }

      // Reschedule for next hour
      await emailQueue.add('send-email', job.data, { delay: 60 * 60 * 1000 });
      return;
    }

    try {
      // Add minimum delay (e.g. 2 seconds between emails on this worker)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send email
      await sendEmail(to, subject, body);

      // Update DB
      const updatedEmail = await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: { status: 'SENT', sentAt: new Date() },
      });

      // Index in Elasticsearch
      await indexEmail({
        ...updatedEmail,
        subject,
        body
      });
      
    } catch (error) {
      console.error(`Job ${job.id} failed`, error);
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: { status: 'FAILED' }
      });
      throw error;
    }
  }, { 
    connection,
    concurrency: WORKER_CONCURRENCY
  });

  worker.on('completed', job => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} has failed with ${err.message}`);
  });
};
