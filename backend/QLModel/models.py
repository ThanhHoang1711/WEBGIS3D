from django.db import models
from django.contrib.postgres.fields import ArrayField

#Bảng Loại mô hình
class LoaiMoHinh(models.Model):
    ten_loai_mo_hinh = models.CharField(
        max_length=100,
        default="",
        verbose_name="Tên loại mô hình",
        help_text="Ví dụ: Cây cổ thụ, Nhà cao tầng, Xe tải, Tàu thuyền..."
    )

    url_glb = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="URL GLB"
    )
    
    url_b3dm = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="URL B3DM"
    )
    
    parent = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="ID cha"
    )
    
    loai_cap_nhat = models.CharField(
        max_length=50,
        verbose_name="Loại cập nhật"
    )
    
    class Meta:
        db_table = "tb_loai_mo_hinh"
        verbose_name = "Loại mô hình"
        verbose_name_plural = "Loại mô hình"
    
    def __str__(self):
        return f"Loại mô hình {self.id} - {self.loai_cap_nhat}"

# Bảng vị trí của một mô hình
class ViTri(models.Model):
    lat = models.FloatField(
        verbose_name="Vĩ độ"
    )
    
    lon = models.FloatField(
        verbose_name="Kinh độ"
    )
    
    height = models.FloatField(
        verbose_name="Độ cao",
        default=0.0
    )
    
    heading = models.FloatField(
        verbose_name="Góc heading",
        default=0.0
    )
    
    pitch = models.FloatField(
        verbose_name="Góc pitch",
        default=0.0
    )
    
    roll = models.FloatField(
        verbose_name="Góc roll",
        default=0.0
    )
    
    # Trường box để lưu bounding box, có thể dùng ArrayField hoặc JSONField
    box = models.JSONField(
        blank=True,
        null=True,
        verbose_name="Bounding box"
    )
    
    scale = models.FloatField(
        verbose_name="Tỷ lệ scale",
        default=1.0
    )
    
    class Meta:
        db_table = "tb_vi_tri"
        verbose_name = "Vị trí"
        verbose_name_plural = "Vị trí"
    
    def __str__(self):
        return f"Vị trí ({self.lat}, {self.lon}, {self.height})"

# Bảng cảnh
class Canh(models.Model):
    ma_canh = models.IntegerField(
        verbose_name="Mã cảnh",
        unique=True,
        help_text="Mã số cảnh 3D"
    )
    
    ten_canh = models.CharField(
        max_length=100,
        verbose_name="Tên cảnh"
    )
    
    mo_ta = models.TextField(
        verbose_name="Mô tả",
        blank=True,
        null=True
    )
    
    # Thông tin camera khi khởi tạo cảnh
    lat = models.FloatField(
        verbose_name="Vĩ độ camera",
        help_text="Vị trí latitude của camera"
    )
    
    lon = models.FloatField(
        verbose_name="Kinh độ camera",
        help_text="Vị trí longitude của camera"
    )
    
    height = models.FloatField(
        verbose_name="Độ cao camera",
        default=1000.0
    )
    
    heading = models.FloatField(
        verbose_name="Góc heading (độ)",
        default=0.0
    )
    
    pitch = models.FloatField(
        verbose_name="Góc pitch (độ)",
        default=-30.0
    )
    
    roll = models.FloatField(
        verbose_name="Góc roll (độ)",
        default=0.0
    )
    
    # URL cho terrain (tileset) của cảnh này
    url_terrain = models.CharField(
        max_length=500,
        verbose_name="URL Terrain/Tileset",
        blank=True,
        null=True
    )
    
    class Meta:
        db_table = "tb_canh"
        verbose_name = "Cảnh 3D"
        verbose_name_plural = "Các cảnh 3D"
        ordering = ['ma_canh']
    
    def __str__(self):
        return f"Cảnh {self.ma_canh}: {self.ten_canh}"

