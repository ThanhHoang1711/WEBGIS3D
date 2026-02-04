# ==============================
# API QUẢN LÝ ĐỐI TƯỢNG TRÊN BẢN ĐỒ
# ==============================
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q
from django.core.files.storage import FileSystemStorage
from django.conf import settings
from .models import MoHinh, LoaiMoHinh, ViTri, Canh, Cay, CongTrinh, DTChuyenDong
import json
import os

# ✅ API LẤY DANH SÁCH ĐỐI TƯỢNG TRÊN BẢN ĐỒ (CÓ PHÂN TRANG)
@csrf_exempt
@require_http_methods(["GET"])
def get_doi_tuong_list(request):
    """
    API lấy danh sách đối tượng trên bản đồ
    Endpoint: GET /api/doi-tuong/
    
    Query params:
    - page: số trang (mặc định 1)
    - page_size: số item mỗi trang (mặc định 10)
    - search: tìm kiếm
    - ma_canh: lọc theo cảnh
    - loai_doi_tuong: lọc theo loại đối tượng (1: chuyển động, 2: cây, 3: công trình)
    """
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        search = request.GET.get('search', '').strip()
        ma_canh = request.GET.get('ma_canh', None)
        loai_doi_tuong = request.GET.get('loai_doi_tuong', None)
        
        queryset = MoHinh.objects.select_related(
            'ma_canh', 'ma_loai_mo_hinh', 'ma_vi_tri'
        ).all().order_by('-thoi_gian_tao')
        
        # Filter theo cảnh
        if ma_canh:
            queryset = queryset.filter(ma_canh_id=int(ma_canh))
        
        # Filter theo loại đối tượng
        if loai_doi_tuong:
            queryset = queryset.filter(loai_doi_tuong=int(loai_doi_tuong))
        
        # Phân trang
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Chuẩn bị data
        doi_tuong_data = []
        for dt in page_obj:
            # Lấy thông tin loại đối tượng cụ thể
            loai_dt_info = None
            if dt.loai_doi_tuong == 1:  # Đối tượng chuyển động
                try:
                    dt_cd = DTChuyenDong.objects.filter(id=dt.id).first()
                    if dt_cd:
                        loai_dt_info = dt_cd.ten_doi_tuong
                except:
                    pass
            elif dt.loai_doi_tuong == 2:  # Cây
                try:
                    cay = Cay.objects.filter(id=dt.id).first()
                    if cay:
                        loai_dt_info = cay.ten_loai
                except:
                    pass
            elif dt.loai_doi_tuong == 3:  # Công trình
                try:
                    ct = CongTrinh.objects.filter(id=dt.id).first()
                    if ct:
                        loai_dt_info = ct.ten_cong_trinh
                except:
                    pass
            
            doi_tuong_data.append({
                'id': dt.id,
                'ma_canh': dt.ma_canh.ten_canh if dt.ma_canh else '-',
                'ma_canh_id': dt.ma_canh.id if dt.ma_canh else None,
                'loai_mo_hinh': dt.ma_loai_mo_hinh.loai_cap_nhat if dt.ma_loai_mo_hinh else '-',
                'loai_mo_hinh_id': dt.ma_loai_mo_hinh.id if dt.ma_loai_mo_hinh else None,
                'vi_tri': f"({dt.ma_vi_tri.lat}, {dt.ma_vi_tri.lon})" if dt.ma_vi_tri else '-',
                'vi_tri_id': dt.ma_vi_tri.id if dt.ma_vi_tri else None,
                'loai_doi_tuong': dt.loai_doi_tuong,
                'loai_doi_tuong_text': _get_loai_doi_tuong_text(dt.loai_doi_tuong),
                'loai_dt_info': loai_dt_info,
                'hinh_anh': dt.hinh_anh or '',
                'trang_thai': dt.trang_thai,
                'thoi_gian_tao': dt.thoi_gian_tao.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return JsonResponse({
            'success': True,
            'data': doi_tuong_data,
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

def _get_loai_doi_tuong_text(loai):
    """Helper function để convert loại đối tượng sang text"""
    mapping = {
        1: 'Đối tượng chuyển động',
        2: 'Cây',
        3: 'Công trình'
    }
    return mapping.get(loai, 'Không xác định')

# ✅ API TẠO MỚI ĐỐI TƯỢNG TRÊN BẢN ĐỒ
# ✅ API TẠO MỚI ĐỐI TƯỢNG TRÊN BẢN ĐỒ
@csrf_exempt
@require_http_methods(["POST"])
def create_doi_tuong(request):
    """
    API tạo mới đối tượng trên bản đồ
    """
    try:
        print(f"📡 POST /api/doi-tuong/create/")
        print("All POST data:", dict(request.POST))
        
        # Lấy thông tin chung
        ma_canh_value = request.POST.get('ma_canh')  # Giá trị ma_canh (0,1,2,3,4)
        ma_loai_mo_hinh_id = request.POST.get('ma_loai_mo_hinh', None)
        loai_doi_tuong = int(request.POST.get('loai_doi_tuong'))
        trang_thai = int(request.POST.get('trang_thai', 1))
        
        # Validate
        if not ma_canh_value:
            return JsonResponse({
                'success': False,
                'error': 'Vui lòng chọn cảnh'
            }, status=400)
        
        # Kiểm tra cảnh tồn tại - TÌM THEO ma_canh (0,1,2,3,4)
        try:
            canh = Canh.objects.get(ma_canh=int(ma_canh_value))
            print(f"✓ Found Canh: id={canh.id}, ma_canh={canh.ma_canh}")
        except Canh.DoesNotExist:
            print(f"✗ Canh with ma_canh={ma_canh_value} not found")
            return JsonResponse({
                'success': False,
                'error': f'Cảnh với mã {ma_canh_value} không tồn tại'
            }, status=400)
        
        # Lấy thông tin vị trí
        try:
            lat = float(request.POST.get('lat'))
            lon = float(request.POST.get('lon'))
            height = float(request.POST.get('height', 0))
            heading = float(request.POST.get('heading', 0))
            pitch = float(request.POST.get('pitch', 0))
            roll = float(request.POST.get('roll', 0))
            scale = float(request.POST.get('scale', 1.0))
        except (ValueError, TypeError):
            return JsonResponse({
                'success': False,
                'error': 'Thông tin vị trí không hợp lệ'
            }, status=400)
        
        # Upload hình ảnh nếu có
        hinh_anh_path = None
        if 'hinh_anh_file' in request.FILES:
            hinh_anh_file = request.FILES['hinh_anh_file']
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'images')
            os.makedirs(upload_dir, exist_ok=True)
            fs = FileSystemStorage(location=upload_dir)
            filename = fs.save(hinh_anh_file.name, hinh_anh_file)
            hinh_anh_path = f"images/{filename}"
            print(f"✅ Image uploaded: {hinh_anh_path}")
        
        # 1. Tạo Vị Trí trước
        vi_tri = ViTri.objects.create(
            lat=lat,
            lon=lon,
            height=height,
            heading=heading,
            pitch=pitch,
            roll=roll,
            scale=scale
        )
        print(f"✅ Created ViTri: ID={vi_tri.id}")
        
        # 2. Tạo đối tượng cụ thể theo loại
        doi_tuong_cu_the_id = None
        
        if loai_doi_tuong == 1:  # Đối tượng chuyển động
            loai_DT = request.POST.get('loai_DT', 'UNKNOWN')
            ten_doi_tuong = request.POST.get('ten_doi_tuong', '')
            duong_chuyen_dong = request.POST.get('duong_chuyen_dong', '')
            van_toc = request.POST.get('van_toc', None)
            
            if not ten_doi_tuong:
                vi_tri.delete()
                return JsonResponse({
                    'success': False,
                    'error': 'Vui lòng nhập tên đối tượng'
                }, status=400)
            
            dt_cd = DTChuyenDong.objects.create(
                loai_DT=loai_DT,
                ten_doi_tuong=ten_doi_tuong,
                duong_chuyen_dong=duong_chuyen_dong,
                van_toc=float(van_toc) if van_toc else None
            )
            doi_tuong_cu_the_id = dt_cd.id
            print(f"✅ Created DTChuyenDong: ID={dt_cd.id}")
            
        elif loai_doi_tuong == 2:  # Cây
            ten_loai = request.POST.get('ten_loai', '')
            cay_height = request.POST.get('cay_height', None)
            duong_kinh = request.POST.get('duong_kinh', None)
            tuoi = request.POST.get('tuoi', None)
            
            if not ten_loai:
                vi_tri.delete()
                return JsonResponse({
                    'success': False,
                    'error': 'Vui lòng nhập tên loài cây'
                }, status=400)
            
            cay = Cay.objects.create(
                ten_loai=ten_loai,
                height=float(cay_height) if cay_height else None,
                duong_kinh=float(duong_kinh) if duong_kinh else None,
                tuoi=int(tuoi) if tuoi else None
            )
            doi_tuong_cu_the_id = cay.id
            print(f"✅ Created Cay: ID={cay.id}")
            
        elif loai_doi_tuong == 3:  # Công trình
            ten_cong_trinh = request.POST.get('ten_cong_trinh', '')
            loai_cong_trinh = request.POST.get('loai_cong_trinh', 'NHA')
            cap_bao_mat = int(request.POST.get('cap_bao_mat', 0))
            
            if not ten_cong_trinh:
                vi_tri.delete()
                return JsonResponse({
                    'success': False,
                    'error': 'Vui lòng nhập tên công trình'
                }, status=400)
            
            cong_trinh = CongTrinh.objects.create(
                ten_cong_trinh=ten_cong_trinh,
                loai_cong_trinh=loai_cong_trinh,
                cap_bao_mat=cap_bao_mat
            )
            doi_tuong_cu_the_id = cong_trinh.id
            print(f"✅ Created CongTrinh: ID={cong_trinh.id}")
        
        else:
            vi_tri.delete()
            return JsonResponse({
                'success': False,
                'error': 'Loại đối tượng không hợp lệ'
            }, status=400)
        
        # 3. Cuối cùng tạo MoHinh - SỬA QUAN TRỌNG
        # Vì database đang lưu ma_canh_id = ma_canh (0,1,2,3,4) chứ không phải id (6,7,8,9,10)
        # Cần tìm đúng id của Canh theo ma_canh
        try:
            # Tìm Canh có ma_canh = giá trị truyền vào
            canh_to_use = Canh.objects.get(ma_canh=int(ma_canh_value))
            
            mo_hinh = MoHinh.objects.create(
                ma_canh=canh_to_use,  # Django sẽ tự động lấy id của canh_to_use
                ma_loai_mo_hinh_id=int(ma_loai_mo_hinh_id) if ma_loai_mo_hinh_id else None,
                ma_vi_tri=vi_tri,
                loai_doi_tuong=loai_doi_tuong,
                hinh_anh=hinh_anh_path,
                trang_thai=trang_thai
            )
            print(f"✅ Created MoHinh: ID={mo_hinh.id}, ma_canh_id={mo_hinh.ma_canh_id}")
            
        except Canh.DoesNotExist:
            vi_tri.delete()
            return JsonResponse({
                'success': False,
                'error': f'Không tìm thấy cảnh với mã {ma_canh_value}'
            }, status=400)
        
        return JsonResponse({
            'success': True,
            'message': 'Tạo đối tượng thành công',
            'data': {
                'id': mo_hinh.id,
                'vi_tri_id': vi_tri.id,
                'doi_tuong_cu_the_id': doi_tuong_cu_the_id
            }
        }, status=201)
        
    except Exception as e:
        print(f"❌ Create error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': f'Lỗi server: {str(e)}'
        }, status=500)

# ✅ API XÓA ĐỐI TƯỢNG
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_doi_tuong(request, doi_tuong_id):
    """
    API xóa đối tượng
    Endpoint: DELETE /api/doi-tuong/<id>/delete/
    """
    try:
        mo_hinh = MoHinh.objects.get(id=doi_tuong_id)
        
        # Xóa vị trí
        if mo_hinh.ma_vi_tri:
            mo_hinh.ma_vi_tri.delete()
        
        # Xóa hình ảnh
        if mo_hinh.hinh_anh:
            hinh_anh_path = os.path.join(settings.MEDIA_ROOT, mo_hinh.hinh_anh)
            if os.path.exists(hinh_anh_path):
                os.remove(hinh_anh_path)
        
        # Xóa mô hình
        mo_hinh.delete()
        
        return JsonResponse({
            'success': True,
            'message': 'Đã xóa đối tượng'
        })
        
    except MoHinh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy đối tượng với ID {doi_tuong_id}'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ✅ API LẤY DANH SÁCH CẢNH CHO DROPDOWN
@csrf_exempt
@require_http_methods(["GET"])
def get_canh_options(request):
    """
    API lấy danh sách cảnh cho dropdown
    Endpoint: GET /api/canh/options/
    """
    try:
        canh_list = Canh.objects.all().order_by('ten_canh')
        
        options = [
            {
                'ma_canh': canh.ma_canh,
                'ten_canh': canh.ten_canh
            }
            for canh in canh_list
        ]
        
        return JsonResponse({
            'success': True,
            'data': options
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ✅ API LẤY DANH SÁCH LOẠI MÔ HÌNH CHO DROPDOWN
@csrf_exempt
@require_http_methods(["GET"])
def get_loai_mo_hinh_options(request):
    """
    API lấy danh sách loại mô hình cho dropdown
    Endpoint: GET /api/loai-mo-hinh/options/
    """
    try:
        loai_mo_hinhs = LoaiMoHinh.objects.all().order_by('loai_cap_nhat')
        
        options = [
            {
                'value': lmh.id,
                'label': f"{lmh.loai_cap_nhat} ({lmh.ten_loai_mo_hinh if lmh.ten_loai_mo_hinh else 'Không có tên'})"
            }
            for lmh in loai_mo_hinhs
        ]
        
        return JsonResponse({
            'success': True,
            'data': options
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)