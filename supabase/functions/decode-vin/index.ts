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
        const { vin } = await req.json()

        if (!vin) {
            return new Response(
                JSON.stringify({ error: 'VIN is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const API_KEY = Deno.env.get('AUTODEV_API_KEY')
        if (!API_KEY) {
            console.error('AUTODEV_API_KEY is not set')
            return new Response(
                JSON.stringify({ error: 'Server configuration error: AUTODEV_API_KEY is missing' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
            )
        }

        const response = await fetch(`https://api.auto.dev/vin/${vin}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Auto.dev API error: ${response.status} - ${errorText}`)
            return new Response(
                JSON.stringify({ error: `Auto.dev API error: ${response.status}`, details: errorText }),
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
