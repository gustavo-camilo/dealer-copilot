import { Link } from 'react-router-dom';
import { Car, Target, Smartphone, TrendingUp, BarChart3, Clock, CheckCircle, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900">How It Works</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <Link to="/signin" className="text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link
                to="/signup"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
            Know What to Buy at Auction<br />
            <span className="text-blue-900">In 3 Seconds</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            Scan your website, understand what you sell best, get smart buy recommendations for auctions.
            All in under 5 minutes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-700 transition inline-flex items-center justify-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <a
              href="#how-it-works"
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:border-gray-400 transition"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-900">30s</div>
              <div className="text-gray-600 mt-2">Inventory Analysis</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-900">3s</div>
              <div className="text-gray-600 mt-2">VIN Scan to Decision</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-900">2x</div>
              <div className="text-gray-600 mt-2">Faster Turnover</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-900">20%</div>
              <div className="text-gray-600 mt-2">Higher Margins</div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-8 w-8 text-blue-900" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                1. Analyze Your Inventory
              </h3>
              <p className="text-gray-600">
                Enter your dealership website and we'll analyze your entire inventory in 30 seconds.
                Understand your portfolio, pricing patterns, and what you stock most.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Smartphone className="h-8 w-8 text-blue-900" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                2. Scan VINs at Auctions
              </h3>
              <p className="text-gray-600">
                Use our mobile app to scan VINs at auctions. Get instant buy/no-buy guidance
                with profit calculations based on your inventory profile.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-blue-900" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                3. Track Sales & Learn
              </h3>
              <p className="text-gray-600">
                As you make sales, we learn your sweet spot and improve recommendations.
                Buy more of what sells fast and profitably.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Everything You Need to Buy Smarter
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Target className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Instant Portfolio Analysis
              </h3>
              <p className="text-gray-600">
                Scan your website and get comprehensive insights in 30 seconds. Total vehicles,
                portfolio value, average metrics, and inventory composition.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Smartphone className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Mobile VIN Scanner
              </h3>
              <p className="text-gray-600">
                Scan VINs at auctions and get instant guidance. See if it matches your profile,
                calculate profit potential, and get a clear buy/caution/pass recommendation.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <TrendingUp className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                AI-Powered Recommendations
              </h3>
              <p className="text-gray-600">
                Get smart buy recommendations based on your inventory profile and sales history.
                Know exactly what to look for at your next auction.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <Clock className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Sweet Spot Intelligence
              </h3>
              <p className="text-gray-600">
                After 10+ sales, discover your sweet spot. Learn which vehicles sell fastest
                and most profitably for your dealership specifically.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <BarChart3 className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Profit Calculator
              </h3>
              <p className="text-gray-600">
                Calculate profit potential instantly. Adjust max bid, see total investment
                including fees, and understand your expected margin.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <CheckCircle className="h-10 w-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Sales Tracking
              </h3>
              <p className="text-gray-600">
                Track every sale with gross profit and days to sale. Build a database of what
                works for your lot and continuously improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Who It's For
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6">
              <Car className="h-12 w-12 text-blue-900 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Independent Dealers</h3>
              <p className="text-gray-600 text-sm">
                Make smarter buying decisions and improve your turn rate
              </p>
            </div>
            <div className="p-6">
              <Target className="h-12 w-12 text-blue-900 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Small Dealer Groups</h3>
              <p className="text-gray-600 text-sm">
                Scale your acquisition strategy across multiple locations
              </p>
            </div>
            <div className="p-6">
              <TrendingUp className="h-12 w-12 text-blue-900 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Auction Buyers</h3>
              <p className="text-gray-600 text-sm">
                Get instant guidance on every vehicle you consider
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-gray-600 mb-16">
            Start with a 14-day free trial. No credit card required.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">Free</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Up to 100 vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Basic recommendations</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">50 VIN scans/month</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full text-center bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Get Started
              </Link>
            </div>

            <div className="bg-blue-900 p-8 rounded-xl shadow-lg border-4 border-orange-600 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-white">Pro</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-white">$99</span>
                <span className="text-blue-200">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Up to 500 vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-white">AI-powered recommendations</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Unlimited VIN scans</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Sweet spot analysis</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-white">Priority support</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className="block w-full text-center bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
              >
                Start Free Trial
              </Link>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900">Enterprise</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Unlimited vehicles</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Multi-location support</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Custom integrations</span>
                </li>
              </ul>
              <a
                href="mailto:sales@dealercopilot.com"
                className="block w-full text-center bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Buy Smarter?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join dealers who are making better buying decisions every day.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center bg-orange-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-orange-700 transition"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <p className="mt-6 text-blue-200 text-sm">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center text-white mb-4">
                <Target className="h-6 w-6" />
                <span className="ml-2 font-bold">Dealer Co-Pilot</span>
              </div>
              <p className="text-sm">
                Know what to buy at auction in 3 seconds.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-white">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">
            <p>&copy; 2024 Dealer Co-Pilot. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
