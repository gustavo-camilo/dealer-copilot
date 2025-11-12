import { DecodedVehicleData } from '../types/database';

const AUTODEV_API_KEY = import.meta.env.VITE_AUTODEV_API_KEY;
const AUTODEV_BASE_URL = 'https://api.auto.dev';

export interface AutoDevVINResponse {
  vin: string;
  vinValid: boolean;
  year: number;
  make: string;
  model: string;
  trim?: string;
  style?: string;
  type?: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    manufacturer: string;
  };
}

export interface VINDecoderResult {
  success: boolean;
  data?: DecodedVehicleData;
  error?: string;
  source: 'autodev' | 'nhtsa' | 'cache';
}

/**
 * Decode VIN using Auto.dev API
 */
async function decodeVINWithAutoDev(vin: string): Promise<VINDecoderResult> {
  try {
    const response = await fetch(`${AUTODEV_BASE_URL}/vin/${vin}`, {
      headers: {
        'Authorization': `Bearer ${AUTODEV_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Auto.dev API error: ${response.status}`);
    }

    const data: AutoDevVINResponse = await response.json();

    if (!data.vinValid) {
      return {
        success: false,
        error: 'Invalid VIN format',
        source: 'autodev',
      };
    }

    const decodedData: DecodedVehicleData = {
      year: data.vehicle.year,
      make: data.vehicle.make,
      model: data.vehicle.model,
      trim: data.trim,
      body_type: data.type,
      // These fields will be populated from other sources or user input
      engine: undefined,
      transmission: undefined,
      exterior_color: undefined,
      mileage: undefined,
      title_status: 'clean', // Default assumption
      owner_count: undefined,
      accident_count: undefined,
      service_records: undefined,
    };

    return {
      success: true,
      data: decodedData,
      source: 'autodev',
    };
  } catch (error) {
    console.error('Auto.dev VIN decode error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'autodev',
    };
  }
}

/**
 * Fallback VIN decoder using NHTSA free API
 */
async function decodeVINWithNHTSA(vin: string): Promise<VINDecoderResult> {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );

    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.Results;

    const getValue = (variableName: string): string | undefined => {
      const item = results.find((r: any) => r.Variable === variableName);
      return item?.Value || undefined;
    };

    const year = parseInt(getValue('Model Year') || '0');
    const make = getValue('Make');
    const model = getValue('Model');

    if (!year || !make || !model) {
      return {
        success: false,
        error: 'Incomplete VIN data from NHTSA',
        source: 'nhtsa',
      };
    }

    const decodedData: DecodedVehicleData = {
      year,
      make,
      model,
      trim: getValue('Trim'),
      body_type: getValue('Body Class'),
      engine: getValue('Engine Model'),
      transmission: getValue('Transmission Style'),
      exterior_color: undefined,
      mileage: undefined,
      title_status: 'clean',
      owner_count: undefined,
      accident_count: undefined,
      service_records: undefined,
    };

    return {
      success: true,
      data: decodedData,
      source: 'nhtsa',
    };
  } catch (error) {
    console.error('NHTSA VIN decode error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'nhtsa',
    };
  }
}

/**
 * Main VIN decoder with fallback strategy
 * Tries Auto.dev first, falls back to NHTSA if needed
 */
export async function decodeVIN(vin: string): Promise<VINDecoderResult> {
  // Validate VIN format
  if (!vin || vin.length !== 17) {
    return {
      success: false,
      error: 'VIN must be exactly 17 characters',
      source: 'autodev',
    };
  }

  // Try Auto.dev first (includes more data)
  const autoDevResult = await decodeVINWithAutoDev(vin);
  if (autoDevResult.success) {
    return autoDevResult;
  }

  // Fallback to NHTSA free API
  console.log('Auto.dev failed, falling back to NHTSA...');
  const nhtsaResult = await decodeVINWithNHTSA(vin);

  return nhtsaResult;
}

/**
 * Enrich decoded data with additional information
 * (mileage, title status, etc. provided by user or external services)
 */
export function enrichDecodedData(
  baseData: DecodedVehicleData,
  additionalInfo: Partial<DecodedVehicleData>
): DecodedVehicleData {
  return {
    ...baseData,
    ...additionalInfo,
  };
}
