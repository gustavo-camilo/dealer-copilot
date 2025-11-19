import React, { useState, useEffect } from 'react';

interface EditableCostInputProps {
  label: string;
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  type?: 'currency' | 'percentage';
  min?: number;
  step?: number;
}

export default function EditableCostInput({
  label,
  value,
  defaultValue,
  onChange,
  type = 'currency',
  min = 0,
  step = type === 'percentage' ? 0.01 : 1,
}: EditableCostInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  const isEdited = value !== defaultValue;
  const prefix = type === 'currency' ? '$' : '';
  const suffix = type === 'percentage' ? '%' : '';

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  const handleSave = () => {
    const numValue = parseFloat(tempValue);
    if (!isNaN(numValue) && numValue >= min) {
      onChange(numValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const formatValue = (val: number) => {
    if (type === 'currency') {
      return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else {
      return val.toFixed(2);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
        {isEdited && (
          <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded">
            Edited
          </span>
        )}
      </label>

      {isEditing ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {prefix}
              </span>
            )}
            <input
              type="number"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              min={min}
              step={step}
              autoFocus
              className={`w-full px-4 py-2 bg-white/10 border-2 border-blue-500 rounded-lg text-white focus:outline-none ${
                prefix ? 'pl-8' : ''
              } ${suffix ? 'pr-8' : ''}`}
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {suffix}
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
            title="Save"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <button
            onClick={handleCancel}
            className="p-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition"
            title="Cancel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="group relative px-4 py-2 bg-white/5 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 hover:border-white/30 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">
              {prefix}{formatValue(value)}{suffix}
            </span>

            <div className="flex items-center gap-2">
              {isEdited && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(defaultValue);
                  }}
                  className="text-xs text-gray-400 hover:text-white transition"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}

              <svg
                className="w-4 h-4 text-gray-400 group-hover:text-white transition"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
          </div>

          {!isEdited && (
            <p className="text-xs text-gray-500 mt-1">
              Default: {prefix}{formatValue(defaultValue)}{suffix}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
