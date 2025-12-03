import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- MAP STATE MANAGER ---
function MapController({ bounds, isAreaSelected, mapInitialized, setMapInitialized }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && !mapInitialized) {
        const padding = isAreaSelected ? [20, 20] : [150, 150];
        
        map.fitBounds(bounds, { 
          padding: padding, 
          duration: 0.5,
          maxZoom: isAreaSelected ? 17 : 13
        });
        setMapInitialized(true);
    }
  }, [bounds, map, isAreaSelected, mapInitialized, setMapInitialized]);

  useEffect(() => {
    if (mapInitialized && bounds) {
      const padding = isAreaSelected ? [20, 20] : [150, 150];
      const duration = isAreaSelected ? 1.0 : 0.5;
      
      map.flyToBounds(bounds, { 
        padding: padding, 
        duration: duration,
        maxZoom: isAreaSelected ? 17 : 13
      });
    }
  }, [isAreaSelected]);

  return null;
}

// --- MULTI-TILE INTERACTION LAYER ---
function TileInteractionLayer({ availableTiles, activeTile, setActiveTile, currentYear, satelliteOpacity, currentNetworkData, getFeatureStyle, layers, isNetworkVisible }) {
    const map = useMap();

    // Create rectangles for ALL tiles
    useEffect(() => {
        if (!availableTiles || availableTiles.length === 0) return;

        const tileRects = availableTiles.map(tile => {
            const leafletBounds = [
              [tile.bounds.south, tile.bounds.west],
              [tile.bounds.north, tile.bounds.east]
            ];
            
            const rect = L.rectangle(leafletBounds, {
                fillColor: '#667eea', 
                fillOpacity: 0, 
                weight: 0,
                interactive: true,
                pane: 'overlayPane'
            }).addTo(map);

            const mouseoverHandler = () => { 
                if (!activeTile) {
                    rect.setStyle({ fillOpacity: 0.2 });
                }
            };
            const mouseoutHandler = () => { 
                if (!activeTile) {
                    rect.setStyle({ fillOpacity: 0 });
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
    }, [map, availableTiles, activeTile, setActiveTile]);

    // Render overlay only for active tile
    if (!activeTile) {
        return null; 
    }

    const tileID = activeTile;
    const activeTileData = availableTiles.find(t => t.tile_id === tileID);
    
    const bounds = [
      [activeTileData.bounds.south, activeTileData.bounds.west],
      [activeTileData.bounds.north, activeTileData.bounds.east]
    ];

    return (
        <>
            <ImageOverlay
                url={`/data/tiles/${tileID}/imagery/${currentYear}.png`}
                bounds={bounds} 
                opacity={satelliteOpacity}
                key={`img-${currentYear}-${tileID}`}
                eventHandlers={{
                  error: (e) => {
                    console.warn(`⚠️  Imagery not available for ${currentYear}`);
                  }
                }}
            />
            
            {currentNetworkData && isNetworkVisible && (
                <GeoJSON
                    data={currentNetworkData}
                    style={getFeatureStyle}
                    key={`geojson-${currentYear}-${JSON.stringify(layers)}-${tileID}`}
                />
            )}
        </>
    );
}

// --- MAIN APP ---
export default function App() {
  const years = [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
  
  const layerColors = {
    sidewalk: '#4A90E2',
    road: '#FF6B6B',
    crosswalk: '#4ECDC4'
  };

  // STATE
  const [availableTiles, setAvailableTiles] = useState(null);
  const [activeTileID, setActiveTileID] = useState(null);
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
  const [isNetworkVisible, setIsNetworkVisible] = useState(true);
  const [mapInitialized, setMapInitialized] = useState(false);
  
  const isAreaSelected = !!activeTileID;
  const activeTileData = availableTiles ? availableTiles.find(t => t.tile_id === activeTileID) : null;

  // Calculate bounds
  const currentBounds = useMemo(() => {
    if (activeTileData) {
        const b = activeTileData.bounds;
        return [[b.south, b.west], [b.north, b.east]];
    } else if (availableTiles && availableTiles.length > 0) {
        // Use first tile bounds for initial view
        const b = availableTiles[0].bounds;
        return [[b.south, b.west], [b.north, b.east]];
    }
    return null;
  }, [availableTiles, activeTileData]);
  
  const currentNetworkData = activeTileID ? allNetworkData[activeTileID]?.[currentYear] : null;

  // LOAD TILES INDEX
  useEffect(() => {
    fetch('/data/tiles_index.json')
      .then(response => response.json())
      .then(tiles => {
        setAvailableTiles(tiles);
        console.log(`✅ Loaded ${tiles.length} regions`);
      })
      .catch(error => {
        console.error('❌ Failed to load tiles index:', error);
        setAvailableTiles([]);
        setIsLoading(false);
      });
  }, []); 

  // LOAD ALL NETWORK DATA FOR ALL TILES
  useEffect(() => {
    if (!availableTiles || availableTiles.length === 0 || Object.keys(allNetworkData).length > 0) return;

    setIsLoading(true);
    
    const allTilePromises = availableTiles.map(tile => {
        const tileID = tile.tile_id;
        
        const yearPromises = years.map(year => {
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
        console.log(`✅ Loaded data for ${results.length} regions`);
      });
      
  }, [availableTiles, years]);

  // HANDLERS
  const handleGoBack = () => {
      setActiveTileID(null);
      setMapInitialized(false); 
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
  }, [layers, networkFillOpacity]);

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
                {currentBounds ? 
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
          </p>
        </div>
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
          />
        </MapContainer>
        
        {isAreaSelected && (
            <button
                onClick={handleGoBack}
                style={{
                    position: 'absolute',
                    top: '20px',
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

        {isAreaSelected && (
            <>
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '15px 20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    color: '#333',
                    maxWidth: '220px'
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
                        <div key={name} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
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
                            <label style={{ fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
                                {name}
                            </label>
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
                            max={years.length - 1}
                            value={years.indexOf(currentYear)}
                            onChange={(e) => setCurrentYear(years[parseInt(e.target.value)])}
                            style={{
                                width: '100%',
                                height: '8px',
                                borderRadius: '4px',
                                outline: 'none',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                background: `linear-gradient(to right, #667eea ${(years.indexOf(currentYear) / (years.length - 1)) * 100}%, #e0e0e0 ${(years.indexOf(currentYear) / (years.length - 1)) * 100}%)`
                            }}
                        />
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            marginTop: '10px'
                        }}>
                            {years.map(year => (
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
            </>
        )}
      </div>
    </div>
  );
}