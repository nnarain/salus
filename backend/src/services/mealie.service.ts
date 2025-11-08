import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MEALIE_BASE_URL = process.env.MEALIE_BASE_URL || 'http://mealie:9000';
const MEALIE_API_TOKEN = process.env.MEALIE_API_TOKEN || '';

export class MealieService {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = MEALIE_BASE_URL;
    this.apiToken = MEALIE_API_TOKEN;
  }

  async getRecipes(page: number = 1, perPage: number = 10) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/recipes`, {
        params: { page, perPage },
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recipes from Mealie:', error);
      throw error;
    }
  }

  async getRecipe(recipeId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/recipes/${recipeId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recipe from Mealie:', error);
      throw error;
    }
  }

  async searchRecipes(query: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/recipes`, {
        params: { search: query },
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching recipes in Mealie:', error);
      throw error;
    }
  }
}
