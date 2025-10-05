import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <>
      <Head>
        <title>Emotion Radar - Real-time AI Sentiment Monitoring</title>
        <meta name="description" content="Real-time AI sentiment monitoring and feedback analysis platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">⚡</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Emotion Radar</h1>
                <p className="text-sm text-gray-600">Real-time AI Sentiment Monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <button className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                  Sign In
                </button>
              </Link>
              <Link href="/dashboard">
                <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-6 py-16">
          <div className={`text-center transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            
            {/* Main Heading */}
            <div className="mb-8">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                  Live Monitoring Active
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                Real-time
                <span className="block text-purple-600">Emotion Radar</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Monitor customer sentiment across all platforms with AI-powered analysis. 
                Get instant alerts, track emotions, and respond to feedback in real-time.
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-purple-600 text-white rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors shadow-lg">
                  Start Monitoring
                </button>
              </Link>
              <button className="px-8 py-4 border border-gray-300 text-gray-700 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors">
                Watch Demo
              </button>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="text-3xl font-bold text-gray-900 mb-2">5</div>
                <div className="text-sm text-gray-600">Total Posts</div>
                <div className="text-xs text-green-600 mt-1">+9%</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="text-3xl font-bold text-gray-900 mb-2">60%</div>
                <div className="text-sm text-gray-600">Positive Sentiment</div>
                <div className="text-xs text-gray-500 mt-1">3 posts</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="text-3xl font-bold text-gray-900 mb-2">0</div>
                <div className="text-sm text-gray-600">Active Alerts</div>
                <div className="text-xs text-gray-500 mt-1">0 critical</div>
              </div>
              <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="text-3xl font-bold text-gray-900 mb-2">0</div>
                <div className="text-sm text-gray-600">High Priority</div>
                <div className="text-xs text-gray-500 mt-1">0% negative</div>
              </div>
            </div>

            {/* Features Preview */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-blue-600 text-xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900">
                  Live Feed Monitoring
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Track customer feedback across Twitter, Instagram, Facebook, Reddit, and review platforms in real-time.
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-purple-600 text-xl">🧠</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900">
                  AI Sentiment Analysis
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Advanced AI analyzes emotions and sentiment with high accuracy, providing detailed insights and confidence scores.
                </p>
              </div>

              <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-green-600 text-xl">⚡</span>
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900">
                  Smart Response Actions
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Approve replies, escalate issues, or ignore feedback with intelligent action recommendations and workflow automation.
                </p>
              </div>
            </div>

            {/* Platform Integrations */}
            <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm mb-16">
              <h3 className="text-2xl font-semibold mb-6 text-gray-900">Monitor All Your Platforms</h3>
              <div className="flex flex-wrap justify-center items-center gap-8">
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-blue-500 text-xl">🐦</span>
                  <span className="text-gray-700 font-medium">Twitter</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-pink-500 text-xl">📷</span>
                  <span className="text-gray-700 font-medium">Instagram</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-blue-600 text-xl">📘</span>
                  <span className="text-gray-700 font-medium">Facebook</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-orange-500 text-xl">🔴</span>
                  <span className="text-gray-700 font-medium">Reddit</span>
                </div>
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-yellow-500 text-xl">⭐</span>
                  <span className="text-gray-700 font-medium">Reviews</span>
                </div>
              </div>
            </div>

            {/* Emotion Bubbles Preview */}
            <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm mb-16">
              <h3 className="text-2xl font-semibold mb-6 text-gray-900">Emotion Detection</h3>
              <p className="text-gray-600 mb-8">AI-powered emotion analysis identifies feelings behind customer feedback</p>
              <div className="flex justify-center items-center space-x-6">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
                  <div className="text-center">
                    <div className="text-xs">Fear</div>
                    <div className="text-lg">3</div>
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  <div className="text-center">
                    <div className="text-xs">Surprise</div>
                    <div>1</div>
                  </div>
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  <div className="text-center">
                    <div className="text-xs">Disgust</div>
                    <div>1</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Final CTA */}
            <div className="text-center">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                Ready to Start Monitoring?
              </h3>
              <p className="text-xl text-gray-600 mb-8">
                Get real-time insights into customer sentiment and emotions
              </p>
              <Link href="/dashboard">
                <button className="px-12 py-4 bg-purple-600 text-white rounded-lg text-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg">
                  Launch Emotion Radar
                </button>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-8">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white text-sm">⚡</span>
              </div>
              <span className="text-gray-900 font-semibold">Emotion Radar</span>
            </div>
            <p className="text-gray-600 text-sm">
              Real-time AI sentiment monitoring • Auto-refresh: 10s
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}