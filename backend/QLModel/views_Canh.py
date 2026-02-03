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
        from django.conf import settings

        # Kiểm tra cảnh tồn tại
        scene = Canh.objects.get(ma_canh=ma_canh)

        # ✅ FIX: Query trực tiếp MoHinh theo ma_canh, chỉ lấy trang_thai=1
        mo_hinhs = MoHinh.objects.select_related(
            'ma_vi_tri', 'ma_loai_mo_hinh'
        ).filter(
            ma_canh=scene,
            trang_thai=1
        )

        # Base URL cho file media
        MEDIA_URL = f"http://localhost:8000/media/"

        mo_hinhs_data = []
        for mh in mo_hinhs:
            vi_tri = mh.ma_vi_tri
            loai_mh = mh.ma_loai_mo_hinh

            # Bỏ qua nếu không có vị trí hoặc không có loại mô hình (=> không có GLB)
            if not vi_tri or not loai_mh:
                continue

            # ✅ FIX: Ghép full URL cho url_glb / url_b3dm
            url_glb = None
            if loai_mh.url_glb:
                raw = loai_mh.url_glb.strip()
                url_glb = raw if raw.startswith("http") else MEDIA_URL + raw

            url_b3dm = None
            if loai_mh.url_b3dm:
                raw = loai_mh.url_b3dm.strip()
                url_b3dm = raw if raw.startswith("http") else MEDIA_URL + raw

            mo_hinhs_data.append({
                'id': mh.id,
                'ma_canh': ma_canh,
                'position': {
                    'lat': float(vi_tri.lat),
                    'lon': float(vi_tri.lon),
                    'height': float(vi_tri.height) if vi_tri.height else 0
                },
                'orientation': {
                    'heading': float(vi_tri.heading) if vi_tri.heading else 0,
                    'pitch': float(vi_tri.pitch) if vi_tri.pitch else 0,
                    'roll': float(vi_tri.roll) if vi_tri.roll else 0
                },
                'scale': float(vi_tri.scale) if vi_tri.scale else 1.0,
                'url_glb': url_glb,
                'url_b3dm': url_b3dm,
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
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)