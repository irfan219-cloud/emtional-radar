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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Customer Feedback Analyzer API'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📡 Dashboard API: http://localhost:${PORT}/api/dashboard/overview`);
});

module.exports = app;