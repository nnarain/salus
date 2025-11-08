import { useState } from 'react';
import { Activity, BarChart, MessageCircle, TrendingUp, Utensils } from 'lucide-react';
import Dashboard from './components/Dashboard';
import BiometricsForm from './components/BiometricsForm';
import ActivitiesForm from './components/ActivitiesForm';
import MealsForm from './components/MealsForm';
import AIChat from './components/AIChat';

type Tab = 'dashboard' | 'biometrics' | 'activities' | 'meals' | 'chat';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart },
    { id: 'biometrics' as Tab, label: 'Biometrics', icon: TrendingUp },
    { id: 'activities' as Tab, label: 'Activities', icon: Activity },
    { id: 'meals' as Tab, label: 'Meals', icon: Utensils },
    { id: 'chat' as Tab, label: 'AI Chat', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Health Tracker</h1>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'biometrics' && <BiometricsForm />}
        {activeTab === 'activities' && <ActivitiesForm />}
        {activeTab === 'meals' && <MealsForm />}
        {activeTab === 'chat' && <AIChat />}
      </main>
    </div>
  );
}

export default App;
