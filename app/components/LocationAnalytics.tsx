import { useState, useEffect } from 'react';
import { MapPin, TrendingUp, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';

interface LocationStats {
  totalLocations: number;
  averageQuality: number;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  sourceDistribution: {
    [key: string]: number;
  };
  averageResponseTime: number;
  averageGpsAccuracy: number;
  locationTypes: {
    [key: string]: number;
  };
}

interface LocationAnalyticsProps {
  stats: LocationStats;
  className?: string;
}

export function LocationAnalytics({ stats, className = '' }: LocationAnalyticsProps) {
  const [selectedMetric, setSelectedMetric] = useState<'quality' | 'sources' | 'types'>('quality');

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-green-600 bg-green-100';
    if (quality >= 60) return 'text-yellow-600 bg-yellow-100';
    if (quality >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getQualityIcon = (quality: number) => {
    if (quality >= 80) return <CheckCircle className="h-4 w-4" />;
    if (quality >= 60) return <TrendingUp className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Location Analytics</h3>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Database className="h-4 w-4" />
            <span>{stats.totalLocations} locations analyzed</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Quality</p>
                <p className={`text-2xl font-bold ${getQualityColor(stats.averageQuality).split(' ')[0]}`}>
                  {stats.averageQuality.toFixed(1)}%
                </p>
              </div>
              {getQualityIcon(stats.averageQuality)}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.averageResponseTime.toFixed(0)}ms
                </p>
              </div>
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">GPS Accuracy</p>
                <p className="text-2xl font-bold text-green-600">
                  ±{stats.averageGpsAccuracy.toFixed(0)}m
                </p>
              </div>
              <MapPin className="h-4 w-4 text-green-600" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Quality</p>
                <p className="text-2xl font-bold text-green-600">
                  {((stats.qualityDistribution.high / stats.totalLocations) * 100).toFixed(1)}%
                </p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSelectedMetric('quality')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedMetric === 'quality'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Quality Distribution
          </button>
          <button
            onClick={() => setSelectedMetric('sources')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedMetric === 'sources'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Data Sources
          </button>
          <button
            onClick={() => setSelectedMetric('types')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedMetric === 'types'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Location Types
          </button>
        </div>

        {/* Charts */}
        <div className="space-y-4">
          {selectedMetric === 'quality' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Quality Distribution</h4>
              <div className="space-y-3">
                {[
                  { label: 'High Quality (80-100%)', value: stats.qualityDistribution.high, color: 'bg-green-500' },
                  { label: 'Medium Quality (60-79%)', value: stats.qualityDistribution.medium, color: 'bg-yellow-500' },
                  { label: 'Low Quality (0-59%)', value: stats.qualityDistribution.low, color: 'bg-red-500' },
                ].map((item) => {
                  const percentage = (item.value / stats.totalLocations) * 100;
                  return (
                    <div key={item.label} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium">{item.value} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="mt-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMetric === 'sources' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Data Sources</h4>
              <div className="space-y-3">
                {Object.entries(stats.sourceDistribution).map(([source, count]) => {
                  const percentage = (count / stats.totalLocations) * 100;
                  const getSourceColor = (src: string) => {
                    switch (src) {
                      case 'nominatim': return 'bg-blue-500';
                      case 'google': return 'bg-green-500';
                      case 'mapbox': return 'bg-purple-500';
                      case 'cache': return 'bg-gray-500';
                      case 'fallback': return 'bg-red-500';
                      default: return 'bg-gray-400';
                    }
                  };
                  
                  return (
                    <div key={source} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 capitalize">{source}</span>
                          <span className="font-medium">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="mt-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getSourceColor(source)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMetric === 'types' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Location Types</h4>
              <div className="space-y-3">
                {Object.entries(stats.locationTypes).map(([type, count]) => {
                  const percentage = (count / stats.totalLocations) * 100;
                  const getTypeColor = (t: string) => {
                    switch (t) {
                      case 'residential': return 'bg-green-500';
                      case 'commercial': return 'bg-blue-500';
                      case 'industrial': return 'bg-orange-500';
                      case 'landmark': return 'bg-purple-500';
                      default: return 'bg-gray-400';
                    }
                  };
                  
                  return (
                    <div key={type} className="flex items-center space-x-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 capitalize">{type}</span>
                          <span className="font-medium">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="mt-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getTypeColor(type)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Recommendations</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {stats.averageQuality < 70 && (
              <li>• Consider adding more geocoding providers to improve location accuracy</li>
            )}
            {stats.averageResponseTime > 3000 && (
              <li>• Response times are high - consider optimizing provider selection</li>
            )}
            {stats.qualityDistribution.low / stats.totalLocations > 0.3 && (
              <li>• High percentage of low-quality locations - review fallback strategies</li>
            )}
            {stats.sourceDistribution.fallback && stats.sourceDistribution.fallback / stats.totalLocations > 0.2 && (
              <li>• Too many fallback locations - check provider availability</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LocationAnalytics;