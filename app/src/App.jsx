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
import { THEMES } from './utils/theme';

// ============================================================================
// CONSTANTS
// ============================================================================
const YEARS = [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];

const DEFAULT_LAYER_COLORS = {
  sidewalk: '#4A90E2',
  road: '#FF6B6B',
  crosswalk: '#4ECDC4'
};

// ============================================================================
// MULTI-TILE UTILITY FUNCTIONS
// ============================================================================

/**
 * Parses tile name to extract row and column
 * Format: "manhattan_tile_123 (R5C3)" -> { row: 5, col: 3 }
 */
function parseTileName(name) {
  const match = name.match(/\(R(\d+)C(\d+)\)/);
  if (match) {
    return { row: parseInt(match[1]), col: parseInt(match[2]) };
  }
  return null;
}

/**
 * Validates if selected tiles form a valid rectangle
 * Rules: 1-16 tiles, adjacent, forming rectangle
 */
function validateTileSelection(tileIDs, tiles) {
  if (!tileIDs || tileIDs.length === 0 || tileIDs.length > 16) {
    return { valid: false, error: 'Must select 1-16 tiles' };
  }

  if (tileIDs.length === 1) {
    return { valid: true };
  }

  // Parse all tile positions
  const positions = tileIDs.map(id => {
    const tile = tiles.find(t => t.tile_id === id);
    if (!tile) return null;
    const parsed = parseTileName(tile.name);
    return parsed ? { id, ...parsed } : null;
  }).filter(Boolean);

  if (positions.length !== tileIDs.length) {
    return { valid: false, error: 'Could not parse tile positions' };
  }

  // Get bounds
  const rows = positions.map(p => p.row);
  const cols = positions.map(p => p.col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  
  if (positions.length !== expectedCount) {
    return { valid: false, error: 'Tiles must be adjacent and form a rectangle' };
  }

  // Check all positions are filled
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (!positions.find(p => p.row === r && p.col === c)) {
        return { valid: false, error: 'Missing tile in rectangle' };
      }
    }
  }

  return { 
    valid: true, 
    layout: { 
      minRow, maxRow, minCol, maxCol,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1
    }
  };
}

/**
 * Gets tiles between start and current hover (rectangle selection)
 */
function getTilesBetween(startID, endID, tiles) {
  const startTile = tiles.find(t => t.tile_id === startID);
  const endTile = tiles.find(t => t.tile_id === endID);
  
  if (!startTile || !endTile) return [];
  
  const startPos = parseTileName(startTile.name);
  const endPos = parseTileName(endTile.name);
  
  if (!startPos || !endPos) return [];
  
  const minRow = Math.min(startPos.row, endPos.row);
  const maxRow = Math.max(startPos.row, endPos.row);
  const minCol = Math.min(startPos.col, endPos.col);
  const maxCol = Math.max(startPos.col, endPos.col);
  
  const selectedIDs = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const tile = tiles.find(t => {
        const pos = parseTileName(t.name);
        return pos && pos.row === r && pos.col === c;
      });
      if (tile) selectedIDs.push(tile.tile_id);
    }
  }
  
  return selectedIDs;
}

/**
 * Calculates combined NETWORK bounds for multiple tiles (not image bounds)
 */
function getCombinedNetworkBounds(tileIDs, tiles) {
  const selectedTiles = tileIDs.map(id => tiles.find(t => t.tile_id === id)).filter(Boolean);
  if (selectedTiles.length === 0) return null;
  
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  
  selectedTiles.forEach(tile => {
    // Use network_bounds instead of bounds
    const b = tile.network_bounds || tile.bounds;
    minLat = Math.min(minLat, b.south);
    maxLat = Math.max(maxLat, b.north);
    minLon = Math.min(minLon, b.west);
    maxLon = Math.max(maxLon, b.east);
  });
  
  return { south: minLat, north: maxLat, west: minLon, east: maxLon };
}

/**
 * Merges GeoJSON data from multiple tiles WITHOUT transformation
 * Keep network data raw and accurate
 */
function mergeGeoJSON(tileIDs, year, allNetworkData) {
  const features = [];
  
  tileIDs.forEach(tileID => {
    const data = allNetworkData[tileID]?.[year];
    if (data && data.features) {
      // NO TRANSFORMATION - keep network data accurate
      features.push(...data.features);
    }
  });
  
  return {
    type: "FeatureCollection",
    features: features
  };
}

