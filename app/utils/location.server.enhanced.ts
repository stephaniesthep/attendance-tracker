import { LRUCache } from "lru-cache";

// Enhanced types for better location handling
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

export interface GeocodingProvider {
  name: string;
  priority: number; // Lower number = higher priority
  rateLimit: number; // Requests per minute
  reverseGeocode: (lat: number, lng: number) => Promise<LocationResult | null>;
  isAvailable: () => boolean;
  getHealthScore: () => number; // 0-100 health score
}

// Enhanced caching with multiple levels
const preciseLocationCache = new LRUCache<string, LocationResult>({
  max: 500,
  ttl: 6 * 60 * 60 * 1000, // 6 hours for precise locations
});

const nearbyLocationCache = new LRUCache<string, LocationResult>({
  max: 1000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours for nearby locations
});

const administrativeCache = new LRUCache<string, LocationResult>({
  max: 200,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for administrative areas
});

// Utility functions
function getPreciseCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function getNearbyCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function getAdministrativeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateQualityScore(result: LocationResult, originalCoords: Coordinates): number {
  let score = 0;
  
  // Base score from provider reliability
  const providerScores = {
    'google': 90,
    'mapbox': 85,
    'here': 80,
    'nominatim': 75,
    'opencage': 70,
    'cache': 95,
    'fallback': 10
  };
  score += (providerScores[result.source] || 50) * 0.3;
  
  // Address completeness score
  const components = result.components || {};
  let completeness = 0;
  if (components.houseNumber) completeness += 20;
  if (components.street) completeness += 25;
  if (components.neighborhood) completeness += 15;
  if (components.city) completeness += 20;
  if (components.state) completeness += 10;
  if (components.country) completeness += 10;
  score += completeness * 0.4;
  
  // Distance accuracy (closer to original coordinates = higher score)
  if (result.distance !== undefined) {
    const distanceScore = Math.max(0, 100 - (result.distance / 10)); // 10m = 90 points, 100m = 0 points
    score += distanceScore * 0.2;
  }
  
  // Response time bonus (faster = better)
  if (result.responseTime !== undefined) {
    const timeScore = Math.max(0, 100 - (result.responseTime / 50)); // 50ms = 99 points, 5000ms = 0 points
    score += timeScore * 0.1;
  }
  
  return Math.min(100, Math.max(0, score));
}

// Enhanced Nominatim Provider
class EnhancedNominatimProvider implements GeocodingProvider {
  name = 'nominatim';
  priority = 1;
  rateLimit = 60; // 1 request per second
  private lastRequest = 0;
  private healthScore = 100;
  private failureCount = 0;

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    const startTime = Date.now();
    
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&extratags=1&namedetails=1`,
        {
          headers: {
            'User-Agent': 'AttendanceTracker/2.0 (Enhanced Location Services)',
            'Accept-Language': 'en,id;q=0.9', // Prefer English, fallback to Indonesian
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
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
      const responseTime = Date.now() - startTime;
      
      // Enhanced address parsing
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

      const result: LocationResult = {
        name,
        confidence: this.calculateConfidence(components),
        source: 'nominatim',
        coordinates: { lat, lng },
        components,
        qualityScore: 0, // Will be calculated later
        locationType,
        distance: 0, // Will be calculated if needed
        responseTime,
      };

      result.qualityScore = calculateQualityScore(result, { lat, lng });
      
      // Update health score on success
      this.failureCount = Math.max(0, this.failureCount - 1);
      this.healthScore = Math.min(100, this.healthScore + 1);
      
      return result;
    } catch (error) {
      console.error('Enhanced Nominatim geocoding failed:', error);
      this.failureCount++;
      this.healthScore = Math.max(0, this.healthScore - 5);
      return null;
    }
  }

  private calculateConfidence(components: LocationComponents): 'high' | 'medium' | 'low' {
    let score = 0;
    if (components.houseNumber) score += 3;
    if (components.street) score += 3;
    if (components.neighborhood) score += 2;
    if (components.city) score += 2;
    
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  isAvailable(): boolean {
    return this.healthScore > 20;
  }

  getHealthScore(): number {
    return this.healthScore;
  }
}

// MapBox Provider
class MapBoxProvider implements GeocodingProvider {
  name = 'mapbox';
  priority = 2;
  rateLimit = 600; // 600 requests per minute
  private apiKey: string;
  private healthScore = 100;
  private failureCount = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MAPBOX_ACCESS_TOKEN || '';
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    if (!this.apiKey) {
      console.warn('MapBox access token not configured');
      return null;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.apiKey}&types=address,poi&language=en`,
        {
          signal: AbortSignal.timeout(8000), // 8 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return null;
      }

