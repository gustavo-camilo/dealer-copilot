import { supabase } from '../lib/supabase';

export interface TicketData {
    type: 'missing_market_data' | 'bug' | 'feature_request' | 'other';
    subject: string;
    details: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export const SupportService = {
    /**
     * Create a new support ticket
     */
    async createTicket(ticket: TicketData) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error('User not authenticated');

        // Get user's tenant_id
        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        if (!userData?.tenant_id) throw new Error('User has no tenant');

        const { data, error } = await supabase
            .from('support_tickets')
            .insert({
                tenant_id: userData.tenant_id,
                user_id: user.id,
                type: ticket.type,
                subject: ticket.subject,
                details: ticket.details,
                priority: ticket.priority || 'medium',
                status: 'open'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
