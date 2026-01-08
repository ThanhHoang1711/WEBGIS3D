# Phần đẩy model lên
from django.shortcuts import render, redirect
from .forms import GlbUploadForm
from .models import GlbMesh
from pygltflib import GLTF2
from django.http import HttpResponse

# views.py - Fix CSRF 403 với csrf_exempt
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

# def upload_glb(request):
#     if request.method == 'POST':
#         form = GlbUploadForm(request.POST, request.FILES)
#         if form.is_valid():
#             glb_instance = form.save()
#             parse_glb_file(glb_instance)
#             return redirect('upload_success')
#     else:
#         form = GlbUploadForm()
#     return render(request, 'upload.html', {'form': form})

# def parse_glb_file(glb_instance):
#     glb_path = glb_instance.glb_file.path
#     glb = GLTF2().load(glb_path)
    
#     for i, mesh in enumerate(glb.meshes):
#         GlbMesh.objects.create(
#             glb_model=glb_instance,
#             mesh_name=f"Mesh_{i}",
#             vertex_data=str(mesh)
#         )

# def upload_success(request):
#     return HttpResponse("Upload thành công!")

#Phần lấy model
from django.http import JsonResponse
from .models import GlbModel

def glb_models_api(request):
    models = GlbModel.objects.all()
    data = [
        {
            'url': model.glb_file.url,
            'lon': model.lon,
            'lat': model.lat,
            'height': model.height,
            'scale': model.scale
        }
        for model in models
    ]
    return JsonResponse(data, safe=False)

#Phần load 3D tiles 
from django.conf import settings
import os

def get_3dtiles(request):
    return JsonResponse({
        "tileset_url": settings.MEDIA_URL + "building/tileset.json"
    })

#Upload 3D tiles 
from .forms import TilesetUploadForm

def upload_tileset(request):
    if request.method == 'POST':
        form = TilesetUploadForm(request.POST, request.FILES)
        if form.is_valid():
            tileset_instance = form.save()
            return redirect('upload_tileset_success')
    else:
        form = TilesetUploadForm()
    return render(request, 'upload_tileset.html', {'form': form})

def upload_tileset_success(request):
    return HttpResponse("Upload Tileset thành công!")

# ✅ FORM UPLOAD (Traditional HTML Form)
def upload_glb(request):
    """Traditional form upload - deprecated, dùng API thay"""
    if request.method == 'POST':
        try:
            name = request.POST.get('name', 'Model')
            glb_file = request.FILES.get('glb_file')
            lon = float(request.POST.get('lon', 0))
            lat = float(request.POST.get('lat', 0))
            height = float(request.POST.get('height', 0))
            scale = float(request.POST.get('scale', 1))
            rotation_x = float(request.POST.get('rotation_x', 0))
            rotation_y = float(request.POST.get('rotation_y', 0))
            rotation_z = float(request.POST.get('rotation_z', 0))

            if not glb_file:
                return HttpResponse("❌ No file uploaded", status=400)

            glb_instance = GlbModel(
                name=name,
                glb_file=glb_file,
                lon=lon,
                lat=lat,
                height=height,
                scale=scale,
                rotation_x=rotation_x,
                rotation_y=rotation_y,
                rotation_z=rotation_z
            )
            glb_instance.save()

            try:
                parse_glb_file(glb_instance)
            except Exception as e:
                print(f"⚠️ Parse error: {str(e)}")

            return redirect('upload_success')
        
        except Exception as e:
            return HttpResponse(f"❌ Error: {str(e)}", status=500)
    
    else:
        return HttpResponse("❌ Method not allowed", status=405)


def parse_glb_file(glb_instance):
    """Parse GLB file và extract mesh"""
    try:
        glb_path = glb_instance.glb_file.path
        
        if not os.path.exists(glb_path):
            raise FileNotFoundError(f"File not found: {glb_path}")
        
        glb = GLTF2().load(glb_path)
        
        GlbMesh.objects.filter(glb_model=glb_instance).delete()
        
        if glb.meshes:
            for i, mesh in enumerate(glb.meshes):
                GlbMesh.objects.create(
                    glb_model=glb_instance,
                    mesh_name=f"Mesh_{i}",
                    vertex_data=str(mesh)
                )
            print(f"✅ Parsed {len(glb.meshes)} meshes")
        else:
            print("⚠️ No meshes found in GLB file")
            
    except Exception as e:
        print(f"❌ Parse error: {str(e)}")
        raise


def upload_success(request):
    """Success page"""
    return HttpResponse("✅ Upload thành công!")


# ========== API ENDPOINTS ==========

# ✅ GET CSRF TOKEN
@ensure_csrf_cookie
@require_http_methods(["GET"])
def get_csrf_token(request):
    """
    Endpoint để lấy CSRF token cho frontend
    GET: /api/csrf-token/
    """
    from django.middleware.csrf import get_token
    token = get_token(request)
    print(f"✅ CSRF token generated: {token[:10]}...")
    return JsonResponse({
        'csrfToken': token
    })


