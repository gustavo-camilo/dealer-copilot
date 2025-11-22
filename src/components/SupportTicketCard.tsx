import { useState } from 'react';
import { MessageSquare, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SupportTicket {
    id: string;
    type: 'missing_market_data' | 'bug' | 'feature_request' | 'other';
    subject: string;
    details: any;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    created_at: string;
    tenant: {
        name: string;
        contact_email: string;
    };
    user: {
        full_name: string;
        email: string;
    };
}

interface SupportTicketCardProps {
    ticket: SupportTicket;
    onUpdateStatus: (id: string, status: string) => void;
}

export default function SupportTicketCard({ ticket, onUpdateStatus }: SupportTicketCardProps) {
    const [expanded, setExpanded] = useState(false);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-800';
            case 'in_progress': return 'bg-yellow-100 text-yellow-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'text-red-600 font-bold';
            case 'high': return 'text-orange-600 font-semibold';
            case 'medium': return 'text-blue-600';
            case 'low': return 'text-gray-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                        </span>
                        <span className={`text-xs uppercase ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority} Priority
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        {ticket.type === 'missing_market_data' && <AlertCircle className="h-5 w-5 text-orange-500" />}
                        {ticket.subject}
                    </h3>

                    <p className="text-sm text-gray-600">
                        Reported by <span className="font-medium">{ticket.user?.full_name || 'Unknown User'}</span> from <span className="font-medium">{ticket.tenant?.name || 'Unknown Dealer'}</span>
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={ticket.status}
                        onChange={(e) => onUpdateStatus(ticket.id, e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>

                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Ticket Details</h4>
                            <div className="bg-gray-50 p-3 rounded text-sm font-mono text-gray-700 overflow-auto max-h-60">
                                <pre>{JSON.stringify(ticket.details, null, 2)}</pre>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact Info</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p>Email: {ticket.user?.email}</p>
                                <p>Dealer Email: {ticket.tenant?.contact_email}</p>
                            </div>

                            {ticket.type === 'missing_market_data' && (
                                <div className="mt-4">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Actions</h4>
                                    <a
                                        href={`https://www.google.com/search?q=${ticket.details?.decoded_data?.year}+${ticket.details?.decoded_data?.make}+${ticket.details?.decoded_data?.model}+price`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                        Google Search Vehicle
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
