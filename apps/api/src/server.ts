import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory storage for demo
const users: any[] = [];
const files: any[] = [];
const messages: any[] = [];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const user = { id: `user-${Date.now()}`, email, name, createdAt: new Date().toISOString() };
  users.push(user);
  const token = 'demo-token-' + Date.now();
  res.json({ token, user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = 'demo-token-' + Date.now();
  res.json({ token, user });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: users[0] || null });
});

// Files routes
app.get('/api/files', (req, res) => {
  res.json(files);
});

app.post('/api/files/upload', (req, res) => {
  const file = { id: `file-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  files.push(file);
  res.json({ file });
});

app.delete('/api/files/:id', (req, res) => {
  const index = files.findIndex(f => f.id === req.params.id);
  if (index !== -1) files.splice(index, 1);
  res.json({ success: true });
});

// Chat routes
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  messages.push({ role: 'user', content: message, createdAt: new Date().toISOString() });
  
  const response = "This is a demo response. The AI backend is not connected yet.";
  messages.push({ role: 'assistant', content: response, createdAt: new Date().toISOString() });
  
  res.json({
    userMessage: { role: 'user', content: message },
    assistantMessage: { role: 'assistant', content: response }
  });
});

app.get('/api/chat', (req, res) => {
  res.json(messages);
});

// Search routes
app.post('/api/search', (req, res) => {
  const { query } = req.body;
  res.json({ results: [] });
});

// Clips routes
app.post('/api/clips/generate', (req, res) => {
  res.json({ status: 'success', message: 'Clip generation not implemented yet' });
});

app.get('/api/clips', (req, res) => {
  res.json({ clips: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 OmniMind API running on http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
});