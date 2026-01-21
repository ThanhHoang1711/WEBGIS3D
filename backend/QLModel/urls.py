from django.urls import path
from . import views

urlpatterns = [
    # API Cảnh
    path('api/scenes/', views.get_scenes, name='get_scenes'),
    path('api/scenes/<int:ma_canh>/', views.get_scene_detail, name='scene_detail'),
    path('api/scenes/<int:ma_canh>/models/', views.get_models_by_scene, name='models_by_scene'),
    path('api/scenes/stats/', views.get_scene_stats, name='scene_stats'),
    
    # API Kiểm tra
    path('api/health/', views.health_check, name='health_check'),
]
