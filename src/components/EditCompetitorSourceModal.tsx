import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditCompetitorSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: {
    id: string;
    source_url: string;
    source_name: string | null;
    notes: string | null;
  } | null;
  onSave: (updatedSource: { id: string; source_name: string; notes?: string }) => Promise<void>;
}

export default function EditCompetitorSourceModal({
  isOpen,
  onClose,
  source,
  onSave,
}: EditCompetitorSourceModalProps) {
  const [formData, setFormData] = useState({
    source_name: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when source changes
  useEffect(() => {
    if (source) {
      setFormData({
        source_name: source.source_name || '',
        notes: source.notes || '',
      });
      setErrors({});
    }
  }, [source]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !source) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.source_name.trim()) {
      newErrors.source_name = 'Source name is required';
    } else if (formData.source_name.trim().length < 2) {
      newErrors.source_name = 'Source name must be at least 2 characters';
    } else if (formData.source_name.length > 100) {
      newErrors.source_name = 'Source name must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Saving source:', {
        id: source.id,
        source_name: formData.source_name.trim(),
        notes: formData.notes.trim() || undefined,
      });

      await onSave({
        id: source.id,
        source_name: formData.source_name.trim(),
        notes: formData.notes.trim() || undefined,
      });

      console.log('Save successful, closing modal');
      onClose();
    } catch (error) {
      console.error('Error saving competitor source:', error);
      setErrors({ submit: 'Failed to save changes. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Competitor Source</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Source URL (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source URL
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
              {source.source_url}
            </div>
            <p className="text-xs text-gray-500 mt-1">This URL cannot be changed</p>
          </div>

          {/* Source Name */}
          <div>
            <label htmlFor="source_name" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="source_name"
              value={formData.source_name}
              onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.source_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., ABC Motors"
              maxLength={100}
            />
            {errors.source_name && (
              <p className="text-sm text-red-600 mt-1">{errors.source_name}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              This name will be displayed to tenants viewing competitor intelligence
            </p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Internal notes about this competitor source..."
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              For internal use only (not visible to tenants)
            </p>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
