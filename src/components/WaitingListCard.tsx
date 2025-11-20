import React from 'react';

interface WaitingListEntry {
  id: string;
  tenant_id: string;
  website_url: string;
  requested_at: string;
  status: string;
  assigned_to: string | null;
  priority: number;
  notes: string | null;
  tenant: {
    name: string;
    contact_email: string;
    contact_phone: string | null;
    location: string | null;
  };
  assigned_user?: {
    full_name: string;
    email: string;
  } | null;
}

interface WaitingListCardProps {
  entry: WaitingListEntry;
  onUpload?: (tenantId: string) => void;
  onUpdateStatus?: (entryId: string, status: string) => void;
  onUpdatePriority?: (entryId: string, priority: number) => void;
}

export default function WaitingListCard({
  entry,
  onUpload,
  onUpdateStatus,
  onUpdatePriority,
}: WaitingListCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityEmoji = (priority: number) => {
    if (priority >= 5) return '🔴';
    if (priority >= 3) return '🟡';
    return '🟢';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-gray-900">{entry.tenant.name}</h3>
            <span className="text-2xl">{getPriorityEmoji(entry.priority)}</span>
          </div>
          <a
            href={entry.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {entry.website_url}
          </a>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(entry.status)}`}>
          {entry.status.replace('_', ' ')}
        </span>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Contact Email</p>
          <p className="text-sm text-gray-900">{entry.tenant.contact_email}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Location</p>
          <p className="text-sm text-gray-900">{entry.tenant.location || 'Not specified'}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Phone</p>
          <p className="text-sm text-gray-900">{entry.tenant.contact_phone || 'Not specified'}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Requested</p>
          <p className="text-sm text-gray-900">{formatDate(entry.requested_at)}</p>
        </div>
      </div>

      {/* Priority Selector */}
      {onUpdatePriority && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block">Priority Level</label>
          <select
            value={entry.priority}
            onChange={(e) => onUpdatePriority(entry.id, parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value={1}>🟢 Low (1)</option>
            <option value={2}>🟢 Normal (2)</option>
            <option value={3}>🟡 Medium (3)</option>
            <option value={4}>🟡 High (4)</option>
            <option value={5}>🔴 Urgent (5)</option>
          </select>
        </div>
      )}

      {/* Assigned User */}
      {entry.assigned_user && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Assigned To</p>
          <p className="text-sm text-gray-900 font-medium">{entry.assigned_user.full_name}</p>
          <p className="text-xs text-gray-500">{entry.assigned_user.email}</p>
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-900">{entry.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onUpload && (
          <button
            onClick={() => onUpload(entry.tenant_id)}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg font-medium transition text-sm text-white"
          >
            Upload CSV
          </button>
        )}

        {onUpdateStatus && entry.status === 'pending' && (
          <button
            onClick={() => onUpdateStatus(entry.id, 'in_progress')}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition text-sm text-white"
          >
            Mark In Progress
          </button>
        )}

        {onUpdateStatus && entry.status === 'in_progress' && (
          <button
            onClick={() => onUpdateStatus(entry.id, 'completed')}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition text-sm text-white"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}
