import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, ArrowLeft, Building2, User, Lock, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeDomain } from '../utils/url';
import GlassCard from '../components/ui/GlassCard';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    dealershipName: '',
    websiteUrl: '',
    contactPhone: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'contactPhone') {
      const formatted = formatPhoneNumber(value);
      setFormData({
        ...formData,
        [name]: formatted,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
    setError('');
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.dealershipName || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        {
          name: formData.dealershipName,
          website_url: normalizeDomain(formData.websiteUrl) || null,
          location: null,
          contact_phone: formData.contactPhone || null,
        }
      );
      navigate('/upgrade');
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors selection:bg-primary-500/30">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <nav className="relative z-50 px-6 py-6 max-w-7xl mx-auto w-full flex justify-between items-center">
        <Link to="/" className="flex items-center group">
          <div className="bg-primary-500 p-2 rounded-xl shadow-glow-primary group-hover:scale-110 transition-transform duration-300">
            <Target className="h-6 w-6 text-white" />
          </div>
          <span className="ml-3 text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
            Dealer <span className="text-primary-500">Co-Pilot</span>
          </span>
        </Link>
        <Link to="/" className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-primary-500 flex items-center transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-20 relative z-10">
        <div className="max-w-xl w-full">
          <div className="text-center mb-10">
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
              Launch Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-600">Growth</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">
              Start your 7-day tactical free trial
            </p>
          </div>

          <GlassCard className="p-8 sm:p-12">
            <div className="mb-10">
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl font-black transition-all ${step >= 1
                  ? 'bg-primary-500 text-white shadow-glow-primary'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                  }`}>
                  <Building2 size={20} />
                </div>
                <div className={`flex-1 h-0.5 mx-4 transition-all duration-500 ${step >= 2 ? 'bg-primary-500 shadow-glow-primary' : 'bg-slate-100 dark:bg-white/5'
                  }`} />
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl font-black transition-all ${step >= 2
                  ? 'bg-primary-500 text-white shadow-glow-primary'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                  }`}>
                  <User size={20} />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <span className={`text-[10px] font-black uppercase tracking-widest ${step === 1 ? 'text-primary-500' : 'text-slate-400'}`}>Operations</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${step === 2 ? 'text-primary-500' : 'text-slate-400'}`}>Intelligence Access</span>
              </div>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <p className="text-red-500 text-xs font-bold text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Dealership Name
                    </label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                      <input
                        type="text"
                        name="dealershipName"
                        value={formData.dealershipName}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        required
                        placeholder="Nexus Motors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Website URL
                    </label>
                    <div className="relative group">
                      <Target className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                      <input
                        type="url"
                        name="websiteUrl"
                        value={formData.websiteUrl}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        placeholder="nexusmotors.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Contact Phone
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors flex items-center justify-center font-black text-[10px]">TEL</div>
                      <input
                        type="tel"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        placeholder="(555) 000-0000"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-glow-primary transition-all flex items-center justify-center gap-2 group"
                  >
                    Next Phase
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Full Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        required
                        placeholder="John Wick"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                      required
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Access Key
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                          required
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Verify Key
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                        required
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft size={16} />
                      Prev Step
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-primary-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-glow-primary transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Full Activation'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </GlassCard>

          <p className="mt-10 text-center text-xs font-bold text-slate-500">
            Already have a unit?{' '}
            <Link to="/signin" className="text-primary-500 hover:text-primary-600 font-black uppercase tracking-widest transition-colors ml-1">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
