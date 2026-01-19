# test_north_vector.py
import math

def compute_vectors_debug(lon, lat):
    """Debug function để xem vectors"""
    lon_rad = math.radians(lon)
    lat_rad = math.radians(lat)
    
    cos_lat = math.cos(lat_rad)
    sin_lat = math.sin(lat_rad)
    cos_lon = math.cos(lon_rad)
    sin_lon = math.sin(lon_rad)
    
    # UP vector
    up = (cos_lat * cos_lon, cos_lat * sin_lon, sin_lat)
    
    # NORTH vector
    north = (-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat)
    
    # EAST vector
    east = (-sin_lon, cos_lon, 0.0)
    
    def normalize(v):
        length = math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
        return (v[0]/length, v[1]/length, v[2]/length)
    
    up = normalize(up)
    north = normalize(north)
    east = normalize(east)
    
    print(f"\n📍 Position: {lon}°, {lat}°")
    print(f"  UP: [{up[0]:.4f}, {up[1]:.4f}, {up[2]:.4f}]")
    print(f"  NORTH: [{north[0]:.4f}, {north[1]:.4f}, {north[2]:.4f}]")
    print(f"  EAST: [{east[0]:.4f}, {east[1]:.4f}, {east[2]:.4f}]")
    
    # Kiểm tra
    print(f"\n  Checks:")
    print(f"  UP·NORTH = {up[0]*north[0] + up[1]*north[1] + up[2]*north[2]:.6f} (should be ~0)")
    print(f"  UP·EAST = {up[0]*east[0] + up[1]*east[1] + up[2]*east[2]:.6f} (should be ~0)")
    print(f"  EAST·NORTH = {east[0]*north[0] + east[1]*north[1] + east[2]*north[2]:.6f} (should be ~0)")

# Test với tọa độ của bạn
compute_vectors_debug(105.305055, 21.033499)