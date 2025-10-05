import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, X, Filter, Search, RefreshCw } from 'lucide-react';

interface Alert {
  id: string;
  feedbackId: string;
  content: string;
  platform: string;
  sentiment: string;
  emotions: Array<{ emotion: string; confidence: number }>;
  viralityScore: number;
  riskLevel: string;
  severity: 'mild' | 'risky' | 'viral-threat';
  timestamp: string;
  author: string;
  status: 'active' | 'handled' | 'dismissed';
}

interface AlertCenterProps {
  className?: string;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ className = '' }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    platform: 'all',
    status: 'active',
    search: ''
  });

  // Mock data for demonstration
  const mockAlerts: Alert[] = [
    {
      id: '1',
      feedbackId: 'fb-1',
      content: 'This app is absolutely terrible! It crashes every time I try to use it. Worst experience ever!',
      platform: 'twitter',
      sentiment: 'negative',
      emotions: [
        { emotion: 'anger', confidence: 0.92 },
        { emotion: 'frustration', confidence: 0.87 }
      ],
      viralityScore: 85,
      riskLevel: 'viral-threat',
      severity: 'viral-threat',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      author: '@angry_user123',
      status: 'active'
    },
    {
      id: '2',
      feedbackId: 'fb-2',
      content: 'Customer service is non-existent. Been waiting for 3 days for a response. This is unacceptable.',
      platform: 'trustpilot',
      sentiment: 'negative',
      emotions: [
        { emotion: 'frustration', confidence: 0.78 },
        { emotion: 'betrayal', confidence: 0.65 }
      ],
      viralityScore: 62,
      riskLevel: 'high',
      severity: 'risky',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      author: 'disappointed_customer',
      status: 'active'
    },
    {
      id: '3',
      feedbackId: 'fb-3',
      content: 'The new update broke everything. How did this pass quality testing?',
      platform: 'appstore',
      sentiment: 'negative',
      emotions: [
        { emotion: 'confusion', confidence: 0.71 },
        { emotion: 'frustration', confidence: 0.68 }
      ],
      viralityScore: 45,
      riskLevel: 'medium',
      severity: 'mild',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      author: 'tech_user_99',
      status: 'active'
    }
  ];

  useEffect(() => {
    fetchAlerts();
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, this would call your API
      // const response = await fetch('/api/analysis/alerts?' + new URLSearchParams(filters));
      // const data = await response.json();
      
      // For now, use mock data with filtering
      let filteredAlerts = mockAlerts;
      
      if (filters.severity !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
      }
      
      if (filters.platform !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.platform === filters.platform);
      }
      
      if (filters.status !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => alert.status === filters.status);
      }
      
      if (filters.search) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.content.toLowerCase().includes(filters.search.toLowerCase()) ||
          alert.author.toLowerCase().includes(filters.search.toLowerCase())
        );
      }
      
      setAlerts(filteredAlerts);
      setError(null);
    } catch (err) {
      setError('Failed to fetch alerts');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertAction = async (alertId: string, action: 'handle' | 'dismiss') => {
    try {
      // In a real implementation, this would call your API
      // await fetch(`/api/alerts/${alertId}/${action}`, { method: 'POST' });
      
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: action === 'handle' ? 'handled' : 'dismissed' }
          : alert
      ));
      
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error(`Error ${action}ing alert:`, err);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, string> = {
      'viral-threat': 'bg-red-500 text-white',
      'risky': 'bg-orange-500 text-white',
      'mild': 'bg-yellow-500 text-black'
    };
    
    const labels: Record<string, string> = {
      'viral-threat': 'Viral Threat',
      'risky': 'Risky',
      'mild': 'Mild'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[severity] || 'bg-gray-500 text-white'}`}>
        {labels[severity] || severity}
      </span>
    );
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: '🐦',
      reddit: '🔴',
      trustpilot: '⭐',
      appstore: '📱'
    };
    return icons[platform] || '📝';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className={`bg-secondary rounded-lg border border-primary ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-primary">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-primary flex items-center">
            <AlertTriangle className="mr-2 h-6 w-6" />
            Alert Management Center
          </h2>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-secondary" />
            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="input-field"
            >
              <option value="all">All Severities</option>
              <option value="viral-threat">Viral Threat</option>
              <option value="risky">Risky</option>
              <option value="mild">Mild</option>
            </select>
          </div>

          <select
            value={filters.platform}
            onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
            className="input-field"
          >
            <option value="all">All Platforms</option>
            <option value="twitter">Twitter</option>
            <option value="reddit">Reddit</option>
            <option value="trustpilot">TrustPilot</option>
            <option value="appstore">App Store</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="input-field"
          >
            <option value="active">Active</option>
            <option value="handled">Handled</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All Status</option>
          </select>

          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-secondary" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex">
        {/* Alert List */}
        <div className="flex-1 p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-4">
              <p className="text-red-400">⚠️ {error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-secondary mt-2">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-secondary mx-auto mb-4" />
              <p className="text-secondary">No alerts found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`card cursor-pointer transition-all hover:border-accent ${
                    selectedAlert?.id === alert.id ? 'border-accent bg-accent/10' : ''
                  }`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getPlatformIcon(alert.platform)}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          {getSeverityBadge(alert.severity)}
                          <span className="text-sm text-secondary">{alert.platform.toUpperCase()}</span>
                        </div>
                        <p className="text-sm text-secondary mt-1">
                          by {alert.author} • {formatTimeAgo(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-primary">
                        Virality: {alert.viralityScore}%
                      </div>
                      <div className="text-xs text-secondary">
                        {alert.sentiment.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <p className="text-primary mb-3 line-clamp-2">
                    {alert.content}
                  </p>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      {alert.emotions.slice(0, 2).map((emotion, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-tertiary rounded text-xs text-secondary"
                        >
                          {emotion.emotion} ({Math.round(emotion.confidence * 100)}%)
                        </span>
                      ))}
                    </div>
                    
                    {alert.status === 'active' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlertAction(alert.id, 'handle');
                          }}
                          className="btn-primary text-xs px-3 py-1"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Handle
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlertAction(alert.id, 'dismiss');
                          }}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert Detail Panel */}
        {selectedAlert && (
          <div className="w-96 border-l border-primary p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-primary">Alert Details</h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-secondary hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-secondary">Platform</label>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-lg">{getPlatformIcon(selectedAlert.platform)}</span>
                  <span className="text-primary">{selectedAlert.platform.toUpperCase()}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Severity</label>
                <div className="mt-1">
                  {getSeverityBadge(selectedAlert.severity)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Content</label>
                <p className="text-primary mt-1 p-3 bg-tertiary rounded">
                  {selectedAlert.content}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Author</label>
                <p className="text-primary mt-1">{selectedAlert.author}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Sentiment Analysis</label>
                <div className="mt-1 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-primary">Sentiment:</span>
                    <span className={`font-medium ${
                      selectedAlert.sentiment === 'positive' ? 'text-green-400' :
                      selectedAlert.sentiment === 'negative' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {selectedAlert.sentiment.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-primary">Virality Score:</span>
                    <span className="font-medium text-primary">{selectedAlert.viralityScore}%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Detected Emotions</label>
                <div className="mt-1 space-y-2">
                  {selectedAlert.emotions.map((emotion, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-primary capitalize">{emotion.emotion}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-tertiary rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full"
                            style={{ width: `${emotion.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-secondary w-8">
                          {Math.round(emotion.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-secondary">Timestamp</label>
                <p className="text-primary mt-1">
                  {new Date(selectedAlert.timestamp).toLocaleString()}
                </p>
              </div>

              {selectedAlert.status === 'active' && (
                <div className="pt-4 border-t border-primary space-y-2">
                  <button
                    onClick={() => handleAlertAction(selectedAlert.id, 'handle')}
                    className="btn-primary w-full flex items-center justify-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Handled
                  </button>
                  <button
                    onClick={() => handleAlertAction(selectedAlert.id, 'dismiss')}
                    className="btn-secondary w-full flex items-center justify-center"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dismiss Alert
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertCenter;