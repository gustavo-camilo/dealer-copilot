import { MarketPricingData } from '../types/market';



interface MarketcheckListing {
    id: string;
    heading: string;
    vin: string;
    price: number;
    miles: number;
    msrp?: number;
    dom?: number; // Days on market
    seller_name?: string;
    seller_city?: string;
    seller_state?: string;
    vdp_url?: string;
}

interface MarketcheckSearchResponse {
    num_found: number;
    listings: MarketcheckListing[];
}

/**
 * Search for active listings on Marketcheck
 */
import { supabase } from '../lib/supabase';

/**
 * Search for active listings on Marketcheck via Supabase Edge Function
 */
export async function searchActiveListings(
    year: number,
    make: string,
    model: string,
    zip: string,
    radius: number = 50,
    mileage?: number
): Promise<MarketcheckSearchResponse | null> {
    try {
        const { data, error } = await supabase.functions.invoke('market-search', {
            body: {
                year,
                make,
                model,
                zip,
                radius,
                mileage
            }
        });

        if (error) {
            throw new Error(`Marketcheck API error: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('Error fetching Marketcheck data:', error);
        return null;
    }
}

/**
 * Convert Marketcheck response to our internal MarketPricingData format
 */
export function processMarketcheckData(
    data: MarketcheckSearchResponse
): MarketPricingData {
    const listings = data.listings.filter(l => l.price > 0); // Filter out zero price

    if (listings.length === 0) {
        throw new Error('No valid listings found');
    }

    const prices = listings.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const averagePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    // Calculate median
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const medianPrice = prices.length % 2 !== 0
        ? prices[mid]
        : Math.round((prices[mid - 1] + prices[mid]) / 2);

    return {
        averagePrice,
        minPrice,
        maxPrice,
        medianPrice,
        listingsCount: data.num_found,
        listings: listings.map(l => ({
            id: l.id,
            price: l.price,
            miles: l.miles,
            title: l.heading,
            dealer: l.seller_name,
            distance: 0, // We don't get exact distance in basic search response easily without extra calc
            url: l.vdp_url,
            vin: l.vin,
            city: l.seller_city,
            state: l.seller_state
        })),
        confidence: listings.length > 10 ? 90 : listings.length > 5 ? 70 : 50,
        dataSource: 'marketcheck'
    };
}
