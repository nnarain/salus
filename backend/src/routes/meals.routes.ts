import { Router } from 'express';
import {
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getCalorieStats,
} from '../controllers/meals.controller';
import { standardLimiter, createLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/stats', standardLimiter, getCalorieStats);
router.get('/', standardLimiter, getMeals);
router.post('/', createLimiter, createMeal);
router.put('/:id', createLimiter, updateMeal);
router.delete('/:id', standardLimiter, deleteMeal);

export default router;
