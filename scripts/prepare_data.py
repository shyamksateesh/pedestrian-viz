"""
Multi-Region Data Preparation Script for NYC Sidewalk Timeline
Reads from regions.json config and processes multiple regions
"""
import geopandas as gpd
from pathlib import Path
from PIL import Image
import json
import numpy as np
import argparse

# ============================================================
# CONFIGURATION
# ============================================================

# Paths
BASE_DIR = Path("/Users/shyam/Desktop/NYU/Fall 2025/VizML/Project")
CONFIG_PATH = BASE_DIR / "pedestrian-viz/scripts/config/regions.json"
REACT_PROJECT = BASE_DIR / "pedestrian-viz/app"

# ============================================================
# LOAD CONFIG
# ============================================================

def load_config():
    """Load regions from config file"""
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

# ============================================================
# PROCESS SINGLE REGION
# ============================================================

def process_region(region_config, years_to_process=None):
    """Process a single region"""
    
    region_id = region_config['id']
    area_name = region_config['area_name']
    data_path = BASE_DIR / region_config['data_path']
    
    print(f"\n{'='*60}")
    print(f"📍 PROCESSING: {region_config['name']}")
    print(f"{'='*60}\n")
    
    # Use specified years or all available years
    years = years_to_process or region_config['years']
    
    # Create output structure
    public_data = REACT_PROJECT / "public/data"
    tiles_dir = public_data / "tiles" / region_id
    imagery_dir = tiles_dir / "imagery"
    networks_dir = tiles_dir / "networks"
    
    for d in [public_data, tiles_dir, imagery_dir, networks_dir]:
        d.mkdir(parents=True, exist_ok=True)
    
    print(f"✅ Created directory structure\n")
    
    # Process each year
    bounds_list = []
    successful_years = []
    
    for year in years:
        print(f"📅 Processing {year}...")
        
        year_dir = data_path / str(year) / f"{area_name}_{year}"
        
        if not year_dir.exists():
            print(f"   ⚠️  Year folder not found, skipping")
            continue
        
        year_success = {'geojson': False, 'imagery': False}
        
        # --- CONVERT SHAPEFILE TO GEOJSON ---
        try:
            poly_dir = year_dir / "polygons"
            
            if poly_dir.exists():
                shp_folders = [f for f in poly_dir.iterdir() if f.is_dir()]
                
                if shp_folders:
                    shp_file = list(shp_folders[0].glob("*.shp"))[0]
                    gdf = gpd.read_file(shp_file)
                    
                    if gdf.crs.to_epsg() != 4326:
                        gdf = gdf.to_crs(epsg=4326)
                    
                    output_geojson = networks_dir / f"{year}.geojson"
                    gdf.to_file(output_geojson, driver='GeoJSON')
                    
                    print(f"   ✅ GeoJSON: {len(gdf)} features")
                    bounds_list.append(gdf.total_bounds)
                    year_success['geojson'] = True
        
        except Exception as e:
            print(f"   ❌ GeoJSON failed: {e}")
        
        # --- STITCH TILES INTO SINGLE IMAGE ---
        try:
            stitched_dir = year_dir / "tiles" / "stitched"
            
            if stitched_dir.exists():
                stitched_subfolders = [f for f in stitched_dir.iterdir() if f.is_dir()]
                
                if stitched_subfolders:
                    tiles_folder = stitched_subfolders[0]
                    tile_files = sorted(tiles_folder.glob("*.png"))
                    
                    if tile_files:
                        first_tile = Image.open(tile_files[0])
                        tile_size = first_tile.size[0]
                        
                        num_tiles = len(tile_files)
                        grid_size = int(num_tiles ** 0.5)
                        
                        if grid_size * grid_size != num_tiles:
                            grid_size = 4
                        
                        canvas = Image.new('RGB', (tile_size * grid_size, tile_size * grid_size), color=(0, 0, 0))
                        
                        tiles_placed = 0
                        for tile_path in tile_files:
                            parts = tile_path.stem.split('_')
                            
                            if len(parts) >= 3:
                                tile_id = int(parts[2])
                                source_row = tile_id // grid_size
                                source_col = tile_id % grid_size
                                canvas_row = source_col
                                canvas_col = source_row
                                
                                if canvas_row < grid_size and canvas_col < grid_size:
                                    img = Image.open(tile_path)
                                    canvas.paste(img, (canvas_col * tile_size, canvas_row * tile_size))
                                    tiles_placed += 1
                        
                        output_img = imagery_dir / f"{year}.png"
                        canvas.save(output_img, 'PNG', optimize=True)
                        
                        print(f"   ✅ Imagery: {tiles_placed}/{num_tiles} tiles")
                        year_success['imagery'] = True
        
        except Exception as e:
            print(f"   ❌ Imagery failed: {e}")
        
        if year_success['geojson'] or year_success['imagery']:
            successful_years.append(year)
    
    # Create tile metadata
    if bounds_list:
        all_bounds = np.array(bounds_list)
        tile_bounds = {
            "west": float(all_bounds[:, 0].min()),
            "south": float(all_bounds[:, 1].min()),
            "east": float(all_bounds[:, 2].max()),
            "north": float(all_bounds[:, 3].max())
        }
    else:
        tile_bounds = region_config['bounds']
    
    tile_metadata = {
        "tile_id": region_id,
        "name": region_config['name'],
        "bounds": tile_bounds,
        "years": sorted(successful_years, reverse=True)
    }
    
    with open(tiles_dir / "metadata.json", 'w') as f:
        json.dump(tile_metadata, f, indent=2)
    
    print(f"\n✅ {region_config['name']}: {len(successful_years)} years processed\n")
    
    return {
        'region_id': region_id,
        'name': region_config['name'],
        'years_processed': len(successful_years),
        'successful': len(successful_years) > 0
    }

