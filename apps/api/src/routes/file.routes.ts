import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ files: [] });
});

router.post('/upload', (req, res) => {
  res.json({ message: 'File upload endpoint' });
});

router.get('/:id', (req, res) => {
  res.json({ file: { id: req.params.id } });
});

router.delete('/:id', (req, res) => {
  res.json({ success: true });
});

export default router;