import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export class AIService {
  async suggestMealPlan(userProfile: any, preferences: string) {
    try {
      const prompt = `You are a helpful nutrition assistant. Based on the following user profile and preferences, suggest a meal plan.

User Profile:
${JSON.stringify(userProfile, null, 2)}

User Preferences/Requirements:
${preferences}

Please provide a detailed meal plan with recipe suggestions, including nutritional information when possible. Format the response in a clear, easy-to-read manner.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful nutrition and meal planning assistant. Provide practical, healthy meal suggestions based on user needs.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating meal plan:', error);
      throw error;
    }
  }

  async chatWithAI(messages: any[]) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful nutrition and meal planning assistant. Help users with recipe suggestions, meal planning, and nutritional advice.',
          },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error in AI chat:', error);
      throw error;
    }
  }
}
