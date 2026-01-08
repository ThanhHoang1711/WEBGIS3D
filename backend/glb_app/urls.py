from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_glb, name='upload_glb'),
    path('upload-success/', views.upload_success, name='upload_success'), 
    path('api/models/', views.glb_models_api, name='glb_models_api'),
    path("tiles/", views.get_3dtiles, name="get_3dtiles"),
    path('upload_tileset/', views.upload_tileset, name='upload_tileset'),
    path('upload_tileset_success/', views.upload_tileset_success, name='upload_tileset_success'),

    # 🟢 API Endpoints
    # ✅ Get CSRF token (gọi trước upload)
    path('api/csrf-token/', views.get_csrf_token, name='get_csrf_token'),
    # ✅ Upload model
    path('api/upload-glb/', views.upload_glb_api, name='upload_glb_api'),
    # ✅ Get all models
    path('api/models/', views.glb_models_api, name='glb_models_api'),
    # ✅ Get model detail
    path('api/models/<int:model_id>/', views.glb_model_detail, name='glb_model_detail'),
    # ✅ Delete model
    path('api/models/<int:model_id>/delete/', views.delete_glb_model, name='delete_glb_model'),
]

