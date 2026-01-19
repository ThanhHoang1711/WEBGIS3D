"""
i3dm_app/urls.py
URL configuration cho I3DM app - VERSION CÓ DATABASE + POINT-BASED
"""

from django.urls import path
from . import views

app_name = 'i3dm_app'

urlpatterns = [
    # ✅ NEW: Generate I3DM từ danh sách điểm (point-based)
    path('generate-from-points/', views.generate_i3dm_from_points, name='generate_i3dm_from_points'),
    
    # ✅ Generate I3DM tileset từ bbox (lưu vào DB)
    path('generate/', views.generate_i3dm_tileset, name='generate_i3dm'),
    
    # ✅ List all tilesets (từ DB)
    path('list/', views.list_i3dm_tilesets, name='list_tilesets'),
    
    # ✅ Get tileset detail
    path('<int:tileset_id>/', views.get_i3dm_tileset_detail, name='tileset_detail'),
    
    # ✅ Delete tileset (xóa cả files)
    path('delete/<int:tileset_id>/', views.delete_i3dm_tileset, name='delete_tileset'),
    
    # ✅ Get tilesets by model
    path('by-model/<int:model_id>/', views.get_tilesets_by_model, name='tilesets_by_model'),
    
    # ✅ Cleanup orphan files
    path('cleanup/', views.cleanup_orphan_files, name='cleanup_orphan'),

     # ✅ NEW: Upload endpoint
    path('generate-from-upload/', views.generate_i3dm_from_upload, name='generate_from_upload'),
]