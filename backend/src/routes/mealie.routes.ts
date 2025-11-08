import { Router } from 'express';
import { getRecipes, getRecipe, searchRecipes } from '../controllers/mealie.controller';
import { standardLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/', standardLimiter, getRecipes);
router.get('/search', standardLimiter, searchRecipes);
router.get('/:id', standardLimiter, getRecipe);

export default router;
