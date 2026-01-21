from django.db import models
from django.contrib.postgres.fields import ArrayField

#Bảng Loại mô hình
class LoaiMoHinh(models.Model):
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
    ma_loai_mo_hinh = models.ForeignKey(
        LoaiMoHinh,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mo_hinhs',
        verbose_name="Loại mô hình"
    )
    
    ma_vi_tri = models.ForeignKey(
        ViTri,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mo_hinhs',
        verbose_name="Vị trí"
    )
    
    ma_canh = models.ForeignKey(
        Canh,
        on_delete=models.CASCADE,
        related_name='loai_mo_hinhs',
        verbose_name="Cảnh",
        help_text="Cảnh mà loại mô hình này thuộc về"
    )
    
    class Meta:
        db_table = "tb_mo_hinh"
        verbose_name = "Mô hình"
        verbose_name_plural = "Mô hình"
    
    def __str__(self):
        return f"Mô hình {self.id} - Cảnh {self.ma_canh}"