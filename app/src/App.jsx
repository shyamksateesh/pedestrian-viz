import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  calculateGeoJSONStats, 
  calculateTemporalStats, 
  calculateComparativeStats,
  generateInsights 
} from './utils/statsCalculator';
import StatisticsPanel from './components/StatisticsPanel_D3';

// ============================================================================
// MOVE CONSTANTS OUTSIDE COMPONENT - CRITICAL FIX
// ============================================================================
const YEARS = [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];

const DEFAULT_LAYER_COLORS = {
  sidewalk: '#4A90E2',
  road: '#FF6B6B',
  crosswalk: '#4ECDC4'
};

// --- DRAGGABLE TOOLTIP COMPONENT ---
function DraggableTooltip({ hoveredTileData, parseTileName, position, setPosition }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);

  const handleMouseDown = (e) => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && tooltipRef.current) {
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;
        
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;
        
        newX = Math.max(0, Math.min(newX, window.innerWidth - tooltipWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - tooltipHeight));
        
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, setPosition]);

  if (!hoveredTileData) return null;

  const tileInfo = parseTileName(hoveredTileData.name);

  return (
    <div
      ref={tooltipRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        background: 'rgba(255, 255, 255, 0.98)',
        padding: '20px 30px',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        zIndex: 10000,
        border: '2px solid #667eea',
        minWidth: '250px',
        textAlign: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
    >
      <div style={{ 
        fontSize: '24px', 
        fontWeight: '700', 
        color: '#667eea',
        marginBottom: '8px'
      }}>
        {hoveredTileData.tile_id.replace('manhattan_tile_', 'Tile ')}
      </div>
      {tileInfo ? (
        <div style={{ 
          fontSize: '16px', 
          color: '#666',
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '8px'
        }}>
          <div>
            <span style={{ fontWeight: '600', color: '#667eea' }}>Row:</span> {tileInfo.row}
          </div>
          <div>
            <span style={{ fontWeight: '600', color: '#667eea' }}>Col:</span> {tileInfo.col}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '14px', color: '#999' }}>
          {hoveredTileData.name}
        </div>
      )}
      <div style={{
        fontSize: '11px',
        color: '#999',
        marginTop: '12px',
        fontStyle: 'italic'
      }}>
        Drag to move
      </div>
    </div>
  );
}

// --- COLOR PICKER COMPONENT ---
function ColorPicker({ isOpen, onClose, currentColor, onColorChange, layerName }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const presetColors = [
    '#4A90E2', '#FF6B6B', '#4ECDC4', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52BE80',
    '#EC7063', '#AF7AC5', '#5DADE2', '#48C9B0', '#F4D03F',
    '#EB984E', '#DC7633', '#CA6F1E', '#BA4A00', '#A04000'
  ];

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: '0',
        marginTop: '8px',
        background: 'white',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10001,
        width: '200px'
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
        Choose color for {layerName}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '6px'
      }}>
        {presetColors.map((color) => (
          <div
            key={color}
            onClick={() => {
              onColorChange(color);
              onClose();
            }}
            style={{
              width: '32px',
              height: '32px',
              background: color,
              borderRadius: '4px',
              cursor: 'pointer',
              border: currentColor === color ? '3px solid #667eea' : '2px solid #e0e0e0',
              transition: 'transform 0.1s',
              boxSizing: 'border-box'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          />
        ))}
      </div>
    </div>
  );
}

// --- MAP STATE MANAGER ---
function MapController({ bounds, isAreaSelected, mapInitialized, setMapInitialized }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && mapInitialized) {
        const padding = isAreaSelected ? [20, 20] : [150, 150];
        const duration = isAreaSelected ? 1.0 : 0.5;

        map.flyToBounds(bounds, { 
          padding: padding, 
          duration: duration,
          maxZoom: isAreaSelected ? 17 : 13
        });
    }
    
    if (bounds && !mapInitialized) {
        map.fitBounds(bounds, { 
          padding: [150, 150],
          duration: 0.5,
          maxZoom: 13
        });
        setMapInitialized(true);
    }
  }, [bounds, map, isAreaSelected, mapInitialized, setMapInitialized]);

  useEffect(() => {
      map.scrollWheelZoom.enable(); 
  }, [map]);

  return null;
}

