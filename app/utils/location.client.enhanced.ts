// Enhanced client-side location utilities
export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number; // GPS accuracy in meters
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationComponents {
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface LocationResult {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'nominatim' | 'google' | 'mapbox' | 'here' | 'opencage' | 'cache' | 'fallback';
  coordinates: Coordinates;
  components?: LocationComponents;
  qualityScore: number; // 0-100 quality score
  locationType?: 'residential' | 'commercial' | 'industrial' | 'landmark' | 'unknown';
  distance?: number; // Distance from original coordinates in meters
  responseTime?: number; // Provider response time in ms
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  retryAttempts?: number;
  progressiveAccuracy?: boolean;
}

// Enhanced in-memory cache with better management
class LocationCache {
  private cache = new Map<string, { result: LocationResult; timestamp: number; accessCount: number }>();
  private readonly maxSize = 200;
  private readonly ttl = 24 * 60 * 60 * 1000; // 24 hours

  private getCacheKey(lat: number, lng: number, precision: number = 4): string {
    return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
  }

  get(lat: number, lng: number): LocationResult | null {
    // Try different precision levels
    for (const precision of [6, 5, 4, 3]) {
      const key = this.getCacheKey(lat, lng, precision);
      const cached = this.cache.get(key);
      
      if (cached && (Date.now() - cached.timestamp) < this.ttl) {
        cached.accessCount++;
        return { ...cached.result, source: 'cache' };
      }
    }
    
    return null;
  }

  set(lat: number, lng: number, result: LocationResult): void {
    const key = this.getCacheKey(lat, lng, result.qualityScore > 80 ? 6 : 4);
    
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedCount = Infinity;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.accessCount < leastUsedCount || 
          (value.accessCount === leastUsedCount && value.timestamp < oldestTime)) {
        leastUsedKey = key;
        leastUsedCount = value.accessCount;
        oldestTime = value.timestamp;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        name: value.result.name,
        confidence: value.result.confidence,
        source: value.result.source,
        qualityScore: value.result.qualityScore,
        accessCount: value.accessCount,
        age: Date.now() - value.timestamp,
      })),
    };
  }
}

const locationCache = new LocationCache();

// Enhanced location acquisition with progressive accuracy
export class LocationAcquisition {
  private watchId: number | null = null;
  private currentOptions: LocationOptions = {};

  async getCurrentLocation(options: LocationOptions = {}): Promise<Coordinates> {
    const defaultOptions: LocationOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000, // Allow 30 second old location for faster response
      retryAttempts: 3,
      progressiveAccuracy: true,
    };

    const finalOptions = { ...defaultOptions, ...options };
    this.currentOptions = finalOptions;

