#!/bin/bash

# Deploy market-search Edge Function
# Run with: ./deploy-market-search.sh YOUR_SUPABASE_ACCESS_TOKEN

if [ -z "$1" ]; then
  echo "Usage: ./deploy-market-search.sh YOUR_SUPABASE_ACCESS_TOKEN"
  exit 1
fi

export SUPABASE_ACCESS_TOKEN="$1"

npx supabase functions deploy market-search --project-ref ixajxijywscuzwkzujpf
