-- Customer Feedback Analyzer Database Schema
-- This script initializes the database with all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Feedback table for storing ingested data
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  content TEXT NOT NULL,
  author_username VARCHAR(255),
  author_follower_count INTEGER,
  author_verified BOOLEAN,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  posted_at TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Analysis table for NLP results
CREATE TABLE analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  sentiment VARCHAR(20) NOT NULL,
  sentiment_confidence DECIMAL(3,2),
  emotions JSONB,
  virality_score INTEGER,
  virality_factors JSONB,
  risk_level VARCHAR(20),
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Responses table for AI-generated responses
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  drafts JSONB NOT NULL,
  selected_draft TEXT,
  sent_at TIMESTAMP,
  sent_to VARCHAR(255),
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table for tracking notifications
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  sent_slack BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_feedback_platform ON feedback(platform);
CREATE INDEX idx_feedback_ingested_at ON feedback(ingested_at);
CREATE INDEX idx_feedback_posted_at ON feedback(posted_at);
CREATE INDEX idx_analysis_feedback_id ON analysis(feedback_id);
CREATE INDEX idx_analysis_sentiment ON analysis(sentiment);
CREATE INDEX idx_analysis_risk_level ON analysis(risk_level);
CREATE INDEX idx_analysis_processed_at ON analysis(processed_at);
CREATE INDEX idx_responses_feedback_id ON responses(feedback_id);
CREATE INDEX idx_responses_status ON responses(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Insert sample data for development
INSERT INTO users (email, password_hash, email_verified) VALUES 
('admin@example.com', '$2a$10$example.hash.for.development', true),
('demo@example.com', '$2a$10$example.hash.for.development', true);

-- Insert sample feedback data
INSERT INTO feedback (platform, external_id, content, author_username, author_follower_count, author_verified, likes, shares, comments, posted_at, metadata) VALUES 
('twitter', 'tweet_123', 'Absolutely love this product! Best purchase I''ve made this year. #amazing', 'happy_customer', 1500, false, 25, 8, 3, NOW() - INTERVAL '2 hours', '{"location": "US", "hashtags": ["amazing"]}'),
('reddit', 'post_456', 'This service is terrible. Waited 3 hours for support and got nowhere. Very frustrated!', 'angry_user', 50, false, 2, 0, 15, NOW() - INTERVAL '1 hour', '{"subreddit": "CustomerService", "upvotes": 2, "downvotes": 8}'),
('trustpilot', 'review_789', 'Mixed feelings about this. Good quality but overpriced. Customer service could be better.', 'neutral_reviewer', 0, false, 5, 1, 2, NOW() - INTERVAL '30 minutes', '{"rating": 3, "verified_purchase": true}'),
('appstore', 'review_101', 'App keeps crashing! This is unacceptable. Fix your bugs!', 'frustrated_dev', 0, false, 0, 0, 0, NOW() - INTERVAL '15 minutes', '{"app_version": "2.1.0", "device": "iPhone", "rating": 1}');

-- Insert corresponding analysis data
INSERT INTO analysis (feedback_id, sentiment, sentiment_confidence, emotions, virality_score, virality_factors, risk_level) VALUES 
((SELECT id FROM feedback WHERE external_id = 'tweet_123'), 'positive', 0.95, '[{"emotion": "joy", "confidence": 0.92}, {"emotion": "satisfaction", "confidence": 0.88}]', 25, '{"toneSeverity": 0.1, "engagementVelocity": 0.3, "userInfluence": 0.4}', 'low'),
((SELECT id FROM feedback WHERE external_id = 'post_456'), 'negative', 0.89, '[{"emotion": "anger", "confidence": 0.91}, {"emotion": "frustration", "confidence": 0.85}]', 75, '{"toneSeverity": 0.9, "engagementVelocity": 0.6, "userInfluence": 0.2}', 'high'),
((SELECT id FROM feedback WHERE external_id = 'review_789'), 'neutral', 0.72, '[{"emotion": "confusion", "confidence": 0.65}, {"emotion": "disappointment", "confidence": 0.58}]', 35, '{"toneSeverity": 0.4, "engagementVelocity": 0.2, "userInfluence": 0.1}', 'medium'),
((SELECT id FROM feedback WHERE external_id = 'review_101'), 'negative', 0.93, '[{"emotion": "anger", "confidence": 0.89}, {"emotion": "frustration", "confidence": 0.94}]', 45, '{"toneSeverity": 0.8, "engagementVelocity": 0.1, "userInfluence": 0.1}', 'medium');

-- Insert sample response drafts
INSERT INTO responses (feedback_id, drafts, status) VALUES 
((SELECT id FROM feedback WHERE external_id = 'tweet_123'), '[{"content": "Thank you so much for your wonderful feedback! We''re thrilled to hear you love the product. Your satisfaction means the world to us! 🙏", "tone": "grateful", "confidence": 0.92}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'post_456'), '[{"content": "We sincerely apologize for the poor experience with our support team. This is not the standard we strive for. Please DM us your ticket number so we can resolve this immediately.", "tone": "apologetic", "confidence": 0.88}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'review_789'), '[{"content": "Thank you for your honest feedback. We appreciate you taking the time to share your experience. We''re always working to improve our value proposition and service quality.", "tone": "understanding", "confidence": 0.85}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'review_101'), '[{"content": "We''re sorry to hear about the app crashes you''re experiencing. Our development team is actively working on stability improvements. Please update to the latest version and contact support if issues persist.", "tone": "helpful", "confidence": 0.87}]', 'draft');

-- Insert sample alerts
INSERT INTO alerts (feedback_id, severity, message, sent_slack, sent_email) VALUES 
((SELECT id FROM feedback WHERE external_id = 'post_456'), 'high', 'High-risk negative feedback detected on Reddit with potential for viral spread', true, true),
((SELECT id FROM feedback WHERE external_id = 'review_101'), 'medium', 'App crash complaints increasing - technical issue alert', false, true);