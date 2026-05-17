import { Router } from 'express';
const router = Router();
router.get('/profile', (req, res) => res.json({ user: {} }));
router.put('/profile', (req, res) => res.json({ success: true }));
export default router;