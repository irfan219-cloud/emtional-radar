// Ultra-fast minimal server
const express = require('express');
const app = express();
const PORT = 5001;

// Minimal middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.use(express.json());

// Fast mock data
const mockData = () => ({
  stats: {
    totalFeedback: 1234 + Math.floor(Math.random() * 100),
    sentimentScore: (7.5 + Math.random()).toFixed(1),
    highRiskAlerts: Math.floor(Math.random() * 5),
    responseRate: 85 + Math.floor(Math.random() * 15),
  },
  recentActivity: [
    {
      id: 1,
      message: 'New Twitter feedback',
      description: 'Negative sentiment detected',
      sentiment: 'negative',
      timestamp: new Date().toISOString()
    },
    {
      id: 2,
      message: 'Response sent',
      description: 'Auto-response approved',
      sentiment: 'positive',
      timestamp: new Date().toISOString()
    }
  ]
});

// Fast routes
app.get('/api/dashboard/overview', (req, res) => {
  res.json({ success: true, data: mockData() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: PORT });
});

// Start fast
app.listen(PORT, () => {
  console.log(`🚀 Fast Server: http://localhost:${PORT}`);
});