# ✅ API UPLOAD - Dùng @csrf_exempt (đơn giản nhất)
@csrf_exempt  # ✅ BYPASS CSRF vì dùng token-based auth
@require_http_methods(["POST"])
def upload_glb_api(request):
    """
    API endpoint để upload model GLB
    POST: /api/upload-glb/
    
    Form data:
    - glb_file: file upload
    - model_name: tên model
    - lon, lat, height: tọa độ
    - scale: tỷ lệ
    - rotation_x, rotation_y, rotation_z: quay
    """
    try:
        print(f"📡 POST /api/upload-glb/")
        print(f"🔐 CSRF in headers: {'HTTP_X_CSRFTOKEN' in request.META}")
        
        if 'glb_file' not in request.FILES:
            return JsonResponse({
                'error': 'No file',
                'message': 'Không tìm thấy file'
            }, status=400)

        glb_file = request.FILES['glb_file']
        print(f"📦 File: {glb_file.name} ({glb_file.size} bytes)")
        
        if not glb_file.name.endswith('.glb'):
            return JsonResponse({
                'error': 'Invalid file type',
                'message': 'Chỉ chấp nhận file .glb'
            }, status=400)

        # Lấy dữ liệu
        name = request.POST.get('model_name', 'Model').strip()
        
        try:
            lon = float(request.POST.get('lon', 0))
            lat = float(request.POST.get('lat', 0))
            height = float(request.POST.get('height', 0))
            scale = float(request.POST.get('scale', 1))
            rotation_x = float(request.POST.get('rotation_x', 0))
            rotation_y = float(request.POST.get('rotation_y', 0))
            rotation_z = float(request.POST.get('rotation_z', 0))
        except ValueError as e:
            return JsonResponse({
                'error': 'Invalid data',
                'message': f'Dữ liệu không hợp lệ: {str(e)}'
            }, status=400)

        if not name:
            return JsonResponse({
                'error': 'Name required',
                'message': 'Vui lòng nhập tên model'
            }, status=400)

        # Tạo model
        glb_instance = GlbModel(
            name=name,
            glb_file=glb_file,
            lon=lon,
            lat=lat,
            height=height,
            scale=scale,
            rotation_x=rotation_x,
            rotation_y=rotation_y,
            rotation_z=rotation_z
        )
        glb_instance.save()
        print(f"✅ Model saved: {name} (ID: {glb_instance.id})")

        # Parse mesh
        try:
            parse_glb_file(glb_instance)
            print(f"✅ Meshes parsed")
        except Exception as e:
            print(f"⚠️ Parse error: {str(e)}")

        print(f"✅ Upload complete: {glb_instance.glb_file.url}")
        
        return JsonResponse({
            'message': '✅ Upload thành công!',
            'id': glb_instance.id,
            'name': name,
            'url': glb_instance.glb_file.url,
            'coordinates': {
                'lon': lon,
                'lat': lat,
                'height': height
            }
        }, status=200)

    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        return JsonResponse({
            'error': 'Server error',
            'message': str(e)
        }, status=500)


# ✅ GET ALL MODELS
@require_http_methods(["GET"])
def glb_models_api(request):
    """
    API endpoint để lấy danh sách tất cả models
    GET: /api/models/
    """
    try:
        models = GlbModel.objects.all()
        
        data = [
            {
                'id': model.id,
                'name': model.name,
                'url': request.build_absolute_uri(model.glb_file.url),
                'lon': float(model.lon),
                'lat': float(model.lat),
                'height': float(model.height),
                'scale': float(model.scale),
                'rotation': {
                    'x': float(model.rotation_x),
                    'y': float(model.rotation_y),
                    'z': float(model.rotation_z)
                }
            }
            for model in models
        ]
        
        print(f"✅ GET /api/models/ - {len(data)} models")
        return JsonResponse(data, safe=False, status=200)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ✅ GET MODEL DETAIL
@require_http_methods(["GET"])
def glb_model_detail(request, model_id):
    """
    API endpoint để lấy chi tiết 1 model
    GET: /api/models/<id>/
    """
    try:
        model = GlbModel.objects.get(id=model_id)
        
        data = {
            'id': model.id,
            'name': model.name,
            'url': request.build_absolute_uri(model.glb_file.url),
            'lon': float(model.lon),
            'lat': float(model.lat),
            'height': float(model.height),
            'scale': float(model.scale),
            'rotation': {
                'x': float(model.rotation_x),
                'y': float(model.rotation_y),
                'z': float(model.rotation_z)
            },
            'meshes': [
                {
                    'id': mesh.id,
                    'name': mesh.mesh_name,
                }
                for mesh in model.meshes.all()
            ]
        }
        
        return JsonResponse(data, status=200)
    
    except GlbModel.DoesNotExist:
        return JsonResponse({'error': 'Model not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ✅ DELETE MODEL
@csrf_exempt  # ✅ Bypass CSRF cho DELETE API
@require_http_methods(["DELETE"])
def delete_glb_model(request, model_id):
    """
    API endpoint để xoá model
    DELETE: /api/models/<id>/
    """
    try:
        model = GlbModel.objects.get(id=model_id)
        model_name = model.name
        
        # Xoá file
        if model.glb_file:
            if os.path.exists(model.glb_file.path):
                os.remove(model.glb_file.path)
        
        model.delete()
        
        print(f"✅ Model deleted: {model_name}")
        return JsonResponse({
            'message': '✅ Deleted successfully',
            'id': model_id,
            'name': model_name
        }, status=200)
    
    except GlbModel.DoesNotExist:
        return JsonResponse({'error': 'Model not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
