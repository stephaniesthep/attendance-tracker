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

// Simple in-memory cache for client-side
const locationCache = new Map<string, { result: LocationResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

// Enhanced reverse geocoding with multiple providers and caching
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (!isValidCoordinates(lat, lng)) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    const cacheKey = getCacheKey(lat, lng);
    const cached = locationCache.get(cacheKey);
    
    // Check cache validity
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.result.name;
    }

    // Try multiple providers
    const result = await getLocationWithFallback(lat, lng);
    
    // Cache the result
    locationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result.name;
  } catch (error) {
    console.error('Location service failed:', error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// Get location with multiple provider fallback
async function getLocationWithFallback(lat: number, lng: number): Promise<LocationResult> {
  // Try OpenStreetMap Nominatim first
  try {
    const nominatimResult = await tryNominatim(lat, lng);
    if (nominatimResult) {
      return nominatimResult;
    }
  } catch (error) {
    console.warn('Nominatim failed:', error);
  }

  // Fallback to coordinate-based name
  return {
    name: `Location ${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`,
    confidence: 'low',
    source: 'fallback',
    coordinates: { lat, lng },
  };
}

// OpenStreetMap Nominatim provider
async function tryNominatim(lat: number, lng: number): Promise<LocationResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'AttendanceTracker/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.display_name) {
      return null;
    }

    const address = data.address || {};
    
    // Build location name with priority order
    const locationParts = [
      address.house_number,
      address.road,
      address.neighbourhood || address.suburb,
      address.city || address.town || address.village,
      address.state,
      address.country
    ].filter(Boolean);

    const name = locationParts.slice(0, 3).join(", ") || data.display_name;
    
    // Determine confidence based on address completeness
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (address.road && (address.city || address.town)) {
      confidence = 'high';
    } else if (address.neighbourhood || address.suburb) {
      confidence = 'medium';
    }

    return {
      name,
      confidence,
      source: 'nominatim',
      coordinates: { lat, lng },
      components: {
        street: address.road,
        city: address.city || address.town || address.village,
        state: address.state,
        country: address.country,
        postalCode: address.postcode,
      },
    };
  } catch (error) {
    console.error('Nominatim geocoding failed:', error);
    return null;
  }
}

// Validate coordinates
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

// Get current location with enhanced error handling
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000, // 20 seconds - increased for GPS lock
      maximumAge: 0, // Always get fresh location data
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        reject(new Error(message));
      },
      options
    );
  });
}

// Watch location changes
export function watchLocation(
  onSuccess: (coords: Coordinates) => void,
  onError: (error: Error) => void
): number {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation is not supported by this browser'));
    return -1;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 20000, // 20 seconds - increased for GPS lock
    maximumAge: 0, // Always get fresh location data for maximum accuracy
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    (error) => {
      let message = 'Unable to watch location';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location information unavailable';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out';
          break;
      }
      onError(new Error(message));
    },
    options
  );
}

// Stop watching location
export function clearLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// Format location for display
export function formatLocationForDisplay(result: LocationResult): string {
  return result.name;
}

// Clear client-side cache
export function clearLocationCache(): void {
  locationCache.clear();
}

// Get cache statistics
export function getLocationCacheStats() {
  return {
    size: locationCache.size,
    entries: Array.from(locationCache.entries()).map(([key, value]) => ({
      key,
      name: value.result.name,
      confidence: value.result.confidence,
      source: value.result.source,
      age: Date.now() - value.timestamp,
    })),
  };
}