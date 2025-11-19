import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Target, Menu, X } from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';

interface CostSettings {
  auction_fee_percent: number;
  reconditioning_cost: number;
  transport_cost: number;
  floor_plan_rate: number;
  target_margin_percent: number;
  target_days_to_sale: number;
}

const DEFAULT_COST_SETTINGS: CostSettings = {
  auction_fee_percent: 2,
  reconditioning_cost: 800,
  transport_cost: 150,
  floor_plan_rate: 0.08,
  target_margin_percent: 15,
  target_days_to_sale: 30,
};

export default function SettingsPage() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Form state
  const [dealershipName, setDealershipName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [zipCodeLoading, setZipCodeLoading] = useState(false);
  const [zipCodeError, setZipCodeError] = useState('');

  const [costSettings, setCostSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    if (tenant) {
      // Load tenant data
      setDealershipName(tenant.name || '');
      setWebsiteUrl(tenant.website_url || '');
      setContactEmail(tenant.contact_email || '');
      setContactPhone(tenant.contact_phone || '');

      // Parse location if it exists (format: "City, State (ZipCode)" or "City, State")
      if (tenant.location) {
        const zipMatch = tenant.location.match(/\((\d{5})\)$/);
        if (zipMatch) {
          setZipCode(zipMatch[1]);
          const cityState = tenant.location.replace(/\s*\(\d{5}\)$/, '').split(', ');
          setCity(cityState[0] || '');
          setState(cityState[1] || '');
        } else {
          const parts = tenant.location.split(', ');
          setCity(parts[0] || '');
          setState(parts[1] || '');
        }
      }

      // Load cost settings
      if (tenant.cost_settings) {
        setCostSettings({
          ...DEFAULT_COST_SETTINGS,
          ...tenant.cost_settings,
        });
      }
    }
  }, [tenant]);

  const handleZipCodeLookup = async (zip: string) => {
    if (zip.length !== 5 || !/^\d{5}$/.test(zip)) {
      setZipCodeError('Please enter a valid 5-digit ZIP code');
      return;
    }

    setZipCodeLoading(true);
    setZipCodeError('');

    try {
      // Use Zippopotam.us API (free, no API key required)
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);

      if (!response.ok) {
        throw new Error('ZIP code not found');
      }

      const data = await response.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        setCity(place['place name']);
        setState(place['state abbreviation']);
        setZipCodeError('');
      } else {
        throw new Error('ZIP code not found');
      }
    } catch (error) {
      console.error('ZIP code lookup error:', error);
      setZipCodeError('Invalid ZIP code or unable to lookup location');
      setCity('');
      setState('');
    } finally {
      setZipCodeLoading(false);
    }
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(zip);
    setZipCodeError('');

    // Auto-lookup when 5 digits are entered
    if (zip.length === 5) {
      handleZipCodeLookup(zip);
    } else {
      // Clear city/state if zip is incomplete
      setCity('');
      setState('');
    }
  };

  const handleSaveCostSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          cost_settings: costSettings,
        })
        .eq('id', tenant?.id);

      if (error) throw error;

      setMessage('Cost settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving cost settings:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      // Format location as "City, State (ZipCode)"
      const location = zipCode && city && state
        ? `${city}, ${state} (${zipCode})`
        : city && state
        ? `${city}, ${state}`
        : '';

      const { error } = await supabase
        .from('tenants')
        .update({
          website_url: websiteUrl,
          location,
          contact_phone: contactPhone,
        })
        .eq('id', tenant?.id);

      if (error) throw error;

      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-blue-900" />
              <span className="ml-2 text-xl font-bold text-gray-900">Dealer Co-Pilot</span>
            </div>
            <div className="flex items-center space-x-4 relative">
              <span className="text-sm text-gray-600 hidden md:inline">{tenant?.name}</span>
              <Link
                to="/scan"
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition hidden md:inline-block"
              >
                Scan VIN
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition"
                  aria-label="Menu"
                >
                  {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>

                {/* Navigation Menu */}
                {menuOpen && (
                  <NavigationMenu
                    currentPath={location.pathname}
                    onClose={() => setMenuOpen(false)}
                    onSignOut={handleSignOut}
                    user={user}
                    tenantName={tenant?.name}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error')
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {message}
          </div>
        )}

        {/* Dealership Profile */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Dealership Profile</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dealership Name</label>
              <input
                type="text"
                value={dealershipName}
                disabled
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Contact support to change dealership name</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourdealership.com"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Changing this will add you to the scraping waiting list</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={handleZipCodeChange}
                placeholder="12345"
                maxLength={5}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              {zipCodeLoading && (
                <p className="text-xs text-blue-600 mt-1">Looking up location...</p>
              )}
              {zipCodeError && (
                <p className="text-xs text-red-600 mt-1">{zipCodeError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                  readOnly={zipCodeLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  maxLength={2}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 uppercase"
                  readOnly={zipCodeLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                disabled
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Cost Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Cost Settings</h2>
          <p className="text-sm text-gray-600 mb-6">
            These values will be used as defaults when analyzing vehicles. You can override them for individual vehicles.
          </p>

          <form onSubmit={handleSaveCostSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auction Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.auction_fee_percent}
                  onChange={(e) => setCostSettings({ ...costSettings, auction_fee_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reconditioning Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.reconditioning_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, reconditioning_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transport Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.transport_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, transport_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Floor Plan Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.floor_plan_rate}
                  onChange={(e) => setCostSettings({ ...costSettings, floor_plan_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Margin (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={costSettings.target_margin_percent}
                  onChange={(e) => setCostSettings({ ...costSettings, target_margin_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Days to Sale</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={costSettings.target_days_to_sale}
                  onChange={(e) => setCostSettings({ ...costSettings, target_days_to_sale: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Cost Settings'}
              </button>

              <button
                type="button"
                onClick={() => setCostSettings(DEFAULT_COST_SETTINGS)}
                className="px-6 py-2 bg-gray-500 text-white hover:bg-gray-600 rounded-lg font-medium transition"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
        </div>

        {/* Subscription Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Current Plan:</span>
              <span className="font-semibold text-gray-900 capitalize">{tenant.plan_type || 'Free'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-semibold capitalize ${
                tenant.status === 'active' ? 'text-green-600' :
                tenant.status === 'trial' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {tenant.status || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Users:</span>
              <span className="font-semibold text-gray-900">{tenant.max_users || 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Vehicles:</span>
              <span className="font-semibold text-gray-900">{tenant.max_vehicles || 100}</span>
            </div>
          </div>

          <Link
            to="/upgrade"
            className="mt-6 block w-full text-center px-6 py-3 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-semibold transition"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
