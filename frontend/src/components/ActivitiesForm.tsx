import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { activitiesApi } from '../services/api';
import { Activity } from '../types';
import { format } from 'date-fns';

function ActivitiesForm() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    activity_type: '',
    duration_minutes: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const activityTypes = [
    'Exercise',
    'Gym',
    'Running',
    'Cycling',
    'Swimming',
    'Walking',
    'Sports',
    'Yoga',
    'Strength Training',
    'Cardio',
    'Other',
  ];

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await activitiesApi.getAll();
      setActivities(response.data);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await activitiesApi.create({
        date: formData.date,
        activity_type: formData.activity_type,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : undefined,
        notes: formData.notes || undefined,
      });

      setFormData({
        date: new Date().toISOString().split('T')[0],
        activity_type: '',
        duration_minutes: '',
        notes: '',
      });

      await loadActivities();
    } catch (error) {
      console.error('Error creating activity:', error);
      alert('Failed to save activity entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await activitiesApi.delete(id);
      await loadActivities();
    } catch (error) {
      console.error('Error deleting activity:', error);
      alert('Failed to delete entry');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Tracking</h2>
        <p className="text-gray-600">Log your daily activities and exercise</p>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Activity</h3>
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
                Activity Type
              </label>
              <select
                value={formData.activity_type}
                onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select activity type...</option>
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="30"
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
              placeholder="Any additional details..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Activity
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
        {activities.length === 0 ? (
          <p className="text-gray-600">No activities yet. Add your first activity above!</p>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {format(new Date(activity.date), 'MMM dd, yyyy')} - {activity.activity_type}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {activity.duration_minutes && (
                      <span>Duration: {activity.duration_minutes} minutes</span>
                    )}
                  </div>
                  {activity.notes && (
                    <div className="text-sm text-gray-500 mt-1">{activity.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(activity.id)}
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

export default ActivitiesForm;
