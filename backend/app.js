const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Mock data generator
const generateMockData = () => {
  const now = new Date();
  
  return {
    stats: {
      totalFeedback: Math.floor(Math.random() * 1000) + 1000,
      sentimentScore: (Math.random() * 3 + 7).toFixed(1),
      highRiskAlerts: Math.floor(Math.random() * 10),
      responseRate: Math.floor(Math.random() * 20 + 80),
    },
    recentActivity: [
      {
        id: 1,
        type: 'feedback',
        message: 'New feedback from Twitter',
        description: 'Negative sentiment detected',
        sentiment: 'negative',
        timestamp: new Date(now.getTime() - Math.random() * 3600000).toISOString()
      },
      {
        id: 2,
        type: 'response',
        message: 'Response sent to customer',
        description: 'Auto-generated response approved',
        sentiment: 'positive',
        timestamp: new Date(now.getTime() - Math.random() * 7200000).toISOString()
      },
      {
        id: 3,
        type: 'alert',
        message: 'High virality alert',
        description: 'Reddit post gaining traction',
        sentiment: 'high-risk',
        timestamp: new Date(now.getTime() - Math.random() * 10800000).toISOString()
      },
      {
        id: 4,
        type: 'feedback',
        message: 'Positive review on App Store',
        description: 'Customer praised new features',
        sentiment: 'positive',
        timestamp: new Date(now.getTime() - Math.random() * 14400000).toISOString()
      }
    ]
  };
};

// Routes
app.get('/api/dashboard/overview', (req, res) => {
  console.log('📊 Dashboard overview requested');
  try {
    const data = generateMockData();
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

app.get('/api/dashboard/stats', (req, res) => {
  console.log('📈 Stats requested');
  try {
    const stats = generateMockData().stats;
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'FeedbackAI API',
    version: '1.0.0',
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'FeedbackAI Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      dashboard: '/api/dashboard/overview',
      stats: '/api/dashboard/stats'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 FeedbackAI Backend Server Started!');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard/overview`);
  console.log('✅ Backend is ready to serve requests!');
});

module.exports = app;