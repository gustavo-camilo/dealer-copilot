import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackMessage {
  text?: string;
  blocks?: any[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Slack webhook URL from environment
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (!slackWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL environment variable not configured');
    }

    // Create Supabase client (service role for internal operations)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse request body (optional - can specify tenant_id or fetch all pending)
    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body;

    // Build query for waiting list entries that need notification
    let query = supabaseClient
      .from('scraping_waiting_list')
      .select(`
        id,
        tenant_id,
        website_url,
        requested_at,
        priority,
        tenants!inner (
          name,
          contact_email,
          location
        )
      `)
      .eq('status', 'pending')
      .is('notified_at', null);

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }

    const { data: waitingEntries, error: queryError } = await query;

    if (queryError) {
      throw new Error(`Failed to fetch waiting list: ${queryError.message}`);
    }

    if (!waitingEntries || waitingEntries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending notifications',
          notified_count: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Send notification for each entry
    let notifiedCount = 0;
    const errors: string[] = [];

    for (const entry of waitingEntries) {
      try {
        // Format timestamp
        const requestedDate = new Date(entry.requested_at);
        const formattedDate = requestedDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        // Priority emoji
        const priorityEmoji = entry.priority >= 5 ? '🔴' : entry.priority >= 3 ? '🟡' : '🟢';

        // Create Slack message with rich formatting
        const slackMessage: SlackMessage = {
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚨 New Dealership Scraping Request',
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Dealership:*\n${entry.tenants.name}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Priority:*\n${priorityEmoji} Level ${entry.priority}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Website:*\n<${entry.website_url}|${entry.website_url}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Requested:*\n${formattedDate}`,
                },
              ],
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Contact:*\n${entry.tenants.contact_email}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Location:*\n${entry.tenants.location || 'Not specified'}`,
                },
              ],
            },
            {
              type: 'divider',
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚡ *Action Required:* Log in to the admin panel to upload CSV data for this dealership.',
              },
            },
          ],
        };

        // Send to Slack
        const slackResponse = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackMessage),
        });

        if (!slackResponse.ok) {
          const errorText = await slackResponse.text();
          throw new Error(`Slack API error: ${slackResponse.status} - ${errorText}`);
        }

        // Update notified_at timestamp
        const { error: updateError } = await supabaseClient
          .from('scraping_waiting_list')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Failed to update notified_at for ${entry.id}:`, updateError);
        }

        notifiedCount++;
        console.log(`Sent notification for tenant: ${entry.tenants.name}`);
      } catch (notifyError) {
        console.error(`Failed to notify for entry ${entry.id}:`, notifyError);
        errors.push(`${entry.tenants.name}: ${notifyError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified_count: notifiedCount,
        total_entries: waitingEntries.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending Slack notifications:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
