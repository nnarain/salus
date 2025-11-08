import { Router } from 'express';
import { suggestMealPlan, chat } from '../controllers/ai.controller';

const router = Router();

router.post('/meal-plan', suggestMealPlan);
router.post('/chat', chat);

export default router;
