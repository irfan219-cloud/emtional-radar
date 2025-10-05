# Customer Feedback Analyzer

A comprehensive system for analyzing customer feedback from multiple social media platforms and review sites with real-time sentiment analysis, virality prediction, and AI-powered response generation.

## Features

- **Multi-Platform Data Ingestion**: Collect feedback from Twitter/X, Reddit, TrustPilot, and App Store reviews
- **NLP Analysis**: Real-time sentiment and emotion detection using advanced machine learning models
- **Virality Prediction**: AI-powered scoring to identify potentially viral content
- **AI Response Generation**: Automated response drafts following company tone guidelines
- **Real-Time Dashboard**: Live monitoring with WebSocket connections
- **Alert System**: Instant notifications via Slack and email for high-risk feedback
- **Interactive Visualizations**: Emotion heatmaps and trend analysis
- **User Authentication**: Secure login with email/password and Google OAuth

## Tech Stack

### Backend
- Node.js with Express.js and TypeScript
- PostgreSQL for data storage
- Redis for caching and real-time data
- Socket.io for WebSocket connections
- Bull Queue for background job processing

### Frontend
- React 18 with Next.js and TypeScript
- Tailwind CSS for styling
- Chart.js for data visualization
- Socket.io-client for real-time updates

### Infrastructure
- Docker containers for development
- nginx for reverse proxy
- PM2 for process management

## Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd customer-feedback-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

4. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Or run locally**
   ```bash
   # Start database services
   docker-compose up postgres redis -d
   
   # Start development servers
   npm run dev
   ```

### Access the Application

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health

## Project Structure

```
customer-feedback-analyzer/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── server.ts       # Main server file
│   ├── database/           # Database migrations and seeds
│   └── package.json
├── frontend/               # React dashboard
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Next.js pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   └── styles/         # CSS styles
│   └── package.json
├── docker-compose.yml      # Docker services
└── package.json           # Root package.json
```

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only

# Building
npm run build           # Build both applications
npm run start           # Start production servers

# Testing
npm run test            # Run all tests
npm run lint            # Run linting
```

### Environment Variables

Key environment variables for the backend:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/feedback_analyzer
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External APIs
TWITTER_BEARER_TOKEN=your-twitter-token
REDDIT_CLIENT_ID=your-reddit-client-id
OPENAI_API_KEY=your-openai-key

# Notifications
SLACK_WEBHOOK_URL=your-slack-webhook
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
```

## API Documentation

### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/google` - Google OAuth login
- `GET /auth/verify-email/:token` - Email verification

### Analysis Endpoints
- `POST /analyzeFeedback` - Analyze feedback text
- `GET /alerts` - Get high-severity alerts
- `GET /heatmapData` - Get emotion heatmap data

### WebSocket Events
- `join-dashboard` - Join real-time dashboard
- `new-feedback` - New feedback received
- `analysis-complete` - Analysis completed
- `alert-triggered` - High-risk alert triggered

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please open an issue in the GitHub repository.