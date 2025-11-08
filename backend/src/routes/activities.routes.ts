import { Router } from 'express';
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/activities.controller';
import { standardLimiter, createLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', standardLimiter, getActivities);
router.post('/', createLimiter, createActivity);
router.put('/:id', createLimiter, updateActivity);
router.delete('/:id', standardLimiter, deleteActivity);

export default router;
