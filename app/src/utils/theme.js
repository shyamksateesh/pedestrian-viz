// ============================================================================
// THEME SYSTEM - Light & Dark Mode Colors
// ============================================================================

export const THEMES = {
  light: {
    // Main backgrounds
    background: '#f0f0f0',
    surface: '#ffffff',
    surfaceHover: '#f8f9fa',
    
    // Text colors
    textPrimary: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    
    // Borders & dividers
    border: '#e0e0e0',
    divider: '#eeeeee',
    
    // Accents
    primary: '#667eea',
    primaryGradientStart: '#667eea',
    primaryGradientEnd: '#764ba2',
    
    // Chart backgrounds
    chartBackground: '#ffffff',
    chartSurface: '#f8f9fa',
    
    // Shadows
    shadowSm: '0 2px 6px rgba(0,0,0,0.06)',
    shadowMd: '0 4px 12px rgba(0,0,0,0.15)',
    shadowLg: '0 8px 32px rgba(0,0,0,0.15)',
    
    // Tooltips
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipText: '#333333',
    
    // Special surfaces
    cardBg: '#ffffff',
    panelBg: '#ffffff',
    headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    
    // Interactive states
    buttonHover: '#f5f5f5',
    buttonActive: '#e0e0e0',
    
    // Data viz specific
    gridLine: '#e0e0e0',
    axisText: '#666666',
    
    // Gold accent (last visited tile)
    goldAccent: '#fbbf24',
    goldAccentBg: 'rgba(251, 191, 36, 0.3)',
  },
  
  dark: {
    // Main backgrounds
    background: '#0f0f1a',
    surface: '#1a1a2e',
    surfaceHover: '#25254a',
    
    // Text colors
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',
    
    // Borders & dividers
    border: '#27272a',
    divider: '#3f3f46',
    
    // Accents
    primary: '#818cf8',
    primaryGradientStart: '#818cf8',
    primaryGradientEnd: '#a78bfa',
    
    // Chart backgrounds
    chartBackground: '#1a1a2e',
    chartSurface: '#25254a',
    
    // Shadows
    shadowSm: '0 2px 6px rgba(0,0,0,0.4)',
    shadowMd: '0 4px 12px rgba(0,0,0,0.5)',
    shadowLg: '0 8px 32px rgba(0,0,0,0.6)',
    
    // Tooltips
    tooltipBg: 'rgba(26, 26, 46, 0.98)',
    tooltipText: '#e4e4e7',
    
    // Special surfaces
    cardBg: '#1a1a2e',
    panelBg: '#1a1a2e',
    headerBg: 'linear-gradient(135deg, #1e1e3f 0%, #2d1b4e 100%)',
    
    // Interactive states
    buttonHover: '#2d2d4a',
    buttonActive: '#3a3a5a',
    
    // Data viz specific
    gridLine: '#3f3f46',
    axisText: '#a1a1aa',
    
    // Gold accent (last visited tile)
    goldAccent: '#fbbf24',
    goldAccentBg: 'rgba(251, 191, 36, 0.2)',
  }
};

// Layer colors remain vibrant in both modes (these are for data visualization)
export const DATA_COLORS = {
  sidewalk: '#4A90E2',
  road: '#FF6B6B',
  crosswalk: '#4ECDC4',
  
  // Status colors (work in both themes)
  success: '#52BE80',
  error: '#EC7063',
  warning: '#F39C12',
  info: '#5DADE2',
};

// Helper to get current theme
export const getTheme = (isDarkMode) => isDarkMode ? THEMES.dark : THEMES.light;