    if (finalOptions.progressiveAccuracy) {
      return this.getProgressiveLocation(finalOptions);
    } else {
      return this.getSingleLocation(finalOptions);
    }
  }

  private async getProgressiveLocation(options: LocationOptions): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      let bestLocation: Coordinates | null = null;
      let attempts = 0;
      const maxAttempts = options.retryAttempts || 3;
      let timeoutId: NodeJS.Timeout;
      let satisfactoryFound = false;

      const cleanup = () => {
        if (this.watchId !== null) {
          navigator.geolocation.clearWatch(this.watchId);
          this.watchId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // Set overall timeout
      timeoutId = setTimeout(() => {
        cleanup();
        if (bestLocation) {
          resolve(bestLocation);
        } else {
          reject(new Error('Location request timed out'));
        }
      }, options.timeout || 8000);

      const geoOptions: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 3000, // Shorter timeout for faster response
        maximumAge: 0, // Always get fresh data for maximum accuracy
      };

      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          attempts++;
          const coords: Coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          };

          console.log(`GPS attempt ${attempts}: accuracy ${coords.accuracy?.toFixed(1)}m`);

          // Keep the most accurate location
          if (!bestLocation || (coords.accuracy && coords.accuracy < (bestLocation.accuracy || Infinity))) {
            bestLocation = coords;
            console.log(`New best location: ${coords.accuracy?.toFixed(1)}m accuracy`);
          }

          // Target <5m accuracy for excellent precision
          if (coords.accuracy && coords.accuracy <= 5) {
            console.log(`🎯 Excellent accuracy achieved: ${coords.accuracy.toFixed(1)}m`);
            satisfactoryFound = true;
            cleanup();
            resolve(bestLocation);
            return;
          }

          // Accept good accuracy (≤10m) after 2 attempts for speed
          if (attempts >= 2 && coords.accuracy && coords.accuracy <= 10) {
            console.log(`✅ Good accuracy achieved: ${coords.accuracy.toFixed(1)}m`);
            cleanup();
            resolve(bestLocation);
            return;
          }

          // Accept any reasonable accuracy (≤20m) after max attempts
          if (attempts >= maxAttempts) {
            console.log(`⏰ Max attempts reached, using best available: ${bestLocation.accuracy?.toFixed(1)}m`);
            cleanup();
            resolve(bestLocation);
          }
        },
        (error) => {
          attempts++;
          console.warn(`Location attempt ${attempts} failed:`, error);
          
          if (attempts >= maxAttempts) {
            cleanup();
            if (bestLocation) {
              console.log(`🔄 Using best available after errors: ${bestLocation.accuracy?.toFixed(1)}m`);
              resolve(bestLocation);
            } else {
              reject(new Error(this.getLocationErrorMessage(error)));
            }
          }
        },
        geoOptions
      );
    });
  }

  private async getSingleLocation(options: LocationOptions): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const geoOptions: PositionOptions = {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 15000,
        maximumAge: options.maximumAge ?? 30000,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          });
        },
        (error) => {
          reject(new Error(this.getLocationErrorMessage(error)));
        },
        geoOptions
      );
    });
  }

  private getLocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location access denied by user. Please enable location services.';
      case error.POSITION_UNAVAILABLE:
        return 'Location information unavailable. Please check your GPS settings.';
      case error.TIMEOUT:
        return 'Location request timed out. Please try again.';
      default:
        return 'Unable to get location. Please try again.';
    }
  }

  stopWatching(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

// Enhanced reverse geocoding with multiple providers
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (!isValidCoordinates(lat, lng)) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    // Check cache first
    const cached = locationCache.get(lat, lng);
    if (cached) {
      return cached.name;
    }

    // Try multiple providers with fallback
    const result = await getLocationWithFallback(lat, lng);
    
    // Cache the result
    locationCache.set(lat, lng, result);

    return result.name;
  } catch (error) {
    console.error('Location service failed:', error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// Enhanced location resolution with parallel requests for speed
async function getLocationWithFallback(lat: number, lng: number): Promise<LocationResult> {
  const providers = [
    () => tryNominatim(lat, lng),
    () => tryMapBox(lat, lng),
    () => tryGoogleMaps(lat, lng),
  ];

  // Try primary provider first for speed
  try {
    const primaryResult = await tryNominatim(lat, lng);
    if (primaryResult && primaryResult.qualityScore > 50) {
      console.log(`🚀 Fast location resolved: ${primaryResult.name} (${primaryResult.qualityScore}%)`);
      return primaryResult;
    }
  } catch (error) {
    console.warn('Primary provider failed, trying alternatives:', error);
  }

  // If primary fails or quality is low, try all providers in parallel for speed
  try {
    const results = await Promise.allSettled(
      providers.map(provider => provider())
    );

    // Find the best successful result
    let bestResult: LocationResult | null = null;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && result.value.qualityScore > 30) {
        if (!bestResult || result.value.qualityScore > bestResult.qualityScore) {
          bestResult = result.value;
        }
      }
    }

    if (bestResult) {
      console.log(`✅ Parallel location resolved: ${bestResult.name} (${bestResult.qualityScore}%)`);
      return bestResult;
    }
  } catch (error) {
    console.warn('All providers failed:', error);
  }

  // Fallback to coordinate-based name
  console.log('🔄 Using fallback location');
  return createFallbackResult(lat, lng);
}

// Enhanced Nominatim provider with speed optimizations
async function tryNominatim(lat: number, lng: number): Promise<LocationResult | null> {
  const startTime = Date.now();
  
  try {
    // Optimized query parameters for faster response
    const params = new URLSearchParams({
      format: 'json',
      lat: lat.toString(),
      lon: lng.toString(),
      zoom: '16', // Reduced zoom for faster response while maintaining accuracy
      addressdetails: '1',
      'accept-language': 'en,id', // Simplified language preference
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          'User-Agent': 'AttendanceTracker/2.0 (Fast Location Services)',
        },
        signal: AbortSignal.timeout(5000), // Reduced timeout for speed
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.display_name) {
      return null;
    }

    const responseTime = Date.now() - startTime;
    console.log(`📍 Nominatim response: ${responseTime}ms`);
    
    return parseNominatimResponse(data, lat, lng, responseTime);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.warn(`❌ Nominatim failed after ${responseTime}ms:`, error);
    return null;
  }
}

// MapBox provider (if API key is available)
async function tryMapBox(lat: number, lng: number): Promise<LocationResult | null> {
  // This would require API key configuration
  // For now, return null to skip this provider
  return null;
}

// Google Maps provider (if API key is available)
async function tryGoogleMaps(lat: number, lng: number): Promise<LocationResult | null> {
  // This would require API key configuration
  // For now, return null to skip this provider
  return null;
}

