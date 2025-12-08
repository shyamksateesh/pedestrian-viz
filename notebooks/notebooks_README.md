# 📊 Data Processing Pipeline - Colab Notebooks

This folder contains three Google Colab notebooks that process NYC satellite imagery into React-ready datasets using deep learning and GIS tools.

---

## 🎯 Quick Start

1. **Open in Colab**: Click notebook links below
2. **Enable GPU**: Runtime → Change runtime type → GPU (for Notebook 01 only)
3. **Run in Order**: 00 → 01 → 02
4. **Download Output**: Get `data/` folder from Google Drive
5. **Deploy to App**: Move to `../app/public/data/`

**Total Time**: ~5 hours | **Storage**: ~2 GB output

---

## 📓 Notebook Details

### [00_setup_and_config.ipynb](https://colab.research.google.com/github/shyamksateesh/pedestrian_viz/blob/main/notebooks/00_setup_and_config.ipynb)

**Purpose**: Install dependencies and configure environment

**Runtime**: ~2 minutes  
**GPU Required**: ❌ No

**What it does**:
- Installs `tile2net`, `geopandas`, `rasterio`, `shapely`
- Mounts Google Drive for data persistence
- Creates directory structure for processing

**Output**: Ready environment

---

### [01_tile2net_extract.ipynb](https://colab.research.google.com/github/shyamksateesh/pedestrian_viz/blob/main/notebooks/01_tile2net_extract.ipynb)

**Purpose**: Extract pedestrian networks from satellite imagery using computer vision

**Runtime**: ~4 hours with GPU  
**GPU Required**: ✅ YES (18x speedup)

**What it does**:
1. Downloads NYC orthoimagery from NYC Open Data (2004-2024)
2. Creates 512×512px tiles from imagery
3. Runs tile2net deep learning model (GPU-accelerated)
4. Detects sidewalks, roads, and crosswalks
5. Converts segmentation masks to vector geometries

**Data Source**: [NYC Open Data - Digital Orthoimagery](https://data.cityofnewyork.us/)

**Output**: `networks_YYYY.gpkg` files (GeoPackage format)

**Processing Stats**:
- 11 years of imagery (2004-2024)
- ~500 MB per year input
- ~50,000 network segments extracted

---

### [02_prepare_for_web.ipynb](https://colab.research.google.com/github/shyamksateesh/pedestrian_viz/blob/main/notebooks/02_prepare_for_web.ipynb)

**Purpose**: Convert GeoPackage data to React-compatible format

**Runtime**: ~1 hour  
**GPU Required**: ❌ No

**What it does**:
1. Transforms coordinates to WGS84 (EPSG:4326) for Leaflet
2. Generates `tiles_index.json` with metadata
3. Exports per-tile GeoJSON files organized by year
4. Creates 512×512px PNG images from tiles
5. Structures output for direct use in React app

**Output Structure**:
```
data/
└── tiles/
    ├── tiles_index.json
    ├── imagery/
    │   └── metadata.json
    ├── manhattan_tile_0/
    │   ├── imagery/
    │   │   ├── 2004.png
    │   │   ├── 2006.png
    │   │   └── ...
    │   └── networks/
    │       ├── 2004.geojson
    │       ├── 2006.geojson
    │       └── ...
    ├── manhattan_tile_1/
    │   ├── imagery/
    │   └── networks/
    └── ...
```

**Output Size**: ~2 GB (web-ready data)

---

## 🔧 Why Google Colab?

1. **Free GPU Access**: tile2net processing 18x faster (20 min vs 6 hours per year)
2. **Pre-installed GIS Tools**: GDAL, rasterio work without complex setup
3. **Large Storage**: Handle 50+ GB satellite imagery via Google Drive
4. **Reproducibility**: Notebooks document exact processing steps

---

## 📥 Using the Output

After running all notebooks:

1. **Find Output**: Check Google Drive `/content/data/tiles/`
2. **Download**: Right-click `tiles/` folder → Download
3. **Extract**: Unzip if needed
4. **Deploy**: Move entire `tiles/` folder to `app/public/data/`

Your React app will now have:
- ✅ Tile metadata (`app/public/data/tiles/tiles_index.json`)
- ✅ Imagery metadata (`app/public/data/tiles/imagery/metadata.json`)
- ✅ Per-tile data organized as `app/public/data/tiles/manhattan_tile_N/`
- ✅ Each tile has `imagery/` folder (PNGs by year) and `networks/` folder (GeoJSON by year)

---

## 🐛 Troubleshooting

### "Runtime disconnected" / "Out of memory"

**Solution**: 
```python
# In Notebook 01, reduce batch size
BATCH_SIZE = 8  # Change from 16 to 8
```

### "GPU not available"

**Solution**:
1. Runtime → Change runtime type
2. Hardware accelerator → GPU
3. Save
4. Restart runtime

### "Module not found" errors

**Solution**: Re-run Notebook 00 to reinstall dependencies

### "Permission denied" (Google Drive)

**Solution**: Re-mount Drive and grant permissions
```python
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
```

---

## 🔄 Processing Pipeline Diagram

```
┌─────────────────┐
│   Notebook 00   │  Install dependencies
│  Setup & Config │  Mount Google Drive
└────────┬────────┘
         ↓
┌─────────────────┐
│   Notebook 01   │  Download NYC imagery
│ tile2net Extract│  Run deep learning model
│                 │  Extract network vectors
└────────┬────────┘
         ↓
┌─────────────────┐
│   Notebook 02   │  Transform coordinates
│ Prepare for Web │  Generate metadata
│                 │  Export GeoJSON + images
└────────┬────────┘
         ↓
    📁 data/
    (Ready for React)
```

---

## 📊 Data Specifications

**Input**:
- Source: NYC Open Data
- Format: GeoTIFF (0.5ft resolution)
- Coverage: Manhattan
- Size: ~500 MB per year × 11 years = ~5.5 GB

**Output**:
- Format: GeoJSON (networks) + PNG (imagery)
- Coordinate System: WGS84 (EPSG:4326)
- Tile Size: 512×512 pixels
- Total Size: ~2 GB

**Accuracy**:
- Sidewalks: 85-90% detection
- Roads: 90-95% detection
- Crosswalks: 75-80% detection

---

## 📚 Additional Resources

- [tile2net Documentation](https://github.com/VIDA-NYU/tile2net)
- [NYC Open Data Portal](https://opendata.cityofnewyork.us/)
- [GeoPandas User Guide](https://geopandas.org/)
- [Google Colab FAQ](https://research.google.com/colaboratory/faq.html)

---

## 📝 Notes

- Notebooks are self-contained with detailed comments
- Progress bars show processing status
- Intermediate results saved to prevent data loss
- All outputs saved to Google Drive for persistence

---

<div align="center">

**Questions?** [Open an issue](../../issues) or [start a discussion](../../discussions)

[← Back to main README](../README.md)

</div>