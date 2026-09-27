const API_BASE_URL = 'http://localhost:3001/api';

export const login = async (email: string, name: string) => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
};

export const getScheduledEmails = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/campaigns/scheduled/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export const getSentEmails = async (userId: string) => {
  const res = await fetch(`${API_BASE_URL}/campaigns/sent/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export const scheduleCampaign = async (data: any) => {
  const res = await fetch(`${API_BASE_URL}/campaigns/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to schedule');
  return res.json();
};
