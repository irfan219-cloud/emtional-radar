const express = require('express');
const app = express();
const PORT = 3001;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());

// Simple mock data
const mockData = {
  stats: {
    totalFeedback: 1234,
    sentimentScore: "8.2",
    highRiskAlerts: 3,
    responseRate: 89,
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
};

// Routes
app.get('/api/dashboard/overview', (req, res) => {
  console.log('Dashboard requested');
  res.json({ success: true, data: mockData });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: PORT });
});

app.listen(PORT, () => {
  console.log(`✅ Simple Backend Running on http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📊 API: http://localhost:${PORT}/api/dashboard/overview`);
});