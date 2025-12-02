# NYC Sidewalk Time Machine

**CS-GY 9223: Visualization for Machine Learning - Fall 2025**  
**Shyam Krishna Sateesh (ss20355)**

An interactive web application that visualizes the temporal evolution of NYC's pedestrian infrastructure using machine learning-generated maps from 2004-2024.

![NYC Sidewalk Timeline Demo](docs/demo.gif)

---

## 🎯 Project Overview

This project transforms 20+ years of aerial imagery into an explorable geospatial-temporal interface, enabling users to "time travel" through Manhattan's infrastructure history. Built with React, Leaflet, and D3.js, it processes ML model outputs (semantic segmentation via Tile2Net) into an interactive dashboard.

### Key Features

- **Interactive Map Interface**: Double-click any neighborhood to explore its sidewalk evolution
- **Multi-Year Timeline**: Seamlessly transition between 11 years of data (2004-2024)
- **Layer Controls**: Toggle between sidewalks, roads, and crosswalks
- **ML Output Visualization**: Real-time rendering of computer vision model predictions
- **Statistical Dashboard**: D3-powered analytics showing infrastructure growth trends

---

## 🏗️ Project Structure
```
pedestrian-viz/
├── app/                          # React application
│   ├── src/
│   │   └── App.jsx              # Main application component
│   ├── public/
│   │   └── data/                # Processed data (gitignored)
│   └── package.json
├── scripts/
│   ├── prepare_data.py          # Local data preparation
│   └── colab_pipeline.py        # Google Colab processing pipeline
├── docs/                        # Documentation & assets
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+ (for data preparation)
- Google Colab account (for large-scale processing)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/pedestrian-viz.git
cd pedestrian-viz
```

### 2. Install Dependencies
```bash
cd app
npm install
```

### 3. Prepare Data

**Option A: Use Pre-processed Data** (Fastest)
```bash
# Download from Google Drive (link in docs/DATA.md)
# Extract to app/public/data/
```

**Option B: Process Your Own Area**
```bash
cd ../scripts
python prepare_data.py
```

### 4. Run the Application
```bash
cd ../app
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📊 Data Pipeline

### ML Processing (Tile2Net)

The project uses [Tile2Net](https://github.com/VIDA-NYU/tile2net) for semantic segmentation:

1. **Input**: NYC aerial imagery (2004-2024) from NYC Planimetrics
2. **Processing**: Deep learning model detects sidewalks, roads, crosswalks
3. **Output**: Shapefiles with polygon geometries

### Data Preparation Workflow
```
Raw Tile2Net Output
    ↓
[prepare_data.py]
    ├── Convert shapefiles → GeoJSON
    ├── Stitch 4×4 tile grids → Single PNG
    ├── Optimize images (4096px → 1024px)
    └── Generate metadata.json
    ↓
React-Ready Data Structure
```

---

## 🗺️ Current Coverage

- **East Harlem**: 11 years (2004-2024) ✅
- **Hudson Yards**: 10 years (2004-2024, missing 2022) ✅
- **Full Manhattan**: In progress (340 tiles)

---

## 🛠️ Technical Stack

### Frontend
- **React 18**: Component-based UI
- **Leaflet.js**: Interactive maps
- **D3.js**: Statistical visualizations
- **Vite**: Build tooling

### Data Processing
- **Python**: Data pipeline orchestration
- **GeoPandas**: Geospatial data manipulation
- **Pillow**: Image processing
- **Tile2Net**: ML inference pipeline

### Data Sources
- NYC Planimetrics (Aerial Imagery)
- NYC Open Data (Ground truth validation)
- OpenStreetMap (Contextual data)

---

## 📁 Data Structure
```
app/public/data/
├── metadata.json                 # Global configuration
└── tiles/
    ├── east_harlem_tile_0/
    │   ├── metadata.json        # Tile-specific bounds
    │   ├── imagery/
    │   │   ├── 2004.png         # Stitched satellite images
    │   │   └── ...
    │   └── networks/
    │       ├── 2004.geojson     # ML-detected features
    │       └── ...
    └── hudson_yards_tile_0/
        └── ...
```

---

## 🎓 Academic Context

This project fulfills the requirements for CS-GY 9223 by:

1. **Visualizing ML Outputs**: Interactive rendering of semantic segmentation results
2. **Temporal Analysis**: Year-over-year comparison of model predictions
3. **Geospatial Analytics**: Statistical analysis of infrastructure evolution
4. **Data Storytelling**: Intuitive UX for exploring complex spatiotemporal data

---

## 🔮 Future Enhancements

- [ ] Multi-tile selection (compare neighborhoods)
- [ ] Ground truth validation overlay
- [ ] Advanced analytics dashboard (D3 charts)
- [ ] Export functionality (GIF generation, data download)
- [ ] Mobile responsiveness

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Tile2Net team at NYU VIDA Lab
- NYC Open Data Initiative
- Professor Claudio Silva - CS-GY 9223