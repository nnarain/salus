import { Router } from 'express';
import { getRecipes, getRecipe, searchRecipes } from '../controllers/mealie.controller';

const router = Router();

router.get('/', getRecipes);
router.get('/search', searchRecipes);
router.get('/:id', getRecipe);

export default router;
