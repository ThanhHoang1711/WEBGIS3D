
import requests
import math


def query_terrain_height_batch(coordinates):
    """
    Query terrain height cho nhiều tọa độ cùng lúc
    
    Args:
        coordinates: List of (lon, lat) tuples
        
    Returns:
        List of heights tương ứng
    """
    heights = []
    
    for lon, lat in coordinates:
        height = query_single_terrain_height(lon, lat)
        heights.append(height)
    
    return heights


def query_single_terrain_height(lon, lat):
    """
    Query terrain height cho 1 điểm
    
    Thử nhiều phương pháp theo thứ tự:
    1. Query từ local terrain server (nếu có)
    2. Estimate từ region
    3. Return 0 (fallback)
    """
    
    # METHOD 1: Query từ terrain server local (nếu server hỗ trợ)
    try:
        response = requests.get(
            'http://localhost:8006/api/height',
            params={'lon': lon, 'lat': lat},
            timeout=1
        )
        if response.ok:
            data = response.json()
            return data.get('height', 0.0)
    except:
        pass
    
    # METHOD 2: Estimate từ region (Việt Nam)
    return estimate_height_vietnam(lon, lat)


def estimate_height_vietnam(lon, lat):
    """
    Estimate terrain height cho vùng Việt Nam
    
    Dựa trên region đơn giản:
    - Miền núi phía Bắc: 50-200m
    - Miền núi Trung Bộ: 100-300m  
    - Tây Nguyên: 500-1500m
    - Đồng bằng: 0-20m
    """
    
    # Tây Nguyên
    if 107.0 <= lon <= 109.0 and 11.0 <= lat <= 15.0:
        return 800.0
    
    # Miền núi phía Bắc (Hà Giang, Lào Cai, etc)
    if 104.0 <= lon <= 106.0 and 21.5 <= lat <= 23.5:
        return 150.0
    
    # Miền núi Trung Bộ (Quảng Bình, Quảng Trị, etc)
    if 106.0 <= lon <= 108.0 and 15.5 <= lat <= 18.0:
        return 200.0
    
    # Đồng bằng (default)
    return 0.0


def get_terrain_samples_for_bbox(min_lon, max_lon, min_lat, max_lat, sample_count=20):
    """
    Lấy sample terrain heights trong bbox để tính min/max cho tileset
    
    Args:
        min_lon, max_lon, min_lat, max_lat: Bbox coordinates
        sample_count: Số điểm sample
        
    Returns:
        (min_height, max_height) tuple
    """
    import random
    
    sample_heights = []
    
    for _ in range(sample_count):
        lon = random.uniform(min_lon, max_lon)
        lat = random.uniform(min_lat, max_lat)
        height = query_single_terrain_height(lon, lat)
        sample_heights.append(height)
    
    if sample_heights:
        return min(sample_heights), max(sample_heights)
    else:
        return 0.0, 100.0  # Fallback
