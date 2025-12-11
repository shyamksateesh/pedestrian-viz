// CORS proxy for local development (REQUIRED!)
const CORS_PROXY = 'https://corsproxy.io/?';

// Load config from public folder
const loadConfig = async () => {
  const response = await fetch('/pedestrian-viz/drive-data-config.json');
  return response.json();
};

// Build Drive URL with proxy for localhost
const buildDriveUrl = (fileId, config) => {
  const driveUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
  
  // Use CORS proxy ONLY on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${CORS_PROXY}${encodeURIComponent(driveUrl)}`;
  }
  
  // Production (GitHub Pages): direct URL
  return driveUrl;
};

// Fetch file from Google Drive
export const fetchFromDrive = async (fileId) => {
  const config = await loadConfig();
  const url = buildDriveUrl(fileId, config);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching from Drive:', error);
    throw error;
  }
};

// Fetch image from Google Drive
export const fetchImageFromDrive = async (fileId) => {
  const config = await loadConfig();
  const url = buildDriveUrl(fileId, config);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error fetching image from Drive:', error);
    throw error;
  }
};

// Fetch tiles index
export const fetchTilesIndex = async () => {
  const config = await loadConfig();
  return fetchFromDrive(config.tilesIndex);
};

// Fetch network data for specific tile and year
export const fetchNetworkData = async (tileId, year) => {
  const config = await loadConfig();
  const fileId = config.tiles[tileId]?.networks?.[year];
  
  if (!fileId) {
    throw new Error(`No network data found for tile ${tileId}, year ${year}`);
  }
  
  return fetchFromDrive(fileId);
};

// Fetch imagery for specific tile and year
export const fetchImagery = async (tileId, year) => {
  const config = await loadConfig();
  const fileId = config.tiles[tileId]?.imagery?.[year];
  
  if (!fileId) {
    throw new Error(`No imagery found for tile ${tileId}, year ${year}`);
  }
  
  return fetchImageFromDrive(fileId);
};