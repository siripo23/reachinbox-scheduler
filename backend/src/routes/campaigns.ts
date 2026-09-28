import { Router } from 'express';
import prisma from '../db';
import { scheduleEmail } from '../services/queue.service';
import { searchEmails } from '../services/elasticsearch.service';

const router = Router();

router.post('/schedule', async (req, res) => {
  const { userId, subject, body, startTime, delaySeconds, hourlyLimit, emails } = req.body;

  if (!userId || !emails || emails.length === 0) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        subject,
        body,
        startTime: new Date(startTime),
        delaySeconds,
        hourlyLimit,
        userId,
      },
    });

    const startMs = new Date(startTime).getTime();
    const nowMs = Date.now();

    for (let i = 0; i < emails.length; i++) {
      const scheduledEmail = await prisma.scheduledEmail.create({
        data: {
          emailAddress: emails[i],
          status: 'SCHEDULED',
          scheduledFor: new Date(startMs + i * delaySeconds * 1000),
          campaignId: campaign.id,
        },
      });

      const delayMs = Math.max(0, startMs + i * delaySeconds * 1000 - nowMs);

      const jobId = await scheduleEmail(
        { scheduledEmailId: scheduledEmail.id, to: emails[i], subject, body, hourlyLimit, userId },
        delayMs
      );

      await prisma.scheduledEmail.update({
        where: { id: scheduledEmail.id },
        data: { jobId: String(jobId) },
      });
    }

    res.json({ success: true, campaignId: campaign.id });
  } catch (error) {
    console.error('Scheduling error:', error);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

router.get('/scheduled/:userId', async (req, res) => {
  const { userId } = req.params;
  const emails = await prisma.scheduledEmail.findMany({
    where: { campaign: { userId }, status: 'SCHEDULED' },
    include: { campaign: true },
    orderBy: { scheduledFor: 'asc' },
  });
  res.json(emails);
});

router.get('/sent/:userId', async (req, res) => {
  const { userId } = req.params;
  const emails = await prisma.scheduledEmail.findMany({
    where: { campaign: { userId }, status: { not: 'SCHEDULED' } },
    include: { campaign: true },
    orderBy: { sentAt: 'desc' },
  });
  res.json(emails);
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = await searchEmails(String(q));
  res.json(results);
});

export default router;
