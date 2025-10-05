import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import ThemeSelector from '../components/ThemeSelector'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate login
    setTimeout(() => {
      setLoading(false)
      router.push('/dashboard')
    }, 1000)
  }

  return (
    <>
      <Head>
        <title>Login - FeedbackAI</title>
        <meta name="description" content="Login to your feedback analyzer dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        {/* Theme Selector */}
        <div className="absolute top-4 right-4 z-20">
          <ThemeSelector />
        </div>

        <div className="max-w-md w-full space-y-8 p-8 relative z-10">
          {/* Header */}
          <div className="text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-white font-bold text-4xl">🌱</span>
            </div>
            <h2 className="text-4xl font-extrabold text-primary mb-2">
              Welcome to Your Garden
            </h2>
            <p className="text-secondary text-lg">
              Enter your FeedbackGarden to nurture customer relationships
            </p>
          </div>
          
          {/* Login Form */}
          <div className="nature-card p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-primary mb-2">
                  🌿 Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input-nature"
                  placeholder="Enter your garden email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-primary mb-2">
                  🔐 Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="input-nature"
                  placeholder="Enter your garden key"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-green-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-primary">
                    Keep me in the garden
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-green-600 hover:text-green-500 transition-colors">
                    Lost your key? 🗝️
                  </a>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-mint w-full py-4 text-lg font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin text-2xl mr-3">🌱</div>
                      Growing your access...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="mr-2">🌸</span>
                      Enter Your Garden
                    </div>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-green-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-secondary">Or bloom with</span>
                </div>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                className="btn-soft w-full py-4 text-lg font-semibold flex items-center justify-center"
              >
                <span className="mr-3">🌻</span>
                Grow with Google
              </button>

              <div className="text-center">
                <p className="text-sm text-secondary">
                  New to our garden?{' '}
                  <Link href="/register" className="font-medium text-green-600 hover:text-green-500 transition-colors">
                    Plant your seeds 🌱
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Back to Home */}
          <div className="text-center">
            <Link href="/" className="text-sm text-secondary hover:text-primary transition-colors inline-flex items-center">
              <span className="mr-2">🏡</span>
              Back to FeedbackGarden
            </Link>
          </div>
        </div>

        {/* Floating Nature Elements */}
        <div className="fixed bottom-8 right-8 text-6xl opacity-20 animate-gentle-bounce">🦋</div>
        <div className="fixed top-1/4 left-8 text-4xl opacity-30 animate-gentle-bounce" style={{animationDelay: '1s'}}>🌿</div>
        <div className="fixed top-3/4 right-16 text-5xl opacity-25 animate-gentle-bounce" style={{animationDelay: '2s'}}>🌸</div>
        <div className="fixed bottom-1/4 left-16 text-3xl opacity-35 animate-gentle-bounce" style={{animationDelay: '3s'}}>🍃</div>
      </div>
    </>
  )
}