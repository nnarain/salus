import { Request, Response } from 'express';
import { MealieService } from '../services/mealie.service';

const mealieService = new MealieService();

export const getRecipes = async (req: Request, res: Response) => {
  try {
    const { page = 1, perPage = 10 } = req.query;
    const recipes = await mealieService.getRecipes(Number(page), Number(perPage));
    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes from Mealie' });
  }
};

export const getRecipe = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate the recipe ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Valid recipe ID is required' });
    }
    
    const recipe = await mealieService.getRecipe(id);
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(404).json({ error: 'Recipe not found' });
  }
};

export const searchRecipes = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const recipes = await mealieService.searchRecipes(String(q));
    res.json(recipes);
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
};
