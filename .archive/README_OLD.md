# Dealer Co-Pilot MVP

A mobile-first acquisition intelligence platform for automotive dealers. Analyze your inventory, get smart buy recommendations, and scan VINs at auctions for instant guidance.

## Features

- **Instant Portfolio Analysis**: Scan your dealership website and get comprehensive inventory insights in 30 seconds
- **AI-Powered Recommendations**: Get smart buy recommendations based on your inventory profile and sales history
- **Mobile VIN Scanner**: Scan VINs at auctions and get instant buy/no-buy guidance with profit calculations
- **Sales Tracking**: Track your sales and discover your "sweet spot" - vehicles that sell fastest and most profitably
- **Multi-Tenant SaaS**: Complete multi-tenant architecture with tenant isolation and admin panel
- **Super Admin Dashboard**: Manage all dealerships, subscriptions, and users from a centralized dashboard

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React
- **Deployment Ready**: Vercel/Netlify compatible

## Architecture

### Multi-Tenant Design

- Shared database with tenant isolation via `tenant_id` foreign keys
- Row Level Security (RLS) policies ensure tenants only access their own data
- Role-based access control: `super_admin`, `tenant_admin`, `tenant_user`

### Database Schema

- `tenants` - Dealership accounts
- `users` - User accounts with tenant association
- `vehicles` - Inventory data per tenant
- `sales_records` - Sales tracking per tenant
- `vin_scans` - VIN scan history per tenant
- `subscriptions` - Billing and subscription management

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dealer-copilot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the database:
- Run the migration files in `supabase/migrations/` in order
- This will create all tables and Row Level Security policies

5. Start the development server:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
dealer-copilot/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── lib/              # Utilities and helpers
│   ├── services/         # API and Supabase services
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── contexts/         # React context providers
├── supabase/
│   └── migrations/       # Database migration files
└── public/               # Static assets
```

## Super Admin Access

To create a super admin user:

1. Sign up through the normal flow
2. In Supabase, update the user's role:
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';
```

3. Access the admin panel at `/admin`

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Netlify

1. Connect your GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables in Netlify dashboard

## License

Proprietary - All rights reserved

## Support

For support, email support@dealercopilot.com
