import { Router } from 'express';

const router = Router();

router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint - implement with database' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - implement with database' });
});

router.get('/me', (req, res) => {
  res.json({ message: 'Get current user' });
});

export default router;