      const feature = data.features[0];
      const responseTime = Date.now() - startTime;
      
      // Parse MapBox response
      const components: LocationComponents = {};
      const context = feature.context || [];
      
      // Extract components from context
      context.forEach((item: any) => {
        const id = item.id || '';
        if (id.startsWith('neighborhood')) {
          components.neighborhood = item.text;
        } else if (id.startsWith('locality')) {
          components.city = item.text;
        } else if (id.startsWith('place')) {
          components.city = components.city || item.text;
        } else if (id.startsWith('region')) {
          components.state = item.text;
        } else if (id.startsWith('country')) {
          components.country = item.text;
          components.countryCode = item.short_code?.toUpperCase();
        } else if (id.startsWith('postcode')) {
          components.postalCode = item.text;
        }
      });

      // Extract address from feature properties
      if (feature.properties?.address) {
        components.houseNumber = feature.properties.address;
      }
      if (feature.text) {
        components.street = feature.text;
      }

      const name = feature.place_name || feature.text || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      const result: LocationResult = {
        name,
        confidence: this.calculateConfidence(components, feature),
        source: 'mapbox',
        coordinates: { lat, lng },
        components,
        qualityScore: 0,
        locationType: this.determineLocationType(feature),
        distance: 0,
        responseTime,
      };

      result.qualityScore = calculateQualityScore(result, { lat, lng });
      
      // Update health score on success
      this.failureCount = Math.max(0, this.failureCount - 1);
      this.healthScore = Math.min(100, this.healthScore + 1);
      
      return result;
    } catch (error) {
      console.error('MapBox geocoding failed:', error);
      this.failureCount++;
      this.healthScore = Math.max(0, this.healthScore - 5);
      return null;
    }
  }

  private calculateConfidence(components: LocationComponents, feature: any): 'high' | 'medium' | 'low' {
    const relevance = feature.relevance || 0;
    if (relevance > 0.8 && (components.street || components.neighborhood)) return 'high';
    if (relevance > 0.6) return 'medium';
    return 'low';
  }

  private determineLocationType(feature: any): LocationResult['locationType'] {
    const categories = feature.properties?.category?.split(',') || [];
    if (categories.some((c: string) => ['residential', 'building'].includes(c))) return 'residential';
    if (categories.some((c: string) => ['commercial', 'retail', 'office'].includes(c))) return 'commercial';
    if (categories.some((c: string) => ['industrial'].includes(c))) return 'industrial';
    if (categories.some((c: string) => ['landmark', 'tourism'].includes(c))) return 'landmark';
    return 'unknown';
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.healthScore > 20;
  }

  getHealthScore(): number {
    return this.healthScore;
  }
}

