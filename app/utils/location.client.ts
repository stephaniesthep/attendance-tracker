// Re-export enhanced location service for backward compatibility
export {
  reverseGeocode,
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
  isValidCoordinates,
  formatLocationForDisplay,
  clearLocationCache,
  getLocationCacheStats,
  assessLocationAccuracy,
  getDetailedLocation,
  type Coordinates,
  type LocationResult,
  type LocationComponents,
  type LocationOptions
} from './location.client.enhanced';

// Legacy types for backward compatibility
export interface LegacyLocationResult {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'nominatim' | 'google' | 'cache' | 'fallback';
  coordinates: { lat: number; lng: number };
  components?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

// Legacy function for backward compatibility
export async function legacyReverseGeocode(lat: number, lng: number): Promise<string> {
  const { reverseGeocode } = await import('./location.client.enhanced');
  return reverseGeocode(lat, lng);
}