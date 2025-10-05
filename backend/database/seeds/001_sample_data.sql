-- Seed Data: Sample feedback and analysis data for development
-- Created: 2024-01-01
-- Description: Insert sample data for testing and development

-- Insert sample users
INSERT INTO users (email, password_hash, email_verified) VALUES 
('admin@example.com', '$2a$10$example.hash.for.development', true),
('demo@example.com', '$2a$10$example.hash.for.development', true)
ON CONFLICT (email) DO NOTHING;

-- Insert sample feedback data
INSERT INTO feedback (platform, external_id, content, author_username, author_follower_count, author_verified, likes, shares, comments, posted_at, metadata) VALUES 
('twitter', 'tweet_123', 'Absolutely love this product! Best purchase I''ve made this year. #amazing', 'happy_customer', 1500, false, 25, 8, 3, NOW() - INTERVAL '2 hours', '{"location": "US", "hashtags": ["amazing"]}'),
('reddit', 'post_456', 'This service is terrible. Waited 3 hours for support and got nowhere. Very frustrated!', 'angry_user', 50, false, 2, 0, 15, NOW() - INTERVAL '1 hour', '{"subreddit": "CustomerService", "upvotes": 2, "downvotes": 8}'),
('trustpilot', 'review_789', 'Mixed feelings about this. Good quality but overpriced. Customer service could be better.', 'neutral_reviewer', 0, false, 5, 1, 2, NOW() - INTERVAL '30 minutes', '{"rating": 3, "verified_purchase": true}'),
('appstore', 'review_101', 'App keeps crashing! This is unacceptable. Fix your bugs!', 'frustrated_dev', 0, false, 0, 0, 0, NOW() - INTERVAL '15 minutes', '{"app_version": "2.1.0", "device": "iPhone", "rating": 1}'),
('twitter', 'tweet_202', 'Customer service was amazing! They resolved my issue in minutes. Highly recommend! 👏', 'satisfied_user', 800, true, 45, 12, 8, NOW() - INTERVAL '45 minutes', '{"location": "UK", "hashtags": ["customerservice", "recommend"]}'),
('reddit', 'post_303', 'Been using this for months now. Solid product, no complaints. Does what it says.', 'regular_user', 120, false, 15, 3, 5, NOW() - INTERVAL '3 hours', '{"subreddit": "ProductReviews", "upvotes": 15, "downvotes": 2}'),
('trustpilot', 'review_404', 'WORST EXPERIENCE EVER! Money wasted. Avoid at all costs!!!', 'very_angry_customer', 0, false, 0, 0, 25, NOW() - INTERVAL '20 minutes', '{"rating": 1, "verified_purchase": true}'),
('appstore', 'review_505', 'Great app! Love the new features. Keep up the good work developers!', 'app_lover', 0, false, 8, 2, 1, NOW() - INTERVAL '1 hour', '{"app_version": "2.1.0", "device": "Android", "rating": 5}')
ON CONFLICT (external_id) DO NOTHING;

