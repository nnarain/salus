import { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { mealsApi, mealieApi } from '../services/api';
import { Meal } from '../types';
import { format } from 'date-fns';

function MealsForm() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    meal_type: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    notes: '',
    mealie_recipe_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'];

  useEffect(() => {
    loadMeals();
  }, []);

  const loadMeals = async () => {
    try {
      const response = await mealsApi.getAll();
      setMeals(response.data);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const handleSearchRecipes = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await mealieApi.searchRecipes(searchQuery);
      setSearchResults(response.data);
      setShowSearch(true);
    } catch (error) {
      console.error('Error searching recipes:', error);
      alert('Failed to search recipes. Make sure Mealie is configured.');
    }
  };

  const selectRecipe = (recipe: any) => {
    setFormData({
      ...formData,
      notes: recipe.name,
      calories: recipe.nutrition?.calories?.toString() || '',
      protein: recipe.nutrition?.protein?.toString() || '',
      carbs: recipe.nutrition?.carbohydrates?.toString() || '',
      fat: recipe.nutrition?.fat?.toString() || '',
      mealie_recipe_id: recipe.id,
    });
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await mealsApi.create({
        date: formData.date,
        meal_type: formData.meal_type,
        calories: formData.calories ? parseInt(formData.calories) : undefined,
        protein: formData.protein ? parseFloat(formData.protein) : undefined,
        carbs: formData.carbs ? parseFloat(formData.carbs) : undefined,
        fat: formData.fat ? parseFloat(formData.fat) : undefined,
        notes: formData.notes || undefined,
        mealie_recipe_id: formData.mealie_recipe_id || undefined,
      });

      setFormData({
        date: new Date().toISOString().split('T')[0],
        meal_type: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        notes: '',
        mealie_recipe_id: '',
      });

      await loadMeals();
    } catch (error) {
      console.error('Error creating meal:', error);
      alert('Failed to save meal entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await mealsApi.delete(id);
      await loadMeals();
    } catch (error) {
      console.error('Error deleting meal:', error);
      alert('Failed to delete entry');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Meal Tracking</h2>
        <p className="text-gray-600">Log your meals and track calorie intake</p>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Meal</h3>

        {/* Recipe Search */}
        <div className="mb-4 p-4 bg-blue-50 rounded-md">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchRecipes()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search recipes from Mealie..."
            />
            <button
              type="button"
              onClick={handleSearchRecipes}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Search className="h-5 w-5" />
              Search
            </button>
          </div>

          {showSearch && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-gray-600">No recipes found</p>
              ) : (
                searchResults.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => selectRecipe(recipe)}
                    className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-white"
                  >
                    <div className="font-medium">{recipe.name}</div>
                    {recipe.description && (
                      <div className="text-sm text-gray-600 mt-1">{recipe.description}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meal Type
              </label>
              <select
                value={formData.meal_type}
                onChange={(e) => setFormData({ ...formData, meal_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select meal type...</option>
                {mealTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calories
              </label>
              <input
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.protein}
                onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.carbs}
                onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fat (g)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.fat}
                onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="15"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Recipe Name
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Grilled chicken with vegetables..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Meal
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Meals</h3>
        {meals.length === 0 ? (
          <p className="text-gray-600">No meals yet. Add your first meal above!</p>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {format(new Date(meal.date), 'MMM dd, yyyy')} - {meal.meal_type}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 space-x-4">
                    {meal.calories && <span>Calories: {meal.calories}</span>}
                    {meal.protein && <span>Protein: {meal.protein}g</span>}
                    {meal.carbs && <span>Carbs: {meal.carbs}g</span>}
                    {meal.fat && <span>Fat: {meal.fat}g</span>}
                  </div>
                  {meal.notes && (
                    <div className="text-sm text-gray-500 mt-1">{meal.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(meal.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MealsForm;