// --- MULTI-TILE INTERACTION LAYER ---
function TileInteractionLayer({ 
  availableTiles, 
  activeTile, 
  setActiveTile, 
  currentYear, 
  satelliteOpacity, 
  currentNetworkData, 
  getFeatureStyle, 
  layers, 
  isNetworkVisible,
  lastVisitedTile,
  hoveredTile,
  setHoveredTile 
}) {
    const map = useMap();

    useEffect(() => {
        if (!availableTiles || availableTiles.length === 0) return;

        const tileRects = availableTiles.map(tile => {
            const leafletBounds = [
              [tile.bounds.south, tile.bounds.west],
              [tile.bounds.north, tile.bounds.east]
            ];
            
            const isLastVisited = tile.tile_id === lastVisitedTile;
            
            const rect = L.rectangle(leafletBounds, {
                fillColor: isLastVisited ? '#fbbf24' : '#667eea', 
                fillOpacity: isLastVisited ? 0.15 : 0, 
                weight: isLastVisited ? 2 : 0,
                color: '#fbbf24',
                interactive: true,
                pane: 'overlayPane'
            }).addTo(map);

            const mouseoverHandler = () => { 
                if (!activeTile) {
                    rect.setStyle({ 
                      fillOpacity: isLastVisited ? 0.25 : 0.2,
                      weight: isLastVisited ? 2 : 0
                    });
                    setHoveredTile(tile.tile_id);
                }
            };
            const mouseoutHandler = () => { 
                if (!activeTile) {
                    rect.setStyle({ 
                      fillOpacity: isLastVisited ? 0.15 : 0,
                      weight: isLastVisited ? 2 : 0
                    });
                    setHoveredTile(null);
                }
            };
            const dblclickHandler = (e) => {
                if (!activeTile) {
                    L.DomEvent.stop(e); 
                    setActiveTile(tile.tile_id);
                }
            };

            rect.on('mouseover', mouseoverHandler);
            rect.on('mouseout', mouseoutHandler);
            rect.on('dblclick', dblclickHandler);
            
            return rect;
        });

        return () => {
            tileRects.forEach(rect => map.removeLayer(rect));
        };
    }, [map, availableTiles, activeTile, setActiveTile, lastVisitedTile, setHoveredTile]);

    if (!activeTile) {
        return null; 
    }

    const tileID = activeTile;
    const activeTileData = availableTiles.find(t => t.tile_id === tileID);
    
    const imageBounds = [
      [activeTileData.bounds.south, activeTileData.bounds.west],
      [activeTileData.bounds.north, activeTileData.bounds.east]
    ];
    
    let transformedNetworkData = currentNetworkData;
    
    if (currentNetworkData && activeTileData.network_bounds) {
        const netBounds = activeTileData.network_bounds;
        const imgBounds = activeTileData.bounds;
        
        const netHeight = netBounds.north - netBounds.south;
        const imgHeight = imgBounds.north - imgBounds.south;
        const netWidth = netBounds.east - netBounds.west;
        const imgWidth = imgBounds.east - imgBounds.west;

        if (Math.abs(imgHeight / netHeight - 1) > 0.01 || 
            Math.abs(imgWidth / netWidth - 1) > 0.01 || 
            Math.abs(imgBounds.south - netBounds.south) > 0.0001 || 
            Math.abs(imgBounds.west - netBounds.west) > 0.0001) {
            
            transformedNetworkData = JSON.parse(JSON.stringify(currentNetworkData));
            
            const transformCoord = (coord) => {
                const [lon, lat] = coord;
                
                const normalizedLon = netWidth !== 0 ? (lon - netBounds.west) / netWidth : 0;
                const normalizedLat = netHeight !== 0 ? (lat - netBounds.south) / netHeight : 0;
                
                const newLon = imgBounds.west + normalizedLon * imgWidth;
                const newLat = imgBounds.south + normalizedLat * imgHeight;

                return [newLon, newLat];
            };
            
            const applyTransform = (coords) => {
                if (typeof coords[0] === 'number') {
                    return transformCoord(coords);
                }
                return coords.map(applyTransform);
            };

            transformedNetworkData.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    feature.geometry.coordinates = applyTransform(feature.geometry.coordinates);
                }
            });
        }
    }

    return (
        <>
            <ImageOverlay
                url={`/data/tiles/${tileID}/imagery/${currentYear}.png`}
                bounds={imageBounds} 
                opacity={satelliteOpacity}
                key={`img-${currentYear}-${tileID}`}
                eventHandlers={{
                  error: (e) => {
                    console.warn(`⚠️  Imagery not available for ${currentYear}`);
                  }
                }}
            />
            
            {transformedNetworkData && isNetworkVisible && (
                <GeoJSON
                    data={transformedNetworkData}
                    style={getFeatureStyle}
                    key={`geojson-${currentYear}-${JSON.stringify(layers)}-${tileID}`}
                />
            )}
        </>
    );
}

