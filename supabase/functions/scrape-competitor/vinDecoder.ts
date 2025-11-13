// =====================================================
// VIN DECODER UTILITY
// =====================================================
// Uses NHTSA's free vPIC API to decode VINs
// Documentation: https://vpic.nhtsa.dot.gov/api/

import { createTimeoutSignal } from './timeout.ts';

export interface VINDecodedData {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  engineType?: string;
  driveType?: string;
}

/**
 * Decode a VIN using NHTSA's free vPIC API
 * Returns vehicle year, make, model, and other details
 */
export async function decodeVIN(vin: string): Promise<VINDecodedData | null> {
  if (!vin || vin.length !== 17) {
    console.log(`⚠️ Invalid VIN format: ${vin}`);
    return null;
  }

  try {
    console.log(`🔍 Decoding VIN via NHTSA API: ${vin}`);

    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DealerCopilotBot/1.0; +https://dealer-copilot.com/bot)',
      },
      signal: createTimeoutSignal(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.log(`❌ NHTSA API returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // NHTSA API returns an array of key-value pairs
    if (!data.Results || !Array.isArray(data.Results)) {
      console.log(`❌ Unexpected NHTSA API response format`);
      return null;
    }

    // Extract relevant fields from the results array
    const results = data.Results;
    const getValue = (variableId: number): string | undefined => {
      const item = results.find((r: any) => r.VariableId === variableId);
      return item?.Value || undefined;
    };

    const getValueByName = (name: string): string | undefined => {
      const item = results.find((r: any) => r.Variable === name);
      return item?.Value || undefined;
    };

    // Extract key fields (using common variable IDs and names)
    const yearStr = getValueByName('Model Year') || getValue(29);
    const make = getValueByName('Make') || getValue(26);
    const model = getValueByName('Model') || getValue(28);
    const trim = getValueByName('Trim') || getValue(109);
    const bodyType = getValueByName('Body Class') || getValue(5);
    const engineType = getValueByName('Engine Model') || getValue(13);
    const driveType = getValueByName('Drive Type') || getValue(15);

    const decoded: VINDecodedData = {
      vin,
      year: yearStr ? parseInt(yearStr) : undefined,
      make: make || undefined,
      model: model || undefined,
      trim: trim || undefined,
      bodyType: bodyType || undefined,
      engineType: engineType || undefined,
      driveType: driveType || undefined,
    };

    // Validate we got at least some useful data
    if (!decoded.year && !decoded.make && !decoded.model) {
      console.log(`⚠️ VIN decoded but no useful data found for ${vin}`);
      return null;
    }

    console.log(`✅ VIN decoded: ${decoded.year} ${decoded.make} ${decoded.model}`);
    return decoded;

  } catch (error) {
    console.log(`❌ Error decoding VIN ${vin}: ${error.message}`);
    return null;
  }
}

/**
 * Title case helper for VIN-decoded data
 */
function toTitleCase(str: string): string {
  if (!str) return str;

  // Split by spaces and hyphens but keep delimiters
  const words = str.split(/(\s+|-)/);

  return words.map(word => {
    // Skip delimiters (spaces and hyphens)
    if (word === ' ' || word === '-' || word.trim() === '') {
      return word;
    }

    // Handle special cases for alphanumeric like "F-150", "RX-350"
    if (/^[A-Z0-9]+$/i.test(word)) {
      // If it's mixed letters and numbers, keep uppercase letters
      if (/[A-Z]/i.test(word) && /[0-9]/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

/**
 * Fill in missing vehicle data using VIN decoder
 * Only fills in fields that are currently missing
 */
export async function enrichVehicleWithVIN(vehicle: any): Promise<any> {
  // Only attempt if we have a VIN but missing core data
  if (!vehicle.vin || vehicle.vin.length !== 17) {
    return vehicle;
  }

  // Check if we're missing critical data
  const needsDecoding = !vehicle.year || !vehicle.make || !vehicle.model;

  if (!needsDecoding) {
    return vehicle; // Already have all the data we need
  }

  console.log(`Vehicle ${vehicle.vin} missing data - attempting VIN decode...`);

  const decoded = await decodeVIN(vehicle.vin);

  if (!decoded) {
    return vehicle; // Decoding failed, return as-is
  }

  // Only fill in missing fields, don't override existing data
  return {
    ...vehicle,
    year: vehicle.year || decoded.year,
    make: vehicle.make || (decoded.make ? toTitleCase(decoded.make) : undefined),
    model: vehicle.model || (decoded.model ? toTitleCase(decoded.model) : undefined),
    trim: vehicle.trim || decoded.trim,
  };
}
