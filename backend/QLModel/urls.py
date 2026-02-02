from django.urls import path
from . import views_Canh
from . import views_loaiMoHinh
from . import views_QLDoiTuong  # ✅ Import thêm module QLDoiTuong

urlpatterns = [
    # ✅ API Cảnh
    path('api/scenes/', views_Canh.get_scenes, name='get_scenes'),
    path('api/scenes/<int:ma_canh>/models/', views_Canh.get_models_by_scene, name='models_by_scene'),
    
    # ✅ API loại mô hình 
    # UPLOAD FILE CHO LOẠI MÔ HÌNH
    path('api/model-types/upload/', views_loaiMoHinh.upload_model_type_file, name='upload_model_type_file'),
    path('api/model-types/<int:model_type_id>/update-with-file/', views_loaiMoHinh.update_model_type_file, name='update_model_type_file'),
    # Lấy danh sách loại mô hình (có phân trang & filter)
    path('api/model-types/', views_loaiMoHinh.get_model_types, name='get_model_types'),
    # Lấy chi tiết một loại mô hình
    path('api/model-types/<int:model_type_id>/', views_loaiMoHinh.get_model_type_detail, name='get_model_type_detail'),
    # Cập nhật loại mô hình
    path('api/model-types/<int:model_type_id>/update/', views_loaiMoHinh.update_model_type, name='update_model_type'),
    # Xóa loại mô hình
    path('api/model-types/<int:model_type_id>/delete/', views_loaiMoHinh.delete_model_type, name='delete_model_type'),
    # Lấy danh sách parent options
    path('api/model-types/parent-options/', views_loaiMoHinh.get_parent_options, name='get_parent_options'),

    # ✅ API Quản lý Đối Tượng - Thêm vào đây
    path('api/doi-tuong/', views_QLDoiTuong.get_doi_tuong_list, name='get_doi_tuong_list'),
    path('api/doi-tuong/create/', views_QLDoiTuong.create_doi_tuong, name='create_doi_tuong'),
    path('api/doi-tuong/<int:doi_tuong_id>/delete/', views_QLDoiTuong.delete_doi_tuong, name='delete_doi_tuong'),
    path('api/canh/options/', views_QLDoiTuong.get_canh_options, name='get_canh_options'),
    path('api/loai-mo-hinh/options/', views_QLDoiTuong.get_loai_mo_hinh_options, name='get_loai_mo_hinh_options'),
]