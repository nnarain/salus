import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { biometricsApi } from '../services/api';
import { Biometric } from '../types';
import { format } from 'date-fns';

function BiometricsForm() {
  const [biometrics, setBiometrics] = useState<Biometric[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: '',
    bmi: '',
    body_fat_percentage: '',
    muscle_mass: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBiometrics();
  }, []);

  const loadBiometrics = async () => {
    try {
      const response = await biometricsApi.getAll();
      setBiometrics(response.data);
    } catch (error) {
      console.error('Error loading biometrics:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await biometricsApi.create({
        date: formData.date,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        bmi: formData.bmi ? parseFloat(formData.bmi) : undefined,
        body_fat_percentage: formData.body_fat_percentage
          ? parseFloat(formData.body_fat_percentage)
          : undefined,
        muscle_mass: formData.muscle_mass ? parseFloat(formData.muscle_mass) : undefined,
        notes: formData.notes || undefined,
      });

      setFormData({
        date: new Date().toISOString().split('T')[0],
        weight: '',
        bmi: '',
        body_fat_percentage: '',
        muscle_mass: '',
        notes: '',
      });

      await loadBiometrics();
    } catch (error) {
      console.error('Error creating biometric:', error);
      alert('Failed to save biometric entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await biometricsApi.delete(id);
      await loadBiometrics();
    } catch (error) {
      console.error('Error deleting biometric:', error);
      alert('Failed to delete entry');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Biometrics Tracking</h2>
        <p className="text-gray-600">Track your weight, BMI, and body composition</p>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Entry</h3>
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
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="70.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BMI
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.bmi}
                onChange={(e) => setFormData({ ...formData, bmi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="22.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body Fat %
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.body_fat_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, body_fat_percentage: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="15.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Muscle Mass (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.muscle_mass}
                onChange={(e) => setFormData({ ...formData, muscle_mass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="30.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Any additional notes..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Entry
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Entries</h3>
        {biometrics.length === 0 ? (
          <p className="text-gray-600">No entries yet. Add your first biometric entry above!</p>
        ) : (
          <div className="space-y-2">
            {biometrics.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {format(new Date(entry.date), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 space-x-4">
                    {entry.weight && <span>Weight: {entry.weight} kg</span>}
                    {entry.bmi && <span>BMI: {entry.bmi}</span>}
                    {entry.body_fat_percentage && (
                      <span>Body Fat: {entry.body_fat_percentage}%</span>
                    )}
                    {entry.muscle_mass && <span>Muscle: {entry.muscle_mass} kg</span>}
                  </div>
                  {entry.notes && (
                    <div className="text-sm text-gray-500 mt-1">{entry.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
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

export default BiometricsForm;
