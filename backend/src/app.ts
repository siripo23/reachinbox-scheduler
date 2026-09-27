import express from 'express';
import cors from 'cors';
import campaignRoutes from './routes/campaigns';
import authRoutes from './routes/auth';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/campaigns', campaignRoutes);
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
