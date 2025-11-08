import { Request, Response } from 'express';
import { pool } from '../config/database';

export const getMeals = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM meals';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ error: 'Failed to fetch meals' });
  }
};

export const createMeal = async (req: Request, res: Response) => {
  try {
    const { date, meal_type, calories, protein, carbs, fat, notes, mealie_recipe_id } = req.body;

    const result = await pool.query(
      `INSERT INTO meals (date, meal_type, calories, protein, carbs, fat, notes, mealie_recipe_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [date, meal_type, calories, protein, carbs, fat, notes, mealie_recipe_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating meal:', error);
    res.status(500).json({ error: 'Failed to create meal entry' });
  }
};

export const updateMeal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, meal_type, calories, protein, carbs, fat, notes, mealie_recipe_id } = req.body;

    const result = await pool.query(
      `UPDATE meals
       SET date = $1, meal_type = $2, calories = $3, protein = $4, carbs = $5, fat = $6, notes = $7, mealie_recipe_id = $8
       WHERE id = $9
       RETURNING *`,
      [date, meal_type, calories, protein, carbs, fat, notes, mealie_recipe_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating meal:', error);
    res.status(500).json({ error: 'Failed to update meal entry' });
  }
};

export const deleteMeal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM meals WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal entry not found' });
    }

    res.json({ message: 'Meal entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting meal:', error);
    res.status(500).json({ error: 'Failed to delete meal entry' });
  }
};

export const getCalorieStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        date,
        SUM(calories) as total_calories,
        SUM(protein) as total_protein,
        SUM(carbs) as total_carbs,
        SUM(fat) as total_fat
      FROM meals
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(startDate, endDate);
    }

    query += ' GROUP BY date ORDER BY date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calorie stats:', error);
    res.status(500).json({ error: 'Failed to fetch calorie statistics' });
  }
};
