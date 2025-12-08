# 🗺️ NYC Sidewalk Time Machine

**An Interactive 20-Year Visualization of Manhattan's Pedestrian Infrastructure Evolution (2004-2024)**

[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.x-199900?logo=leaflet)](https://leafletjs.com/)
[![D3.js](https://img.shields.io/badge/D3.js-7.x-F9A03C?logo=d3.js)](https://d3js.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A full-stack geospatial visualization tool combining computer vision, GIS processing, and interactive web technologies to analyze two decades of New York City's pedestrian infrastructure changes at unprecedented granularity.

[Video Walkthrough](#) | [Report Issues](../../issues)

---

## 📸 Project Showcase

<div align="center">

### Main Interface
![Main Interface](docs/images/main-interface.png)
*Interactive tile-based map showing Manhattan's pedestrian networks with temporal controls*

### Multi-Tile Selection & Analysis
![Multi-Tile Selection](docs/images/multi-tile-selection.png)
*Select up to 16 adjacent tiles for neighborhood-scale comparative analysis*

### Dark Mode Support
![Dark Mode](docs/images/dark-mode.png)
*Fully theme-aware interface with smooth dark mode transitions*

### Statistical Insights
![Statistics Panel](docs/images/statistics-panel.png)
*Real-time D3.js visualizations showing temporal trends and infrastructure metrics*

### Timeline Navigation
![Timeline Slider](docs/images/timeline-slider.png)
*Seamless year-by-year navigation through 20 years of infrastructure evolution*

### Layer Customization
![Network Layers](docs/images/network-layers.png)
*Independent control of sidewalks, roads, and crosswalks with custom colors*

</div>

---

## 🎯 Overview

Understanding how urban pedestrian infrastructure evolves is critical for:
- **Urban Planning**: Quantify infrastructure investment and identify gaps
- **Accessibility Research**: Track ADA compliance and sidewalk coverage over time
- **Policy Analysis**: Measure the impact of city initiatives on pedestrian safety
- **Academic Research**: Provide high-resolution temporal data for urban studies

### The Challenge

Historical pedestrian infrastructure data is typically:
- Scattered across municipal databases
- Inconsistently formatted across years
- Rarely visualized at high spatial and temporal resolution
- Inaccessible for comparative analysis

### Our Solution

The NYC Sidewalk Time Machine provides:

1. **Automated Data Processing**: Extract pedestrian networks from satellite imagery using deep learning
2. **Interactive Visualization**: Explore 20 years of infrastructure data through an intuitive web interface
3. **Real-Time Analysis**: Calculate metrics like density, coverage, and pedestrian-friendliness ratios
4. **Flexible Comparison**: View single tiles for precision or combine up to 16 tiles for neighborhood analysis

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     DATA PIPELINE                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  NYC Open Data → tile2net → GeoJSON → React Visualization  │
│                                                            │
│  [Satellite     [Computer   [Spatial    [Interactive       │
│   Imagery]       Vision]     Data]       Maps & Charts]    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Processing Pipeline**: Google Colab notebooks handle GPU-accelerated computer vision
**Visualization Layer**: React + Leaflet + D3.js for interactive exploration

---

## ✨ Key Features

### 🗺️ **Interactive Mapping**
- **512×512px Tile Grid**: High-resolution coverage of Manhattan
- **Single & Multi-Tile Modes**: Analyze individual tiles or combine up to 16 for neighborhood views
- **Smart Coordinate Transformation**: Precise alignment between imagery and network data
- **Seamless Image Stitching**: Canvas-based composition for multi-tile selections

### 📅 **Temporal Analysis**
- **20-Year Timeline**: Data from 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024
- **Year Filtering**: Focus analysis on specific time periods
- **Animated Transitions**: Smooth visual updates when changing years

### 🎨 **Customizable Visualization**
- **Layer Controls**: Toggle sidewalks, roads, and crosswalks independently
- **Color Palette**: 20-color preset picker plus custom hex input for each layer
- **Opacity Sliders**: Separate controls for satellite imagery and network overlays
- **Dark Mode**: Complete theming system with instant switching

### 📊 **Statistical Insights**
- **Temporal Trends**: Line charts showing infrastructure growth patterns
- **Comparative Metrics**: Pedestrian-friendliness ratios and crosswalk density
- **Real-Time Calculations**: Length, area, and density statistics computed on-the-fly
- **Animated D3.js Charts**: Smooth transitions and interactive tooltips

### 🚀 **Performance Optimizations**
- **Lazy Loading**: Networks and imagery loaded only when needed
- **Session Caching**: Image stitching results cached for instant re-access
- **Efficient Rendering**: React optimizations prevent unnecessary re-renders

---

## 🛠️ Technology Stack

### Frontend
- **React 18.x** - Component-based UI framework
- **Vite** - Fast build tool and dev server
- **React-Leaflet** - Interactive mapping
- **Leaflet.js** - Geospatial visualization
- **D3.js 7.x** - Statistical charts and animations
- **Turf.js** - Spatial analysis and calculations

### Data Processing (Python/Colab)
- **tile2net** - Deep learning for street network extraction
- **GeoPandas** - Geospatial data manipulation
- **Rasterio** - Raster imagery processing
- **Shapely** - Geometric operations

### Data Sources
- **NYC Open Data** - High-resolution orthoimagery (0.5ft resolution)
- **OpenStreetMap** - Base map tiles

---

## 📂 Repository Structure

```
pedestrian_viz/
├── app/                           # React application
│   ├── components/
│   │   └── StatisticsPanel_D3.jsx
│   ├── utils/
│   │   ├── statsCalculator.js
│   │   └── theme.js
│   ├── App.jsx
│   ├── main.jsx
│   └── public/data/               # Generated from notebooks
│       └── tiles/                 # All data organized by tile
│           ├── tiles_index.json
│           ├── imagery/
│           │   └── metadata.json
│           └── manhattan_tile_*/
│               ├── imagery/       # PNGs by year
│               └── networks/      # GeoJSON by year
│
├── notebooks/                     # Google Colab pipeline
│   ├── 00_setup_and_config.ipynb
│   ├── 01_tile2net_extract.ipynb
│   └── 02_prepare_for_web.ipynb
│
├── docs/images/                   # README screenshots
├── scripts/                       # Utility scripts
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm** ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- *Optional*: **Google Colab** account (for data processing)

### 1. Clone Repository

```bash
git clone https://github.com/shyamksateesh/pedestrian_viz.git
cd pedestrian_viz
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Get the Data

**Option A: Use Pre-processed Data (Recommended)**
- Download processed data package from [Releases](#)
- Extract to `app/public/data/`

**Option B: Process Your Own Data**
- See [Data Processing Pipeline](#data-processing-pipeline) below
- Run the Colab notebooks to generate your own dataset

### 4. Run Development Server

```bash
npm run dev
```

Navigate to `http://localhost:5173` 🎉

### 5. Build for Production

```bash
npm run build
```

Outputs to `dist/` directory ready for deployment.

---

## 📊 Data Processing Pipeline

The data processing uses **Google Colab** notebooks for three key reasons:

1. **Free GPU Access**: tile2net requires GPU acceleration (6 hours → 20 minutes per year)
2. **Pre-installed GIS Tools**: GDAL, rasterio, and geospatial libraries work out-of-the-box
3. **Large-Scale Processing**: Handle 50+ GB of satellite imagery without local storage constraints

### Pipeline Overview

```
Notebook 00        Notebook 01           Notebook 02
   Setup      →    tile2net Extract  →   Web Export
                                          
[Configure]    [NYC Imagery → Networks]  [tiles_index.json]
[Install]      [512×512 tiles]           [GeoJSON files]
[Dependencies] [GPU Processing]          [PNG images]
```

### Notebook 00: Setup & Configuration

**Purpose**: Install dependencies and configure Google Drive

**What it does**:
- Installs `tile2net`, `geopandas`, `rasterio`, `shapely`
- Mounts Google Drive for data persistence
- Creates directory structure for processing

**Runtime**: ~2 minutes

---

### Notebook 01: tile2net Network Extraction

**Purpose**: Extract pedestrian networks from NYC satellite imagery using computer vision

**What it does**:
1. Downloads high-resolution orthoimagery from NYC Open Data (2004-2024)
2. Tiles imagery into 512×512px patches
3. Runs tile2net segmentation model (detects sidewalks, roads, crosswalks)
4. Extracts vector network geometries from segmentation masks
5. Saves to GeoPackage format with attributes

**Data Source**: [NYC Open Data - Orthoimagery](https://data.cityofnewyork.us/)

**Key Features**:
- GPU-accelerated processing (18x speedup)
- Automatic handling of coordinate systems
- Progress tracking for 11 years of data

**Runtime**: ~4 hours with GPU (all years)

**Output**: `networks_YYYY.gpkg` files containing LineString geometries

---

### Notebook 02: Prepare for Web

**Purpose**: Convert GeoPackage data to React-ready format

**What it does**:
1. Transforms coordinates to WGS84 (EPSG:4326) for Leaflet compatibility
2. Generates `tiles_index.json` with tile metadata and bounds
3. Exports per-tile GeoJSON files organized by year
4. Creates 512×512px PNG images from satellite tiles
5. Structures output for direct use in React app

**Runtime**: ~1 hour

**Output Structure**:
```
data/
└── tiles/
    ├── tiles_index.json           # Tile metadata
    ├── imagery/
    │   └── metadata.json
    ├── manhattan_tile_0/
    │   ├── imagery/
    │   │   ├── 2004.png
    │   │   ├── 2006.png
    │   │   ├── 2008.png
    │   │   └── ...
    │   └── networks/
    │       ├── 2004.geojson
    │       ├── 2006.geojson
    │       ├── 2008.geojson
    │       └── ...
    ├── manhattan_tile_1/
    │   ├── imagery/
    │   └── networks/
    ├── manhattan_tile_2/
    └── ...
```

### Running the Pipeline

1. **Open Colab**: Click notebook links in `notebooks/` directory
2. **Enable GPU**: Runtime → Change runtime type → GPU
3. **Run All Cells**: Runtime → Run all (or Ctrl+F9)
4. **Download Results**: Copy `data/` folder to `app/public/`

**Total Time**: ~5 hours for complete dataset (11 years)

**Storage Requirements**:
- Input: ~50 GB (satellite imagery)
- Processing: ~20 GB (intermediate files)
- Output: ~2 GB (web-ready data)

---

## 🎛️ Application Features

### Single-Tile Mode

**Best for**: Detailed analysis, precise measurements, street-level accuracy

- Perfect coordinate transformation between imagery and networks
- High-precision overlay alignment
- Detailed statistics for 512×512px area

### Multi-Tile Mode

**Best for**: Neighborhood patterns, area comparisons, trend identification

- Select 1-16 adjacent tiles (must form rectangle)
- Automated image stitching
- Aggregated statistics across selection
- Network-first rendering (accepts ±10% imagery alignment)

**Selection Process**:
1. Click "Multi-Select (ON)"
2. Double-click start tile (turns green)
3. Hover to preview selection area
4. Double-click end tile
5. Review alignment warning
6. Confirm and analyze

### Statistical Analysis

Real-time calculations using Turf.js:

- **Length Metrics**: Total kilometers of each network type
- **Density**: km per km² for infrastructure comparison
- **Coverage**: Feature counts and distribution
- **Pedestrian-Friendliness**: Sidewalk-to-road ratios
- **Temporal Trends**: Growth rates and change patterns
- **Comparative Analysis**: Year-over-year comparisons

### Theme System

Two carefully designed themes:

- **Light Mode**: High contrast for daytime use
- **Dark Mode**: Reduced eye strain for extended sessions

All 30+ UI elements smoothly transition between themes, including:
- Map backgrounds
- Chart colors
- Text and borders
- Shadows and overlays

---

## 🐛 Known Limitations

### Multi-Tile Alignment

**Issue**: ±10% alignment discrepancy between imagery and networks in multi-tile mode

**Cause**: Single tiles use precise transformation; multi-tile uses averaged bounds

**Impact**: Visual only - GeoJSON coordinates remain accurate for measurements

**When to Use**:
- **Single-tile**: Precision work, exact measurements
- **Multi-tile**: Pattern detection, neighborhood trends

### Browser Compatibility

- **Recommended**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, Brave
- **Not Supported**: Internet Explorer (uses modern JavaScript)

### Data Coverage

- **Geographic**: Manhattan only (expandable to other boroughs)
- **Temporal**: Some tiles missing data for certain years
- **tile2net Accuracy**: 85-95% precision depending on feature type

---

## 📚 Documentation

### Component Architecture

The application uses a modular React architecture:

- **App.jsx**: Main component managing state and tile selection
- **StatisticsPanel**: Tab-based interface for metrics and charts
- **TileInteractionLayer**: Handles map rendering and user interactions
- **Utility Functions**: Shared calculations and transformations

### State Management

Key state variables:

```javascript
activeTileID        // Currently selected tile(s)
currentYear         // Active year from timeline
allNetworkData      // Cached GeoJSON by tile and year
isDarkMode          // Theme toggle
layers              // Sidewalk/road/crosswalk visibility
layerColors         // Custom colors for each network type
```

### Performance Considerations

**Lazy Loading**: Networks fetched only when tile is selected (~50-100 KB per tile)

**Caching Strategy**: Stitched images stored in memory to prevent recomputation

**React Optimization**: Uses `useMemo` and `useCallback` to minimize re-renders

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes with clear commit messages
4. Test thoroughly (see [Testing](#testing) below)
5. Submit a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Add comments for complex logic
- Keep components focused and reusable
- Test on multiple browsers and screen sizes

### Testing Checklist

Before submitting a PR:

- [ ] Tested on Chrome, Firefox, and Safari
- [ ] Dark mode works correctly
- [ ] Multi-tile selection with various configurations
- [ ] Statistics calculate accurately
- [ ] No console errors or warnings

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

**Third-Party Licenses**:
- React (MIT), Leaflet (BSD-2-Clause), D3.js (ISC)
- tile2net (MIT), OpenStreetMap tiles (ODbL)

---

## 🙏 Acknowledgments

### Core Technologies & Tools

- **[tile2net](https://github.com/VIDA-NYU/tile2net)** by NYU VIDA Lab - The deep learning foundation that makes automated network extraction possible
- **[React](https://react.dev/)** - Powerful component framework for building the UI
- **[Leaflet](https://leafletjs.com/)** - Open-source mapping library
- **[D3.js](https://d3js.org/)** - Data visualization primitives
- **Google Colab** - Free GPU resources for large-scale processing

### Data Providers

- **[NYC Open Data](https://opendata.cityofnewyork.us/)** - High-resolution orthoimagery spanning 20 years
- **[OpenStreetMap](https://www.openstreetmap.org/)** - Base map tiles

### Special Recognition

- **NYU VIDA Lab** - Pioneering urban analytics and computer vision research
- **Urban Planning Community** - Inspiring the need for accessible infrastructure tools
- **Open Source Community** - Countless libraries enabling modern development

---

## 📧 Contact

**Shyam Krishna Sateesh**
- Email: shyam.s@nyu.edu
- GitHub: [@shyamksateesh](https://github.com/shyamksateesh)
- LinkedIn: [linkedin.com/in/shyamksateesh](https://www.linkedin.com/in/shyamksateesh/)

**Project Repository**: [github.com/shyamksateesh/pedestrian_viz](https://github.com/shyamksateesh/pedestrian_viz)

---

## 🗺️ Roadmap

### Planned Features

- [ ] Export functionality (GeoJSON, CSV, PNG)
- [ ] Animation mode (auto-play through years)
- [ ] Comparison view (side-by-side years)
- [ ] Mobile optimization
- [ ] Tutorial walkthrough for first-time users

### Future Enhancements

- [ ] Expand to other NYC boroughs (Brooklyn, Queens, Bronx, Staten Island)
- [ ] Additional layers (bike lanes, bus routes)
- [ ] 3D visualization with building extrusion
- [ ] REST API for programmatic access
- [ ] Accessibility compliance scoring

### Research Applications

- [ ] ML training dataset export
- [ ] Urban planning workflow integration
- [ ] Academic collaboration tools
- [ ] Policy impact analysis features

---

## 📊 Project Statistics

- **Frontend**: ~10,000+ lines (React, JavaScript)
- **Processing**: 3 Colab notebooks (~1,500 lines Python)
- **Data Processed**: ~50,000 network segments
- **Coverage**: 60+ km² (Manhattan)
- **Temporal Span**: 20 years (2004-2024)
- **Components**: 25+ React components
- **Visualizations**: 3 interactive D3.js charts

---

<div align="center">

**Built with ❤️ for urban analytics and open data**

If you find this project useful, please ⭐ **star the repo**!

[Report Bug](../../issues) · [Request Feature](../../issues) · [Discussions](../../discussions)

*Made possible by NYU Visualization for Machine Learning Course (Fall 2024)*

</div>
