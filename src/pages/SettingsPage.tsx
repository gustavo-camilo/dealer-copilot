import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Target, Trash2, Plus, Building2, Globe, MapPin, Mail, Phone, DollarSign, Percent, Calendar, Shield, Save, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import GlassCard from '../components/ui/GlassCard';
import { normalizeDomain } from '../utils/url';
import { TenantCostSettings, AuctionSource } from '../types/database';

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

  useEffect(() => {
    if (tenant) {
      setDealershipName(tenant.name || '');
      setWebsiteUrl(tenant.website_url || '');
      setContactEmail(tenant.contact_email || '');
      setContactPhone(tenant.contact_phone || '');

      if (tenant.zip_code) {
        setZipCode(tenant.zip_code);
      }

      if (tenant.location) {
        const zipMatch = tenant.location.match(/\((\d{5})\)$/);
        if (zipMatch) {
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

      if (tenant.cost_settings) {
        setCostSettings({
          ...DEFAULT_COST_SETTINGS,
          ...tenant.cost_settings,
        });
      }

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
    if (!newAuctionName.trim()) return;
    setAddingAuction(true);
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

      if (error) throw error;
      setNewAuctionName('');
      loadAuctionSources();
      setMessage('Source integrated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error adding auction source:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setAddingAuction(false);
    }
  };

  const handleDeleteAuctionSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
    try {
      const { error } = await supabase
        .from('auction_sources')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadAuctionSources();
      setMessage('Source removed');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting auction source:', error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleZipCodeLookup = async (zip: string) => {
    if (zip.length !== 5) return;
    setZipCodeLoading(true);
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!response.ok) throw new Error('ZIP not found');
      const data = await response.json();
      if (data.places?.[0]) {
        setCity(data.places[0]['place name']);
        setState(data.places[0]['state abbreviation']);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setZipCodeLoading(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const location = zipCode && city && state ? `${city}, ${state} (${zipCode})` : city && state ? `${city}, ${state}` : '';

      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          website_url: normalizeDomain(websiteUrl),
          location,
          zip_code: zipCode || null,
          contact_phone: contactPhone,
          cost_settings: costSettings,
        })
        .eq('id', tenant?.id);

      if (tenantError) throw tenantError;
      setMessage('Tactical parameters updated successfully');
      setTimeout(() => setMessage(''), 4000);
    } catch (error: any) {
      setMessage(`Update failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); navigate('/signin'); } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 dark:bg-primary-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-500/10 dark:bg-secondary-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <Header user={user} tenant={tenant} signOut={handleSignOut} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
              System <span className="text-primary-500">Parameters</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">
              Configure baseline operations & intelligence matrix
            </p>
          </div>

          {message && (
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2 ${message.includes('Error') || message.includes('failed')
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-primary-500/10 text-primary-500 border border-primary-500/20'
              }`}>
              {message}
            </div>
          )}
        </div>

        <form onSubmit={handleSaveAll} className="space-y-8">
          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Identity & Communications */}
            <div className="space-y-8">
              <GlassCard className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-primary-500/10 rounded-xl">
                    <Building2 size={20} className="text-primary-500" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Identity Hub</h2>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Registry Name</label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" value={dealershipName} disabled className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-500 font-bold outline-none cursor-not-allowed" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Primary Website</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500" />
                      <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} onBlur={(e) => setWebsiteUrl(normalizeDomain(e.target.value))} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" placeholder="nexusmotors.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Grid Zone (ZIP)</label>
                      <input type="text" value={zipCode} onChange={(e) => { const z = e.target.value.replace(/\D/g, '').slice(0, 5); setZipCode(z); if (z.length === 5) handleZipCodeLookup(z); }} className="w-full px-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" placeholder="90210" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sector (City/State)</label>
                      <div className="w-full px-4 py-4 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-500 font-bold flex items-center gap-2">
                        {zipCodeLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                        <span className="truncate">{city ? `${city}, ${state}` : 'Waiting for ZIP...'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Comm Link (Phone)</label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500" />
                      <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all" placeholder="(555) 000-0000" />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Auction Sources */}
              <GlassCard className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-secondary-500/10 rounded-xl">
                    <RefreshCw size={20} className="text-secondary-500" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Supply Vectors</h2>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-2">
                    <input type="text" value={newAuctionName} onChange={(e) => setNewAuctionName(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-secondary-500" placeholder="New supply unit name..." />
                    <button type="button" onClick={handleAddAuctionSource} disabled={addingAuction || !newAuctionName.trim()} className="px-4 py-3 bg-secondary-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-glow-secondary disabled:opacity-50 transition-all">
                      {addingAuction ? 'Linking...' : 'Link'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {auctionSources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-white/10">
                        <span className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 tracking-tight">{source.name}</span>
                        <button type="button" onClick={() => handleDeleteAuctionSource(source.id, source.name)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Financial Parameters */}
            <div className="space-y-8">
              <GlassCard className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-primary-500/10 rounded-xl">
                    <DollarSign size={20} className="text-primary-500" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Margin Matrix</h2>
                </div>

                <div className="space-y-6">
                  {/* Auction Fees Stepper */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tactical Fee Brackets</label>
                    <div className="space-y-2">
                      {costSettings.auction_fee_thresholds?.map((t, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-11 grid grid-cols-3 gap-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                              <input type="number" value={t.min_price} onChange={(e) => { const n = [...costSettings.auction_fee_thresholds]; n[idx].min_price = Number(e.target.value); setCostSettings({ ...costSettings, auction_fee_thresholds: n }); }} className="w-full pl-5 pr-2 py-2 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
                            </div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">$</span>
                              <input type="number" value={t.max_price} onChange={(e) => { const n = [...costSettings.auction_fee_thresholds]; n[idx].max_price = Number(e.target.value); setCostSettings({ ...costSettings, auction_fee_thresholds: n }); }} className="w-full pl-5 pr-2 py-2 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
                            </div>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-primary-500">+</span>
                              <input type="number" value={t.fee} onChange={(e) => { const n = [...costSettings.auction_fee_thresholds]; n[idx].fee = Number(e.target.value); setCostSettings({ ...costSettings, auction_fee_thresholds: n }); }} className="w-full pl-5 pr-2 py-2 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-black text-primary-500" />
                            </div>
                          </div>
                          <div className="col-span-1 text-center">
                            <button type="button" onClick={() => setCostSettings({ ...costSettings, auction_fee_thresholds: costSettings.auction_fee_thresholds.filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => setCostSettings({ ...costSettings, auction_fee_thresholds: [...costSettings.auction_fee_thresholds, { min_price: 0, max_price: 99999, fee: 0 }] })} className="w-full py-2 bg-primary-500/5 hover:bg-primary-500/10 text-primary-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-dashed border-primary-500/20 mt-2">
                        Deploy New Bracket
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Recon Unit ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-3 w-3" />
                        <input type="number" value={costSettings.reconditioning_cost} onChange={(e) => setCostSettings({ ...costSettings, reconditioning_cost: Number(e.target.value) })} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold outline-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Logistic Unit ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-3 w-3" />
                        <input type="number" value={costSettings.transport_cost} onChange={(e) => setCostSettings({ ...costSettings, transport_cost: Number(e.target.value) })} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Floor Rate (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-3 w-3" />
                        <input type="number" step="0.01" value={costSettings.floor_plan_rate} onChange={(e) => setCostSettings({ ...costSettings, floor_plan_rate: Number(e.target.value) })} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold outline-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Yield (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500 h-3 w-3" />
                        <input type="number" step="0.1" value={costSettings.target_margin_percent} onChange={(e) => setCostSettings({ ...costSettings, target_margin_percent: Number(e.target.value) })} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-primary-500 font-orange font-black outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Strategic Days to Sale</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-3 w-3" />
                      <input type="number" value={costSettings.target_days_to_sale} onChange={(e) => setCostSettings({ ...costSettings, target_days_to_sale: Number(e.target.value) })} className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-900 dark:text-white font-bold outline-none" />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* License & Metrics */}
              <GlassCard className="p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-primary-500/10 rounded-xl">
                    <Shield size={20} className="text-primary-500" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Authorization</h2>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Intelligence Tier', value: tenant.plan_type || 'Free', primary: true },
                    { label: 'Operational Status', value: tenant.status || 'Active', color: tenant.status === 'active' ? 'text-green-500' : 'text-yellow-500' },
                    { label: 'Pilot Capacity', value: tenant.max_users || 3 },
                    { label: 'Registry Ceiling', value: `${tenant.max_vehicles || 100} units` },
                  ].map((stat, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
                      <span className={`text-xs font-black uppercase tracking-tight ${stat.color || (stat.primary ? 'text-primary-500' : 'text-slate-900 dark:text-white')}`}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                  <Link to="/upgrade" className="mt-4 w-full py-3 bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-glow-primary transition-all text-center flex items-center justify-center gap-2 group">
                    Scale Infrastructure
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Action Bar */}
          <div className="sticky bottom-8 z-40 px-4">
            <button type="submit" disabled={saving} className="w-full max-w-md mx-auto block bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:shadow-glow-primary transition-all disabled:opacity-50 flex items-center justify-center gap-3 group">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
              Commit Parameters
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
