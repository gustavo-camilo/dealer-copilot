# Deployment Guide

## Prerequisites

- Supabase account with project created
- Node.js 18+ installed
- Git installed

## Database Setup

The database migrations have already been applied to your Supabase instance. The following tables were created:

- `tenants` - Dealership accounts
- `users` - User accounts with tenant association
- `vehicles` - Vehicle inventory per tenant
- `inventory_snapshots` - Historical inventory data
- `vehicle_price_history` - Price tracking over time
- `sales_records` - Sales tracking
- `vin_scans` - VIN scan history
- `recommendations` - Buy recommendations
- `subscriptions` - Billing and subscription management

All tables have Row Level Security (RLS) policies enabled for complete data isolation between tenants.

## Environment Variables

The project is already configured with Supabase credentials in `.env`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open http://localhost:5173

## Creating a Super Admin

To create the first super admin user:

1. Sign up through the normal flow at `/signup`
2. In Supabase SQL Editor, run:
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';
```
3. Access the admin panel at `/admin`

## Deployment to Vercel

1. Push your code to GitHub:
```bash
git remote add origin https://github.com/yourusername/dealer-copilot.git
git push -u origin master
```

2. Connect to Vercel:
   - Go to vercel.com and import your GitHub repository
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Deploy

3. Your app will be live at: `https://your-project.vercel.app`

## Deployment to Netlify

1. Build the project:
```bash
npm run build
```

2. Deploy to Netlify:
   - Go to netlify.com and create new site from Git
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

3. Your app will be live at: `https://your-site.netlify.app`

## Post-Deployment Checklist

- [ ] Verify database connections work
- [ ] Test user signup flow
- [ ] Test signin flow
- [ ] Create a super admin account
- [ ] Test VIN scanning functionality
- [ ] Test dashboard loads correctly
- [ ] Verify RLS policies are working (users can only see their own data)
- [ ] Test onboarding flow
- [ ] Check responsive design on mobile devices

## Key Features Implemented

### Multi-Tenant Architecture
- Complete tenant isolation with RLS policies
- Shared database with tenant-specific data access
- Role-based access control (super_admin, tenant_admin, tenant_user)

### Landing Page
- Compelling sales-oriented design
- Feature highlights
- Pricing tiers
- Call-to-action buttons

### User Authentication
- Supabase Auth integration
- Email/password authentication
- Protected routes
- Session management

### Dashboard
- Inventory overview
- Portfolio metrics
- Recent VIN scans
- Quick actions

### VIN Scanner
- VIN input and validation
- Mock vehicle decoding
- Buy/caution/pass recommendations
- Profit calculator
- Match reasoning

### Onboarding
- Website URL analysis
- Progress indicators
- Sample vehicle data creation
- Portfolio overview

### Super Admin Panel
- View all tenants
- Tenant statistics
- User management
- Subscription tracking

## Next Steps for Production

1. **Implement real VIN decoding**:
   - Integrate NHTSA vPIC API
   - Add commercial VIN provider (DataOne, Vehicle Databases)
   - Implement caching strategy

2. **Add payment processing**:
   - Integrate Stripe
   - Set up subscription webhooks
   - Implement billing portal

3. **Enhance VIN scanning**:
   - Add actual OCR capability
   - Implement mobile camera integration
   - Add offline support

4. **Build inventory scraping**:
   - Implement website scraping with Puppeteer
   - Parse vehicle data from listings
   - Schedule automatic updates

5. **Add analytics and reporting**:
   - Sales performance tracking
   - Sweet spot analysis
   - Turn rate metrics
   - Profit analytics

6. **Implement email notifications**:
   - Welcome emails
   - Sale confirmations
   - Subscription updates
   - Recommendation alerts

## Support

For questions or issues:
- Email: support@dealercopilot.com
- Documentation: See README.md

## License

Proprietary - All rights reserved
