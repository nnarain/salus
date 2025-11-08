import axios from 'axios';
import { Biometric, Activity, Meal, CalorieStats, MealieRecipe, ChatMessage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Biometrics API
export const biometricsApi = {
  getAll: (startDate?: string, endDate?: string) =>
    api.get<Biometric[]>('/biometrics', { params: { startDate, endDate } }),
  create: (data: Partial<Biometric>) => api.post<Biometric>('/biometrics', data),
  update: (id: number, data: Partial<Biometric>) =>
    api.put<Biometric>(`/biometrics/${id}`, data),
  delete: (id: number) => api.delete(`/biometrics/${id}`),
};

// Activities API
export const activitiesApi = {
  getAll: (startDate?: string, endDate?: string) =>
    api.get<Activity[]>('/activities', { params: { startDate, endDate } }),
  create: (data: Partial<Activity>) => api.post<Activity>('/activities', data),
  update: (id: number, data: Partial<Activity>) =>
    api.put<Activity>(`/activities/${id}`, data),
  delete: (id: number) => api.delete(`/activities/${id}`),
};

// Meals API
export const mealsApi = {
  getAll: (startDate?: string, endDate?: string) =>
    api.get<Meal[]>('/meals', { params: { startDate, endDate } }),
  create: (data: Partial<Meal>) => api.post<Meal>('/meals', data),
  update: (id: number, data: Partial<Meal>) => api.put<Meal>(`/meals/${id}`, data),
  delete: (id: number) => api.delete(`/meals/${id}`),
  getStats: (startDate?: string, endDate?: string) =>
    api.get<CalorieStats[]>('/meals/stats', { params: { startDate, endDate } }),
};

// Mealie API
export const mealieApi = {
  getRecipes: (page = 1, perPage = 10) =>
    api.get<MealieRecipe[]>('/mealie', { params: { page, perPage } }),
  getRecipe: (id: string) => api.get<MealieRecipe>(`/mealie/${id}`),
  searchRecipes: (query: string) =>
    api.get<MealieRecipe[]>('/mealie/search', { params: { q: query } }),
};

// AI API
export const aiApi = {
  suggestMealPlan: (preferences: string) =>
    api.post<{ mealPlan: string }>('/ai/meal-plan', { preferences }),
  chat: (messages: ChatMessage[]) =>
    api.post<{ response: string }>('/ai/chat', { messages }),
};
