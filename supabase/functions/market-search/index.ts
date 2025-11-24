import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { year, make, model, zip, radius, mileage, start, rows } = await req.json()

        const API_KEY = Deno.env.get('MARKETCHECK_API_KEY')
        if (!API_KEY) {
            console.error('MARKETCHECK_API_KEY is not set')
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        const params = new URLSearchParams({
            api_key: API_KEY,
            year: year ? `${year - 1}-${year + 1}` : '',
            make: make || '',
            model: model || '',
            radius: (radius || 50).toString(),
            zip: zip || '',
            car_type: 'used',
            start: (start || 0).toString(),
            rows: (rows || 50).toString(),
        })

        // Add mileage range if provided (+/- 10k miles)
        if (mileage) {
            const minMiles = Math.max(0, mileage - 10000)
            const maxMiles = mileage + 10000
            params.append('miles_range', `${minMiles}-${maxMiles}`)
        }

        const response = await fetch(`https://api.marketcheck.com/v2/search?${params.toString()}`)

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Marketcheck API error: ${response.status} - ${errorText}`)
            return new Response(
                JSON.stringify({ error: `Marketcheck API error: ${response.status}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
            )
        }

        const data = await response.json()

        return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
