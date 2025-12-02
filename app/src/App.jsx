import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- MAP STATE MANAGER (Conditional Zoom) ---
function MapController({ bounds, isAreaSelected, mapInitialized, setMapInitialized }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && !mapInitialized) {
        // Only fit bounds ONCE on initial load
        const padding = isAreaSelected ? [20, 20] : [150, 150];
        
        map.fitBounds(bounds, { 
          padding: padding, 
          duration: 0.5,
          maxZoom: isAreaSelected ? 17 : 13
        });
        setMapInitialized(true);
    }
  }, [bounds, map, isAreaSelected, mapInitialized, setMapInitialized]);

  // Separate effect for handling selection changes (zoom in/out)
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
  }, [isAreaSelected]); // Only trigger on selection change

  return null;
}

// --- INTERACTION LAYER: Handles Hover, Double-Click, and Conditional Overlays ---
function TileInteractionLayer({ bounds, metadata, currentYear, isAreaSelected, setIsAreaSelected, satelliteOpacity, currentNetworkData, getFeatureStyle, layers, isNetworkVisible }) {
    const map = useMap();
    
    // State to manage the hover highlight effect
    const [isHovered, setIsHovered] = useState(false);
    
    useEffect(() => {
        if (!bounds) return;

        // Create the invisible rectangle for interaction
        const rect = L.rectangle(bounds, {
            fillColor: '#667eea', 
            fillOpacity: 0, 
            weight: 0,
            interactive: true,
            pane: 'overlayPane'
        }).addTo(map);

        // --- INTERACTION HANDLERS ---
        const mouseoverHandler = () => { 
            if (!isAreaSelected) {
                rect.setStyle({ fillOpacity: 0.2 }); 
                setIsHovered(true); 
            }
        };
        const mouseoutHandler = () => { 
            if (!isAreaSelected) {
                rect.setStyle({ fillOpacity: 0 }); 
                setIsHovered(false);
            }
        };
        
        rect.on('mouseover', mouseoverHandler);
        rect.on('mouseout', mouseoutHandler);
        
        // --- DOUBLE-CLICK ACTIVATION ---
        rect.on('dblclick', (e) => {
            if (!isAreaSelected) {
                L.DomEvent.stop(e); 
                setIsAreaSelected(true);
                rect.setStyle({ interactive: false }); // Disable after click
            }
        });

        // Clean up
        return () => {
            map.removeLayer(rect);
        };
    }, [map, bounds, isAreaSelected, setIsAreaSelected]);


    // Only display the ImageOverlay and GeoJSON AFTER the area is selected
    if (!isAreaSelected) {
        return null; 
    }

    // Dynamic URL for the imagery
    const tileId = metadata.tile_id;

    return (
        <>
            {/* Satellite Imagery (Only visible when selected) */}
            <ImageOverlay
                url={`/data/tiles/${tileId}/imagery/${currentYear}.png`}
                bounds={bounds}
                opacity={satelliteOpacity}
                key={`imagery-${currentYear}`}
                eventHandlers={{
                  error: (e) => {
                    console.warn(`⚠️  Imagery not available for ${currentYear}`);
                  }
                }}
            />

            {/* Network Data (Only visible when selected AND master toggle is on) */}
            {currentNetworkData && isNetworkVisible && (
                <GeoJSON
                    data={currentNetworkData}
                    style={getFeatureStyle}
                    key={`network-${currentYear}-${JSON.stringify(layers)}`}
                />
            )}
        </>
    );
}

