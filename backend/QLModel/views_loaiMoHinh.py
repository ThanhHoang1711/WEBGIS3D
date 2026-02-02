# ==============================
# API QUẢN LÝ LOẠI MÔ HÌNH
# ==============================
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q
from .models import LoaiMoHinh
import json
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os


# ✅ API LẤY DANH SÁCH LOẠI MÔ HÌNH (CÓ PHÂN TRANG VÀ LỌC)
@csrf_exempt
@require_http_methods(["GET"])
def get_model_types(request):
    """
    API lấy danh sách loại mô hình với phân trang và filter
    Endpoint: GET /api/model-types/
    
    Query params:
    - page: số trang (mặc định 1)
    - page_size: số item mỗi trang (mặc định 10)
    - search: tìm kiếm theo loại cập nhật
    - parent: lọc theo parent ID
    """
    try:
        # Lấy params
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        search = request.GET.get('search', '').strip()
        parent = request.GET.get('parent', None)
        
        # Query base
        queryset = LoaiMoHinh.objects.all().order_by('-id')
        
        # Filter theo search
        if search:
            queryset = queryset.filter(
                Q(loai_cap_nhat__icontains=search) |
                Q(url_glb__icontains=search) |
                Q(url_b3dm__icontains=search)
            )
        
        # Filter theo parent
        if parent:
            if parent.lower() == 'null':
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent=int(parent))
        
        # Phân trang
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Chuẩn bị data
        model_types_data = []
        for mt in page_obj:
            model_types_data.append({
                'id': mt.id,
                'ten_loai_mo_hinh': mt.ten_loai_mo_hinh,  
                'url_glb': mt.url_glb or '',
                'url_b3dm': mt.url_b3dm or '',
                'parent': mt.parent,
                'loai_cap_nhat': mt.loai_cap_nhat,
            })
        
        return JsonResponse({
            'success': True,
            'data': model_types_data,
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
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ✅ API LẤY CHI TIẾT MỘT LOẠI MÔ HÌNH
@csrf_exempt
@require_http_methods(["GET"])
def get_model_type_detail(request, model_type_id):
    """
    API lấy chi tiết một loại mô hình
    Endpoint: GET /api/model-types/<id>/
    """
    try:
        model_type = LoaiMoHinh.objects.get(id=model_type_id)
        
        data = {
            'id': model_type.id,
            'ten_loai_mo_hinh': model_type.ten_loai_mo_hinh,
            'url_glb': model_type.url_glb or '',
            'url_b3dm': model_type.url_b3dm or '',
            'parent': model_type.parent,
            'loai_cap_nhat': model_type.loai_cap_nhat,
            # Thêm thông tin về các model con nếu có
            'children_count': LoaiMoHinh.objects.filter(parent=model_type.id).count(),
            # Thêm thông tin về số mô hình sử dụng loại này
            'usage_count': model_type.mo_hinhs.count()
        }
        
        return JsonResponse({
            'success': True,
            'data': data
        })
        
    except LoaiMoHinh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy loại mô hình với ID {model_type_id}'
        }, status=404)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ✅ API CẬP NHẬT LOẠI MÔ HÌNH
@csrf_exempt
@require_http_methods(["PUT", "PATCH"])
def update_model_type(request, model_type_id):
    """
    API cập nhật loại mô hình
    Endpoint: PUT/PATCH /api/model-types/<id>/update/
    
    Body (JSON):
    {
        "url_glb": "http://example.com/model_new.glb",
        "url_b3dm": "http://example.com/model_new.b3dm",
        "parent": 2,
        "loai_cap_nhat": "Loại B"
    }
    """
    try:
        # Tìm model type
        model_type = LoaiMoHinh.objects.get(id=model_type_id)
        
        # Parse JSON body
        data = json.loads(request.body)
        
        # Cập nhật các field
        if 'url_glb' in data:
            url_glb = data['url_glb'].strip()
            model_type.url_glb = url_glb if url_glb else None
            
        if 'url_b3dm' in data:
            url_b3dm = data['url_b3dm'].strip()
            model_type.url_b3dm = url_b3dm if url_b3dm else None
            
        if 'parent' in data:
            parent = data['parent']
            if parent is not None:
                try:
                    parent_obj = LoaiMoHinh.objects.get(id=parent)
                    # Kiểm tra không tạo vòng lặp
                    if parent == model_type_id:
                        return JsonResponse({
                            'success': False,
                            'error': 'Không thể đặt chính nó làm parent'
                        }, status=400)
                    model_type.parent = parent
                except LoaiMoHinh.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': f'Parent ID {parent} không tồn tại'
                    }, status=400)
            else:
                model_type.parent = None
                
        if 'loai_cap_nhat' in data:
            loai_cap_nhat = data['loai_cap_nhat'].strip()
            if not loai_cap_nhat:
                return JsonResponse({
                    'success': False,
                    'error': 'Loại cập nhật không được để trống'
                }, status=400)
            model_type.loai_cap_nhat = loai_cap_nhat
        
        if 'ten_loai_mo_hinh' in data:
            ten_loai = data['ten_loai_mo_hinh'].strip()
            if not ten_loai:
                return JsonResponse({
                    'success': False,
                    'error': 'Tên loại mô hình không được để trống'
                }, status=400)
            model_type.ten_loai_mo_hinh = ten_loai
        
        # Validate ít nhất phải có 1 URL
        if not model_type.url_glb and not model_type.url_b3dm:
            return JsonResponse({
                'success': False,
                'error': 'Phải có ít nhất một URL (GLB hoặc B3DM)'
            }, status=400)
        
        # Lưu
        model_type.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Cập nhật loại mô hình thành công',
            'data': {
                'id': model_type.id,
                'ten_loai_mo_hinh': model_type.ten_loai_mo_hinh,
                'url_glb': model_type.url_glb or '',
                'url_b3dm': model_type.url_b3dm or '',
                'parent': model_type.parent,
                'loai_cap_nhat': model_type.loai_cap_nhat
            }
        })
        
    except LoaiMoHinh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy loại mô hình với ID {model_type_id}'
        }, status=404)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON format'
        }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ✅ API XÓA LOẠI MÔ HÌNH
