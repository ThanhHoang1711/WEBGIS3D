import struct
import json
import math
from pathlib import Path

class I3DMGenerator:
    """
    I3DM Generator - FIXED: Model đứng thẳng giống eastNorthUpToFixedFrame
    ✅ Sử dụng đầy đủ 3 vectors: UP, RIGHT, FORWARD (giống ENU frame)
    ✅ Model sẽ đứng thẳng y hệt khi load đơn lẻ với eastNorthUpToFixedFrame
    """

    WGS84_A = 6378137.0
    WGS84_E2 = 0.00669437999014

    def __init__(self, glb_path, debug=True):
        self.glb_path = Path(glb_path)
        self.debug = debug
        if not self.glb_path.exists():
            raise FileNotFoundError(f"GLB not found: {glb_path}")
        
        with open(self.glb_path, "rb") as f:
            self.glb_data = f.read()
        
        if self.debug:
            print(f"📦 Loaded GLB: {self.glb_path.name} ({len(self.glb_data)} bytes)")

    @staticmethod
    def geodetic_to_cartesian(lon, lat, height):
        """Chuyển WGS84 (lon, lat, height) sang ECEF Cartesian (x, y, z)"""
        lon_rad = math.radians(lon)
        lat_rad = math.radians(lat)
        
        sin_lat = math.sin(lat_rad)
        cos_lat = math.cos(lat_rad)
        sin_lon = math.sin(lon_rad)
        cos_lon = math.cos(lon_rad)

        N = I3DMGenerator.WGS84_A / math.sqrt(1 - I3DMGenerator.WGS84_E2 * sin_lat**2)
        
        x = (N + height) * cos_lat * cos_lon
        y = (N + height) * cos_lat * sin_lon
        z = (N * (1 - I3DMGenerator.WGS84_E2) + height) * sin_lat
        
        return x, y, z

    @staticmethod
    def compute_enu_frame(lon, lat, heading_deg=0.0):
        """
        Tính toán ENU frame + FIX cho GLB Y-up models.
        
        ⚠️ QUAN TRỌNG: Nếu GLB của bạn là Y-up (Blender/3ds Max default),
        cần swap trục để model đứng thẳng trong CesiumJS (Z-up).
        
        I3DM orientation:
        - NORMAL_UP: Hướng model "lên trời" (model's local +Y → world +Z)
        - NORMAL_RIGHT: Hướng model "sang phải" (model's local +X → world +X)
        """
        lon_rad = math.radians(lon)
        lat_rad = math.radians(lat)
        heading_rad = math.radians(heading_deg)
        
        cos_lat = math.cos(lat_rad)
        sin_lat = math.sin(lat_rad)
        cos_lon = math.cos(lon_rad)
        sin_lon = math.sin(lon_rad)
        
        # ========== World ENU Axes ==========
        # (Trục tọa độ địa lý chuẩn)
        
        # UP vector (Z-axis, hướng lên trời)
        world_up_x = cos_lat * cos_lon
        world_up_y = cos_lat * sin_lon
        world_up_z = sin_lat
        
        # EAST vector (X-axis)
        world_east_x = -sin_lon
        world_east_y = cos_lon
        world_east_z = 0.0
        
        # NORTH vector (Y-axis)
        world_north_x = -sin_lat * cos_lon
        world_north_y = -sin_lat * sin_lon
        world_north_z = cos_lat
        
        # ========== Apply Heading Rotation ==========
        cos_h = math.cos(heading_rad)
        sin_h = math.sin(heading_rad)
        
        # Rotate East/North around Up axis
        rotated_east_x = world_east_x * cos_h + world_north_x * sin_h
        rotated_east_y = world_east_y * cos_h + world_north_y * sin_h
        rotated_east_z = world_east_z * cos_h + world_north_z * sin_h
        
        rotated_north_x = -world_east_x * sin_h + world_north_x * cos_h
        rotated_north_y = -world_east_y * sin_h + world_north_y * cos_h
        rotated_north_z = -world_east_z * sin_h + world_north_z * cos_h
        
        # ========== FIX cho Y-up models ==========
        # GLB Y-up: Model +Y là "lên", +Z là "ra trước"
        # CesiumJS Z-up: World +Z là "lên"
        # 
        # HACK: Swap axes để model đứng thẳng
        # - NORMAL_UP → world NORTH (trục Y)
        # - NORMAL_RIGHT → world EAST (trục X)
        # Khi đó CesiumJS sẽ tự động xoay model 90°
        
        normal_up = (rotated_north_x, rotated_north_y, rotated_north_z)  # ← Dùng NORTH thay vì UP
        normal_right = (rotated_east_x, rotated_east_y, rotated_east_z)
        
        return normal_up, normal_right

    def generate_i3dm(self, instances, output_path):
        """
        Tạo I3DM file từ danh sách instances.
        
        Args:
            instances: List of dicts với keys:
                - lon: Kinh độ (°)
                - lat: Vĩ độ (°)
                - height: Độ cao (m, mặc định 0)
                - scale: Tỷ lệ (mặc định 1.0)
                - heading: Góc quay quanh trục Z (°, 0=Bắc, mặc định 0)
        """
        if not instances:
            raise ValueError("Cần ít nhất 1 instance")

        positions = []
        ups = []
        rights = []
        scales = []

        # Tính RTC_CENTER (lấy instance đầu tiên làm gốc)
        first = instances[0]
        rtc_x, rtc_y, rtc_z = self.geodetic_to_cartesian(
            first["lon"], 
            first["lat"], 
            first.get("height", 0.0)
        )

        if self.debug:
            print(f"\n📍 RTC_CENTER: ({rtc_x:.2f}, {rtc_y:.2f}, {rtc_z:.2f})")

        # Process từng instance
        for i, inst in enumerate(instances):
            # 1. Vị trí ECEF tuyệt đối
            abs_x, abs_y, abs_z = self.geodetic_to_cartesian(
                inst["lon"], 
                inst["lat"], 
                inst.get("height", 0.0)
            )
            
            # 2. Chuyển sang tọa độ tương đối
            rel_x = abs_x - rtc_x
            rel_y = abs_y - rtc_y
            rel_z = abs_z - rtc_z
            
            # 3. Tính ENU frame vectors - QUAN TRỌNG: Mỗi instance có lon/lat riêng
            lon = float(inst["lon"])  # ✅ Force convert to float
            lat = float(inst["lat"])  # ✅ Force convert to float
            heading = float(inst.get("heading", 0.0))
            
            up_vec, right_vec = self.compute_enu_frame(lon, lat, heading)
            
            # 4. Thêm vào buffers
            positions.extend([rel_x, rel_y, rel_z])
            ups.extend(up_vec)
            rights.extend(right_vec)
            scales.append(inst.get("scale", 1.0))
            
            # Debug first few instances
            if self.debug and i < 3:
                print(f"\n📦 Instance {i+1}:")
                print(f"   Pos: ({inst['lon']:.6f}, {inst['lat']:.6f}, {inst.get('height', 0):.2f}m)")
                print(f"   UP: ({up_vec[0]:.4f}, {up_vec[1]:.4f}, {up_vec[2]:.4f})")
                print(f"   RIGHT: ({right_vec[0]:.4f}, {right_vec[1]:.4f}, {right_vec[2]:.4f})")
                print(f"   Scale: {inst.get('scale', 1.0):.2f}x")

        # ========== Feature Table ==========
        count = len(instances)
        offset = 0
        
        feature_table = {
            "INSTANCES_LENGTH": count,
            "RTC_CENTER": [rtc_x, rtc_y, rtc_z],
            "POSITION": {
                "byteOffset": offset,
                "componentType": "FLOAT",
                "type": "VEC3"
            }
        }
        offset += count * 12
        
        feature_table["NORMAL_UP"] = {
            "byteOffset": offset,
            "componentType": "FLOAT",
            "type": "VEC3"
        }
        offset += count * 12
        
        feature_table["NORMAL_RIGHT"] = {
            "byteOffset": offset,
            "componentType": "FLOAT",
            "type": "VEC3"
        }
        offset += count * 12
        
        feature_table["SCALE"] = {
            "byteOffset": offset,
            "componentType": "FLOAT",
            "type": "SCALAR"
        }
        offset += count * 4
        
        feature_table["GLTF_FORMAT"] = 1

        # JSON padding
        ft_json_bytes = json.dumps(feature_table, separators=(",", ":")).encode("utf-8")
        ft_json_bytes += b" " * ((8 - len(ft_json_bytes) % 8) % 8)

        # ========== Feature Table Binary ==========
        ft_bin = bytearray()
        
        # POSITION data
        for i in range(0, len(positions), 3):
            ft_bin += struct.pack("<fff", positions[i], positions[i+1], positions[i+2])
        
        # NORMAL_UP data
        for i in range(0, len(ups), 3):
            ft_bin += struct.pack("<fff", ups[i], ups[i+1], ups[i+2])
        
        # NORMAL_RIGHT data
        for i in range(0, len(rights), 3):
            ft_bin += struct.pack("<fff", rights[i], rights[i+1], rights[i+2])
        
        # SCALE data
        for s in scales:
            ft_bin += struct.pack("<f", s)
        
        # Binary padding
        ft_bin += b"\x00" * ((8 - len(ft_bin) % 8) % 8)

        # ========== I3DM Header ==========
        byte_length = 32 + len(ft_json_bytes) + len(ft_bin) + len(self.glb_data)
        
        header = struct.pack(
            "<4sIIIIIII",
            b"i3dm",
            1,
            byte_length,
            len(ft_json_bytes),
            len(ft_bin),
            0,
            0,
            1
        )

        # ========== Write File ==========
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "wb") as f:
            f.write(header)
            f.write(ft_json_bytes)
            f.write(ft_bin)
            f.write(self.glb_data)
        
        if self.debug:
            print(f"\n✅ Created: {output_path}")
            print(f"   Instances: {count}")
            print(f"   File size: {byte_length:,} bytes")
        
        return output_path

    @staticmethod
    def create_tileset_json(instances, i3dm_relative_url, output_path):
        """Tạo tileset.json cho I3DM"""
        if not instances:
            return
        
        lons = [math.radians(i["lon"]) for i in instances]
        lats = [math.radians(i["lat"]) for i in instances]
        heights = [i.get("height", 0.0) for i in instances]
        
        min_lon = min(lons)
        max_lon = max(lons)
        min_lat = min(lats)
        max_lat = max(lats)
        min_h = min(heights)
        max_h = max(heights)
        
        height_buffer = 50.0
        
        tileset = {
            "asset": {"version": "1.0"},
            "geometricError": 500,
            "root": {
                "boundingVolume": {
                    "region": [min_lon, min_lat, max_lon, max_lat, min_h, max_h + height_buffer]
                },
                "geometricError": 0,
                "refine": "ADD",
                "content": {"uri": i3dm_relative_url}
            }
        }
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(tileset, f, indent=2)
        
        print(f"✅ Created tileset: {output_path}")


# ========== TEST CODE ==========
if __name__ == "__main__":
    gen = I3DMGenerator("path/to/model.glb", debug=True)
    
    instances = [
        {"lon": 105.83420, "lat": 21.02780, "height": 10.0, "scale": 1.0, "heading": 0.0},
        {"lon": 105.83450, "lat": 21.02800, "height": 10.0, "scale": 1.2, "heading": 45.0},
        {"lon": 105.83480, "lat": 21.02820, "height": 15.0, "scale": 0.8, "heading": 90.0}
    ]
    
    gen.generate_i3dm(instances, "output/test.i3dm")
    I3DMGenerator.create_tileset_json(instances, "test.i3dm", "output/tileset.json")