import { Router } from 'express';
const router = Router();
router.post('/', (req, res) => res.json({ results: [] }));
export default router;