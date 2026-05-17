import { Router } from 'express';

const router = Router();

router.post('/', (req, res) => {
  res.json({ message: 'Chat endpoint', userMessage: req.body });
});

router.get('/', (req, res) => {
  res.json({ messages: [] });
});

export default router;