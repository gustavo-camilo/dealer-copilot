export type UserRole = 'super_admin' | 'tenant_admin' | 'tenant_user' | 'va_uploader';

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export type PlanType = 'free' | 'basic' | 'pro' | 'enterprise';

export type VehicleStatus = 'available' | 'sold' | 'pending' | 'wholesaled';

export type TitleStatus = 'clean' | 'salvage' | 'rebuilt' | 'unknown';

export type RecommendationType = 'buy' | 'maybe' | 'pass';

export type PurchaseStatusType = 'purchased' | 'not_purchased';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface AuctionFeeThreshold {
  min_price: number;
  max_price: number;
  fee: number;
}

export interface TenantCostSettings {
  auction_fee_thresholds: AuctionFeeThreshold[];
  reconditioning_cost: number;
  transport_cost: number;
  floor_plan_rate: number;
  target_margin_percent: number;
  target_days_to_sale: number;
}

export type InventoryStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'pending_review';

export interface Tenant {
  id: string;
  name: string;
  website_url: string | null;
  location: string | null;
  zip_code: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: TenantStatus;
  plan_type: PlanType;
  max_users: number;
  max_vehicles: number;
  cost_settings: TenantCostSettings | null;
  dark_mode_enabled: boolean | null;
  inventory_status: InventoryStatus;
  inventory_ready_at: string | null;
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
  market_data: any | null; // Using any for now as the market data structure is complex
  estimated_profit: number | null;
  max_bid_suggestion: number | null;
  scan_location: string | null;
  saved_to_bid_list: boolean;
  costs_edited: boolean;
  custom_recon_cost: number | null;
  custom_transport_cost: number | null;
  custom_max_bid: number | null;
  custom_market_price: number | null;
  auction_url: string | null;
  purchase_status: PurchaseStatusType;
  purchase_price: number | null;
  purchase_date: string | null;
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
  is_underperforming?: boolean;
}

export type ScrapingSource = 'dealer_inventory' | 'competitor_data';

export type UploadStatus = 'processing' | 'completed' | 'failed' | 'pending_review';

export interface ManualScrapingUpload {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  filename: string;
  upload_date: string;
  status: UploadStatus;
  vehicles_processed: number;
  vehicles_new: number;
  vehicles_updated: number;
  vehicles_sold: number;
  error_log: Record<string, any> | null;
  raw_csv_data: string | null;
  scraping_source: ScrapingSource;
  created_at: string;
  updated_at: string;
}

export type CompetitorWaitingListStatus = 'pending' | 'in_progress' | 'completed';

export interface CompetitorWaitingListEntry {
  id: string;
  tenant_id: string;
  competitor_url: string;
  competitor_name: string | null;
  requested_at: string;
  status: CompetitorWaitingListStatus;
  assigned_to: string | null;
  priority: number;
  notes: string | null;
  completed_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionSource {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleComment {
  id: string;
  tenant_id: string;
  user_id: string;
  vin_scan_id: string;
  comment: string;
  auction_source_id: string | null;
  auction_source_name: string | null;
  created_at: string;
  updated_at: string;
  user?: User; // For joined queries
  auction_source?: AuctionSource; // For joined queries
}

// --- Unified Vehicle Tracking Types ---

export type SourceType = 'dealer' | 'competitor';
export type TrackedVehicleStatus = 'active' | 'sold' | 'removed';
export type ListingDateConfidence = 'high' | 'medium' | 'low' | 'estimated';

// ... existing types ...

export interface TenantSource {
  id: string;
  tenant_id: string;
  source_id: string;
  relationship_type: 'owner' | 'competitor' | 'watchlist';
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TenantVehicleOverride {
  tenant_id: string;
  vehicle_id: string;
  custom_price: number | null;
  notes: string | null;
  floor_plan_status: string | null;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

// Updated TrackedVehicle with source_id
export interface TrackedVehicle {
  id: string;
  tenant_id: string | null; // Deprecated: Moving to source_id based model
  source_id: string | null; // New Centralized ID
  source_url: string;
  source_type: SourceType;
  vin: string | null;
  stock_number: string | null;
  listing_url: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  exterior_color: string | null;
  image_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  status: TrackedVehicleStatus;
  listing_date_confidence: ListingDateConfidence;
  listing_date_source: string | null;
  price_history: any[] | null; // JSONB
  vehicle_id: string | null; // Link to manual entry
  created_at: string;
  updated_at: string;
}

// Updated InventorySnapshotUnified with source_id
export interface InventorySnapshotUnified {
  id: string;
  tenant_id: string | null; // Deprecated
  source_id: string | null; // New Centralized ID
  source_url: string;
  source_type: SourceType;
  source_name: string | null;
  snapshot_date: string;
  scanned_at: string;
  vehicle_count: number;
  total_inventory_value: number | null;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  avg_mileage: number | null;
  min_mileage: number | null;
  max_mileage: number | null;
  avg_days_in_inventory: number | null;
  avg_vehicle_age: number | null;
  make_distribution: Record<string, number> | null; // JSONB
  model_distribution: Record<string, number> | null; // JSONB
  price_distribution: Record<string, number> | null; // JSONB
  scraping_duration_ms: number | null;
  status: 'pending' | 'success' | 'partial' | 'failed' | 'pending_review';
  error_message: string | null;
  raw_data: any | null; // JSONB
  created_at: string;
}

export interface SourceRegistry {
  id: string;
  source_url: string;
  source_type: SourceType;
  source_name: string | null;
  tenant_id: string | null; // Deprecated
  scraping_enabled: boolean;
  last_scraped_at: string | null;
  next_scheduled_scrape: string | null;
  scraping_frequency_hours: number;
  created_at: string;
  updated_at: string;
  migrated_from_competitor_at: string | null;
  original_competitor_url: string | null;
}

