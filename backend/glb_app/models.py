import os
from django.db import models
from django.core.files.storage import default_storage

def glb_upload_path(instance, filename):
    upload_path = os.path.join("models", filename)
    
    # Nếu file đã tồn tại thì xóa
    if default_storage.exists(upload_path):
        default_storage.delete(upload_path)
    
    return upload_path

class GlbModel(models.Model):
    name = models.CharField(max_length=255)
    glb_file = models.FileField(upload_to=glb_upload_path)
    lon = models.FloatField(default=0.0)
    lat = models.FloatField(default=0.0)
    height = models.FloatField(default=0.0)
    scale = models.FloatField(default=1.0)
    rotation_x = models.FloatField(default=0.0)
    rotation_y = models.FloatField(default=0.0)
    rotation_z = models.FloatField(default=0.0)

    def __str__(self):
        return self.name

class GlbMesh(models.Model):
    glb_model = models.ForeignKey(GlbModel, on_delete=models.CASCADE, related_name='meshes')
    mesh_name = models.CharField(max_length=255)
    vertex_data = models.TextField()  

class Tileset(models.Model):
    name = models.CharField(max_length=255, unique=True)  # Tên tileset
    folder = models.CharField(max_length=500, blank=True)  # Thư mục chứa tiles
    tileset_file = models.FileField(upload_to='tilesets/')  # file tileset.json

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
