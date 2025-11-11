export type UserRole = 'super_admin' | 'tenant_admin' | 'tenant_user';

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export type PlanType = 'free' | 'basic' | 'pro' | 'enterprise';

export type VehicleStatus = 'available' | 'sold' | 'pending' | 'wholesaled';

export type TitleStatus = 'clean' | 'salvage' | 'rebuilt' | 'unknown';

export type RecommendationType = 'buy' | 'caution' | 'pass';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface Tenant {
  id: string;
  name: string;
  website_url: string | null;
  location: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: TenantStatus;
  plan_type: PlanType;
  max_users: number;
  max_vehicles: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface Vehicle {
  id: string;
  tenant_id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  body_type: string | null;
  engine: string | null;
  transmission: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  mileage: number;
  price: number;
  cost: number | null;
  status: VehicleStatus;
  title_status: TitleStatus;
  features: Record<string, any>;
  images: string[] | null;
  first_seen_at: string;
  last_seen_at: string;
  sold_at: string | null;
  days_in_inventory: number;
  created_at: string;
  updated_at: string;
}

export interface InventorySnapshot {
  id: string;
  tenant_id: string;
  snapshot_date: string;
  total_vehicles: number;
  total_value: number;
  avg_price: number;
  avg_mileage: number;
  avg_age: number;
  avg_days_in_inventory: number;
  make_distribution: MakeDistribution[];
  model_distribution: ModelDistribution[];
  price_distribution: PriceDistribution;
  created_at: string;
}

export interface MakeDistribution {
  make: string;
  count: number;
  percentage: number;
}

export interface ModelDistribution {
  make: string;
  model: string;
  count: number;
}

export interface PriceDistribution {
  under_20k: number;
  from_20k_to_30k: number;
  from_30k_to_40k: number;
  over_40k: number;
}

export interface SalesRecord {
  id: string;
  tenant_id: string;
  vehicle_id: string | null;
  vin: string;
  year: number;
  make: string;
  model: string;
  sale_price: number;
  acquisition_cost: number;
  gross_profit: number;
  margin_percent: number;
  days_to_sale: number;
  sale_date: string;
  notes: string | null;
  created_at: string;
}

export interface VINScan {
  id: string;
  tenant_id: string;
  user_id: string;
  vin: string;
  decoded_data: DecodedVehicleData;
  recommendation: RecommendationType;
  confidence_score: number;
  match_reasoning: MatchReason[];
  estimated_profit: number | null;
  max_bid_suggestion: number | null;
  scan_location: string | null;
  saved_to_bid_list: boolean;
  created_at: string;
}

export interface DecodedVehicleData {
  year: number;
  make: string;
  model: string;
  trim?: string;
  body_type?: string;
  engine?: string;
  transmission?: string;
  exterior_color?: string;
  mileage?: number;
  title_status?: TitleStatus;
  owner_count?: number;
  accident_count?: number;
  service_records?: number;
}

export interface MatchReason {
  type: 'positive' | 'negative' | 'neutral';
  message: string;
}

export interface Recommendation {
  id: string;
  tenant_id: string;
  year_min: number;
  year_max: number;
  make: string;
  model: string;
  trim: string | null;
  target_price_min: number;
  target_price_max: number;
  target_mileage_max: number;
  confidence_score: number;
  reasoning: string;
  based_on_sales: boolean;
  avg_days_to_sale: number | null;
  avg_gross_profit: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  billing_interval: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SweetSpotAnalysis {
  make: string;
  model: string;
  units_sold: number;
  avg_days_to_sale: number;
  avg_gross_profit: number;
  total_gross_profit: number;
  is_top_performer: boolean;
}
