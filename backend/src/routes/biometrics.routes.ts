import { Router } from 'express';
import {
  getBiometrics,
  createBiometric,
  updateBiometric,
  deleteBiometric,
} from '../controllers/biometrics.controller';

const router = Router();

router.get('/', getBiometrics);
router.post('/', createBiometric);
router.put('/:id', updateBiometric);
router.delete('/:id', deleteBiometric);

export default router;
