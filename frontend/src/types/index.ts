export interface Biometric {
  id: number;
  date: string;
  weight?: number;
  bmi?: number;
  body_fat_percentage?: number;
  muscle_mass?: number;
  notes?: string;
  created_at: string;
}

export interface Activity {
  id: number;
  date: string;
  activity_type: string;
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface Meal {
  id: number;
  date: string;
  meal_type: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
  mealie_recipe_id?: string;
  created_at: string;
}

export interface CalorieStats {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export interface MealieRecipe {
  id: string;
  name: string;
  description?: string;
  image?: string;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
