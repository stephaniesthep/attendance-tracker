import { useState } from 'react';
import { 
  getCurrentLocation, 
  getDetailedLocation, 
  reverseGeocode,
  isValidCoordinates,
  assessLocationAccuracy,
  type Coordinates,
  type LocationResult 
} from '~/utils/location.client.enhanced';

export function LocationTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    coords?: Coordinates;
    locationResult?: LocationResult;
    locationName?: string;
    accuracy?: string;
    error?: string;
  }>({});

  const testLocation = async () => {
    setTesting(true);
    setResults({});
    
    try {
      console.log('🔍 Testing location services...');
      
      // Step 1: Get GPS coordinates
      console.log('📍 Getting GPS coordinates...');
      const coords = await getCurrentLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        progressiveAccuracy: true
      });
      
      console.log('✅ GPS coordinates:', coords);
      setResults(prev => ({ ...prev, coords }));
      
      // Step 2: Validate coordinates
      if (!isValidCoordinates(coords.lat, coords.lng)) {
        throw new Error('Invalid coordinates received');
      }
      
      // Step 3: Assess GPS accuracy
      const accuracyAssessment = assessLocationAccuracy(coords);
      console.log('📊 GPS accuracy:', accuracyAssessment);
      setResults(prev => ({ ...prev, accuracy: accuracyAssessment.description }));
      
      // Step 4: Get detailed location
      console.log('🏠 Getting detailed location...');
      const locationResult = await getDetailedLocation(coords.lat, coords.lng);
      console.log('✅ Detailed location:', locationResult);
      setResults(prev => ({ ...prev, locationResult }));
      
      // Step 5: Get simple location name
      console.log('📝 Getting location name...');
      const locationName = await reverseGeocode(coords.lat, coords.lng);
      console.log('✅ Location name:', locationName);
      setResults(prev => ({ ...prev, locationName }));
      
      console.log('🎉 Location test completed successfully!');
      
    } catch (error) {
      console.error('❌ Location test failed:', error);
      setResults(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-4">Location Service Test</h3>
      
      <button
        onClick={testLocation}
        disabled={testing}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Location Services'}
      </button>
      
      {results.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">Error: {results.error}</p>
        </div>
      )}
      
      {results.coords && (
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-md">
            <h4 className="font-medium mb-2">GPS Coordinates</h4>
            <p>Latitude: {results.coords.lat.toFixed(6)}</p>
            <p>Longitude: {results.coords.lng.toFixed(6)}</p>
            {results.coords.accuracy && (
              <p>Accuracy: ±{results.coords.accuracy.toFixed(0)}m</p>
            )}
          </div>
          
          {results.accuracy && (
            <div className="p-3 bg-blue-50 rounded-md">
              <h4 className="font-medium mb-2">GPS Assessment</h4>
              <p>{results.accuracy}</p>
            </div>
          )}
          
          {results.locationName && (
            <div className="p-3 bg-green-50 rounded-md">
              <h4 className="font-medium mb-2">Location Name (Simple)</h4>
              <p>{results.locationName}</p>
            </div>
          )}
          
          {results.locationResult && (
            <div className="p-3 bg-purple-50 rounded-md">
              <h4 className="font-medium mb-2">Detailed Location Result</h4>
              <p><strong>Name:</strong> {results.locationResult.name}</p>
              <p><strong>Quality Score:</strong> {results.locationResult.qualityScore}%</p>
              <p><strong>Confidence:</strong> {results.locationResult.confidence}</p>
              <p><strong>Source:</strong> {results.locationResult.source}</p>
              {results.locationResult.locationType && (
                <p><strong>Type:</strong> {results.locationResult.locationType}</p>
              )}
              {results.locationResult.responseTime && (
                <p><strong>Response Time:</strong> {results.locationResult.responseTime}ms</p>
              )}
              {results.locationResult.components && (
                <div className="mt-2">
                  <p><strong>Components:</strong></p>
                  <pre className="text-xs bg-white p-2 rounded border mt-1">
                    {JSON.stringify(results.locationResult.components, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationTest;