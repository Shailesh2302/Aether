import { Router } from 'express';
const router = Router();
router.post('/generate', (req, res) => res.json({ message: 'Clip generation' }));
router.get('/', (req, res) => res.json({ clips: [] }));
export default router;