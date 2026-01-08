# glb_app/forms.py
from django import forms
from .models import GlbModel

class GlbUploadForm(forms.ModelForm):
    class Meta:
        model = GlbModel
        fields = ['name', 'glb_file', 'lon', 'lat', 'height', 'scale', 'rotation_x', 'rotation_y', 'rotation_z']

from .models import Tileset

class TilesetUploadForm(forms.ModelForm):
    class Meta:
        model = Tileset
        fields = ['name', 'tileset_file', 'folder']