/**
 * Stitches multiple tile images into one using Canvas
 * FIX: Canvas Y grows downward, but tile rows grow upward in lat/lon
 */
async function stitchImages(tileIDs, year, tiles, layout) {
  const { minRow, maxRow, minCol, maxCol, rows, cols } = layout;
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = 512 * cols;
  canvas.height = 512 * rows;
  const ctx = canvas.getContext('2d');
  
  // Load and draw all images
  const imagePromises = [];
  
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const tile = tiles.find(t => {
        const pos = parseTileName(t.name);
        return pos && pos.row === r && pos.col === c;
      });
      
      if (tile) {
        const imgPath = `/data/tiles/${tile.tile_id}/imagery/${year}.png`;
        const canvasX = (c - minCol) * 512;
        // FIX: Invert Y-axis - higher row numbers should be at top of canvas
        const canvasY = (maxRow - r) * 512;
        
        const promise = new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, canvasX, canvasY, 512, 512);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load image: ${imgPath}`);
            resolve(); // Don't reject, just skip
          };
          img.src = imgPath;
        });
        
        imagePromises.push(promise);
      }
    }
  }
  
  await Promise.all(imagePromises);
  
  return canvas.toDataURL('image/png');
}

// ============================================================================
// COMPONENTS
// ============================================================================

// --- MULTI-TILE WARNING DIALOG ---
function MultiTileWarningDialog({ onAccept, onCancel, theme }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.2s ease-in'
    }}>
      <div style={{
        background: theme.surface,
        borderRadius: '16px',
        padding: '30px 40px',
        maxWidth: '500px',
        boxShadow: theme.shadowLg,
        border: `2px solid ${theme.primary}`
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: '700',
          color: theme.primary,
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          ⚠️ Multi-Tile Mode Notice
        </div>
        
        <div style={{
          fontSize: '15px',
          color: theme.textPrimary,
          lineHeight: '1.6',
          marginBottom: '20px'
        }}>
          <p style={{ marginTop: 0 }}>
            In multi-tile mode, <strong>imagery and network overlays may not align perfectly</strong> due to precision differences in tile extraction.
          </p>
          <p style={{
            background: theme.background,
            padding: '12px',
            borderRadius: '8px',
            borderLeft: `4px solid ${theme.primary}`
          }}>
            ✅ <strong>GeoJSON network data remains accurate</strong> and can be relied upon for analysis.
          </p>
          <p style={{ marginBottom: 0 }}>
            The imagery will be displayed at <strong>10% opacity</strong> to emphasize the network data. Please use this feature keeping these limitations in mind.
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              background: theme.buttonHover,
              color: theme.textPrimary,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            style={{
              padding: '10px 20px',
              background: theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Alright, Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// --- DRAGGABLE TOOLTIP COMPONENT ---
function DraggableTooltip({ hoveredTileData, parseTileName, position, setPosition, theme }) {
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
        background: theme.tooltipBg,
        padding: '20px 30px',
        borderRadius: '16px',
        boxShadow: theme.shadowLg,
        zIndex: 10000,
        border: `2px solid ${theme.primary}`,
        transition: 'all 0.3s ease',
        minWidth: '250px',
        textAlign: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
    >
      <div style={{ 
        fontSize: '24px', 
        fontWeight: '700', 
        color: theme.primary,
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
function ColorPicker({ isOpen, onClose, currentColor, onColorChange, layerName, theme }) {
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
        background: theme.surface,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: theme.shadowMd,
        transition: 'all 0.3s ease',
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
  setHoveredTile,
  isMultiTileMode,
  selectionStart,
  setSelectionStart,
  previewTiles,
  setPreviewTiles,
  stitchedImages,
  allNetworkData
}) {
    const map = useMap();
    
    const isMultiTile = Array.isArray(activeTile) && activeTile.length > 1;
    const activeTileIDs = Array.isArray(activeTile) ? activeTile : (activeTile ? [activeTile] : []);

    useEffect(() => {
        if (!availableTiles || availableTiles.length === 0) return;

        const tileRects = availableTiles.map(tile => {
            const leafletBounds = [
              [tile.bounds.south, tile.bounds.west],
              [tile.bounds.north, tile.bounds.east]
            ];
            
            // FIX: Only show gold highlight when NO tiles are active
            const showLastVisited = activeTileIDs.length === 0;
            const isLastVisited = showLastVisited && (
              Array.isArray(lastVisitedTile) 
                ? lastVisitedTile.includes(tile.tile_id)
                : tile.tile_id === lastVisitedTile
            );
            
            const isInPreview = previewTiles.includes(tile.tile_id);
            const isStartTile = tile.tile_id === selectionStart;
            
            // Selection preview styling
            let fillColor = '#667eea';
            let fillOpacity = 0;
            let weight = 0;
            let dashArray = null;
            
            if (isStartTile) {
              fillColor = '#10b981';
              fillOpacity = 0.3;
              weight = 3;
            } else if (isInPreview) {
              fillColor = '#667eea';
              fillOpacity = 0.15;
              weight = 2;
              dashArray = '5, 5';
            } else if (isLastVisited) {
              fillColor = '#fbbf24';
              fillOpacity = 0.15;
              weight = 2;
            }
            
            const rect = L.rectangle(leafletBounds, {
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                weight: weight,
                color: fillColor,
                dashArray: dashArray,
                interactive: !activeTileIDs.length,
                pane: 'overlayPane'
            }).addTo(map);

            const mouseoverHandler = () => { 
                if (activeTileIDs.length === 0) {
                    if (isMultiTileMode && selectionStart) {
                      const preview = getTilesBetween(selectionStart, tile.tile_id, availableTiles);
                      setPreviewTiles(preview);
                    } else if (isMultiTileMode && !selectionStart) {
                      rect.setStyle({ 
                        fillOpacity: 0.2,
                        weight: 2,
                        color: '#667eea'
                      });
                    } else if (!isMultiTileMode) {
                      rect.setStyle({ 
                        fillOpacity: isLastVisited ? 0.25 : 0.2,
                        weight: isLastVisited ? 2 : 0
                      });
                    }
                    setHoveredTile(tile.tile_id);
                }
            };
            
            const mouseoutHandler = () => { 
                if (activeTileIDs.length === 0) {
                    if (isMultiTileMode && selectionStart) {
                      setPreviewTiles([]);
                    } else if (isMultiTileMode && !selectionStart) {
                      rect.setStyle({ 
                        fillOpacity: isLastVisited ? 0.15 : 0,
                        weight: isLastVisited ? 2 : 0,
                        color: isLastVisited ? '#fbbf24' : '#667eea'
                      });
                    } else if (!isMultiTileMode) {
                      rect.setStyle({ 
                        fillOpacity: isLastVisited ? 0.15 : 0,
                        weight: isLastVisited ? 2 : 0
                      });
                    }
                    setHoveredTile(null);
                }
            };
            
            const dblclickHandler = (e) => {
                if (activeTileIDs.length === 0) {
                    L.DomEvent.stop(e);
                    L.DomEvent.stopPropagation(e);
                    
                    if (isMultiTileMode) {
                      if (!selectionStart) {
                        setSelectionStart(tile.tile_id);
                      } else if (selectionStart === tile.tile_id) {
                        setActiveTile(tile.tile_id);
                        setSelectionStart(null);
                        setPreviewTiles([]);
                      } else {
                        const selectedIDs = getTilesBetween(selectionStart, tile.tile_id, availableTiles);
                        const validation = validateTileSelection(selectedIDs, availableTiles);
                        
                        if (validation.valid) {
                          setActiveTile(selectedIDs);
                          setSelectionStart(null);
                          setPreviewTiles([]);
                        } else {
                          alert(`Invalid selection: ${validation.error}`);
                          setSelectionStart(null);
                          setPreviewTiles([]);
                        }
                      }
                    } else {
                      setActiveTile(tile.tile_id);
                    }
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
    }, [map, availableTiles, activeTileIDs.join(','), setActiveTile, lastVisitedTile, setHoveredTile, 
        isMultiTileMode, selectionStart, setSelectionStart, previewTiles.join(','), setPreviewTiles]);

    if (activeTileIDs.length === 0) {
        return null; 
    }

    // Multi-tile rendering
    if (isMultiTile) {
        // Use NETWORK bounds for overlay, not image bounds
        const combinedNetworkBounds = getCombinedNetworkBounds(activeTileIDs, availableTiles);
        const networkBounds = [
          [combinedNetworkBounds.south, combinedNetworkBounds.west],
          [combinedNetworkBounds.north, combinedNetworkBounds.east]
        ];
        
        const stitchedKey = `${activeTileIDs.join('-')}-${currentYear}`;
        const stitchedImage = stitchedImages[stitchedKey];
        
        const mergedGeoJSON = mergeGeoJSON(activeTileIDs, currentYear, allNetworkData);
        
        return (
            <>
                {stitchedImage ? (
                    <ImageOverlay
                        url={stitchedImage}
                        bounds={networkBounds}  // Use network bounds, not image bounds
                        opacity={satelliteOpacity}
                        key={`stitched-${currentYear}-${activeTileIDs.join('-')}`}
                    />
                ) : null}
                
                {mergedGeoJSON && isNetworkVisible && mergedGeoJSON.features.length > 0 && (
                    <GeoJSON
                        data={mergedGeoJSON}
                        style={getFeatureStyle}
                        key={`geojson-multi-${currentYear}-${JSON.stringify(layers)}-${activeTileIDs.join('-')}`}
                    />
                )}
            </>
        );
    }

    // Single tile rendering (unchanged)
    const tileID = activeTileIDs[0];
    const activeTileData = availableTiles.find(t => t.tile_id === tileID);
    
    if (!activeTileData) return null;
    
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

// ============================================================================
// MAIN APP
// ============================================================================
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
  const [singleTileOpacity, setSingleTileOpacity] = useState(0.8); // Remember user's single-tile setting
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
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // MULTI-TILE STATE
  const [isMultiTileMode, setIsMultiTileMode] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [previewTiles, setPreviewTiles] = useState([]);
  const [stitchedImages, setStitchedImages] = useState({});
  const [showMultiTileWarning, setShowMultiTileWarning] = useState(false);
  const [pendingMultiTileSelection, setPendingMultiTileSelection] = useState(null);

  // STATISTICS STATE
  const [tileStats, setTileStats] = useState(null);
  const [temporalStats, setTemporalStats] = useState(null);
  const [comparativeStats, setComparativeStats] = useState(null);
  const [insights, setInsights] = useState([]);

  // YEAR FILTER STATE
  const [selectedYears, setSelectedYears] = useState(YEARS); // All years selected by default
  const [isYearFilterOpen, setIsYearFilterOpen] = useState(false);
  const yearFilterRef = useRef(null);

  // Close year filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (yearFilterRef.current && !yearFilterRef.current.contains(event.target)) {
        setIsYearFilterOpen(false);
      }
    };

    if (isYearFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearFilterOpen]);

  const [tooltipPosition, setTooltipPosition] = useState(() => {
    return { x: 20, y: window.innerHeight - 200 };
  });
  
  // Get current theme
  const theme = isDarkMode ? THEMES.dark : THEMES.light;
  
  const isAreaSelected = !!activeTileID;
  const isMultiTile = Array.isArray(activeTileID) && activeTileID.length > 1;
  const activeTileIDs = Array.isArray(activeTileID) ? activeTileID : (activeTileID ? [activeTileID] : []);
  
  // Get tile data
  const activeTileData = useMemo(() => {
    if (!availableTiles || !activeTileID) return null;
    if (isMultiTile) {
      const combinedBounds = getCombinedNetworkBounds(activeTileIDs, availableTiles);
      return {
        bounds: combinedBounds,
        name: `Multi-Tile Selection (${activeTileIDs.length} tiles)`,
        tile_id: activeTileIDs.join('-')
      };
    }
    return availableTiles.find(t => t.tile_id === activeTileID);
  }, [availableTiles, activeTileID, activeTileIDs, isMultiTile]);
  
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
  
  const currentNetworkData = useMemo(() => {
    if (!activeTileID) return null;
    if (isMultiTile) {
      return mergeGeoJSON(activeTileIDs, currentYear, allNetworkData);
    }
    return allNetworkData[activeTileID]?.[currentYear];
  }, [activeTileID, activeTileIDs, currentYear, allNetworkData, isMultiTile]);

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

  // LAZY LOAD NETWORK DATA WHEN TILE(S) SELECTED
  useEffect(() => {
    if (!activeTileIDs || activeTileIDs.length === 0) return;
    
    const tilesToLoad = activeTileIDs.filter(id => !allNetworkData[id]);
    
    if (tilesToLoad.length === 0) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    const tilePromises = tilesToLoad.map(tileID => {
      const yearPromises = YEARS.map(year => {
        const dataPath = `/data/tiles/${tileID}/networks/${year}.geojson`;
        return fetch(dataPath)
          .then(response => response.ok ? response.json() : null)
          .then(data => ({ year, data }))
          .catch(() => null);
      });
      
      return Promise.all(yearPromises).then(results => {
        const yearData = {};
        results.forEach(result => {
          if (result && result.data) {
            yearData[result.year] = result.data;
          }
        });
        return { tileID, yearData };
      });
    });
    
    Promise.all(tilePromises)
      .then(results => {
        const newData = {};
        results.forEach(({ tileID, yearData }) => {
          newData[tileID] = yearData;
        });
        
        setAllNetworkData(prev => ({
          ...prev,
          ...newData
        }));
        
        setIsLoading(false);
      })
      .catch(error => {
        console.error(`❌ Error loading tiles:`, error);
        setIsLoading(false);
      });
      
  }, [activeTileIDs.join(',')]);

  // STITCH IMAGES FOR MULTI-TILE
  useEffect(() => {
    if (!isMultiTile || !availableTiles) return;
    
    const validation = validateTileSelection(activeTileIDs, availableTiles);
    if (!validation.valid) return;
    
    const { layout } = validation;
    
    const stitchPromises = YEARS.map(async (year) => {
      const key = `${activeTileIDs.join('-')}-${year}`;
      
      if (stitchedImages[key]) return null;
      
      const stitched = await stitchImages(activeTileIDs, year, availableTiles, layout);
      return { year, key, stitched };
    });
    
    Promise.all(stitchPromises).then(results => {
      const newStitched = {};
      results.forEach(result => {
        if (result) {
          newStitched[result.key] = result.stitched;
        }
      });
      
      if (Object.keys(newStitched).length > 0) {
        setStitchedImages(prev => ({
          ...prev,
          ...newStitched
        }));
      }
    });
    
  }, [isMultiTile, activeTileIDs.join(','), availableTiles]);

  // STATISTICS CALCULATION
  useEffect(() => {
    if (!activeTileIDs.length) {
      setTileStats(null);
      setTemporalStats(null);
      setComparativeStats(null);
      setInsights([]);
      return;
    }

    const yearlyStats = {};
    
    let bounds;
    if (isMultiTile) {
      bounds = getCombinedNetworkBounds(activeTileIDs, availableTiles);
    } else {
      const tile = availableTiles?.find(t => t.tile_id === activeTileIDs[0]);
      bounds = tile?.bounds;
    }
    
    if (!bounds) return;
    
    // Only calculate stats for selected years
    selectedYears.forEach(year => {
      if (isMultiTile) {
        const mergedGeoJSON = mergeGeoJSON(activeTileIDs, year, allNetworkData);
        if (mergedGeoJSON && mergedGeoJSON.features.length > 0) {
          yearlyStats[year] = calculateGeoJSONStats(mergedGeoJSON, bounds);
        }
      } else {
        const geojson = allNetworkData[activeTileIDs[0]]?.[year];
        if (geojson) {
          yearlyStats[year] = calculateGeoJSONStats(geojson, bounds);
        }
      }
    });

    const temporal = calculateTemporalStats(yearlyStats, selectedYears);
    const comparative = calculateComparativeStats(yearlyStats, selectedYears);
    const detectedInsights = generateInsights(yearlyStats, temporal, selectedYears);

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

  }, [activeTileIDs.join(','), allNetworkData, isMultiTile, availableTiles, selectedYears.join(',')]);

  // HANDLERS
  const handleGoBack = () => {
      setLastVisitedTileID(activeTileID);
      setActiveTileID(null);
      setMapInitialized(false);
      setIsControlsOpen(false);
      setIsStatsOpen(false);
      setSelectionStart(null);
      setPreviewTiles([]);
      // Don't reset opacity here - will be set correctly on next selection
  };
  
  // Modified to intercept multi-tile selections and show warning
  const setActiveTileAndZoom = (tileID) => {
    const isMultiTileSelection = Array.isArray(tileID) && tileID.length > 1;
    
    if (isMultiTileSelection) {
      // Show warning dialog first
      setPendingMultiTileSelection(tileID);
      setShowMultiTileWarning(true);
    } else {
      // Single tile - restore saved single-tile opacity
      setCurrentYear(2024);
      setSatelliteOpacity(singleTileOpacity);
      setActiveTileID(tileID);
    }
  }
  
  const handleMultiTileWarningAccept = () => {
    setShowMultiTileWarning(false);
    setCurrentYear(2024);
    // ALWAYS set to 10% for multi-tile (2+ tiles)
    setSatelliteOpacity(0.1);
    setActiveTileID(pendingMultiTileSelection);
    setPendingMultiTileSelection(null);
  };
  
  const handleMultiTileWarningCancel = () => {
    setShowMultiTileWarning(false);
    setPendingMultiTileSelection(null);
    setSelectionStart(null);
    setPreviewTiles([]);
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

  // Year filter handler
  const toggleYear = (year) => {
    setSelectedYears(prev => {
      const newYears = prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year].sort((a, b) => a - b);
      
      // Must have at least one year selected
      if (newYears.length === 0) {
        return prev;
      }
      
      // If current year is deselected, switch to nearest selected year
      if (!newYears.includes(currentYear)) {
        const nearestYear = newYears.reduce((prev, curr) => 
          Math.abs(curr - currentYear) < Math.abs(prev - currentYear) ? curr : prev
        );
        setCurrentYear(nearestYear);
      }
      
      return newYears;
    });
  };

  // INITIAL LOADING STATE
  if (!availableTiles || !currentBounds) {
      return (
          <div style={{
            width: '100vw', 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: theme.background,
            transition: 'all 0.3s ease'
          }}>
              <div style={{
                background: theme.surface,
                padding: '20px 40px',
                borderRadius: '12px',
                boxShadow: theme.shadowLg,
                fontSize: '16px',
                fontWeight: '500',
                color: theme.textPrimary,
                transition: 'all 0.3s ease'
              }}>
                Loading map...
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
      {/* Multi-Tile Warning Dialog */}
      {showMultiTileWarning && (
        <MultiTileWarningDialog 
          onAccept={handleMultiTileWarningAccept}
          onCancel={handleMultiTileWarningCancel}
          theme={theme}
        />
      )}
      
      {/* Header */}
      {!isAreaSelected && (
        <div style={{
          padding: '20px 30px',
          background: theme.headerBg,
          color: 'white',
          boxShadow: theme.shadowMd,
          transition: 'all 0.3s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
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
                  Last visited: {Array.isArray(lastVisitedTileID) 
                    ? `${lastVisitedTileID.length} tiles` 
                    : '1 tile'} (highlighted in gold)
                </span>
              )}
            </p>
          </div>
          
          {/* Multi-Tile Toggle Button */}
          <button
            onClick={() => {
              const newMode = !isMultiTileMode;
              setIsMultiTileMode(newMode);
              setSelectionStart(null);
              setPreviewTiles([]);
            }}
            style={{
              padding: '10px 20px',
              background: isMultiTileMode ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: isMultiTileMode ? '2px solid #059669' : '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '18px' }}>🔲🔲</span>
            Multi-Select {isMultiTileMode ? '(ON)' : '(OFF)'}
          </button>
        </div>
      )}
      
      {/* Draggable Hover Tooltip */}
      {!isAreaSelected && (
        <DraggableTooltip 
          hoveredTileData={hoveredTileData} 
          parseTileName={parseTileName}
          position={tooltipPosition}
          setPosition={setTooltipPosition}
          theme={theme}
        />
      )}
      
      {/* Map Container */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        background: isAreaSelected ? theme.background : 'transparent',
        transition: 'background 0.3s ease'
      }}>
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
            isMultiTileMode={isMultiTileMode}
            selectionStart={selectionStart}
            setSelectionStart={setSelectionStart}
            previewTiles={previewTiles}
            setPreviewTiles={setPreviewTiles}
            stitchedImages={stitchedImages}
            allNetworkData={allNetworkData}
          />
        </MapContainer>
        
        {/* LOADING SPINNER */}
        {isLoading && isAreaSelected && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            animation: 'fadeIn 0.2s ease-in'
          }}>
            <div style={{
              background: theme.surface,
              padding: '30px 40px',
              borderRadius: '16px',
              boxShadow: theme.shadowLg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: `4px solid ${theme.border}`,
                borderTop: `4px solid ${theme.primary}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              
              <div style={{
                color: theme.textPrimary,
                fontSize: '16px',
                fontWeight: '500'
              }}>
                Loading {isMultiTile ? 'multi-tile' : 'tile'} data...
              </div>
              
              <div style={{
                color: theme.textSecondary,
                fontSize: '13px'
              }}>
                {activeTileData?.name || 'Region'}
              </div>
            </div>
            
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              
              /* Theme-aware Leaflet container background */
              .leaflet-container {
                background: ${theme.background} !important;
                transition: background 0.3s ease;
              }
            `}</style>
          </div>
        )}
        
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
                    background: theme.surface,
                    color: theme.primary,
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: theme.shadowMd,
                    transition: 'all 0.3s ease',
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
                {/* Settings Button with Tooltip */}
                <div style={{ position: 'relative' }}>
                  <button
                      onClick={() => {
                          if (isControlsOpen) {
                              setIsControlsOpen(false);
                          } else {
                              setIsControlsOpen(true);
                              setIsStatsOpen(false);
                          }
                      }}
                      onMouseEnter={(e) => e.currentTarget.nextElementSibling.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.nextElementSibling.style.opacity = '0'}
                      style={{
                          width: '44px',
                          height: '44px',
                          background: isControlsOpen ? theme.primary : theme.surface,
                          color: isControlsOpen ? 'white' : theme.primary,
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: theme.shadowMd,
                          cursor: 'pointer',
                          fontSize: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: '0.3s ease-in-out'
                      }}
                  >
                      ⚙️
                  </button>
                  {/* Tooltip */}
                  <div style={{
                    position: 'absolute',
                    right: '52px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: theme.tooltipBg,
                    color: theme.textPrimary,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    opacity: '0',
                    pointerEvents: 'none',
                    transition: 'opacity 0.2s',
                    boxShadow: theme.shadowMd
                  }}>
                    Map Settings
                  </div>
                </div>

                {/* Statistics Button with Tooltip */}
                <div style={{ position: 'relative' }}>
                  <button
                      onClick={() => {
                          if (isStatsOpen) {
                              setIsStatsOpen(false);
                          } else {
                              setIsStatsOpen(true);
                              setIsControlsOpen(false);
                          }
                      }}
                      onMouseEnter={(e) => e.currentTarget.nextElementSibling.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.nextElementSibling.style.opacity = '0'}
                      style={{
                          width: '44px',
                          height: '44px',
                          background: isStatsOpen ? theme.primary : theme.surface,
                          color: isStatsOpen ? 'white' : theme.primary,
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: theme.shadowMd,
                          cursor: 'pointer',
                          fontSize: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: '0.3s ease-in-out'
                      }}
                  >
                      📊
                  </button>
                  {/* Tooltip */}
                  <div style={{
                    position: 'absolute',
                    right: '52px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: theme.tooltipBg,
                    color: theme.textPrimary,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    opacity: '0',
                    pointerEvents: 'none',
                    transition: 'opacity 0.2s',
                    boxShadow: theme.shadowMd
                  }}>
                    Statistics
                  </div>
                </div>
            </div>
        )}

        {/* SETTINGS PANEL */}
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
                    background: theme.surface,
                    borderRadius: '12px',
                    padding: '15px 20px',
                    boxShadow: theme.shadowMd,
                    width: '220px',
                    maxHeight: '100%',
                    overflowY: 'auto',
                    color: theme.textPrimary,
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: `1px solid ${theme.divider}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{isDarkMode ? '🌙' : '☀️'}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>
                            {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                          </span>
                        </div>
                        <button
                          onClick={() => setIsDarkMode(!isDarkMode)}
                          style={{
                            background: isDarkMode ? theme.primary : theme.buttonHover,
                            color: isDarkMode ? 'white' : theme.textPrimary,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '16px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {isDarkMode ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>

                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: theme.textPrimary }}>
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
                            theme={theme}
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
                        onChange={(e) => {
                          const newOpacity = parseFloat(e.target.value);
                          setSatelliteOpacity(newOpacity);
                          // Save to single-tile memory if not in multi-tile mode
                          if (!isMultiTile) {
                            setSingleTileOpacity(newOpacity);
                          }
                        }}
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
                    background: theme.surface,
                    borderRadius: '12px',
                    boxShadow: theme.shadowMd,
                    width: '650px',
                    maxHeight: '100%',
                    overflowY: 'hidden',
                    transition: 'all 0.3s ease'
                }}>
                    <StatisticsPanel
                        yearlyStats={tileStats}
                        temporalStats={temporalStats}
                        comparativeStats={comparativeStats}
                        insights={insights}
                        currentYear={currentYear}
                        years={selectedYears}
                        theme={theme}
                        layerColors={layerColors}
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
                    background: theme.surface,
                    borderTop: `1px solid ${theme.border}`,
                    boxShadow: theme.shadowMd,
                    zIndex: 1000,
                    color: theme.textPrimary,
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
                        {/* Year Filter Button */}
                        <div style={{ position: 'absolute', right: 0, top: 0 }}>
                          <div ref={yearFilterRef} style={{ position: 'relative' }}>
                            <button
                              onClick={() => setIsYearFilterOpen(!isYearFilterOpen)}
                              onMouseEnter={(e) => e.currentTarget.querySelector('.tooltip').style.opacity = '1'}
                              onMouseLeave={(e) => e.currentTarget.querySelector('.tooltip').style.opacity = '0'}
                              style={{
                                padding: '8px 12px',
                                background: isYearFilterOpen ? theme.primary : theme.buttonHover,
                                color: isYearFilterOpen ? 'white' : theme.textPrimary,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                              }}
                            >
                              📅 {selectedYears.length}/{YEARS.length} Years
                              <span className="tooltip" style={{
                                position: 'absolute',
                                bottom: '110%',
                                right: '0',
                                background: theme.tooltipBg,
                                color: theme.textPrimary,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                whiteSpace: 'nowrap',
                                opacity: '0',
                                pointerEvents: 'none',
                                transition: 'opacity 0.2s',
                                boxShadow: theme.shadowMd
                              }}>
                                Filter Years
                              </span>
                            </button>
                            
                            {/* Year Filter Dropdown */}
                            {isYearFilterOpen && (
                              <div style={{
                                position: 'absolute',
                                bottom: '110%',
                                right: 0,
                                marginBottom: '8px',
                                background: theme.surface,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: theme.shadowLg,
                                minWidth: '200px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                animation: 'fadeIn 0.2s ease-out',
                                zIndex: 1001
                              }}>
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  marginBottom: '8px',
                                  color: theme.textSecondary,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span>Select Years</span>
                                  <span style={{ fontSize: '10px', fontWeight: '400' }}>
                                    (min: 1)
                                  </span>
                                </div>
                                
                                {/* Select All Checkbox */}
                                {selectedYears.length < YEARS.length && (
                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '8px',
                                      cursor: 'pointer',
                                      borderRadius: '6px',
                                      background: theme.primary + '15',
                                      border: `1px solid ${theme.primary}40`,
                                      marginBottom: '8px',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = theme.primary + '25'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = theme.primary + '15'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      onChange={() => setSelectedYears(YEARS)}
                                      style={{
                                        marginRight: '8px',
                                        cursor: 'pointer',
                                        accentColor: theme.primary
                                      }}
                                    />
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      color: theme.primary
                                    }}>
                                      ✓ Select All Years
                                    </span>
                                  </label>
                                )}
                                
                                {YEARS.map(year => (
                                  <label
                                    key={year}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '6px 8px',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      transition: 'background 0.2s',
                                      background: year === currentYear ? theme.background : 'transparent'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = theme.background}
                                    onMouseLeave={(e) => e.currentTarget.style.background = year === currentYear ? theme.background : 'transparent'}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedYears.includes(year)}
                                      onChange={() => toggleYear(year)}
                                      disabled={selectedYears.length === 1 && selectedYears.includes(year)}
                                      style={{
                                        marginRight: '8px',
                                        cursor: selectedYears.length === 1 && selectedYears.includes(year) ? 'not-allowed' : 'pointer'
                                      }}
                                    />
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: year === currentYear ? '600' : '400',
                                      color: selectedYears.includes(year) ? theme.textPrimary : theme.textTertiary
                                    }}>
                                      {year}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '15px',
                            paddingRight: '140px' // Space for year filter button
                        }}>
                            <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: theme.primary }}>
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
                            <div style={{ fontSize: '14px', color: theme.textSecondary }}>
                                {activeTileData?.name}
                            </div>
                        </div>
                        
                        <input
                            type="range"
                            min={0}
                            max={selectedYears.length - 1}
                            value={selectedYears.indexOf(currentYear)}
                            onChange={(e) => setCurrentYear(selectedYears[parseInt(e.target.value)])}
                            style={{
                                width: '100%',
                                height: '8px',
                                borderRadius: '4px',
                                outline: 'none',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                background: `linear-gradient(to right, #667eea ${(selectedYears.indexOf(currentYear) / (selectedYears.length - 1)) * 100}%, #e0e0e0 ${(selectedYears.indexOf(currentYear) / (selectedYears.length - 1)) * 100}%)`
                            }}
                        />
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            marginTop: '10px'
                        }}>
                            {selectedYears.map(year => (
                                <div 
                                    key={year}
                                    onClick={() => setCurrentYear(year)}
                                    style={{
                                        fontSize: '12px',
                                        color: year === currentYear ? theme.primary : theme.textTertiary,
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