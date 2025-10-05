-- Migration: Initial Schema
-- Created: 2024-01-01
-- Description: Create initial database schema for Customer Feedback Analyzer

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Feedback table for storing ingested data
CREATE TABLE IF NOT EXISTS feedback (
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
CREATE TABLE IF NOT EXISTS analysis (
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
CREATE TABLE IF NOT EXISTS responses (
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
CREATE TABLE IF NOT EXISTS alerts (
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
CREATE INDEX IF NOT EXISTS idx_feedback_platform ON feedback(platform);
CREATE INDEX IF NOT EXISTS idx_feedback_ingested_at ON feedback(ingested_at);
CREATE INDEX IF NOT EXISTS idx_feedback_posted_at ON feedback(posted_at);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback_id ON analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sentiment ON analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_analysis_risk_level ON analysis(risk_level);
CREATE INDEX IF NOT EXISTS idx_analysis_processed_at ON analysis(processed_at);
CREATE INDEX IF NOT EXISTS idx_responses_feedback_id ON responses(feedback_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);