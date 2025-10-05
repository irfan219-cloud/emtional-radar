const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Mock data generators
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

const generateFeedbackList = () => {
  const platforms = ['twitter', 'reddit', 'appstore', 'trustpilot'];
  const sentiments = ['positive', 'negative', 'neutral'];
  const feedbacks = [];
  
  for (let i = 0; i < 20; i++) {
    feedbacks.push({
      id: i + 1,
      platform: platforms[Math.floor(Math.random() * platforms.length)],
      content: `Sample feedback content ${i + 1}`,
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
      score: (Math.random() * 10).toFixed(1),
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      author: `user${i + 1}`,
      engagement: {
        likes: Math.floor(Math.random() * 100),
        shares: Math.floor(Math.random() * 50),
        comments: Math.floor(Math.random() * 25)
      }
    });
  }
  
  return feedbacks;
};

// Routes
app.get('/api/dashboard/overview', (req, res) => {
  try {
    const data = generateMockData();
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

app.get('/api/dashboard/stats', (req, res) => {
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

app.get('/api/feedback', (req, res) => {
  try {
    const feedbacks = generateFeedbackList();
    res.json({
      success: true,
      data: feedbacks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback data'
    });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock authentication
  if (email && password) {
    res.json({
      success: true,
      data: {
        user: {
          id: 1,
          email: email,
          name: 'Demo User'
        },
        token: 'mock-jwt-token'
      }
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Email and password required'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'FeedbackAI API',
    version: '1.0.0'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FeedbackAI Server running on port ${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📡 Dashboard API: http://localhost:${PORT}/api/dashboard/overview`);
  console.log(`📝 Feedback API: http://localhost:${PORT}/api/feedback`);
});

module.exports = app;