# Bảng mô hình
class MoHinh(models.Model):
    ma_canh = models.ForeignKey(
        'Canh',
        on_delete=models.CASCADE,
        to_field='ma_canh', 
        related_name='mo_hinhs',
        verbose_name="Cảnh",
        db_column='ma_canh_id'
    )

    ma_loai_mo_hinh = models.ForeignKey(
        'LoaiMoHinh',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mo_hinhs',
        verbose_name="Loại mô hình"
    )

    ma_vi_tri = models.ForeignKey(
        'ViTri',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mo_hinhs',
        verbose_name="Vị trí"
    )

    loai_doi_tuong = models.SmallIntegerField(
        default=1,
        verbose_name="Loại đối tượng",
        help_text="Ví dụ: 1: DOI TUONG CHUYEN DONG, 2: CAY, 3: CONG TRINH"
    )

    hinh_anh = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="Đường dẫn hình ảnh",
        help_text="VD: images/nha_01"
    )

    trang_thai = models.SmallIntegerField(
        default=1,
        verbose_name="Trạng thái",
        help_text="1: Hoạt động, 0: Không hoạt động"
    )

    thoi_gian_tao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Thời gian tạo"
    )

    thoi_gian_cap_nhat = models.DateTimeField(
        auto_now=True,
        verbose_name="Thời gian cập nhật"
    )

    class Meta:
        db_table = "tb_mo_hinh"
        verbose_name = "Mô hình"
        verbose_name_plural = "Mô hình"

    def __str__(self):
        return f"Mô hình {self.id} - {self.loai_doi_tuong}"

class Cay(models.Model):
    ten_loai = models.CharField(
        max_length=100,
        verbose_name="Tên loài cây"
    )

    height = models.FloatField(
        null=True,
        blank=True,
        verbose_name="Chiều cao (m)"
    )

    duong_kinh = models.FloatField(
        null=True,
        blank=True,
        verbose_name="Đường kính thân (cm)"
    )

    tuoi = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Tuổi cây (năm)"
    )

    thuoc_tinh_khac = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Thuộc tính khác (JSON)",
        help_text="Thuộc tính mở rộng, động theo từng loại cây"
    )

    class Meta:
        db_table = "tb_cay"
        verbose_name = "Cây"
        verbose_name_plural = "Cây"

    def __str__(self):
        return f"{self.ten_loai} (ID: {self.id})"

class DTChuyenDong(models.Model):
    loai_DT = models.CharField(
        max_length=50,
        default="UNKNOWN",
        verbose_name="Loại đối tượng",
        help_text="VD: TAU, XE, MAY_BAY, UAV"
    )

    ten_doi_tuong = models.CharField(
        max_length=100,
        verbose_name="Tên đối tượng"
    )

    duong_chuyen_dong = models.TextField(
        verbose_name="Đường chuyển động",
        help_text="Lưu polyline / GeoJSON / danh sách tọa độ"
    )

    van_toc = models.FloatField(
        null=True,
        blank=True,
        verbose_name="Vận tốc"
    )

    thuoc_tinh_khac = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Thuộc tính khác (JSON)"
    )

    class Meta:
        db_table = "tb_DT_chuyen_dong"
        verbose_name = "Đối tượng chuyển động"
        verbose_name_plural = "Đối tượng chuyển động"

    def __str__(self):
        return f"{self.ten_doi_tuong} ({self.loai_DT})"
    
class CongTrinh(models.Model):
    ten_cong_trinh = models.CharField(
        max_length=150,
        verbose_name="Tên công trình"
    )

    loai_cong_trinh = models.CharField(
        max_length=50,
        verbose_name="Loại công trình",
        help_text="VD: NHA, CAU, CANG, TRAM"
    )

    cap_bao_mat = models.SmallIntegerField(
        default=0,
        verbose_name="Cấp bảo mật",
        help_text="0: thường, 1: hạn chế, 2: mật"
    )

    thuoc_tinh_khac = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Thuộc tính khác (JSON)"
    )

    class Meta:
        db_table = "tb_cong_trinh"
        verbose_name = "Công trình"
        verbose_name_plural = "Công trình"

    def __str__(self):
        return self.ten_cong_trinh


