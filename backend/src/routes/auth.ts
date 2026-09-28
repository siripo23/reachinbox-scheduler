import { Router } from 'express';
import prisma from '../db';
import axios from 'axios';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name } });
  }

  res.json({ user });
});

router.get('/slack/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: 'http://localhost:3001/api/auth/slack/callback',
      },
    });

    const data = response.data;

    if (!data.ok) {
      return res.status(400).send(`Slack OAuth failed: ${data.error}`);
    }

    await prisma.user.update({
      where: { id: String(state) },
      data: { slackToken: data.access_token },
    });

    res.redirect('http://localhost:5173/');
  } catch (error) {
    console.error('Slack OAuth error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
