"""
i3dm_app/models.py
Model để lưu thông tin các I3DM tilesets đã tạo
"""

from django.db import models
from glb_app.models import GlbModel


class I3DMTileset(models.Model):
    """
    Lưu thông tin các I3DM tilesets đã generate
    """
    # ✅ UPDATED: Reference đến model gốc (nullable cho uploaded files)
    source_model = models.ForeignKey(
        GlbModel, 
        on_delete=models.CASCADE,
        related_name='i3dm_tilesets',
        verbose_name="Model gốc",
        null=True,      # ✅ Cho phép NULL
        blank=True      # ✅ Cho phép blank trong forms
    )
    
    # Metadata
    name = models.CharField(max_length=255, verbose_name="Tên tileset")
    count = models.IntegerField(verbose_name="Số instances")
    
    # Bounding box
    min_lon = models.FloatField(verbose_name="Min Longitude")
    max_lon = models.FloatField(verbose_name="Max Longitude")
    min_lat = models.FloatField(verbose_name="Min Latitude")
    max_lat = models.FloatField(verbose_name="Max Latitude")
    
    # Transform
    height = models.FloatField(default=0, verbose_name="Height offset")
    scale = models.FloatField(default=1.0, verbose_name="Scale")
    
    # File paths (relative to MEDIA_ROOT)
    tileset_file = models.CharField(max_length=500, verbose_name="Tileset JSON path")
    i3dm_file = models.CharField(max_length=500, verbose_name="I3DM binary path")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'i3dm_tileset'
        verbose_name = 'I3DM Tileset'
        verbose_name_plural = 'I3DM Tilesets'
        ordering = ['-created_at']
    
    def __str__(self):
        # ✅ Handle case when source_model is None
        source_name = self.source_model.name if self.source_model else "Uploaded"
        return f"{self.name} ({self.count} instances) - {source_name}"
    
    @property
    def tileset_url(self):
        """URL để load trong Cesium"""
        return f'/media/i3dm/{self.tileset_file}'
    
    @property
    def file_size(self):
        """Tính size của i3dm file"""
        from pathlib import Path
        from django.conf import settings
        
        i3dm_path = Path(settings.MEDIA_ROOT) / 'i3dm' / self.i3dm_file
        if i3dm_path.exists():
            return i3dm_path.stat().st_size
        return 0
    
    def delete_files(self):
        """Xóa files khi delete record"""
        from pathlib import Path
        from django.conf import settings
        
        i3dm_dir = Path(settings.MEDIA_ROOT) / 'i3dm'
        
        # Delete tileset.json
        tileset_path = i3dm_dir / self.tileset_file
        if tileset_path.exists():
            tileset_path.unlink()
            print(f"🗑️ Deleted: {self.tileset_file}")
        
        # Delete .i3dm
        i3dm_path = i3dm_dir / self.i3dm_file
        if i3dm_path.exists():
            i3dm_path.unlink()
            print(f"🗑️ Deleted: {self.i3dm_file}")
    
    def delete(self, *args, **kwargs):
        """Override delete để xóa cả files"""
        self.delete_files()
        super().delete(*args, **kwargs)