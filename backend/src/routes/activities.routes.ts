import { Router } from 'express';
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/activities.controller';

const router = Router();

router.get('/', getActivities);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

export default router;
