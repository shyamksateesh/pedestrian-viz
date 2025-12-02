"""
Data Preparation Script for NYC Sidewalk Timeline
Converts shapefiles to GeoJSON and stitches tiles into single images
ROBUSTLY HANDLES MISSING DATA
"""
import geopandas as gpd
from pathlib import Path
from PIL import Image
import shutil
import json
import numpy as np

# ============================================================
# CONFIGURATION
# ============================================================

# Your data location
BASE_DIR = Path("/Users/shyam/Desktop/NYU/Fall 2025/VizML/Project/sidewalk_data")

# Your React project location
REACT_PROJECT = Path("/Users/shyam/Desktop/NYU/Fall 2025/VizML/Project/nyc-sidewalk-timeline")

# Years you have
YEARS = [2024, 2022, 2020, 2018, 2016, 2014, 2012, 2010, 2008, 2006, 2004]

# CHANGE THIS TO SWITCH AREAS
AREA_NAME = "hudson_yards"  # or "east_harlem"

# ============================================================
# STEP 1: CREATE OUTPUT STRUCTURE
# ============================================================

print("="*60)
print("PREPARING DATA FOR WEB APP")
print("="*60 + "\n")

# Create directories
public_data = REACT_PROJECT / "public" / "data"
tiles_dir = public_data / "tiles" / f"{AREA_NAME}_tile_0"
imagery_dir = tiles_dir / "imagery"
networks_dir = tiles_dir / "networks"

for d in [public_data, tiles_dir, imagery_dir, networks_dir]:
    d.mkdir(parents=True, exist_ok=True)

print(f"✅ Created directory structure in: {REACT_PROJECT}/public/data\n")

# ============================================================
# STEP 2: PROCESS EACH YEAR (ROBUST ERROR HANDLING)
# ============================================================

bounds_list = []
successful_years = []
failed_years = []

for year in YEARS:
    print(f"📅 Processing {year}...")
    
    year_dir = BASE_DIR / str(year) / f"{AREA_NAME}_{year}"
    
    if not year_dir.exists():
        print(f"   ⚠️  Year folder not found, skipping")
        failed_years.append(year)
        continue
    
    year_success = {'geojson': False, 'imagery': False}
    
    # --- CONVERT SHAPEFILE TO GEOJSON ---
    try:
        poly_dir = year_dir / "polygons"
        
        if not poly_dir.exists():
            print(f"   ⚠️  No polygons folder found")
        else:
            shp_folders = [f for f in poly_dir.iterdir() if f.is_dir()]
            
            if shp_folders:
                shp_file = list(shp_folders[0].glob("*.shp"))[0]
                
                # Load shapefile
                gdf = gpd.read_file(shp_file)
                
                # Convert to WGS84 if needed
                if gdf.crs.to_epsg() != 4326:
                    gdf = gdf.to_crs(epsg=4326)
                
                # Save as GeoJSON
                output_geojson = networks_dir / f"{year}.geojson"
                gdf.to_file(output_geojson, driver='GeoJSON')
                
                print(f"   ✅ GeoJSON: {len(gdf)} features")
                
                # Store bounds for metadata
                bounds = gdf.total_bounds
                bounds_list.append(bounds)
                
                year_success['geojson'] = True
            else:
                print(f"   ⚠️  No shapefile folder found in polygons/")
    
    except Exception as e:
        print(f"   ❌ GeoJSON conversion failed: {e}")
    
    # --- STITCH TILES INTO SINGLE IMAGE ---
    try:
        stitched_dir = year_dir / "tiles" / "stitched"
        
        if not stitched_dir.exists():
            print(f"   ⚠️  No stitched tiles folder found")
        else:
            stitched_subfolders = [f for f in stitched_dir.iterdir() if f.is_dir()]

            if stitched_subfolders:
                tiles_folder = stitched_subfolders[0]
                tile_files = sorted(tiles_folder.glob("*.png"))
                
                if tile_files:
                    # Load first tile to get dimensions
                    first_tile = Image.open(tile_files[0])
                    tile_size = first_tile.size[0]
                    
                    # Detect grid size
                    num_tiles = len(tile_files)
                    grid_size = int(num_tiles ** 0.5)
                    
                    if grid_size * grid_size != num_tiles:
                        print(f"   ⚠️  Warning: {num_tiles} tiles doesn't form perfect square, using 4x4")
                        grid_size = 4
                    
                    # Create canvas
                    canvas = Image.new('RGB', (tile_size * grid_size, tile_size * grid_size), color=(0, 0, 0))
                    
                    # Place tiles with transposition
                    tiles_placed = 0
                    for tile_path in tile_files:
                        parts = tile_path.stem.split('_')
                        
                        if len(parts) >= 3:
                            tile_id = int(parts[2])
                            
                            # Source position
                            source_row = tile_id // grid_size
                            source_col = tile_id % grid_size
                            
                            # Transposition (swap row/col)
                            canvas_row = source_col
                            canvas_col = source_row
                            
                            # Bounds check
                            if canvas_row >= grid_size or canvas_col >= grid_size:
                                print(f"   ⚠️  Tile {tile_id} out of bounds, skipping")
                                continue
                            
                            # Load and paste
                            img = Image.open(tile_path)
                            canvas.paste(img, (canvas_col * tile_size, canvas_row * tile_size))
                            tiles_placed += 1
                    
                    # Save stitched image
                    output_img = imagery_dir / f"{year}.png"
                    canvas.save(output_img, 'PNG', optimize=True)
                    
                    print(f"   ✅ Imagery: {tiles_placed}/{num_tiles} tiles stitched ({grid_size}x{grid_size})")
                    year_success['imagery'] = True
                else:
                    print(f"   ⚠️  No PNG tiles found in {tiles_folder.name}")
            else:
                print(f"   ⚠️  No subfolders found in stitched/")
    
    except Exception as e:
        print(f"   ❌ Image stitching failed: {e}")
        import traceback
        traceback.print_exc()
    
    # Track year status
    if year_success['geojson'] or year_success['imagery']:
        successful_years.append(year)
    else:
        failed_years.append(year)
    
    print()

