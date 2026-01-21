from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from .models import Canh, LoaiMoHinh, ViTri, MoHinh
from django.utils import timezone
import json

# ==============================
# API LẤY DANH SÁCH CẢNH
# ==============================
@csrf_exempt
@require_GET
def get_scenes(request):
    """
    API trả về danh sách tất cả các cảnh
    Endpoint: GET /api/scenes/
    """
    try:
        # Lấy tất cả cảnh, có thể thêm filter nếu cần
        scenes = Canh.objects.all().order_by('ma_canh')
        
        scenes_data = []
        for scene in scenes:
            scenes_data.append({
                'ma_canh': scene.ma_canh,
                'ten_canh': scene.ten_canh,
                'mo_ta': scene.mo_ta,
                'camera': {
                    'lat': scene.lat,
                    'lon': scene.lon,
                    'height': scene.height,
                    'heading': scene.heading,
                    'pitch': scene.pitch,
                    'roll': scene.roll
                },
                'url_terrain': scene.url_terrain,
                # Thêm các field khác nếu có
                # 'loai_terrain': scene.loai_terrain if hasattr(scene, 'loai_terrain') else None,
                # 'is_active': scene.is_active if hasattr(scene, 'is_active') else True,
            })
        
        return JsonResponse({
            'success': True,
            'count': len(scenes_data),
            'scenes': scenes_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ==============================
# API LẤY CHI TIẾT MỘT CẢNH
# ==============================
@csrf_exempt
@require_GET
def get_scene_detail(request, ma_canh):
    """
    API trả về chi tiết một cảnh và các model thuộc cảnh đó
    Endpoint: GET /api/scenes/<ma_canh>/
    """
    try:
        # Tìm cảnh theo mã
        scene = Canh.objects.get(ma_canh=ma_canh)
        
        # Lấy danh sách loại mô hình thuộc cảnh này
        loai_mo_hinhs = LoaiMoHinh.objects.filter(ma_canh=scene)
        
        # Chuẩn bị dữ liệu loại mô hình
        loai_mo_hinhs_data = []
        for loai_mh in loai_mo_hinhs:
            loai_mo_hinhs_data.append({
                'id': loai_mh.id,
                'url_glb': loai_mh.url_glb,
                'url_b3dm': loai_mh.url_b3dm,
                'parent': loai_mh.parent,
                'loai_cap_nhat': loai_mh.loai_cap_nhat,
                # Thêm thông tin khác nếu cần
            })
        
        # Lấy danh sách mô hình thuộc các loại mô hình này
        mo_hinhs_data = []
        for loai_mh in loai_mo_hinhs:
            # Lấy tất cả mô hình thuộc loại này
            mo_hinhs = MoHinh.objects.filter(ma_loai_mo_hinh=loai_mh)
            
            for mh in mo_hinhs:
                # Lấy thông tin vị trí của mô hình
                vi_tri = mh.ma_vi_tri
                mo_hinhs_data.append({
                    'id': mh.id,
                    'ma_doi_tuong': mh.ma_doi_tuong,
                    'ma_canh': mh.ma_canh,
                    'vi_tri': {
                        'id': vi_tri.id,
                        'lat': vi_tri.lat,
                        'lon': vi_tri.lon,
                        'height': vi_tri.height,
                        'heading': vi_tri.heading,
                        'pitch': vi_tri.pitch,
                        'roll': vi_tri.roll,
                        'box': vi_tri.box,
                        'scale': vi_tri.scale
                    } if vi_tri else None,
                    'loai_mo_hinh_id': loai_mh.id,
                    'url_glb': loai_mh.url_glb,  # URL từ loại mô hình
                    'url_b3dm': loai_mh.url_b3dm  # URL từ loại mô hình
                })
        
        # Tổng hợp dữ liệu phản hồi
        response_data = {
            'success': True,
            'scene': {
                'ma_canh': scene.ma_canh,
                'ten_canh': scene.ten_canh,
                'mo_ta': scene.mo_ta,
                'camera': {
                    'lat': scene.lat,
                    'lon': scene.lon,
                    'height': scene.height,
                    'heading': scene.heading,
                    'pitch': scene.pitch,
                    'roll': scene.roll
                },
                'url_terrain': scene.url_terrain,
            },
            'loai_mo_hinhs': loai_mo_hinhs_data,
            'mo_hinhs': mo_hinhs_data,
            'count_loai_mo_hinh': len(loai_mo_hinhs_data),
            'count_mo_hinh': len(mo_hinhs_data)
        }
        
        return JsonResponse(response_data)
        
    except Canh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy cảnh với mã {ma_canh}'
        }, status=404)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ==============================