@csrf_exempt
@require_http_methods(["DELETE"])
def delete_model_type(request, model_type_id):
    """
    API xóa loại mô hình
    Endpoint: DELETE /api/model-types/<id>/delete/
    """
    try:
        model_type = LoaiMoHinh.objects.get(id=model_type_id)
        
        # Kiểm tra xem có model nào đang sử dụng không
        usage_count = model_type.mo_hinhs.count()
        if usage_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Không thể xóa. Có {usage_count} mô hình đang sử dụng loại này'
            }, status=400)
        
        # Kiểm tra xem có loại con không
        children_count = LoaiMoHinh.objects.filter(parent=model_type_id).count()
        if children_count > 0:
            return JsonResponse({
                'success': False,
                'error': f'Không thể xóa. Có {children_count} loại mô hình con'
            }, status=400)
        
        loai_cap_nhat = model_type.loai_cap_nhat
        model_type.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Đã xóa loại mô hình "{loai_cap_nhat}"'
        })
        
    except LoaiMoHinh.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': f'Không tìm thấy loại mô hình với ID {model_type_id}'
        }, status=404)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ✅ API LẤY DANH SÁCH PARENT (ĐỂ CHỌN TRONG DROPDOWN)
@csrf_exempt
@require_http_methods(["GET"])
def get_parent_options(request):
    """
    API lấy danh sách parent options cho dropdown
    Endpoint: GET /api/model-types/parent-options/
    """
    try:
        # Lấy tất cả loại mô hình để làm parent options
        model_types = LoaiMoHinh.objects.all().order_by('loai_cap_nhat')
        
        options = [
            {
                'value': mt.id,
                'label': f"{mt.ten_loai_mo_hinh} ({mt.loai_cap_nhat})"
            }
            for mt in model_types
        ]
        
        return JsonResponse({
            'success': True,
            'options': options
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

# ==============================
# API UPLOAD FILE CHO LOẠI MÔ HÌNH (VỚI ĐƯỜNG DẪN TƯƠNG ĐỐI)
# Thêm vào file model_type_api.py hiện tại
# ==============================

# ✅ API UPLOAD FILE GLB/B3DM VÀ TẠO LOẠI MÔ HÌNH MỚI
@csrf_exempt
@require_http_methods(["POST"])
def upload_model_type_file(request):
    """
    API upload file GLB/B3DM và tạo loại mô hình mới
    Endpoint: POST /api/model-types/upload/
    """
    try:
        print("📡 POST /api/model-types/upload/")

        # =========================
        # 1️⃣ LẤY & VALIDATE DATA
        # =========================
        ten_loai_mo_hinh = request.POST.get('ten_loai_mo_hinh', '').strip()
        loai_cap_nhat = request.POST.get('loai_cap_nhat', '').strip()
        parent_raw = request.POST.get('parent')  # CÓ THỂ None / '' / 'null'

        if not ten_loai_mo_hinh:
            return JsonResponse({
                'success': False,
                'error': 'Vui lòng nhập tên loại mô hình'
            }, status=400)

        if not loai_cap_nhat:
            return JsonResponse({
                'success': False,
                'error': 'Vui lòng nhập loại cập nhật'
            }, status=400)

        # =========================
        # 2️⃣ XỬ LÝ PARENT (QUAN TRỌNG)
        # =========================
        parent = None  # ✅ LUÔN KHỞI TẠO

        if parent_raw not in [None, '', 'null']:
            try:
                parent = int(parent_raw)
                LoaiMoHinh.objects.get(id=parent)
            except (ValueError, LoaiMoHinh.DoesNotExist):
                return JsonResponse({
                    'success': False,
                    'error': 'Parent ID không hợp lệ'
                }, status=400)

        # =========================
        # 3️⃣ LẤY FILE
        # =========================
        glb_file = request.FILES.get('glb_file')
        b3dm_file = request.FILES.get('b3dm_file')

        if not glb_file and not b3dm_file:
            return JsonResponse({
                'success': False,
                'error': 'Phải upload ít nhất một file (GLB hoặc B3DM)'
            }, status=400)

        if glb_file and not glb_file.name.lower().endswith('.glb'):
            return JsonResponse({
                'success': False,
                'error': 'File GLB phải có đuôi .glb'
            }, status=400)

        if b3dm_file and not b3dm_file.name.lower().endswith('.b3dm'):
            return JsonResponse({
                'success': False,
                'error': 'File B3DM phải có đuôi .b3dm'
            }, status=400)

        # =========================
        # 4️⃣ LƯU FILE
        # =========================
        model_types_dir = os.path.join(settings.MEDIA_ROOT, 'model_types')
        os.makedirs(model_types_dir, exist_ok=True)

        fs = FileSystemStorage(location=model_types_dir)

        url_glb = None
        url_b3dm = None
        safe_name = loai_cap_nhat.replace(' ', '_').replace('/', '_')

        if glb_file:
            filename = f"{safe_name}_{glb_file.name}"
            saved = fs.save(filename, glb_file)
            url_glb = f"model_types/{saved}"

        if b3dm_file:
            filename = f"{safe_name}_{b3dm_file.name}"
            saved = fs.save(filename, b3dm_file)
            url_b3dm = f"model_types/{saved}"

        # =========================
        # 5️⃣ TẠO RECORD DB
        # =========================
        model_type = LoaiMoHinh.objects.create(
            ten_loai_mo_hinh=ten_loai_mo_hinh,
            loai_cap_nhat=loai_cap_nhat,
            parent=parent,          # ✅ None hoặc int
            url_glb=url_glb,
            url_b3dm=url_b3dm
        )

        print(f"✅ Created model type ID={model_type.id}")

        # =========================
        # 6️⃣ RESPONSE
        # =========================
        return JsonResponse({
            'success': True,
            'message': 'Upload và tạo loại mô hình thành công',
            'data': {
                'id': model_type.id,
                'ten_loai_mo_hinh': model_type.ten_loai_mo_hinh,
                'loai_cap_nhat': model_type.loai_cap_nhat,
                'parent': model_type.parent,
                'url_glb': model_type.url_glb or '',
                'url_b3dm': model_type.url_b3dm or ''
            }
        }, status=201)

    except Exception as e:
        print("❌ Upload error:", str(e))
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': f'Lỗi server: {str(e)}'
        }, status=500)


