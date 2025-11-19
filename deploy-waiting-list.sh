#!/bin/bash

# Deploy the updated get-waiting-list edge function
# This function now automatically shows all tenants without inventory

echo "Deploying get-waiting-list edge function..."
npx supabase functions deploy get-waiting-list --project-ref fljbojafogcmyzrqxznq

echo ""
echo "Deployment complete!"
echo ""
echo "Changes made:"
echo "- Waiting list now automatically includes all tenants with inventory_status != 'ready'"
echo "- Auto-creates waiting list entries for tenants that don't have one"
echo "- Tenants appear in waiting list until their inventory is ready"
