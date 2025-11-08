import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { pool } from '../config/database';

const aiService = new AIService();

export const suggestMealPlan = async (req: Request, res: Response) => {
  try {
    const { preferences } = req.body;

    // Get recent biometrics for user profile
    const biometricsResult = await pool.query(
      'SELECT * FROM biometrics ORDER BY date DESC LIMIT 1'
    );

    const userProfile = {
      latestBiometrics: biometricsResult.rows[0] || null,
    };

    const mealPlan = await aiService.suggestMealPlan(userProfile, preferences);
    res.json({ mealPlan });
  } catch (error) {
    console.error('Error generating meal plan:', error);
    res.status(500).json({ error: 'Failed to generate meal plan' });
  }
};

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await aiService.chatWithAI(messages);
    res.json({ response });
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
};
