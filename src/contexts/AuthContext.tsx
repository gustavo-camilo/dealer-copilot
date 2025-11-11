import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Tenant } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, tenantData: Partial<Tenant>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      throw userError;
    }

    if (!userData) {
      console.error('User profile not found for userId:', userId);
      throw new Error('User profile not found. Please complete signup.');
    }

    setUser(userData);

    if (userData.tenant_id) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userData.tenant_id)
        .maybeSingle();

      if (tenantError) {
        console.error('Error fetching tenant:', tenantError);
        throw tenantError;
      }
      if (tenantData) {
        setTenant(tenantData);
      }
    }

    supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.warn('Failed to update last_login_at:', error);
      });
  };

  const refreshUser = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      await fetchUserProfile(currentSession.user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id);
      } else {
        setUser(null);
        setTenant(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    tenantData: Partial<Tenant>
  ) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw authError;
    }
    if (!authData.user) throw new Error('Failed to create user');
    if (!authData.session) throw new Error('Email confirmation is required. Please check your inbox and confirm your email before signing in.');

    const supabaseWithSession = supabase;
    await supabaseWithSession.auth.setSession({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });

    const { data: newTenant, error: tenantError } = await supabaseWithSession
      .from('tenants')
      .insert({
        name: tenantData.name,
        website_url: tenantData.website_url,
        location: tenantData.location,
        contact_email: email,
        contact_phone: tenantData.contact_phone,
        status: 'trial',
        plan_type: 'free',
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    const { error: userError } = await supabaseWithSession.from('users').insert({
      id: authData.user.id,
      tenant_id: newTenant.id,
      email,
      full_name: fullName,
      role: 'tenant_admin',
      is_active: true,
    });

    if (userError) {
      console.error('User creation error:', userError);
      throw new Error(`Failed to create user profile: ${userError.message}`);
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const { error: subError } = await supabaseWithSession.from('subscriptions').insert({
      tenant_id: newTenant.id,
      plan_type: 'free',
      status: 'trialing',
      billing_interval: 'monthly',
      amount: 0,
      currency: 'USD',
      current_period_start: new Date().toISOString().split('T')[0],
      current_period_end: trialEnd.toISOString().split('T')[0],
      trial_end: trialEnd.toISOString().split('T')[0],
    });

    if (subError) throw subError;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenant,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
