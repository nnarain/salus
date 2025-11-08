import { useState } from 'react';
import { Send } from 'lucide-react';
import { aiApi } from '../services/api';
import { ChatMessage } from '../types';

function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiApi.chat([...messages, userMessage]);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response || 'Sorry, I could not generate a response.',
      };
      setMessages([...messages, userMessage, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Make sure the OpenAI API key is configured.',
      };
      setMessages([...messages, userMessage, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Meal Planning Assistant</h2>
        <p className="text-gray-600">
          Get personalized meal suggestions and nutrition advice
        </p>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col" style={{ height: '600px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-12">
              <p className="text-lg mb-2">👋 Hello! I'm your AI nutrition assistant.</p>
              <p className="text-sm">
                Ask me about meal planning, recipe suggestions, or nutritional advice!
              </p>
              <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-gray-700">Example questions:</p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Can you suggest a high-protein meal plan for weight loss?</li>
                  <li>What are some healthy breakfast ideas?</li>
                  <li>How can I increase my daily protein intake?</li>
                  <li>Suggest a vegetarian meal plan for the week</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about meal planning, recipes, or nutrition..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <Send className="h-5 w-5" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
