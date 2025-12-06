import * as turf from '@turf/turf';

/**
 * Calculate statistics for a single GeoJSON dataset
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {Object} tileBounds - Tile boundary box {north, south, east, west}
 * @returns {Object} Statistics object
 */
export function calculateGeoJSONStats(geojson, tileBounds) {
  if (!geojson || !geojson.features) {
    return null;
  }

  const stats = {
    sidewalk: { totalLength: 0, featureCount: 0, totalArea: 0 },
    road: { totalLength: 0, featureCount: 0, totalArea: 0 },
    crosswalk: { totalLength: 0, featureCount: 0, totalArea: 0 }
  };

  geojson.features.forEach(feature => {
    const fType = feature.properties?.f_type || 'sidewalk';
    
    if (!stats[fType]) return;

    stats[fType].featureCount++;

    try {
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        // Calculate length in kilometers
        const length = turf.length(feature, { units: 'kilometers' });
        stats[fType].totalLength += length;
      } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        // Calculate area in square meters
        const area = turf.area(feature);
        stats[fType].totalArea += area;
        
        // Also calculate perimeter as "length"
        const length = turf.length(turf.polygonToLine(feature), { units: 'kilometers' });
        stats[fType].totalLength += length;
      }
    } catch (error) {
      console.warn('Error calculating geometry metrics:', error);
    }
  });

  // Calculate tile area for density metrics
  const tileArea = calculateTileArea(tileBounds);

  // Add derived metrics
  Object.keys(stats).forEach(type => {
    const s = stats[type];
    s.density = tileArea > 0 ? (s.totalLength / tileArea) : 0; // km per km²
    s.areaCoverage = tileArea > 0 ? (s.totalArea / (tileArea * 1e6)) * 100 : 0; // % of tile
  });

  return stats;
}

/**
 * Calculate area of tile in km²
 */
function calculateTileArea(bounds) {
  try {
    const polygon = turf.bboxPolygon([
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north
    ]);
    return turf.area(polygon) / 1e6; // Convert m² to km²
  } catch (error) {
    console.warn('Error calculating tile area:', error);
    return 1; // Fallback
  }
}

/**
 * Calculate temporal changes across years
 * @param {Object} yearlyStats - Object with year keys and stats values
 * @param {Array} years - Sorted array of years
 * @returns {Object} Temporal analysis
 */
export function calculateTemporalStats(yearlyStats, years) {
  const temporal = {
    sidewalk: {},
    road: {},
    crosswalk: {}
  };

  Object.keys(temporal).forEach(type => {
    const values = years.map(year => yearlyStats[year]?.[type]?.totalLength || 0);
    
    if (values.every(v => v === 0)) {
      temporal[type] = {
        growthRate: 0,
        totalChange: 0,
        peakYear: null,
        changes: []
      };
      return;
    }

    const firstValue = values.find(v => v > 0) || 0;
    const lastValue = values[values.length - 1];
    
    // Calculate year-over-year changes
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const change = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
      changes.push({
        fromYear: years[i - 1],
        toYear: years[i],
        absoluteChange: curr - prev,
        percentChange: change
      });
    }

    // Find peak year
    const maxValue = Math.max(...values);
    const peakIndex = values.indexOf(maxValue);
    const peakYear = years[peakIndex];

    temporal[type] = {
      growthRate: firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0,
      totalChange: lastValue - firstValue,
      peakYear: peakYear,
      changes: changes,
      trend: lastValue > firstValue ? 'increasing' : lastValue < firstValue ? 'decreasing' : 'stable'
    };
  });

  return temporal;
}

/**
 * Calculate comparative statistics between feature types
 */
export function calculateComparativeStats(yearlyStats, years) {
  const comparisons = [];

  years.forEach(year => {
    const stats = yearlyStats[year];
    if (!stats) return;

    const sidewalkLength = stats.sidewalk?.totalLength || 0;
    const roadLength = stats.road?.totalLength || 0;
    const crosswalkCount = stats.crosswalk?.featureCount || 0;

    comparisons.push({
      year,
      sidewalkToRoadRatio: roadLength > 0 ? sidewalkLength / roadLength : 0,
      crosswalksPerKmRoad: roadLength > 0 ? crosswalkCount / roadLength : 0,
      infrastructureMix: {
        sidewalk: sidewalkLength,
        road: roadLength,
        crosswalk: crosswalkCount
      }
    });
  });

  return comparisons;
}

/**
 * Generate insights based on statistics
 */
export function generateInsights(yearlyStats, temporal, years) {
  const insights = [];

  // Check for significant growth
  Object.keys(temporal).forEach(type => {
    const t = temporal[type];
    if (Math.abs(t.growthRate) > 10) {
      insights.push({
        type: 'growth',
        feature: type,
        message: `${type} infrastructure ${t.trend === 'increasing' ? 'grew' : 'decreased'} by ${Math.abs(t.growthRate).toFixed(1)}% over 20 years`,
        severity: Math.abs(t.growthRate) > 30 ? 'high' : 'medium'
      });
    }
  });

  // Check for data availability issues
  const availableYears = years.filter(year => yearlyStats[year]);
  if (availableYears.length < years.length) {
    insights.push({
      type: 'warning',
      message: `Data available for ${availableYears.length} out of ${years.length} years`,
      severity: 'low'
    });
  }

  // Check for unusual year-over-year changes
  Object.keys(temporal).forEach(type => {
    const largeChanges = temporal[type].changes?.filter(c => Math.abs(c.percentChange) > 50) || [];
    if (largeChanges.length > 0) {
      largeChanges.forEach(change => {
        insights.push({
          type: 'anomaly',
          feature: type,
          message: `Unusual ${Math.abs(change.percentChange).toFixed(0)}% change in ${type} between ${change.fromYear} and ${change.toYear}`,
          severity: 'medium'
        });
      });
    }
  });

  return insights;
}