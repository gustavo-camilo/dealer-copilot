import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Target, Menu, X, Trash2, Plus, Moon, Sun } from 'lucide-react';
import NavigationMenu from '../components/NavigationMenu';
import Header from '../components/Header';
import { normalizeDomain } from '../utils/url';
import { TenantCostSettings, AuctionFeeThreshold, AuctionSource } from '../types/database';

const DEFAULT_COST_SETTINGS: TenantCostSettings = {
  auction_fee_thresholds: [
    { min_price: 0, max_price: 5000, fee: 200 },
    { min_price: 5000, max_price: 10000, fee: 350 },
    { min_price: 10000, max_price: 999999, fee: 500 },
  ],
  reconditioning_cost: 800,
  transport_cost: 150,
  floor_plan_rate: 0.08,
  target_margin_percent: 15,
  target_days_to_sale: 30,
};

export default function SettingsPage() {
  const { user, tenant, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
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

  const [costSettings, setCostSettings] = useState<TenantCostSettings>(DEFAULT_COST_SETTINGS);

  // Auction sources state
  const [auctionSources, setAuctionSources] = useState<AuctionSource[]>([]);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [addingAuction, setAddingAuction] = useState(false);

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

      // Check if we have a separate zip_code field first (new schema)
      if (tenant.zip_code) {
        setZipCode(tenant.zip_code);
      }

      // Parse location if it exists (format: "City, State (ZipCode)" or "City, State")
      if (tenant.location) {
        const zipMatch = tenant.location.match(/\((\d{5})\)$/);
        if (zipMatch) {
          // Only set ZIP from location if we don't have it in the separate field
          if (!tenant.zip_code) {
            setZipCode(zipMatch[1]);
          }
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

      // Load auction sources
      loadAuctionSources();
    }
  }, [tenant]);

  const loadAuctionSources = async () => {
    if (!tenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('auction_sources')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setAuctionSources(data || []);
    } catch (error: any) {
      console.error('Error loading auction sources:', error);
    }
  };

  const handleAddAuctionSource = async () => {
    if (!newAuctionName.trim()) {
      setMessage('Error: Please enter an auction name');
      return;
    }

    setAddingAuction(true);
    setMessage('');

    try {
      const maxOrder = auctionSources.length > 0
        ? Math.max(...auctionSources.map(a => a.display_order))
        : 0;

      const { error } = await supabase
        .from('auction_sources')
        .insert({
          tenant_id: tenant?.id,
          name: newAuctionName.trim(),
          display_order: maxOrder + 1,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This auction source already exists');
        }
        throw error;
      }

      setMessage('Auction source added successfully!');
      setNewAuctionName('');
      loadAuctionSources();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding auction source:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setAddingAuction(false);
    }
  };

  const handleDeleteAuctionSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('auction_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage('Auction source removed successfully!');
      loadAuctionSources();
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting auction source:', error);
      setMessage(`Error: ${error.message}`);
    }
  };

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
      // Format location as "City, State (ZipCode)" for backwards compatibility
      const location = zipCode && city && state
        ? `${city}, ${state} (${zipCode})`
        : city && state
          ? `${city}, ${state}`
          : '';

      const { error } = await supabase
        .from('tenants')
        .update({
          website_url: normalizeDomain(websiteUrl),
          location,
          zip_code: zipCode || null, // Save ZIP to separate field as well
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
    <div className="min-h-screen bg-gray-50 dark:bg-brand-bg-dark">
      {/* Header */}
      <Header
        user={user}
        tenant={tenant}
        signOut={handleSignOut}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('Error')
            ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-400'
            }`}>
            {message}
          </div>
        )}

        {/* Appearance Settings */}
        <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Customize how Dealer Co-Pilot looks on your device
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-navy-400 mr-3" />
              ) : (
                <Sun className="h-5 w-5 text-orange-500 mr-3" />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white">
                  Dark Mode
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                </p>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-navy-900 ${
                theme === 'dark' ? 'bg-orange-600' : 'bg-gray-300'
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Dealership Profile */}
        <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Dealership Profile</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dealership Name</label>
              <input
                type="text"
                value={dealershipName}
                disabled
                className="w-full px-4 py-2 bg-gray-50 dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact support to change dealership name</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onBlur={(e) => setWebsiteUrl(normalizeDomain(e.target.value))}
                placeholder="yourdealership.com"
                className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Changing this will trigger a new scan of your website's inventory.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ZIP Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={handleZipCodeChange}
                placeholder="12345"
                maxLength={5}
                className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              {zipCodeLoading && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Looking up location...</p>
              )}
              {zipCodeError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{zipCodeError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  readOnly={zipCodeLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  maxLength={2}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 uppercase"
                  readOnly={zipCodeLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                disabled
                className="w-full px-4 py-2 bg-gray-50 dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
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
        <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Default Cost Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            These values will be used as defaults when analyzing vehicles. You can override them for individual vehicles.
          </p>

          <form onSubmit={handleSaveCostSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Auction Fee Thresholds</label>
                <div className="bg-gray-50 dark:bg-navy-800 rounded-lg p-4 border border-gray-200 dark:border-navy-700">
                  <div className="grid grid-cols-12 gap-4 mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    <div className="col-span-4">Min Price</div>
                    <div className="col-span-4">Max Price</div>
                    <div className="col-span-3">Fee</div>
                    <div className="col-span-1"></div>
                  </div>

                  {costSettings.auction_fee_thresholds?.map((threshold, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 mb-3 items-center">
                      <div className="col-span-4 relative">
                        <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={threshold.min_price}
                          onChange={(e) => {
                            const newThresholds = [...(costSettings.auction_fee_thresholds || [])];
                            newThresholds[index].min_price = Number(e.target.value);
                            setCostSettings({ ...costSettings, auction_fee_thresholds: newThresholds });
                          }}
                          className="w-full pl-6 pr-3 py-1.5 bg-white dark:bg-navy-700 border border-gray-300 dark:border-navy-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-4 relative">
                        <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={threshold.max_price}
                          onChange={(e) => {
                            const newThresholds = [...(costSettings.auction_fee_thresholds || [])];
                            newThresholds[index].max_price = Number(e.target.value);
                            setCostSettings({ ...costSettings, auction_fee_thresholds: newThresholds });
                          }}
                          className="w-full pl-6 pr-3 py-1.5 bg-white dark:bg-navy-700 border border-gray-300 dark:border-navy-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-3 relative">
                        <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                        <input
                          type="number"
                          value={threshold.fee}
                          onChange={(e) => {
                            const newThresholds = [...(costSettings.auction_fee_thresholds || [])];
                            newThresholds[index].fee = Number(e.target.value);
                            setCostSettings({ ...costSettings, auction_fee_thresholds: newThresholds });
                          }}
                          className="w-full pl-6 pr-3 py-1.5 bg-white dark:bg-navy-700 border border-gray-300 dark:border-navy-600 rounded text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const newThresholds = costSettings.auction_fee_thresholds.filter((_, i) => i !== index);
                            setCostSettings({ ...costSettings, auction_fee_thresholds: newThresholds });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const newThresholds = [...(costSettings.auction_fee_thresholds || [])];
                      newThresholds.push({ min_price: 0, max_price: 999999, fee: 0 });
                      setCostSettings({ ...costSettings, auction_fee_thresholds: newThresholds });
                    }}
                    className="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Threshold
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reconditioning Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.reconditioning_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, reconditioning_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transport Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.transport_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, transport_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Floor Plan Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.floor_plan_rate}
                  onChange={(e) => setCostSettings({ ...costSettings, floor_plan_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Margin (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={costSettings.target_margin_percent}
                  onChange={(e) => setCostSettings({ ...costSettings, target_margin_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Days to Sale</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={costSettings.target_days_to_sale}
                  onChange={(e) => setCostSettings({ ...costSettings, target_days_to_sale: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
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
                className="px-6 py-2 bg-gray-500 dark:bg-navy-700 text-white hover:bg-gray-600 dark:hover:bg-navy-600 rounded-lg font-medium transition"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
        </div>

        {/* Auction Sources Management */}
        <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Auction Sources</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Manage the auction sources where you buy vehicles. These will appear as options when adding comments to vehicles.
          </p>

          {/* Add New Auction Source */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add New Auction Source</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAuctionName}
                onChange={(e) => setNewAuctionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddAuctionSource()}
                placeholder="e.g., CarMax, ADESA, Local Auction"
                className="flex-1 px-4 py-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                disabled={addingAuction}
              />
              <button
                onClick={handleAddAuctionSource}
                disabled={addingAuction || !newAuctionName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                {addingAuction ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Auction Sources List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Auction Sources</label>
            {auctionSources.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-700">
                No auction sources configured yet. Add one above to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {auctionSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-700 hover:bg-gray-100 dark:hover:bg-navy-700 transition"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{source.name}</span>
                    <button
                      onClick={() => handleDeleteAuctionSource(source.id, source.name)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                      title="Remove auction source"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Subscription Info */}
        <div className="bg-white dark:bg-navy-900 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Subscription</h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Plan:</span>
              <span className="font-semibold text-gray-900 dark:text-white capitalize">{tenant.plan_type || 'Free'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`font-semibold capitalize ${tenant.status === 'active' ? 'text-green-600 dark:text-green-400' :
                tenant.status === 'trial' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                {tenant.status || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Max Users:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{tenant.max_users || 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Max Vehicles:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{tenant.max_vehicles || 100}</span>
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
