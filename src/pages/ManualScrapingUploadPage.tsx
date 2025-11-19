import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CSVUploader from '../components/CSVUploader';

interface Tenant {
  id: string;
  name: string;
  website_url: string;
}

interface ValidationResult {
  valid: number;
  invalid: number;
  pseudoVINs: number;
  missingFields: string[];
  preview: any[];
}

export default function ManualScrapingUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Check if user has permission
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userData || !['super_admin', 'va_uploader'].includes(userData.role)) {
        navigate('/dashboard');
        return;
      }
    };

    checkPermission();
  }, [user, navigate]);

  // Load tenants
  useEffect(() => {
    const loadTenants = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, website_url')
          .order('name');

        if (error) throw error;

        setTenants(data || []);

        // If tenant_id in URL params, pre-select it
        const tenantIdParam = searchParams.get('tenant_id');
        if (tenantIdParam && data?.some(t => t.id === tenantIdParam)) {
          setSelectedTenantId(tenantIdParam);
        }
      } catch (err: any) {
        console.error('Error loading tenants:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, [searchParams]);

  const validateCSV = (content: string): ValidationResult => {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    // Required headers
    const requiredHeaders = [
      'Dealership_URL',
      'Year',
      'Make',
      'Model',
      'Price',
      'Days_In_Stock',
    ];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const preview: any[] = [];
    let validVINs = 0;
    let invalidVINs = 0;
    let pseudoVINs = 0;
    const missingFields: string[] = [];

    // Process data rows (skip header)
    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      // Preview first 10 rows
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      // Check VIN
      const vin = row.VIN;
      if (vin && vin.length === 17) {
        validVINs++;
      } else if (vin) {
        invalidVINs++;
        pseudoVINs++;
      } else {
        pseudoVINs++;
      }

      // Check required fields
      requiredHeaders.forEach(field => {
        if (!row[field]) {
          missingFields.push(`Row ${i + 1}: Missing ${field}`);
        }
      });

      preview.push(row);
    }

    // Count total pseudo-VINs
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const vinIndex = headers.indexOf('VIN');
      const vin = vinIndex >= 0 ? values[vinIndex]?.trim() : '';

      if (!vin || vin.length !== 17) {
        pseudoVINs++;
      }
    }

    return {
      valid: validVINs,
      invalid: invalidVINs,
      pseudoVINs: lines.length - 1 - validVINs, // Total rows minus header minus valid VINs
      missingFields: missingFields.slice(0, 10), // Show first 10 issues
      preview,
    };
  };

  const handleFileSelect = (file: File, content: string) => {
    setCsvFile(file);
    setCsvContent(content);
    setError('');
    setValidationResult(null);
    setUploadResult(null);

    try {
      const result = validateCSV(content);
      setValidationResult(result);

      if (result.missingFields.length > 0) {
        setError('Some rows have missing required fields. See validation results below.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClear = () => {
    setCsvFile(null);
    setCsvContent('');
    setValidationResult(null);
    setUploadResult(null);
    setError('');
    setMessage('');
  };

  const handleUpload = async () => {
    if (!csvFile || !csvContent || !selectedTenantId) {
      setError('Please select a tenant and upload a CSV file');
      return;
    }

    if (validationResult && validationResult.missingFields.length > 0) {
      const confirmed = window.confirm(
        'Some rows have missing required fields. Do you want to continue? Invalid rows will be skipped.'
      );
      if (!confirmed) return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    setUploadResult(null);

    try {
      const { data, error: uploadError } = await supabase.functions.invoke(
        'upload-manual-scraping',
        {
          body: {
            csv_content: csvContent,
            filename: csvFile.name,
            tenant_id: selectedTenantId,
          },
        }
      );

      if (uploadError) throw uploadError;

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadResult(data);
      setMessage('CSV uploaded and processed successfully!');

      // Clear form after successful upload
      setTimeout(() => {
        handleClear();
        setSelectedTenantId('');
      }, 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Dealership_URL,Year,Make,Model,Mileage,Price,VIN,Days_In_Stock,Body_Style,Photo_URL
https://example.com,2022,Toyota,Camry,25000,28500,1HGBH41JXMN109186,15,Sedan,https://example.com/photo.jpg
https://example.com,2021,Honda,Accord,30000,26500,2HGFC2F59MH123456,20,Sedan,https://example.com/photo2.jpg`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scraping_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Upload Manual Scraping Data</h1>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Tenant Selector */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
          <label className="block text-lg font-semibold mb-3">Select Dealership</label>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a dealership...</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.website_url})
              </option>
            ))}
          </select>
        </div>

        {/* CSV Upload */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Upload CSV File</h2>
          <CSVUploader onFileSelect={handleFileSelect} onClear={handleClear} />
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Validation Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-300">{validationResult.valid}</p>
                <p className="text-sm text-gray-300">Valid VINs</p>
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-yellow-300">{validationResult.pseudoVINs}</p>
                <p className="text-sm text-gray-300">Generated Pseudo-VINs</p>
              </div>

              <div className={`rounded-lg p-4 ${
                validationResult.missingFields.length > 0
                  ? 'bg-red-500/20 border border-red-500/50'
                  : 'bg-green-500/20 border border-green-500/50'
              }`}>
                <p className={`text-2xl font-bold ${
                  validationResult.missingFields.length > 0 ? 'text-red-300' : 'text-green-300'
                }`}>
                  {validationResult.missingFields.length}
                </p>
                <p className="text-sm text-gray-300">Missing Fields</p>
              </div>
            </div>

            {validationResult.missingFields.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-red-300">Issues Found:</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {validationResult.missingFields.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                  {validationResult.missingFields.length >= 10 && (
                    <li className="text-gray-400">... and more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div>
              <h3 className="font-semibold mb-3">Preview (First 10 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left p-2 text-gray-300">Year</th>
                      <th className="text-left p-2 text-gray-300">Make</th>
                      <th className="text-left p-2 text-gray-300">Model</th>
                      <th className="text-left p-2 text-gray-300">Price</th>
                      <th className="text-left p-2 text-gray-300">Mileage</th>
                      <th className="text-left p-2 text-gray-300">VIN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.preview.map((row, idx) => (
                      <tr key={idx} className="border-b border-white/10">
                        <td className="p-2">{row.Year}</td>
                        <td className="p-2">{row.Make}</td>
                        <td className="p-2">{row.Model}</td>
                        <td className="p-2">${row.Price}</td>
                        <td className="p-2">{row.Mileage}</td>
                        <td className="p-2 text-xs">{row.VIN || <span className="text-yellow-400">Will generate</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upload Results */}
        {uploadResult && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Upload Results</h2>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-300">{uploadResult.vehicles_processed}</p>
                <p className="text-sm text-gray-300">Total Processed</p>
              </div>

              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-green-300">{uploadResult.vehicles_new}</p>
                <p className="text-sm text-gray-300">New Vehicles</p>
              </div>

              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-yellow-300">{uploadResult.vehicles_updated}</p>
                <p className="text-sm text-gray-300">Updated</p>
              </div>

              <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-purple-300">{uploadResult.vehicles_sold}</p>
                <p className="text-sm text-gray-300">Marked as Sold</p>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 text-red-300">Errors:</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {uploadResult.errors.slice(0, 10).map((err: string, idx: number) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!csvFile || !selectedTenantId || uploading}
          className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload and Process CSV'}
        </button>
      </div>
    </div>
  );
}
