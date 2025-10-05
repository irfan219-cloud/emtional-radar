import React, { useState, useEffect } from 'react';

interface FeedbackItem {
  id: number;
  user: string;
  platform: string;
  message: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotion: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'escalated' | 'ignored';
}

const Dashboard: React.FC = () => {
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState({
    totalPosts: 5,
    positiveSentiment: 60,
    activeAlerts: 0,
    highPriority: 0
  });

  // Mock data for demonstration
  useEffect(() => {
    const mockFeedback: FeedbackItem[] = [
      {
        id: 1,
        user: 'Emily Rodriguez',
        platform: 'instagram',
        message: "Been a customer for years and they never disappoint. Keep up the great work!",
        sentiment: 'positive',
        confidence: 95,
        emotion: 'joy',
        timestamp: '12:04:07 PM',
        priority: 'low',
        status: 'pending'
      },
      {
        id: 2,
        user: 'Mike Johnson',
        platform: 'facebook',
        message: "Met my basic needs. Could be better but could also be worse. It's acceptable.",
        sentiment: 'neutral',
        confidence: 91,
        emotion: 'surprise',
        timestamp: '11:27:28 AM',
        priority: 'medium',
        status: 'pending'
      },
      {
        id: 3,
        user: 'Lisa Anderson',
        platform: 'facebook',
        message: "Absolutely loving this product! Best purchase I've made all year. The quality is outstanding and customer service was amazing!",
        sentiment: 'positive',
        confidence: 74,
        emotion: 'fear',
        timestamp: '12:00:32 PM',
        priority: 'low',
        status: 'approved'
      }
    ];
    setFeedbackData(mockFeedback);
  }, []);

  const handleAction = (id: number, action: 'approve' | 'escalate' | 'ignore') => {
    setFeedbackData(prev => prev.map(item => 
      item.id === id ? { ...item, status: action === 'approve' ? 'approved' : action === 'escalate' ? 'escalated' : 'ignored' } : item
    ));
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500';
      case 'neutral': return 'bg-blue-500';
      case 'negative': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">⚡</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Emotion Radar</h1>
            <div className="flex items-center space-x-2 px-3 py-1 bg-purple-100 rounded-full">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-purple-700">Live</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Real-time AI Sentiment Monitoring • Auto-refresh: 10s</p>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
                <p className="text-sm text-gray-600">Total Posts</p>
                <p className="text-xs text-gray-500">+9%</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.positiveSentiment}%</p>
                <p className="text-sm text-gray-600">Positive Sentiment</p>
                <p className="text-xs text-gray-500">3 posts</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600">📈</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.activeAlerts}</p>
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className="text-xs text-gray-500">0 critical</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600">⚠️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.highPriority}</p>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-xs text-gray-500">0% negative</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600">🎯</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Sentiment</span>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm">All Sentiments</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Positive</span>
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Neutral</span>
                  </button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Negative</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Platform</span>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm">All Platforms</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Twitter</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Instagram</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Facebook</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Reddit</button>
                  <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Reviews</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Live Feed and Heat Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Feedback Heat Map */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-purple-600">🔥</span>
                  <h2 className="text-lg font-semibold text-gray-900">Feedback Heat Map</h2>
                </div>
                <p className="text-sm text-gray-600">Visual representation of feedback distribution and intensity</p>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Active Points</span>
                    <span className="text-2xl font-bold text-gray-900">0</span>
                  </div>
                </div>
                
                {/* Heat Map Visualization */}
                <div className="relative bg-gray-50 rounded-lg h-48 flex items-center justify-center border-2 border-dashed border-gray-200">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-gray-500 text-sm">No active feedback points</p>
                    <p className="text-gray-400 text-xs mt-1">Heat map will appear when feedback is detected</p>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">Sentiment</div>
                  <div className="flex space-x-4">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Positive</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Neutral</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Negative</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Live Feed */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Live Feed</h2>
                <p className="text-sm text-gray-600">5 posts</p>
              </div>
              <div className="divide-y divide-gray-200">
                {feedbackData.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-medium text-sm">
                          {item.user.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">{item.user}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm text-gray-500">{item.platform}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm text-gray-500">{item.timestamp}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-gray-800 mb-3">{item.message}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <div className={`w-4 h-4 rounded-full ${getSentimentColor(item.sentiment)}`}></div>
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {item.sentiment} {item.confidence}%
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-gray-600">😊</span>
                              <span className="text-sm text-gray-600">{item.emotion}</span>
                            </div>
                          </div>
                          
                          {item.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleAction(item.id, 'approve')}
                                className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 flex items-center space-x-1"
                              >
                                <span>✓</span>
                                <span>Approve Reply</span>
                              </button>
                              <button 
                                onClick={() => handleAction(item.id, 'escalate')}
                                className="px-3 py-1 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700"
                              >
                                Escalate
                              </button>
                              <button 
                                onClick={() => handleAction(item.id, 'ignore')}
                                className="px-3 py-1 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
                              >
                                Ignore
                              </button>
                            </div>
                          )}
                          
                          {item.status !== 'pending' && (
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                              item.status === 'approved' ? 'bg-green-100 text-green-800' :
                              item.status === 'escalated' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              Status: {item.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Analytics */}
          <div className="space-y-6">
            {/* Virtual Analysis */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-purple-600">🧠</span>
                <h3 className="font-semibold text-gray-900">Virtual Analysis</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">AI-powered insights from user feedback patterns</p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Positive</span>
                  <span className="text-sm font-medium">0.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Neutral</span>
                  <span className="text-sm font-medium">0.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Negative</span>
                  <span className="text-sm font-medium">0.0%</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Feedback</span>
                  <span className="text-sm font-medium">Avg Rating</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-purple-600">0</span>
                  <span className="text-lg font-bold text-blue-600">0.0/5</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-yellow-500">⭐</span>
                  <span className="text-sm font-medium text-gray-900">Engagement Score</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">0</div>
                <p className="text-xs text-gray-500">Room for improvement</p>
                
                <div className="mt-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Analysis Response Time</span>
                    <span className="font-medium">0ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-red-600">⚠️</span>
                <h3 className="font-semibold text-gray-900">Alerts</h3>
              </div>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 text-2xl">✓</span>
                </div>
                <p className="text-gray-600">All clear! No active alerts</p>
              </div>
            </div>

            {/* Emotion Bubbles */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-blue-600">😊</span>
                <h3 className="font-semibold text-gray-900">Emotion Bubbles</h3>
              </div>
              <div className="flex justify-center items-center space-x-4 py-6">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-medium shadow-lg">
                  <div className="text-center">
                    <div className="text-xs">Fear</div>
                    <div className="text-lg font-bold">3</div>
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium shadow-lg">
                  <div className="text-center">
                    <div className="text-xs">Surprise</div>
                    <div className="font-bold">1</div>
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium shadow-lg">
                  <div className="text-center">
                    <div className="text-xs">Disgust</div>
                    <div className="font-bold">1</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sentiment Trends Chart */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-green-600">📈</span>
                <h3 className="font-semibold text-gray-900">Sentiment Trends</h3>
              </div>
              <div className="relative h-32">
                <svg className="w-full h-full" viewBox="0 0 300 120">
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="30" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 24" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Y-axis labels */}
                  <text x="10" y="20" className="text-xs fill-gray-400">1.5</text>
                  <text x="10" y="65" className="text-xs fill-gray-400">1</text>
                  <text x="10" y="110" className="text-xs fill-gray-400">0.5</text>
                  
                  {/* X-axis labels */}
                  <text x="30" y="115" className="text-xs fill-gray-400">11:00</text>
                  <text x="270" y="115" className="text-xs fill-gray-400">12:00</text>
                  
                  {/* Positive trend line (green, declining) */}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points="30,30 60,35 90,40 120,45 150,50 180,55 210,60 240,65 270,70"
                  />
                  <circle cx="30" cy="30" r="3" fill="#10b981" />
                  <circle cx="270" cy="70" r="3" fill="#10b981" />
                  
                  {/* Neutral trend line (blue, stable) */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points="30,80 60,80 90,81 120,80 150,81 180,80 210,81 240,80 270,80"
                  />
                  <circle cx="30" cy="80" r="3" fill="#3b82f6" />
                  <circle cx="270" cy="80" r="3" fill="#3b82f6" />
                  
                  {/* Negative trend line (red, stable low) */}
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    points="30,100 60,100 90,100 120,100 150,100 180,100 210,100 240,100 270,100"
                  />
                  <circle cx="30" cy="100" r="3" fill="#ef4444" />
                  <circle cx="270" cy="100" r="3" fill="#ef4444" />
                </svg>
              </div>
              
              {/* Legend */}
              <div className="flex justify-center space-x-4 mt-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">positive</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">neutral</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">negative</span>
                </div>
              </div>
            </div>

            {/* Submit Feedback */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-gray-600">📝</span>
                <h3 className="font-semibold text-gray-900">Submit Feedback</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">Share your thoughts and help us improve the experience</p>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Rating (optional)</label>
                <div className="flex space-x-1">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} className="text-gray-300 hover:text-yellow-400 text-xl">⭐</button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">Your Feedback</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-md text-sm"
                  rows={3}
                  placeholder="Tell us what you think..."
                ></textarea>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 flex items-center justify-center space-x-1">
                  <span>👍</span>
                  <span>Positive</span>
                </button>
                <button className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 flex items-center justify-center space-x-1">
                  <span>😐</span>
                  <span>Neutral</span>
                </button>
                <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex items-center justify-center space-x-1">
                  <span>👎</span>
                  <span>Negative</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;