# ✅ API CẬP NHẬT FILE CHO LOẠI MÔ HÌNH (Upload file mới thay thế)
@csrf_exempt
@require_http_methods(["POST"])
def update_model_type_file(request, model_type_id):
    try:
        model_type = LoaiMoHinh.objects.get(id=model_type_id)

        ten_loai_mo_hinh = request.POST.get('ten_loai_mo_hinh', '').strip()
        loai_cap_nhat = request.POST.get('loai_cap_nhat', '').strip()
        parent = request.POST.get('parent', None)

        if not loai_cap_nhat:
            return JsonResponse({'success': False, 'error': 'Loại cập nhật bắt buộc'}, status=400)

        model_type.loai_cap_nhat = loai_cap_nhat
        if ten_loai_mo_hinh:
            model_type.ten_loai_mo_hinh = ten_loai_mo_hinh

        if parent in [None, '', 'null']:
            model_type.parent = None
        else:
            model_type.parent = int(parent)
        storage = FileSystemStorage(location=settings.MEDIA_ROOT)

        if 'glb_file' in request.FILES:
            glb_file = request.FILES['glb_file']
            glb_path = storage.save(f"model_types/{glb_file.name}", glb_file)
            model_type.url_glb = glb_path

        if 'b3dm_file' in request.FILES:
            b3dm_file = request.FILES['b3dm_file']
            b3dm_path = storage.save(f"model_types/{b3dm_file.name}", b3dm_file)
            model_type.url_b3dm = b3dm_path

        if not model_type.url_glb and not model_type.url_b3dm:
            return JsonResponse({'success': False, 'error': 'Phải có GLB hoặc B3DM'}, status=400)

        model_type.save()

        return JsonResponse({
            'success': True,
            'message': 'Cập nhật loại mô hình thành công'
        })

    except LoaiMoHinh.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Không tồn tại'}, status=404)
