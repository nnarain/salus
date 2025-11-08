import { Router } from 'express';
import { suggestMealPlan, chat } from '../controllers/ai.controller';
import { aiLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/meal-plan', aiLimiter, suggestMealPlan);
router.post('/chat', aiLimiter, chat);

export default router;
