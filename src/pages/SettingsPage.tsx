import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
  const { user, tenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [dealershipName, setDealershipName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [location, setLocation] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [costSettings, setCostSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);

  useEffect(() => {
    if (tenant) {
      // Load tenant data
      setDealershipName(tenant.name || '');
      setWebsiteUrl(tenant.website_url || '');
      setLocation(tenant.location || '');
      setContactEmail(tenant.contact_email || '');
      setContactPhone(tenant.contact_phone || '');

      // Load cost settings
      if (tenant.cost_settings) {
        setCostSettings({
          ...DEFAULT_COST_SETTINGS,
          ...tenant.cost_settings,
        });
      }
    }
  }, [tenant]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Settings</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error')
              ? 'bg-red-500/20 border border-red-500/50 text-red-200'
              : 'bg-green-500/20 border border-green-500/50 text-green-200'
          }`}>
            {message}
          </div>
        )}

        {/* Dealership Profile */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Dealership Profile</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Dealership Name</label>
              <input
                type="text"
                value={dealershipName}
                disabled
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-gray-400 mt-1">Contact support to change dealership name</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourdealership.com"
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Changing this will add you to the scraping waiting list</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                disabled
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-not-allowed opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Cost Settings */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Default Cost Settings</h2>
          <p className="text-sm text-gray-300 mb-6">
            These values will be used as defaults when analyzing vehicles. You can override them for individual vehicles.
          </p>

          <form onSubmit={handleSaveCostSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Auction Fee (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.auction_fee_percent}
                  onChange={(e) => setCostSettings({ ...costSettings, auction_fee_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reconditioning Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.reconditioning_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, reconditioning_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Transport Cost ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={costSettings.transport_cost}
                  onChange={(e) => setCostSettings({ ...costSettings, transport_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Floor Plan Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costSettings.floor_plan_rate}
                  onChange={(e) => setCostSettings({ ...costSettings, floor_plan_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Margin (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={costSettings.target_margin_percent}
                  onChange={(e) => setCostSettings({ ...costSettings, target_margin_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Days to Sale</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={costSettings.target_days_to_sale}
                  onChange={(e) => setCostSettings({ ...costSettings, target_days_to_sale: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Cost Settings'}
              </button>

              <button
                type="button"
                onClick={() => setCostSettings(DEFAULT_COST_SETTINGS)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
        </div>

        {/* Subscription Info */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-4">Subscription</h2>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Current Plan:</span>
              <span className="font-semibold capitalize">{tenant.plan_type || 'Free'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Status:</span>
              <span className={`font-semibold capitalize ${
                tenant.status === 'active' ? 'text-green-400' :
                tenant.status === 'trial' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {tenant.status || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Max Users:</span>
              <span className="font-semibold">{tenant.max_users || 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Max Vehicles:</span>
              <span className="font-semibold">{tenant.max_vehicles || 100}</span>
            </div>
          </div>

          <a
            href="/upgrade"
            className="mt-6 block w-full text-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    </div>
  );
}
