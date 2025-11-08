import { Router } from 'express';
import {
  getBiometrics,
  createBiometric,
  updateBiometric,
  deleteBiometric,
} from '../controllers/biometrics.controller';
import { standardLimiter, createLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', standardLimiter, getBiometrics);
router.post('/', createLimiter, createBiometric);
router.put('/:id', createLimiter, updateBiometric);
router.delete('/:id', standardLimiter, deleteBiometric);

export default router;
