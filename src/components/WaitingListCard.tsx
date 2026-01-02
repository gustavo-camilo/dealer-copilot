import { useState } from 'react';
import { Upload, Play, CheckCircle, PlusCircle, MinusCircle, MapPin, Mail, Building2, Calendar, Trash2, Globe } from 'lucide-react';

interface WaitingListEntry {
  id: string;
  tenant_id: string;
  website_url: string;
  requested_at: string;
  status: string;
  assigned_to: string | null;
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
  onDelete?: (entryId: string) => void;
}

export default function WaitingListCard({
  entry,
  onUpload,
  onUpdateStatus,
  onDelete,
}: WaitingListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'in_progress':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg transition overflow-hidden">
      {/* Condensed Row */}
      <div className="p-4 flex items-center justify-between gap-4">
        {/* Left: Dealer Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate" title={entry.website_url}>
              {entry.website_url}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(entry.status)}`}>
              {entry.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            Requested {formatDate(entry.requested_at)}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onUpload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpload(entry.tenant_id);
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-full transition"
              title="Upload CSV"
            >
              <Upload className="h-5 w-5" />
            </button>
          )}

          {onUpdateStatus && entry.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(entry.id, 'in_progress');
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/20 rounded-full transition"
              title="Mark In Progress"
            >
              <Play className="h-5 w-5" />
            </button>
          )}

          {onUpdateStatus && entry.status === 'in_progress' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateStatus(entry.id, 'completed');
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/20 rounded-full transition"
              title="Mark Complete"
            >
              <CheckCircle className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-full transition"
            title={isExpanded ? "Hide Details" : "View Details"}
          >
            {isExpanded ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
          </button>

          {onDelete && !showDeleteConfirm && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition"
              title="Delete Request"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}

          {onDelete && showDeleteConfirm && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white text-xs font-medium rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition"
              >
                Confirm Delete
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Dealership
              </p>
              <p className="text-sm text-gray-900 dark:text-white">{entry.tenant.name}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" /> Contact
              </p>
              <p className="text-sm text-gray-900 dark:text-white">{entry.tenant.contact_email}</p>
              {entry.tenant.contact_phone && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{entry.tenant.contact_phone}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </p>
              <p className="text-sm text-gray-900 dark:text-white">{entry.tenant.location || 'Not specified'}</p>
            </div>
          </div>

          {entry.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.notes}</p>
            </div>
          )}

          {entry.assigned_user && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assigned To</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.assigned_user.full_name} ({entry.assigned_user.email})</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