-- Insert corresponding analysis data
INSERT INTO analysis (feedback_id, sentiment, sentiment_confidence, emotions, virality_score, virality_factors, risk_level) VALUES 
((SELECT id FROM feedback WHERE external_id = 'tweet_123'), 'positive', 0.95, '[{"emotion": "joy", "confidence": 0.92}, {"emotion": "satisfaction", "confidence": 0.88}]', 25, '{"toneSeverity": 0.1, "engagementVelocity": 0.3, "userInfluence": 0.4}', 'low'),
((SELECT id FROM feedback WHERE external_id = 'post_456'), 'negative', 0.89, '[{"emotion": "anger", "confidence": 0.91}, {"emotion": "frustration", "confidence": 0.85}]', 75, '{"toneSeverity": 0.9, "engagementVelocity": 0.6, "userInfluence": 0.2}', 'high'),
((SELECT id FROM feedback WHERE external_id = 'review_789'), 'neutral', 0.72, '[{"emotion": "confusion", "confidence": 0.65}, {"emotion": "disappointment", "confidence": 0.58}]', 35, '{"toneSeverity": 0.4, "engagementVelocity": 0.2, "userInfluence": 0.1}', 'medium'),
((SELECT id FROM feedback WHERE external_id = 'review_101'), 'negative', 0.93, '[{"emotion": "anger", "confidence": 0.89}, {"emotion": "frustration", "confidence": 0.94}]', 45, '{"toneSeverity": 0.8, "engagementVelocity": 0.1, "userInfluence": 0.1}', 'medium'),
((SELECT id FROM feedback WHERE external_id = 'tweet_202'), 'positive', 0.97, '[{"emotion": "joy", "confidence": 0.95}, {"emotion": "gratitude", "confidence": 0.89}]', 40, '{"toneSeverity": 0.05, "engagementVelocity": 0.5, "userInfluence": 0.6}', 'low'),
((SELECT id FROM feedback WHERE external_id = 'post_303'), 'positive', 0.78, '[{"emotion": "satisfaction", "confidence": 0.82}, {"emotion": "trust", "confidence": 0.75}]', 20, '{"toneSeverity": 0.2, "engagementVelocity": 0.2, "userInfluence": 0.3}', 'low'),
((SELECT id FROM feedback WHERE external_id = 'review_404'), 'negative', 0.98, '[{"emotion": "anger", "confidence": 0.97}, {"emotion": "betrayal", "confidence": 0.85}, {"emotion": "frustration", "confidence": 0.92}]', 85, '{"toneSeverity": 0.95, "engagementVelocity": 0.7, "userInfluence": 0.1}', 'viral-threat'),
((SELECT id FROM feedback WHERE external_id = 'review_505'), 'positive', 0.91, '[{"emotion": "joy", "confidence": 0.88}, {"emotion": "appreciation", "confidence": 0.85}]', 15, '{"toneSeverity": 0.1, "engagementVelocity": 0.1, "userInfluence": 0.1}', 'low')
ON CONFLICT DO NOTHING;

-- Insert sample response drafts
INSERT INTO responses (feedback_id, drafts, status) VALUES 
((SELECT id FROM feedback WHERE external_id = 'tweet_123'), '[{"content": "Thank you so much for your wonderful feedback! We''re thrilled to hear you love the product. Your satisfaction means the world to us! 🙏", "tone": "grateful", "confidence": 0.92}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'post_456'), '[{"content": "We sincerely apologize for the poor experience with our support team. This is not the standard we strive for. Please DM us your ticket number so we can resolve this immediately.", "tone": "apologetic", "confidence": 0.88}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'review_789'), '[{"content": "Thank you for your honest feedback. We appreciate you taking the time to share your experience. We''re always working to improve our value proposition and service quality.", "tone": "understanding", "confidence": 0.85}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'review_101'), '[{"content": "We''re sorry to hear about the app crashes you''re experiencing. Our development team is actively working on stability improvements. Please update to the latest version and contact support if issues persist.", "tone": "helpful", "confidence": 0.87}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'tweet_202'), '[{"content": "We''re so happy to hear about your positive experience with our customer service team! Thank you for taking the time to share this feedback. 😊", "tone": "appreciative", "confidence": 0.94}]', 'draft'),
((SELECT id FROM feedback WHERE external_id = 'review_404'), '[{"content": "We deeply apologize for this terrible experience. This is absolutely not acceptable and we want to make this right immediately. Please contact our executive support team at [email] with your order details so we can provide a full resolution.", "tone": "urgent_apologetic", "confidence": 0.91}]', 'draft')
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO alerts (feedback_id, severity, message, sent_slack, sent_email) VALUES 
((SELECT id FROM feedback WHERE external_id = 'post_456'), 'high', 'High-risk negative feedback detected on Reddit with potential for viral spread', true, true),
((SELECT id FROM feedback WHERE external_id = 'review_101'), 'medium', 'App crash complaints increasing - technical issue alert', false, true),
((SELECT id FROM feedback WHERE external_id = 'review_404'), 'viral-threat', 'URGENT: Extremely negative review with high virality potential detected on TrustPilot', true, true)
ON CONFLICT DO NOTHING;