# API LẤY MODEL THEO CẢNH
# ==============================
@csrf_exempt
@require_GET
def get_models_by_scene(request, ma_canh):
    """
    API chỉ trả về danh sách mô hình thuộc một cảnh
    Endpoint: GET /api/scenes/<ma_canh>/models/
    """
    try:
        # Kiểm tra cảnh tồn tại
        scene = Canh.objects.get(ma_canh=ma_canh)
        
        # Lấy tất cả loại mô hình thuộc cảnh
        loai_mo_hinhs = LoaiMoHinh.objects.filter(ma_canh=scene)
        
        # Lấy tất cả mô hình thuộc các loại mô hình này
        mo_hinhs_data = []
        for loai_mh in loai_mo_hinhs:
            mo_hinhs = MoHinh.objects.filter(ma_loai_mo_hinh=loai_mh)
            
            for mh in mo_hinhs:
                vi_tri = mh.ma_vi_tri
                mo_hinhs_data.append({
                    'id': mh.id,
                    'ma_doi_tuong': mh.ma_doi_tuong,
                    'ma_canh': mh.ma_canh,
                    'position': {
                        'lat': vi_tri.lat,
                        'lon': vi_tri.lon,
                        'height': vi_tri.height
                    } if vi_tri else None,
                    'orientation': {
                        'heading': vi_tri.heading,
                        'pitch': vi_tri.pitch,
                        'roll': vi_tri.roll
                    } if vi_tri else None,
                    'scale': vi_tri.scale if vi_tri else 1.0,
                    'url_glb': loai_mh.url_glb,
                    'url_b3dm': loai_mh.url_b3dm,
                    'loai_mo_hinh': {
                        'id': loai_mh.id,
                        'loai_cap_nhat': loai_mh.loai_cap_nhat
                    }
                })
        
        return JsonResponse({
            'success': True,
            'scene_id': ma_canh,
            'scene_name': scene.ten_canh,
            'models': mo_hinhs_data,
            'count': len(mo_hinhs_data)
        })
        
    except Canh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy cảnh với mã {ma_canh}'
        }, status=404)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ==============================
# API THỐNG KÊ CẢNH
# ==============================
@csrf_exempt
@require_GET
def get_scene_stats(request):
    """
    API trả về thống kê về các cảnh
    Endpoint: GET /api/scenes/stats/
    """
    try:
        # Thống kê cơ bản
        total_scenes = Canh.objects.count()
        
        # Đếm số loại mô hình và mô hình cho mỗi cảnh
        scenes_stats = []
        scenes = Canh.objects.all()
        
        for scene in scenes:
            loai_mo_hinh_count = LoaiMoHinh.objects.filter(ma_canh=scene).count()
            
            # Đếm tổng số mô hình trong cảnh
            mo_hinh_count = 0
            loai_mo_hinhs = LoaiMoHinh.objects.filter(ma_canh=scene)
            for loai_mh in loai_mo_hinhs:
                mo_hinh_count += MoHinh.objects.filter(ma_loai_mo_hinh=loai_mh).count()
            
            scenes_stats.append({
                'ma_canh': scene.ma_canh,
                'ten_canh': scene.ten_canh,
                'loai_mo_hinh_count': loai_mo_hinh_count,
                'mo_hinh_count': mo_hinh_count,
                'url_terrain': scene.url_terrain
            })
        
        return JsonResponse({
            'success': True,
            'total_scenes': total_scenes,
            'scenes_stats': scenes_stats
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ==============================
# API KIỂM TRA TRẠNG THÁI
# ==============================
@csrf_exempt
@require_GET
def health_check(request):
    """
    API kiểm tra trạng thái hệ thống
    Endpoint: GET /api/health/
    """
    try:
        # Kiểm tra kết nối database
        scene_count = Canh.objects.count()
        model_count = MoHinh.objects.count()
        vi_tri_count = ViTri.objects.count()
        
        return JsonResponse({
            'status': 'healthy',
            'database': {
                'scene_count': scene_count,
                'model_count': model_count,
                'vi_tri_count': vi_tri_count
            },
            'timestamp': timezone.now().isoformat()
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)