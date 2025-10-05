// Clean server with port checking
const express = require('express');
const { exec } = require('child_process');

// Try different ports
const PORTS = [5002, 5003, 5004, 5005];
let currentPort = null;

const app = express();

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
app.use(express.json());

// Mock data
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
      message: 'Response sent successfully',
      description: 'Auto-response approved and sent',
      sentiment: 'positive',
      timestamp: new Date().toISOString()
    },
    {
      id: 3,
      message: 'High engagement detected',
      description: 'Reddit post gaining traction',
      sentiment: 'high-risk',
      timestamp: new Date().toISOString()
    }
  ]
});

// Routes
app.get('/api/dashboard/overview', (req, res) => {
  console.log('📊 Dashboard data requested');
  res.json({ 
    success: true, 
    data: mockData(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  console.log('🏥 Health check');
  res.json({ 
    status: 'OK', 
    port: currentPort,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'FeedbackAI Backend API',
    port: currentPort,
    endpoints: ['/health', '/api/dashboard/overview']
  });
});

// Function to try starting server on available port
function startServer(portIndex = 0) {
  if (portIndex >= PORTS.length) {
    console.error('❌ No available ports found');
    process.exit(1);
  }

  const port = PORTS[portIndex];
  
  const server = app.listen(port, () => {
    currentPort = port;
    console.log('🚀 FeedbackAI Backend Started!');
    console.log(`📡 Server: http://localhost:${port}`);
    console.log(`🏥 Health: http://localhost:${port}/health`);
    console.log(`📊 API: http://localhost:${port}/api/dashboard/overview`);
    console.log('✅ Ready for requests!');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} in use, trying next...`);
      startServer(portIndex + 1);
    } else {
      console.error('❌ Server error:', err);
    }
  });
}

// Kill processes on common ports first
console.log('🧹 Cleaning up ports...');
exec('taskkill /F /IM node.exe 2>nul', () => {
  setTimeout(() => {
    startServer();
  }, 1000);
});