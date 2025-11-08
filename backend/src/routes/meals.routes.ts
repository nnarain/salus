import { Router } from 'express';
import {
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getCalorieStats,
} from '../controllers/meals.controller';

const router = Router();

router.get('/', getMeals);
router.post('/', createMeal);
router.put('/:id', updateMeal);
router.delete('/:id', deleteMeal);
router.get('/stats', getCalorieStats);

export default router;