// --- MAIN APP ---
export default function App() {
  const years = [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
  
  // STATE
  const [metadata, setMetadata] = useState(null);
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
  
  // Controls the selection/zoom view
  const [isAreaSelected, setIsAreaSelected] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false); 

  const layerColors = {
    sidewalk: '#4A90E2',
    road: '#FF6B6B',
    crosswalk: '#4ECDC4'
  };

  // LOAD METADATA
  useEffect(() => {
    fetch('/data/metadata.json')
      .then(response => response.json())
      .then(data => {
        setMetadata(data);
      })
      .catch(error => {
        console.error('❌ Failed to load metadata:', error);
        setIsLoading(false);
      });
  }, []);

  // LOAD ALL NETWORK DATA (HANDLES MISSING FILES)
  useEffect(() => {
    if (!metadata) return;

    const tileId = metadata.tile_id;
    const dataPromises = years.map(year => {
      const path = `/data/tiles/${tileId}/networks/${year}.geojson`;
      return fetch(path)
        .then(response => {
          if (!response.ok) {
            console.warn(`⚠️ GeoJSON not found for ${year} (this is OK)`);
            return null;
          }
          return response.json();
        })
        .then(data => ({ year, data }))
        .catch(error => {
          console.warn(`⚠️ Failed to load ${year}:`, error.message);
          return { year, data: null };
        });
    });

    Promise.all(dataPromises).then(results => {
      const networkData = {};
      results.forEach(({ year, data }) => {
        if (data) networkData[year] = data;
      });
      setAllNetworkData(networkData);
      setIsLoading(false);

      const loaded = Object.keys(networkData).length;
      const missing = years.length - loaded;
      console.log(`✅ Loaded ${loaded} years of network data`);
      if (missing > 0) {
        console.log(`⚠️ ${missing} years missing (imagery may still be available)`);
      }
    });
  }, [metadata, years]);

  // HANDLERS
  const handleGoBack = () => {
      setIsAreaSelected(false);
      setMapInitialized(false); 
  };
  
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
  if (isLoading || !metadata) {
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
          Loading NYC Sidewalk Timeline...
        </div>
      </div>
    );
  }

  // CALCULATE BOUNDS
  const bounds = [
    [metadata.bounds.south, metadata.bounds.west],
    [metadata.bounds.north, metadata.bounds.east]
  ];

  const currentNetworkData = allNetworkData[currentYear];
  const baseTileOpacity = isAreaSelected ? 0 : 1;

  // MAIN RENDER
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header - Only visible when unselected */}
      {!isAreaSelected && (
          <div style={{
            padding: '20px 30px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>
              NYC Sidewalk Time Machine
            </h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              {metadata.area_name.replace('_', ' ').toUpperCase()} • Double-click the highlighted area to begin
            </p>
          </div>
      )}

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={false}
          dragging={true}
          touchZoom={true}
        >
          <MapController 
              bounds={bounds} 
              isAreaSelected={isAreaSelected}
              mapInitialized={mapInitialized}
              setMapInitialized={setMapInitialized}
          />

          {/* Base Map - Fades out when selected */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            opacity={baseTileOpacity}
          />

          {/* Interaction Layer (Handles hover/click and conditional data rendering) */}
          <TileInteractionLayer
              bounds={bounds}
              metadata={metadata}
              currentYear={currentYear}
              isAreaSelected={isAreaSelected}
              setIsAreaSelected={setIsAreaSelected}
              satelliteOpacity={satelliteOpacity}
              currentNetworkData={currentNetworkData}
              getFeatureStyle={getFeatureStyle}
              layers={layers}
              isNetworkVisible={isNetworkVisible}
          />
        </MapContainer>
        
        {/* Go Back Button - Only visible when selected */}
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
                <span style={{ fontSize: '18px' }}>&#x2190;</span> Back to Full Map
            </button>
        )}

        {/* Controls and Timeline - Only visible when selected */}
        {isAreaSelected && (
            <>
                {/* Controls */}
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

                    {/* Master Toggle */}
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

                    {/* Individual Layers */}
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

                    {/* Imagery Opacity */}
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

                    {/* Network Opacity */}
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

                {/* Timeline */}
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
                                Slide to travel through time
                            </div>
                        </div>

                        {/* Slider */}
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

                        {/* Year Markers */}
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