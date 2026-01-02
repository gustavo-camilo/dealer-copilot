import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { VehicleComment, AuctionSource } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface VehicleCommentSectionProps {
  vinScanId: string;
  tenantId: string;
}

export function VehicleCommentSection({ vinScanId, tenantId }: VehicleCommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<(VehicleComment & { user_name: string })[]>([]);
  const [auctionSources, setAuctionSources] = useState<AuctionSource[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      loadComments();
      loadAuctionSources();
    }
  }, [isExpanded, vinScanId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_comments')
        .select(`
          *,
          user:users(full_name)
        `)
        .eq('vin_scan_id', vinScanId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedComments = data?.map(comment => ({
        ...comment,
        user_name: comment.user?.full_name || 'Unknown User'
      })) || [];

      setComments(formattedComments);
    } catch (error: any) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuctionSources = async () => {
    try {
      const { data, error } = await supabase
        .from('auction_sources')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setAuctionSources(data || []);
    } catch (error: any) {
      console.error('Error loading auction sources:', error);
      toast.error('Failed to load auction sources');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    if (!selectedAuctionId) {
      toast.error('Please select an auction source');
      return;
    }

    setIsSaving(true);
    try {
      const selectedAuction = auctionSources.find(a => a.id === selectedAuctionId);

      const { error } = await supabase
        .from('vehicle_comments')
        .insert({
          tenant_id: tenantId,
          user_id: user?.id,
          vin_scan_id: vinScanId,
          comment: newComment.trim(),
          auction_source_id: selectedAuctionId,
          auction_source_name: selectedAuction?.name
        });

      if (error) throw error;

      toast.success('Comment added successfully');
      setNewComment('');
      setSelectedAuctionId('');
      loadComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('vehicle_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comment deleted');
      loadComments();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="border border-gray-200 dark:border-navy-700 rounded-lg">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Comments & Auction Source
          </span>
          {comments.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full">
              {comments.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-navy-700 p-4 space-y-4">
          {/* Add Comment Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Auction Source *
              </label>
              <select
                value={selectedAuctionId}
                onChange={(e) => setSelectedAuctionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-navy-600 rounded-md bg-white dark:bg-navy-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              >
                <option value="">Select auction...</option>
                {auctionSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Comment / Observations
              </label>
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add notes or observations about this vehicle..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-navy-600 rounded-md bg-white dark:bg-navy-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  disabled={isSaving}
                />
              </div>
            </div>

            <button
              onClick={handleAddComment}
              disabled={isSaving || !newComment.trim() || !selectedAuctionId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {isSaving ? 'Adding...' : 'Add Comment'}
            </button>
          </div>

          {/* Comments List */}
          {isLoading ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              No comments yet. Be the first to add one!
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 bg-gray-50 dark:bg-navy-700 rounded-lg border border-gray-200 dark:border-navy-600"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {comment.user_name}
                        </span>
                        {comment.auction_source_name && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded">
                            {comment.auction_source_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    {comment.user_id === user?.id && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-500/20 rounded transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {comment.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