# ============================================================
# GENERATE TILES INDEX
# ============================================================

def generate_tiles_index(config):
    """Generate tiles_index.json for frontend"""
    
    public_data = REACT_PROJECT / "public/data"
    tiles_base_dir = public_data / "tiles"
    
    tiles_index = []
    
    for tile_dir in tiles_base_dir.iterdir():
        if tile_dir.is_dir():
            meta_path = tile_dir / "metadata.json"
            if meta_path.exists():
                with open(meta_path, 'r') as f:
                    tile_meta = json.load(f)
                    tiles_index.append({
                        "tile_id": tile_meta['tile_id'],
                        "name": tile_meta.get('name', tile_meta['tile_id']),
                        "bounds": tile_meta['bounds']
                    })
    
    tiles_index_file = public_data / "tiles_index.json"
    with open(tiles_index_file, 'w') as f:
        json.dump(tiles_index, f, indent=2)
    
    print(f"✅ Generated tiles_index.json with {len(tiles_index)} regions\n")

# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Process NYC sidewalk data for multiple regions')
    parser.add_argument('--region', help='Process specific region (e.g., east_harlem)')
    parser.add_argument('--all', action='store_true', help='Process all regions in config')
    args = parser.parse_args()
    
    print("="*60)
    print("🗺️  NYC SIDEWALK DATA PREPARATION")
    print("="*60 + "\n")
    
    config = load_config()
    
    if args.region:
        # Process single region
        region_config = next((r for r in config['regions'] if r['area_name'] == args.region), None)
        if not region_config:
            print(f"❌ Region '{args.region}' not found in config")
            return
        
        results = [process_region(region_config)]
    
    elif args.all:
        # Process all regions
        results = []
        for region_config in config['regions']:
            result = process_region(region_config)
            results.append(result)
    
    else:
        print("Usage:")
        print("  python prepare_data.py --region east_harlem")
        print("  python prepare_data.py --all")
        return
    
    # Generate tiles index
    generate_tiles_index(config)
    
    # Summary
    print("="*60)
    print("📊 PROCESSING COMPLETE")
    print("="*60 + "\n")
    
    for result in results:
        status = "✅" if result['successful'] else "❌"
        print(f"{status} {result['name']}: {result['years_processed']} years")
    
    print(f"\n📁 Output: {REACT_PROJECT}/public/data/tiles/")

if __name__ == "__main__":
    main()