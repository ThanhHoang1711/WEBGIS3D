# ==============================
# API QUẢN LÝ CÔNG TRÌNH THEO LOD - FIXED
# ==============================
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from .models import MoHinh, LoaiMoHinh, ViTri, Canh, CongTrinh
import json

# ✅ API LẤY DANH SÁCH CÔNG TRÌNH VỚI THÔNG TIN LOD - FIXED
@csrf_exempt
@require_http_methods(["GET"])
def get_cong_trinh_lod(request):
    """
    API lấy danh sách công trình kèm thông tin LOD chi tiết
    Endpoint: GET /api/cong-trinh/lod/
    
    Query params:
    - page: số trang (mặc định 1)
    - page_size: số item mỗi trang (mặc định 1000)
    - lod: lọc theo loai_mo_hinh_id (LOD)
    - ma_canh: lọc theo cảnh
    - search: tìm kiếm theo tên công trình
    """
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 1000))
        lod_filter = request.GET.get('lod', None)  # loai_mo_hinh_id
        ma_canh_filter = request.GET.get('ma_canh', None)
        search = request.GET.get('search', '').strip()
        
        # Query MoHinh với loai_doi_tuong = 3 (Công trình)
        queryset = MoHinh.objects.select_related(
            'ma_canh', 'ma_loai_mo_hinh', 'ma_vi_tri'
        ).filter(
            loai_doi_tuong=3,  # Chỉ lấy công trình
            trang_thai=1        # Chỉ lấy đang hoạt động
        ).order_by('-thoi_gian_tao')
        
        # Filter theo LOD (loai_mo_hinh_id)
        if lod_filter:
            queryset = queryset.filter(ma_loai_mo_hinh_id=int(lod_filter))
        
        # Filter theo cảnh
        if ma_canh_filter:
            queryset = queryset.filter(ma_canh__ma_canh=int(ma_canh_filter))
        
        # Phân trang
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Chuẩn bị data
        cong_trinh_data = []
        for mh in page_obj:
            # Lấy thông tin công trình cụ thể từ bảng CongTrinh
            cong_trinh_info = None
            try:
                ct = CongTrinh.objects.get(id=mh.id)
                cong_trinh_info = {
                    'ten_cong_trinh': ct.ten_cong_trinh,
                    'loai_cong_trinh': ct.loai_cong_trinh,
                    'cap_bao_mat': ct.cap_bao_mat
                }
            except CongTrinh.DoesNotExist:
                cong_trinh_info = {
                    'ten_cong_trinh': f'Công trình #{mh.id}',
                    'loai_cong_trinh': 'KHAC',
                    'cap_bao_mat': 0
                }
            
            # ✅ FIX: Lấy CÁ 2 thông tin LOD - ten_loai_mo_hinh VÀ loai_cap_nhat
            ten_loai_mo_hinh = 'Không xác định'  # ← THÊM MỚI
            lod_name = 'Không xác định'
            loai_mo_hinh_id = None
            
            if mh.ma_loai_mo_hinh:
                # ✅ Lấy tên model thực (ví dụ: "Nhà 3 tầng")
                ten_loai_mo_hinh = mh.ma_loai_mo_hinh.ten_loai_mo_hinh or 'Không xác định'
                
                # Giữ nguyên LOD level (ví dụ: "LOD2") để backward compatible
                lod_name = mh.ma_loai_mo_hinh.loai_cap_nhat or 'Không xác định'
                
                loai_mo_hinh_id = mh.ma_loai_mo_hinh.id
            
            # Lấy vị trí
            lat = 0
            lon = 0
            height = 0
            vi_tri_id = None
            if mh.ma_vi_tri:
                lat = float(mh.ma_vi_tri.lat) if mh.ma_vi_tri.lat else 0
                lon = float(mh.ma_vi_tri.lon) if mh.ma_vi_tri.lon else 0
                height = float(mh.ma_vi_tri.height) if mh.ma_vi_tri.height else 0
                vi_tri_id = mh.ma_vi_tri.id
            
            # Lấy thông tin cảnh
            ma_canh = None
            ma_canh_id = None
            if mh.ma_canh:
                ma_canh = mh.ma_canh.ten_canh
                ma_canh_id = mh.ma_canh.ma_canh  # Lưu ý: ma_canh (0,1,2,3,4) không phải id
            
            cong_trinh_data.append({
                'id': mh.id,
                'ten_cong_trinh': cong_trinh_info['ten_cong_trinh'],
                'loai_cong_trinh': cong_trinh_info['loai_cong_trinh'],
                'cap_bao_mat': cong_trinh_info['cap_bao_mat'],
                
                # ✅ FIX: Thêm field ten_loai_mo_hinh
                'ten_loai_mo_hinh': ten_loai_mo_hinh,  # ← THÊM MỚI: "Nhà 3 tầng"
                'lod': lod_name,                        # Giữ nguyên: "LOD2"
                
                'loai_mo_hinh_id': loai_mo_hinh_id,
                'ma_canh': ma_canh,
                'ma_canh_id': ma_canh_id,
                'lat': lat,
                'lon': lon,
                'height': height,
                'vi_tri_id': vi_tri_id,
                'thoi_gian_tao': mh.thoi_gian_tao.strftime('%Y-%m-%d %H:%M:%S') if mh.thoi_gian_tao else None,
                'hinh_anh': mh.hinh_anh or ''
            })
        
        # Filter theo search (sau khi đã lấy data)
        if search:
            search_lower = search.lower()
            cong_trinh_data = [
                item for item in cong_trinh_data 
                if search_lower in item['ten_cong_trinh'].lower()
            ]
        
        return JsonResponse({
            'success': True,
            'data': cong_trinh_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': paginator.num_pages,
                'total_items': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ✅ API THỐNG KÊ CÔNG TRÌNH THEO LOD - FIXED
@csrf_exempt
@require_http_methods(["GET"])
def get_cong_trinh_stats_by_lod(request):
    """
    API thống kê số lượng công trình theo từng LOD
    Endpoint: GET /api/cong-trinh/stats/lod/
    """
    try:
        from django.db.models import Count
        
        # Đếm số lượng công trình theo LOD
        stats = MoHinh.objects.filter(
            loai_doi_tuong=3,
            trang_thai=1
        ).values(
            'ma_loai_mo_hinh__id',
            'ma_loai_mo_hinh__ten_loai_mo_hinh',      # ← THÊM MỚI
            'ma_loai_mo_hinh__loai_cap_nhat'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        stats_data = []
        total = 0
        for item in stats:
            count = item['count']
            total += count
            
            # ✅ FIX: Thêm ten_loai_mo_hinh vào stats
            ten_loai_mo_hinh = item['ma_loai_mo_hinh__ten_loai_mo_hinh'] or 'Không xác định'
            lod = item['ma_loai_mo_hinh__loai_cap_nhat'] or 'Không xác định'
            
            stats_data.append({
                'loai_mo_hinh_id': item['ma_loai_mo_hinh__id'],
                'ten_loai_mo_hinh': ten_loai_mo_hinh,  # ← THÊM MỚI
                'lod': lod,
                'count': count
            })
        
        # Tính phần trăm
        for item in stats_data:
            item['percentage'] = round((item['count'] / total * 100), 1) if total > 0 else 0
        
        return JsonResponse({
            'success': True,
            'total': total,
            'stats': stats_data
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)