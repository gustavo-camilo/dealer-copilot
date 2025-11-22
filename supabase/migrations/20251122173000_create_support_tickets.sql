-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('missing_market_data', 'bug', 'feature_request', 'other')),
  subject text NOT NULL,
  details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can view their own tenant's tickets
CREATE POLICY "Users can view own tenant tickets"
  ON support_tickets
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Only admins/support can update (for now, let's allow users to update their own for simplicity or define admin role later)
-- For MVP, we'll just allow read/write for tenant members
CREATE POLICY "Users can update own tenant tickets"
  ON support_tickets
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
