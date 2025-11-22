export interface MarketListing {
    id: string;
    price: number;
    miles: number;
    title: string;
    dealer?: string;
    distance?: number;
    url?: string;
    vin?: string;
    city?: string;
    state?: string;
}

export interface MarketPricingData {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    medianPrice: number;
    listingsCount: number;
    listings: MarketListing[];
    confidence: number; // 0-100
    dataSource: 'estimated' | 'marketcheck' | 'autodev';
}