# ============================================================
# STEP 3: CREATE METADATA FILE
# ============================================================

print("="*60)
print("CREATING METADATA")
print("="*60 + "\n")

# Calculate overall bounds (from all years that have GeoJSON)
if bounds_list:
    all_bounds = np.array(bounds_list)
    
    overall_bounds = {
        "west": float(all_bounds[:, 0].min()),
        "south": float(all_bounds[:, 1].min()),
        "east": float(all_bounds[:, 2].max()),
        "north": float(all_bounds[:, 3].max())
    }
else:
    # Fallback: Use approximate bounds based on area name
    print("⚠️  No GeoJSON bounds found, using estimated bounds")
    if AREA_NAME == "east_harlem":
        overall_bounds = {
            "west": -73.979239,
            "south": 40.777385,
            "east": -73.970209,
            "north": 40.784245
        }
    elif AREA_NAME == "hudson_yards":
        overall_bounds = {
            "west": -74.003421,
            "south": 40.750033,
            "east": -73.997934,
            "north": 40.755121
        }
    else:
        # Generic NYC bounds
        overall_bounds = {
            "west": -74.01,
            "south": 40.70,
            "east": -73.97,
            "north": 40.76
        }

# Check which years actually have data
available_years = []
for year in YEARS:
    has_geojson = (networks_dir / f"{year}.geojson").exists()
    has_imagery = (imagery_dir / f"{year}.png").exists()
    if has_geojson or has_imagery:
        available_years.append(year)

metadata = {
    "area_name": AREA_NAME,
    "tile_id": f"{AREA_NAME}_tile_0",
    "bounds": overall_bounds,
    "years": sorted(available_years, reverse=True),  # Only years with data
    "layers": ["sidewalk", "road", "crosswalk"],
    "layer_colors": {
        "sidewalk": "#4A90E2",
        "road": "#FF6B6B",
        "crosswalk": "#4ECDC4"
    }
}

metadata_file = public_data / "metadata.json"
with open(metadata_file, 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"✅ Metadata saved\n")

# ============================================================
# SUMMARY
# ============================================================

print("="*60)
print("🎉 DATA PREPARATION COMPLETE!")
print("="*60 + "\n")

print(f"📁 Output location: {public_data}\n")

# Count files
geojson_files = list(networks_dir.glob("*.geojson"))
image_files = list(imagery_dir.glob("*.png"))

print("Summary:")
print(f"   • Area: {AREA_NAME}")
print(f"   • Available years: {len(available_years)} of {len(YEARS)}")
print(f"   • GeoJSON files: {len(geojson_files)}")
print(f"   • PNG images: {len(image_files)}")

if failed_years:
    print(f"\n⚠️  Failed/missing years: {', '.join(map(str, failed_years))}")

print(f"\n✅ Your React app can now load this data!")
print(f"   (Missing years will be handled gracefully)")