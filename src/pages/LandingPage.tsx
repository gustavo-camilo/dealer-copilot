import { Link } from 'react-router-dom';
import { Car, Target, Smartphone, TrendingUp, BarChart3, Clock, CheckCircle, ArrowRight, Zap, Shield, LineChart } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-1.5 rounded-lg">
                <Target className="h-6 w-6 text-white" />
              </div>
              <span className="ml-3 text-xl font-bold text-white">Dealer Co-Pilot</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-300 hover:text-white transition">Features</a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white transition">How It Works</a>
              <a href="#pricing" className="text-slate-300 hover:text-white transition">Pricing</a>
              <Link to="/signin" className="text-slate-300 hover:text-white transition">Sign In</Link>
              <Link
                to="/signup"
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30 font-semibold"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-slate-950"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTQwYWYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2djRoLTR2LTRoNG16bTAgMGg0djRoLTR2LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40"></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center bg-blue-950/50 border border-blue-800/50 rounded-full px-4 py-2 mb-8">
            <Zap className="h-4 w-4 text-orange-400 mr-2" />
            <span className="text-sm text-blue-200 font-medium">AI-Powered Auction Intelligence</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Know What to Buy<br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 text-transparent bg-clip-text">
              In 3 Seconds
            </span>
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Scan your website, understand what you sell best, get smart buy recommendations.
            Turn data into profit at every auction.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="group bg-gradient-to-r from-orange-500 to-orange-600 text-white px-10 py-5 rounded-xl text-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 inline-flex items-center justify-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="border-2 border-slate-700 bg-slate-900/50 text-white px-10 py-5 rounded-xl text-lg font-bold hover:border-slate-600 hover:bg-slate-900 transition-all backdrop-blur"
            >
              See How It Works
            </a>
          </div>

          <p className="mt-6 text-slate-400 text-sm">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
      </section>

      <section className="py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="group hover:scale-105 transition-transform">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 text-transparent bg-clip-text mb-2">30s</div>
              <div className="text-slate-400 group-hover:text-slate-300 transition">Inventory Analysis</div>
            </div>
            <div className="group hover:scale-105 transition-transform">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 text-transparent bg-clip-text mb-2">3s</div>
              <div className="text-slate-400 group-hover:text-slate-300 transition">VIN to Decision</div>
            </div>
            <div className="group hover:scale-105 transition-transform">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 text-transparent bg-clip-text mb-2">2x</div>
              <div className="text-slate-400 group-hover:text-slate-300 transition">Faster Turnover</div>
            </div>
            <div className="group hover:scale-105 transition-transform">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 text-transparent bg-clip-text mb-2">20%</div>
              <div className="text-slate-400 group-hover:text-slate-300 transition">Higher Margins</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-400">Three simple steps to smarter buying</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group relative bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                1
              </div>
              <div className="bg-blue-950/50 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                Analyze Your Inventory
              </h3>
              <p className="text-slate-400 text-center leading-relaxed">
                Enter your dealership website and we'll analyze your entire inventory in 30 seconds.
                Understand your portfolio, pricing patterns, and what you stock most.
              </p>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                2
              </div>
              <div className="bg-blue-950/50 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                Scan VINs at Auctions
              </h3>
              <p className="text-slate-400 text-center leading-relaxed">
                Use our mobile app to scan VINs at auctions. Get instant buy/no-buy guidance
                with profit calculations based on your inventory profile.
              </p>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                3
              </div>
              <div className="bg-blue-950/50 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                Track Sales & Learn
              </h3>
              <p className="text-slate-400 text-center leading-relaxed">
                As you make sales, we learn your sweet spot and improve recommendations.
                Buy more of what sells fast and profitably.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Buy Smarter
            </h2>
            <p className="text-xl text-slate-400">Powerful features designed for dealers</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Instant Portfolio Analysis
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Scan your website and get comprehensive insights in 30 seconds. Total vehicles,
                portfolio value, average metrics, and inventory composition.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Smartphone className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Mobile VIN Scanner
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Scan VINs at auctions and get instant guidance. See if it matches your profile,
                calculate profit potential, and get clear buy/caution/pass recommendation.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                AI-Powered Recommendations
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Get smart buy recommendations based on your inventory profile and sales history.
                Know exactly what to look for at your next auction.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <LineChart className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Sweet Spot Intelligence
              </h3>
              <p className="text-slate-400 leading-relaxed">
                After 10+ sales, discover your sweet spot. Learn which vehicles sell fastest
                and most profitably for your dealership specifically.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Profit Calculator
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Calculate profit potential instantly. Adjust max bid, see total investment
                including fees, and understand your expected margin.
              </p>
            </div>

            <div className="group bg-gradient-to-br from-slate-900 to-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all hover:shadow-xl hover:shadow-orange-500/10">
              <div className="bg-orange-500/10 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-7 w-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Sales Tracking
              </h3>
              <p className="text-slate-400 leading-relaxed">
                Track every sale with gross profit and days to sale. Build a database of what
                works for your lot and continuously improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-400">
              Start with a 14-day free trial. No credit card required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-all">
              <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
              <div className="mt-4 mb-6">
                <span className="text-5xl font-bold text-white">$0</span>
                <span className="text-slate-400 ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Up to 100 vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Basic recommendations</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">50 VIN scans/month</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full text-center bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-700 transition"
              >
                Get Started
              </Link>
            </div>

            <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-2xl shadow-2xl shadow-orange-500/30 transform scale-105">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-slate-950 text-orange-400 px-6 py-2 rounded-full text-sm font-bold border border-orange-500">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="mt-4 mb-6">
                <span className="text-5xl font-bold text-white">$99</span>
                <span className="text-orange-100 ml-2">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Up to 500 vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-white">AI-powered recommendations</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited VIN scans</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Sweet spot analysis</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Priority support</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full text-center bg-white text-orange-600 px-6 py-3 rounded-xl font-bold hover:bg-orange-50 transition shadow-lg"
              >
                Start Free Trial
              </Link>
            </div>

            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-all">
              <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
              <div className="mt-4 mb-6">
                <span className="text-5xl font-bold text-white">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Unlimited vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Multi-location support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Custom integrations</span>
                </li>
              </ul>
              <a
                href="mailto:sales@dealercopilot.com"
                className="block w-full text-center bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-700 transition"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-950 to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmOTczMTYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2djRoLTR2LTRoNG16bTAgMGg0djRoLTR2LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Buy Smarter?
          </h2>
          <p className="text-xl md:text-2xl text-blue-200 mb-12">
            Join dealers who are making better buying decisions every day.
          </p>
          <Link
            to="/signup"
            className="group inline-flex items-center bg-gradient-to-r from-orange-500 to-orange-600 text-white px-12 py-5 rounded-xl text-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50"
          >
            Start Your Free Trial
            <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-8 text-blue-300 text-sm">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center text-white mb-4">
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-1.5 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 font-bold">Dealer Co-Pilot</span>
              </div>
              <p className="text-slate-400 text-sm">
                Know what to buy at auction in 3 seconds.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-slate-400 hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="text-slate-400 hover:text-white transition">Pricing</a></li>
                <li><a href="#how-it-works" className="text-slate-400 hover:text-white transition">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-slate-400 hover:text-white transition">About</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Contact</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-slate-400 hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-900 mt-12 pt-8 text-center text-sm text-slate-500">
            <p>&copy; 2024 Dealer Co-Pilot. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