function parseNominatimResponse(data: any, lat: number, lng: number, responseTime: number): LocationResult {
  const address = data.address || {};
  
  const components: LocationComponents = {
    houseNumber: address.house_number,
    street: address.road || address.pedestrian || address.footway,
    neighborhood: address.neighbourhood || address.suburb || address.quarter,
    city: address.city || address.town || address.village || address.municipality,
    district: address.county || address.district,
    state: address.state || address.province,
    country: address.country,
    postalCode: address.postcode,
    countryCode: address.country_code?.toUpperCase(),
  };

  // Build intelligent location name
  const nameParts = [
    components.houseNumber && components.street ? `${components.houseNumber} ${components.street}` : components.street,
    components.neighborhood,
    components.city,
  ].filter(Boolean);

  const name = nameParts.length > 0 ? nameParts.join(", ") : data.display_name;
  
  // Calculate quality score
  let qualityScore = 50; // Base score
  if (components.houseNumber) qualityScore += 15;
  if (components.street) qualityScore += 20;
  if (components.neighborhood) qualityScore += 10;
  if (components.city) qualityScore += 15;
  if (responseTime < 2000) qualityScore += 10;
  if (responseTime < 1000) qualityScore += 5;
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (components.street && components.city) {
    confidence = 'high';
  } else if (components.neighborhood || components.city) {
    confidence = 'medium';
  }

  // Determine location type
  let locationType: LocationResult['locationType'] = 'unknown';
  const placeType = data.type || '';
  if (['house', 'residential', 'apartment'].some(t => placeType.includes(t))) {
    locationType = 'residential';
  } else if (['commercial', 'office', 'shop', 'retail'].some(t => placeType.includes(t))) {
    locationType = 'commercial';
  } else if (['industrial', 'warehouse', 'factory'].some(t => placeType.includes(t))) {
    locationType = 'industrial';
  } else if (['monument', 'memorial', 'attraction'].some(t => placeType.includes(t))) {
    locationType = 'landmark';
  }

  return {
    name,
    confidence,
    source: 'nominatim',
    coordinates: { lat, lng },
    components,
    qualityScore: Math.min(100, qualityScore),
    locationType,
    distance: 0,
    responseTime,
  };
}

function createFallbackResult(lat: number, lng: number): LocationResult {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  // Try to determine general region
  let region = 'Unknown Region';
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) {
    region = 'Indonesia';
  } else if (lat >= 1 && lat <= 7 && lng >= 103 && lng <= 105) {
    region = 'Singapore/Malaysia';
  }
  
  return {
    name: `Approximate Location: ${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir} (${region})`,
    confidence: 'low',
    source: 'fallback',
    coordinates: { lat, lng },
    qualityScore: 15,
    locationType: 'unknown',
    distance: 0,
    responseTime: 1,
  };
}

// Enhanced location validation
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

// Get current location with enhanced options
const locationAcquisition = new LocationAcquisition();

export function getCurrentLocation(options?: LocationOptions): Promise<Coordinates> {
  return locationAcquisition.getCurrentLocation(options);
}

// Watch location changes with enhanced handling
export function watchLocation(
  onSuccess: (coords: Coordinates) => void,
  onError: (error: Error) => void,
  options?: LocationOptions
): number {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation is not supported by this browser'));
    return -1;
  }

  const geoOptions: PositionOptions = {
    enableHighAccuracy: options?.enableHighAccuracy ?? true,
    timeout: options?.timeout ?? 20000,
    maximumAge: options?.maximumAge ?? 0,
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined,
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
    geoOptions
  );
}

// Stop watching location
export function clearLocationWatch(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
  }
  locationAcquisition.stopWatching();
}

// Enhanced location result with detailed information
export async function getDetailedLocation(lat: number, lng: number): Promise<LocationResult> {
  if (!isValidCoordinates(lat, lng)) {
    throw new Error('Invalid coordinates');
  }

  // Check cache first
  const cached = locationCache.get(lat, lng);
  if (cached) {
    return cached;
  }

  // Get location with fallback
  const result = await getLocationWithFallback(lat, lng);
  
  // Cache the result
  locationCache.set(lat, lng, result);
  
  return result;
}

// Format location for display with quality indicators
export function formatLocationForDisplay(result: LocationResult): string {
  const qualityIndicator = result.qualityScore > 80 ? '✓' : 
                          result.qualityScore > 50 ? '~' : '?';
  return `${result.name} ${qualityIndicator}`;
}

// Clear client-side cache
export function clearLocationCache(): void {
  locationCache.clear();
}

// Get cache statistics
export function getLocationCacheStats() {
  return locationCache.getStats();
}

// Location accuracy assessment
export function assessLocationAccuracy(coords: Coordinates): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  description: string;
} {
  const accuracy = coords.accuracy || Infinity;
  
  if (accuracy <= 5) {
    return { level: 'excellent', description: 'Very precise location (±5m)' };
  } else if (accuracy <= 20) {
    return { level: 'good', description: 'Good location accuracy (±20m)' };
  } else if (accuracy <= 100) {
    return { level: 'fair', description: 'Fair location accuracy (±100m)' };
  } else {
    return { level: 'poor', description: 'Poor location accuracy (>100m)' };
  }
}

// Export enhanced location service for backward compatibility
export {
  reverseGeocode as reverseGeocodeEnhanced,
  getCurrentLocation as getCurrentLocationEnhanced,
};