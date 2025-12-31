import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';

export default function SignInPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 bg-mesh-gradient flex flex-col transition-colors duration-300">
      <nav className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <div className="bg-primary-500 p-1.5 rounded-lg shadow-glow-primary">
                <Target className="h-6 w-6 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold text-slate-900 dark:text-white transition-colors">Dealer Co-Pilot</span>
            </Link>
            <Link to="/" className="text-slate-600 dark:text-slate-300 hover:text-primary-500 dark:hover:text-white flex items-center transition">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
              Sign In to Your Account
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Welcome back! Enter your credentials to continue.
            </p>
          </div>

          <GlassCard className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-600 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" className="mr-2 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary-500 focus:ring-primary-500" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors font-medium">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 disabled:opacity-50 mt-6 active:scale-[0.98]"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-white/5 pt-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-500 dark:text-primary-400 font-bold hover:underline transition">
                Start Free Trial
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