// --- MAIN APP ---
export default function App() {
  // STATE
  const [availableTiles, setAvailableTiles] = useState(null);
  const [activeTileID, setActiveTileID] = useState(null);
  const [lastVisitedTileID, setLastVisitedTileID] = useState(null);
  const [hoveredTileID, setHoveredTileID] = useState(null);
  const [currentYear, setCurrentYear] = useState(2024);
  const [allNetworkData, setAllNetworkData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.8);
  const [networkFillOpacity, setNetworkFillOpacity] = useState(0.5);
  const [layers, setLayers] = useState({
    sidewalk: true,
    road: true,
    crosswalk: true
  });
  const [layerColors, setLayerColors] = useState(DEFAULT_LAYER_COLORS);
  const [colorPickerOpen, setColorPickerOpen] = useState(null);
  const [isNetworkVisible, setIsNetworkVisible] = useState(true);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(true); // Stats open by default

  // STATISTICS STATE
  const [tileStats, setTileStats] = useState(null);
  const [temporalStats, setTemporalStats] = useState(null);
  const [comparativeStats, setComparativeStats] = useState(null);
  const [insights, setInsights] = useState([]);

  const [tooltipPosition, setTooltipPosition] = useState(() => {
    return { x: 20, y: window.innerHeight - 200 };
  });
  
  const isAreaSelected = !!activeTileID;
  const activeTileData = availableTiles ? availableTiles.find(t => t.tile_id === activeTileID) : null;
  const hoveredTileData = availableTiles ? availableTiles.find(t => t.tile_id === hoveredTileID) : null;

  const currentBounds = useMemo(() => {
    if (activeTileData) {
        const b = activeTileData.bounds;
        return [[b.south, b.west], [b.north, b.east]];
    } else if (availableTiles && availableTiles.length > 0) {
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        
        availableTiles.forEach(tile => {
            const b = tile.bounds;
            minLat = Math.min(minLat, b.south);
            maxLat = Math.max(maxLat, b.north);
            minLon = Math.min(minLon, b.west);
            maxLon = Math.max(maxLon, b.east);
        });
        
        return [[minLat, minLon], [maxLat, maxLon]];
    }
    return null;
  }, [availableTiles, activeTileData]);
  
  const currentNetworkData = activeTileID ? allNetworkData[activeTileID]?.[currentYear] : null;

  // LOAD TILES INDEX AND METADATA
  useEffect(() => {
    fetch('/data/tiles_index.json')
      .then(response => response.json())
      .then(async (tiles) => {
        const tilesWithMetadata = await Promise.all(
          tiles.map(async (tile) => {
            try {
              const metaResponse = await fetch(`/data/tiles/${tile.tile_id}/metadata.json`);
              if (!metaResponse.ok) throw new Error('Metadata not found');
              const metadata = await metaResponse.json();
              return {
                ...tile,
                network_bounds: metadata.network_bounds || tile.bounds, 
                name: metadata.name || tile.tile_id
              };
            } catch (error) {
              return { ...tile, network_bounds: tile.bounds, name: tile.name || tile.tile_id };
            }
          })
        );
        
        setAvailableTiles(tilesWithMetadata);
        console.log(`✅ Loaded ${tilesWithMetadata.length} regions`);
      })
      .catch(error => {
        console.error('❌ Failed to load tiles index:', error);
        setAvailableTiles([]);
        setIsLoading(false);
      });
  }, []); 

  // LOAD ALL NETWORK DATA
  useEffect(() => {
    if (!availableTiles || availableTiles.length === 0 || Object.keys(allNetworkData).length > 0) return;

    setIsLoading(true);
    
    const allTilePromises = availableTiles.map(tile => {
        const tileID = tile.tile_id;
        
        const yearPromises = YEARS.map(year => {
            const dataPath = `/data/tiles/${tileID}/networks/${year}.geojson`;
            return fetch(dataPath)
                .then(response => response.ok ? response.json() : null)
                .then(data => ({ year, data }))
                .catch(() => null);
        });
        
        return Promise.all(yearPromises)
            .then(results => {
                const yearData = {};
                results.forEach(result => {
                    if (result && result.data) yearData[result.year] = result.data;
                });
                return { tileID, yearData };
            });
    });
    
    Promise.all(allTilePromises)
      .then(results => {
        const globalData = {};
        results.forEach(result => {
            globalData[result.tileID] = result.yearData;
        });
        
        setAllNetworkData(globalData);
        setIsLoading(false);
      });
      
  }, [availableTiles]);

  // ============================================================================
  // CRITICAL FIX: STABLE STATISTICS CALCULATION
  // ============================================================================
  useEffect(() => {
    console.log('Stats effect triggered', { activeTileID, hasData: !!allNetworkData[activeTileID] });
    
    if (!activeTileID || !allNetworkData[activeTileID] || !activeTileData) {
      setTileStats(null);
      setTemporalStats(null);
      setComparativeStats(null);
      setInsights([]);
      return;
    }

    console.log('📊 Calculating statistics for', activeTileID);

    // Use a ref or local variable to prevent recreating objects
    const yearlyStats = {};
    
    YEARS.forEach(year => {
      const geojson = allNetworkData[activeTileID][year];
      if (geojson) {
        yearlyStats[year] = calculateGeoJSONStats(geojson, activeTileData.bounds);
      }
    });

    const temporal = calculateTemporalStats(yearlyStats, YEARS);
    const comparative = calculateComparativeStats(yearlyStats, YEARS);
    const detectedInsights = generateInsights(yearlyStats, temporal, YEARS);

    // Only update if values actually changed
    setTileStats(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(yearlyStats);
      return hasChanged ? yearlyStats : prev;
    });
    
    setTemporalStats(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(temporal);
      return hasChanged ? temporal : prev;
    });
    
    setComparativeStats(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(comparative);
      return hasChanged ? comparative : prev;
    });
    
    setInsights(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(detectedInsights);
      return hasChanged ? detectedInsights : prev;
    });

  }, [activeTileID, allNetworkData, activeTileData]); // Removed 'years' from dependencies

  // HANDLERS
  const handleGoBack = () => {
      setLastVisitedTileID(activeTileID);
      setActiveTileID(null);
      setMapInitialized(false); 
      setIsControlsOpen(false);
      setIsStatsOpen(false);
  };
  
  const setActiveTileAndZoom = (tileID) => {
    setCurrentYear(2024);
    setActiveTileID(tileID);
  }

  const toggleNetworkVisible = (newValue) => {
    setIsNetworkVisible(newValue);
    setLayers({ sidewalk: newValue, road: newValue, crosswalk: newValue });
  };

  const toggleLayer = (layerName) => {
    setLayers(prev => {
      const newState = { ...prev, [layerName]: !prev[layerName] };
      const anyLayerOn = Object.values(newState).some(v => v);
      setIsNetworkVisible(anyLayerOn);
      return newState;
    });
  };

  const handleColorChange = (layerName, newColor) => {
    setLayerColors(prev => ({
      ...prev,
      [layerName]: newColor
    }));
  };

  const getFeatureStyle = useCallback((feature) => {
    const fType = feature.properties?.f_type || 'sidewalk';
    
    if (!layers[fType]) {
      return { opacity: 0, stroke: false, fill: false, weight: 0 };
    }
    
    return {
      color: layerColors[fType] || '#666',
      weight: fType === 'crosswalk' ? 3 : fType === 'road' ? 2 : 1.5,
      opacity: 0.8,
      fillOpacity: networkFillOpacity
    };
  }, [layers, networkFillOpacity, layerColors]);

  const parseTileName = (name) => {
    const match = name.match(/\(R(\d+)C(\d+)\)/);
    if (match) {
      return { row: parseInt(match[1]), col: parseInt(match[2]) };
    }
    return null;
  };

  // LOADING STATE
  if (isLoading || !currentBounds) {
      return (
          <div style={{
            width: '100vw', 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#f0f0f0'
          }}>
              <div style={{
                background: 'white',
                padding: '20px 40px',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                fontSize: '16px',
                fontWeight: '500'
              }}>
                {availableTiles ? 
                  `Loading ${availableTiles.length} regions...` : 
                  `Loading map...`}
              </div>
          </div>
      );
  }

  // MAIN RENDER
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      {!isAreaSelected && (
        <div style={{
          padding: '20px 30px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>
            NYC Sidewalk Time Machine
          </h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
            {availableTiles.length} regions available • Double-click any area to explore
            {lastVisitedTileID && (
              <span style={{ 
                marginLeft: '8px', 
                padding: '2px 8px', 
                background: 'rgba(251, 191, 36, 0.3)',
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                Last visited highlighted in gold
              </span>
            )}
          </p>
        </div>
      )}
      
      {/* Draggable Hover Tooltip */}
      {!isAreaSelected && (
        <DraggableTooltip 
          hoveredTileData={hoveredTileData} 
          parseTileName={parseTileName}
          position={tooltipPosition}
          setPosition={setTooltipPosition}
        />
      )}
      
      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[(currentBounds[0][0] + currentBounds[1][0]) / 2, (currentBounds[0][1] + currentBounds[1][1]) / 2]}
          zoom={12} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={false}
          dragging={true}
          touchZoom={true}
        >
          <MapController 
            bounds={currentBounds} 
            isAreaSelected={isAreaSelected} 
            mapInitialized={mapInitialized}
            setMapInitialized={setMapInitialized}
          />
          
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            opacity={isAreaSelected ? 0 : 1}
          />
          
          <TileInteractionLayer
            availableTiles={availableTiles}
            activeTile={activeTileID}
            setActiveTile={setActiveTileAndZoom}
            currentYear={currentYear}
            satelliteOpacity={satelliteOpacity}
            currentNetworkData={currentNetworkData}
            getFeatureStyle={getFeatureStyle}
            layers={layers}
            isNetworkVisible={isNetworkVisible}
            lastVisitedTile={lastVisitedTileID}
            hoveredTile={hoveredTileID}
            setHoveredTile={setHoveredTileID}
          />
        </MapContainer>
        
        {/* Go Back Button */}
        {isAreaSelected && (
            <button
                onClick={handleGoBack}
                style={{
                    position: 'absolute',
                    top: '80px',
                    left: '20px',
                    zIndex: 1000,
                    padding: '10px 15px',
                    background: 'white',
                    color: '#667eea',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <span style={{ fontSize: '18px' }}>&#x2190;</span> Back
            </button>
        )}

        {/* Dual Sidebar Toggle Buttons */}
        {isAreaSelected && (
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {/* Settings Button */}
                <button
                    onClick={() => {
                        setIsControlsOpen(true);
                        setIsStatsOpen(false);
                    }}
                    style={{
                        width: '44px',
                        height: '44px',
                        background: isControlsOpen ? '#667eea' : 'white',
                        color: isControlsOpen ? 'white' : '#667eea',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        fontSize: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: '0.3s ease-in-out'
                    }}
                    title="Map Settings"
                >
                    ⚙️
                </button>

                {/* Statistics Button */}
                <button
                    onClick={() => {
                        setIsStatsOpen(true);
                        setIsControlsOpen(false);
                    }}
                    style={{
                        width: '44px',
                        height: '44px',
                        background: isStatsOpen ? '#667eea' : 'white',
                        color: isStatsOpen ? 'white' : '#667eea',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        fontSize: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: '0.3s ease-in-out'
                    }}
                    title="Statistics"
                >
                    📊
                </button>
            </div>
        )}

        {/* SETTINGS PANEL (Map Controls) */}
        {isAreaSelected && (
            <div style={{
                position: 'absolute',
                top: '20px',
                right: isControlsOpen ? '75px' : '-300px',
                transition: 'right 0.3s ease-in-out',
                zIndex: 1000,
                maxHeight: 'calc(100vh - 250px)',
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '15px 20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    width: '220px',
                    maxHeight: '100%',
                    overflowY: 'auto',
                    color: '#333'
                }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                        Layers
                    </h3>

                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
                        <input
                            type="checkbox"
                            checked={isNetworkVisible}
                            onChange={(e) => toggleNetworkVisible(e.target.checked)}
                            style={{ marginRight: '8px', cursor: 'pointer', transform: 'scale(1.1)' }}
                        />
                        <label style={{ fontSize: '13px', cursor: 'pointer', textTransform: 'uppercase' }}>
                            All Network Data
                        </label>
                    </div>
                    <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #eee' }} />

                    {Object.entries(layers).map(([name, enabled]) => (
                        <div key={name} style={{ marginBottom: '8px', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => toggleLayer(name)}
                                style={{ marginRight: '8px', cursor: 'pointer' }}
                            />
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                background: layerColors[name],
                                marginRight: '8px'
                            }} />
                            <label style={{ fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize', flex: 1 }}>
                                {name}
                            </label>
                            <button
                                onClick={() => setColorPickerOpen(colorPickerOpen === name ? null : name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#667eea',
                                  fontSize: '14px'
                                }}
                                title="Edit color"
                            >
                              ✏️
                            </button>
                          </div>
                          <ColorPicker
                            isOpen={colorPickerOpen === name}
                            onClose={() => setColorPickerOpen(null)}
                            currentColor={layerColors[name]}
                            onColorChange={(color) => handleColorChange(name, color)}
                            layerName={name}
                          />
                        </div>
                    ))}

                    <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #eee' }} />

                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                        Imagery Opacity
                    </h3>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={satelliteOpacity}
                        onChange={(e) => setSatelliteOpacity(parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                        {Math.round(satelliteOpacity * 100)}%
                    </div>

                    <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #eee' }} />

                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                        Network Opacity
                    </h3>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={networkFillOpacity}
                        onChange={(e) => setNetworkFillOpacity(parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                        {Math.round(networkFillOpacity * 100)}%
                    </div>
                </div>
            </div>
        )}

        {/* STATISTICS PANEL */}
        {isAreaSelected && (
            <div style={{
                position: 'absolute',
                top: '20px',
                right: isStatsOpen ? '75px' : '-700px',
                transition: 'right 0.3s ease-in-out',
                zIndex: 1000,
                maxHeight: 'calc(100vh - 250px)',
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    width: '650px',
                    maxHeight: '100%',
                    overflowY: 'hidden'
                }}>
                    <StatisticsPanel
                        yearlyStats={tileStats}
                        temporalStats={temporalStats}
                        comparativeStats={comparativeStats}
                        insights={insights}
                        currentYear={currentYear}
                        years={YEARS}
                    />
                </div>
            </div>
        )}

        {/* Timeline */}
        {isAreaSelected && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    width: '100%',
                    padding: '25px 30px',
                    background: 'white',
                    borderTop: '1px solid #e0e0e0',
                    boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
                    zIndex: 1000,
                    color: '#333'
                }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '15px'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#667eea' }}>
                                {currentYear}
                                {!currentNetworkData && (
                                  <span style={{ 
                                    fontSize: '14px', 
                                    marginLeft: '10px', 
                                    color: '#ff6b6b',
                                    fontWeight: '500'
                                  }}>
                                    (Network data unavailable)
                                  </span>
                                )}
                            </h2>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                                {activeTileData?.name}
                            </div>
                        </div>
                        
                        <input
                            type="range"
                            min={0}
                            max={YEARS.length - 1}
                            value={YEARS.indexOf(currentYear)}
                            onChange={(e) => setCurrentYear(YEARS[parseInt(e.target.value)])}
                            style={{
                                width: '100%',
                                height: '8px',
                                borderRadius: '4px',
                                outline: 'none',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                background: `linear-gradient(to right, #667eea ${(YEARS.indexOf(currentYear) / (YEARS.length - 1)) * 100}%, #e0e0e0 ${(YEARS.indexOf(currentYear) / (YEARS.length - 1)) * 100}%)`
                            }}
                        />
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            marginTop: '10px'
                        }}>
                            {YEARS.map(year => (
                                <div 
                                    key={year}
                                    onClick={() => setCurrentYear(year)}
                                    style={{
                                        fontSize: '12px',
                                        color: year === currentYear ? '#667eea' : '#999',
                                        fontWeight: year === currentYear ? '600' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {year}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
        )}
      </div>
    </div>
  );
}