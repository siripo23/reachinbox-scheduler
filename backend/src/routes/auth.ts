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

// Real Slack OAuth Flow
router.get('/slack/callback', async (req, res) => {
  const { code, state } = req.query; // state contains userId

  if (!code || !state) {
    return res.status(400).send('Invalid request: Missing code or state');
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: 'http://localhost:3001/api/auth/slack/callback'
      }
    });

    const data = response.data;
    
    if (!data.ok) {
      console.error('Slack OAuth Error:', data.error);
      return res.status(400).send(`Slack OAuth failed: ${data.error}`);
    }

    // data.access_token is the bot token if scopes are requested for bot
    const slackToken = data.access_token;
    
    // Store in DB
    await prisma.user.update({
      where: { id: String(state) },
      data: { slackToken }
    });

    // Redirect back to frontend
    res.redirect('http://localhost:5173/');
  } catch (error) {
    console.error('Slack OAuth request failed:', error);
    res.status(500).send('Internal Server Error during Slack OAuth');
  }
});

export default router;