// Enhanced Google Maps Provider
class EnhancedGoogleMapsProvider implements GeocodingProvider {
  name = 'google';
  priority = 3;
  rateLimit = 50; // Conservative rate limit
  private apiKey: string;
  private healthScore = 100;
  private failureCount = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    if (!this.apiKey) {
      console.warn('Google Maps API key not configured');
      return null;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}&language=en&result_type=street_address|premise|subpremise|neighborhood|locality`,
        {
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return null;
      }

      const result = data.results[0];
      const responseTime = Date.now() - startTime;
      const components: LocationComponents = {};
      
      // Parse Google's address components
      result.address_components?.forEach((component: any) => {
        const types = component.types;
        if (types.includes('street_number')) {
          components.houseNumber = component.long_name;
        } else if (types.includes('route')) {
          components.street = component.long_name;
        } else if (types.includes('neighborhood') || types.includes('sublocality')) {
          components.neighborhood = component.long_name;
        } else if (types.includes('locality')) {
          components.city = component.long_name;
        } else if (types.includes('administrative_area_level_2')) {
          components.district = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          components.state = component.long_name;
        } else if (types.includes('country')) {
          components.country = component.long_name;
          components.countryCode = component.short_name;
        } else if (types.includes('postal_code')) {
          components.postalCode = component.long_name;
        }
      });

      // Build readable name
      const nameParts = [
        components.houseNumber && components.street ? `${components.houseNumber} ${components.street}` : components.street,
        components.neighborhood,
        components.city,
      ].filter(Boolean);

      const name = nameParts.length > 0 ? nameParts.join(", ") : result.formatted_address;

      const locationResult: LocationResult = {
        name,
        confidence: this.calculateConfidence(components, result),
        source: 'google',
        coordinates: { lat, lng },
        components,
        qualityScore: 0,
        locationType: this.determineLocationType(result.types),
        distance: 0,
        responseTime,
      };

      locationResult.qualityScore = calculateQualityScore(locationResult, { lat, lng });
      
      // Update health score on success
      this.failureCount = Math.max(0, this.failureCount - 1);
      this.healthScore = Math.min(100, this.healthScore + 1);
      
      return locationResult;
    } catch (error) {
      console.error('Enhanced Google Maps geocoding failed:', error);
      this.failureCount++;
      this.healthScore = Math.max(0, this.healthScore - 5);
      return null;
    }
  }

  private calculateConfidence(components: LocationComponents, result: any): 'high' | 'medium' | 'low' {
    const hasStreetAddress = components.houseNumber && components.street;
    const hasNeighborhood = components.neighborhood;
    const hasCity = components.city;
    
    if (hasStreetAddress && hasCity) return 'high';
    if ((hasStreetAddress || hasNeighborhood) && hasCity) return 'medium';
    return 'low';
  }

  private determineLocationType(types: string[]): LocationResult['locationType'] {
    if (types.includes('premise') || types.includes('subpremise')) return 'residential';
    if (types.includes('establishment') || types.includes('point_of_interest')) return 'commercial';
    if (types.includes('neighborhood') || types.includes('sublocality')) return 'residential';
    return 'unknown';
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.healthScore > 20;
  }

  getHealthScore(): number {
    return this.healthScore;
  }
}

// Enhanced Fallback Provider
class EnhancedFallbackProvider implements GeocodingProvider {
  name = 'fallback';
  priority = 999;
  rateLimit = 1000;
  private healthScore = 100;

  async reverseGeocode(lat: number, lng: number): Promise<LocationResult | null> {
    // Generate a more informative fallback name
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    
    // Try to determine general region based on coordinates
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

  isAvailable(): boolean {
    return true;
  }

  getHealthScore(): number {
    return this.healthScore;
  }
}

// Enhanced Location Service
export class EnhancedLocationService {
  private providers: GeocodingProvider[];
  private retryAttempts = 2;
  private retryDelay = 1000;

  constructor() {
    this.providers = [
      new EnhancedNominatimProvider(),
      new MapBoxProvider(),
      new EnhancedGoogleMapsProvider(),
      new EnhancedFallbackProvider(),
    ].sort((a, b) => a.priority - b.priority);
  }

  // Main method with enhanced caching and provider selection
  async getLocationName(lat: number, lng: number): Promise<LocationResult> {
    // Check caches in order of precision
    const preciseKey = getPreciseCacheKey(lat, lng);
    const nearbyKey = getNearbyCacheKey(lat, lng);
    const adminKey = getAdministrativeCacheKey(lat, lng);

    // Check precise cache first
    const preciseCache = preciseLocationCache.get(preciseKey);
    if (preciseCache) {
      return { ...preciseCache, source: 'cache' };
    }

    // Check nearby cache
    const nearbyCache = nearbyLocationCache.get(nearbyKey);
    if (nearbyCache && nearbyCache.qualityScore > 70) {
      return { ...nearbyCache, source: 'cache' };
    }

    // Try providers in order of health and priority
    const availableProviders = this.providers
      .filter(p => p.isAvailable())
      .sort((a, b) => {
        const healthDiff = b.getHealthScore() - a.getHealthScore();
        return healthDiff !== 0 ? healthDiff : a.priority - b.priority;
      });

    let bestResult: LocationResult | null = null;
    const results: LocationResult[] = [];

    // Try multiple providers for comparison
    for (const provider of availableProviders.slice(0, 3)) { // Try top 3 providers
      const result = await this.tryProviderWithRetry(provider, lat, lng);
      if (result) {
        results.push(result);
        if (!bestResult || result.qualityScore > bestResult.qualityScore) {
          bestResult = result;
        }
      }
    }

    // If we have multiple results, validate consistency
    if (results.length > 1) {
      bestResult = this.validateAndSelectBestResult(results, { lat, lng });
    }

    if (bestResult) {
      // Cache the result based on quality
      if (bestResult.qualityScore > 80) {
        preciseLocationCache.set(preciseKey, bestResult);
      } else if (bestResult.qualityScore > 50) {
        nearbyLocationCache.set(nearbyKey, bestResult);
      } else {
        administrativeCache.set(adminKey, bestResult);
      }
      
      return bestResult;
    }

    // This should never happen since fallback provider always returns a result
    throw new Error('All location providers failed');
  }

  private validateAndSelectBestResult(results: LocationResult[], originalCoords: Coordinates): LocationResult {
    // Calculate consensus score for each result
    const scoredResults = results.map(result => {
      let consensusScore = result.qualityScore;
      
      // Bonus for results that agree with others
      const similarResults = results.filter(other => 
        other !== result && this.areResultsSimilar(result, other)
      );
      consensusScore += similarResults.length * 10;
      
      return { ...result, consensusScore };
    });

    // Return the result with the highest consensus score
    return scoredResults.reduce((best, current) => 
      current.consensusScore > best.consensusScore ? current : best
    );
  }

  private areResultsSimilar(result1: LocationResult, result2: LocationResult): boolean {
    const comp1 = result1.components || {};
    const comp2 = result2.components || {};
    
    // Check if they share the same city or neighborhood
    return !!(
      (comp1.city && comp2.city && comp1.city === comp2.city) ||
      (comp1.neighborhood && comp2.neighborhood && comp1.neighborhood === comp2.neighborhood) ||
      (comp1.street && comp2.street && comp1.street === comp2.street)
    );
  }

  private async tryProviderWithRetry(
    provider: GeocodingProvider,
    lat: number,
    lng: number
  ): Promise<LocationResult | null> {
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await provider.reverseGeocode(lat, lng);
        if (result) {
          return result;
        }
      } catch (error) {
        console.error(`${provider.name} attempt ${attempt + 1} failed:`, error);
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }
    
    return null;
  }

  // Get multiple location suggestions for comparison
  async getLocationSuggestions(lat: number, lng: number): Promise<LocationResult[]> {
    const results: LocationResult[] = [];
    
    const availableProviders = this.providers
      .filter(p => p.isAvailable() && p.name !== 'fallback')
      .slice(0, 3);
    
    const promises = availableProviders.map(provider => 
      this.tryProviderWithRetry(provider, lat, lng)
    );
    
    const providerResults = await Promise.allSettled(promises);
    
    providerResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });

    return results.sort((a, b) => b.qualityScore - a.qualityScore);
  }

  // Validate coordinates
  static isValidCoordinates(lat: number, lng: number): boolean {
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

  // Get cache statistics
  getCacheStats() {
    return {
      precise: {
        size: preciseLocationCache.size,
        maxSize: preciseLocationCache.max,
      },
      nearby: {
        size: nearbyLocationCache.size,
        maxSize: nearbyLocationCache.max,
      },
      administrative: {
        size: administrativeCache.size,
        maxSize: administrativeCache.max,
      },
    };
  }

  // Clear all caches
  clearCache() {
    preciseLocationCache.clear();
    nearbyLocationCache.clear();
    administrativeCache.clear();
  }

  // Get provider health status
  getProviderHealth() {
    return this.providers.map(provider => ({
      name: provider.name,
      available: provider.isAvailable(),
      healthScore: provider.getHealthScore(),
      priority: provider.priority,
    }));
  }
}

// Export singleton instance
export const enhancedLocationService = new EnhancedLocationService();

// Backward compatibility function
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (!EnhancedLocationService.isValidCoordinates(lat, lng)) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    const result = await enhancedLocationService.getLocationName(lat, lng);
    return result.name;
  } catch (error) {
    console.error('Enhanced location service failed:', error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}