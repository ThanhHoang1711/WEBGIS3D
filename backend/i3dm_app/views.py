import json
import random
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from pathlib import Path
import hashlib
import time
from .i3dm_generator import I3DMGenerator
from .models import I3DMTileset
from glb_app.models import GlbModel
from .terrain_helper import query_terrain_height_batch, get_terrain_samples_for_bbox


@csrf_exempt
@require_http_methods(["POST"])
def generate_i3dm_tileset(request):
    """
    API endpoint để tạo I3DM tileset - VERSION CỦI với TERRAIN CLAMPING
    
    Request body:
    {
        "model_id": 1,
        "bbox": {
            "min_lon": 105.0,
            "max_lon": 105.1,
            "min_lat": 21.0,
            "max_lat": 21.1
        },
        "count": 100,
        "height": 0,  // Offset từ mặt đất (m)
        "scale": 1.0
    }
    """
    try:
        data = json.loads(request.body)
        
        model_id = data.get('model_id')
        bbox = data.get('bbox')
        count = int(data.get('count', 100))
        height_offset = float(data.get('height', 0))  # Offset từ terrain
        scale = float(data.get('scale', 1.0))
        
        print(f"\n NEW REQUEST")
        print(f"={'='*60}")
        print(f"Model ID: {model_id}")
        print(f"Count: {count}")
        print(f"Height offset: {height_offset}m")
        print(f"Scale: {scale}x")
        
        # Validation
        if not model_id:
            return JsonResponse({
                'success': False,
                'error': 'model_id is required'
            }, status=400)
        
        if not bbox:
            return JsonResponse({
                'success': False,
                'error': 'bbox is required'
            }, status=400)
        
        required_bbox_keys = ['min_lon', 'max_lon', 'min_lat', 'max_lat']
        if not all(key in bbox for key in required_bbox_keys):
            return JsonResponse({
                'success': False,
                'error': f'bbox must contain: {required_bbox_keys}'
            }, status=400)
        
        if count < 1 or count > 10000:
            return JsonResponse({
                'success': False,
                'error': 'count must be between 1 and 10000'
            }, status=400)
        
        # Get model from database
        try:
            model = GlbModel.objects.get(id=model_id)
            print(f"✅ Found model: {model.name}")
        except GlbModel.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Model with id {model_id} not found'
            }, status=404)
        
        # Extract bbox coordinates
        min_lon = float(bbox['min_lon'])
        max_lon = float(bbox['max_lon'])
        min_lat = float(bbox['min_lat'])
        max_lat = float(bbox['max_lat'])
        
        # Validate bbox
        if min_lon >= max_lon or min_lat >= max_lat:
            return JsonResponse({
                'success': False,
                'error': 'Invalid bbox: min values must be less than max values'
            }, status=400)
        
        print(f"📍 BBox: [{min_lon}, {min_lat}] → [{max_lon}, {max_lat}]")
        
        # 🔥🔥🔥 BƯỚC QUAN TRỌNG: Generate positions + Query terrain
        print(f"\n⏳ Generating {count} positions with terrain heights...")
        
        coordinates = []
        for _ in range(count):
            lon = random.uniform(min_lon, max_lon)
            lat = random.uniform(min_lat, max_lat)
            coordinates.append((lon, lat))
        
        # Query terrain heights
        print(f"🌍 Querying terrain heights...")
        terrain_heights = query_terrain_height_batch(coordinates)
        
        # Build instances với terrain heights - KHÔNG CÓ ROTATION
        instances = []
        for i, ((lon, lat), terrain_h) in enumerate(zip(coordinates, terrain_heights)):
            final_height = terrain_h + height_offset
            
            instances.append({
                'lon': lon,
                'lat': lat,
                'height': final_height,  # ✅ Absolute height
                'scale': scale,
                # ❌ KHÔNG CÓ rotation_z - model tự đứng thẳng
            })
            
            if (i + 1) % 100 == 0:
                print(f"  ✓ Processed {i + 1}/{count}")
        
        print(f"✅ Generated {len(instances)} instances (NO ROTATION)")
        print(f"   Terrain heights: {min(terrain_heights):.2f}m → {max(terrain_heights):.2f}m")
        
        # Create unique filenames
        import hashlib
        import time
        unique_id = hashlib.md5(
            f"{model_id}_{count}_{time.time()}".encode()
        ).hexdigest()[:8]
        
        i3dm_filename = f'instances_{model_id}_{count}_{unique_id}.i3dm'
        tileset_filename = f'tileset_{model_id}_{count}_{unique_id}.json'
        
        # Paths
        i3dm_dir = Path(settings.MEDIA_ROOT) / 'i3dm'
        i3dm_dir.mkdir(parents=True, exist_ok=True)
        
        i3dm_path = i3dm_dir / i3dm_filename
        tileset_path = i3dm_dir / tileset_filename
        
        # Get GLB file path
        glb_path = model.glb_file.path
        print(f"📦 Using GLB: {glb_path}")
        
        # Generate I3DM
        print(f"⚙️  Generating I3DM file...")
        generator = I3DMGenerator(glb_path)
        generator.generate_i3dm(instances, i3dm_path)
        
        # Generate tileset.json
        print(f"⚙️  Generating tileset.json...")
        I3DMGenerator.create_tileset_json(
            instances,
            i3dm_filename,
            tileset_path
        )
        
        # Save to database
        tileset_record = I3DMTileset.objects.create(
            source_model=model,
            name=f"{model.name} - {count} instances",
            count=count,
            min_lon=min_lon,
            max_lon=max_lon,
            min_lat=min_lat,
            max_lat=max_lat,
            height=height_offset,
            scale=scale,
            tileset_file=tileset_filename,
            i3dm_file=i3dm_filename
        )
        print(f"💾 Saved to database: ID={tileset_record.id}")
        
        # Return URLs
        tileset_url = f'/media/i3dm/{tileset_filename}'
        i3dm_url = f'/media/i3dm/{i3dm_filename}'
        
        print(f"\n✅ SUCCESS!")
        print(f"   Tileset URL: {tileset_url}")
        print(f"   I3DM URL: {i3dm_url}")
        print(f"={'='*60}\n")
        
        return JsonResponse({
            'success': True,
            'id': tileset_record.id,
            'count': count,
            'tileset_url': tileset_url,
            'i3dm_url': i3dm_url,
            'model_name': model.name,
            'message': f'Successfully created {count} instances with terrain clamping (NO ROTATION)'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request body'
        }, status=400)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def list_i3dm_tilesets(request):
    """
    List all generated I3DM tilesets từ DATABASE
    """
    try:
        tilesets = I3DMTileset.objects.select_related('source_model').all()
        
        data = [
            {
                'id': ts.id,
                'name': ts.name,
                'source_model': {
                    'id': ts.source_model.id,
                    'name': ts.source_model.name
                },
                'count': ts.count,
                'bbox': {
                    'min_lon': ts.min_lon,
                    'max_lon': ts.max_lon,
                    'min_lat': ts.min_lat,
                    'max_lat': ts.max_lat
                },
                'height': ts.height,
                'scale': ts.scale,
                'tileset_url': f'/media/i3dm/{ts.tileset_file}',
                'i3dm_url': f'/media/i3dm/{ts.i3dm_file}',
                'file_size': ts.file_size,
                'created_at': ts.created_at.isoformat()
            }
            for ts in tilesets
        ]
        
        print(f"✅ Listed {len(data)} tilesets from database")
        
        return JsonResponse({
            'success': True,
            'count': len(data),
            'tilesets': data
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_i3dm_tileset_detail(request, tileset_id):
    """
    Get chi tiết 1 tileset từ database
    GET: /api/i3dm/<id>/
    """
    try:
        tileset = I3DMTileset.objects.select_related('source_model').get(id=tileset_id)
        
        data = {
            'id': tileset.id,
            'name': tileset.name,
            'source_model': {
                'id': tileset.source_model.id,
                'name': tileset.source_model.name,
                'url': tileset.source_model.glb_file.url
            },
            'count': tileset.count,
            'bbox': {
                'min_lon': tileset.min_lon,
                'max_lon': tileset.max_lon,
                'min_lat': tileset.min_lat,
                'max_lat': tileset.max_lat
            },
            'height': tileset.height,
            'scale': tileset.scale,
            'tileset_url': f'/media/i3dm/{tileset.tileset_file}',
            'i3dm_url': f'/media/i3dm/{tileset.i3dm_file}',
            'file_size': tileset.file_size,
            'created_at': tileset.created_at.isoformat()
        }
        
        return JsonResponse({
            'success': True,
            'tileset': data
        })
        
    except I3DMTileset.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Tileset not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_i3dm_tileset(request, tileset_id):
    """
    Delete I3DM tileset từ database (tự động xóa files)
    DELETE: /api/i3dm/delete/<id>/
    """
    try:
        tileset = I3DMTileset.objects.get(id=tileset_id)
        name = tileset.name
        
        print(f"🗑️ Deleting tileset: {name}")
        
        tileset.delete()
        
        print(f"✅ Deleted tileset: {name}")
        
        return JsonResponse({
            'success': True,
            'message': f'Tileset "{name}" deleted successfully'
        })
        
    except I3DMTileset.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Tileset not found'
        }, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_tilesets_by_model(request, model_id):
    """
    Get tất cả tilesets của 1 model cụ thể
    GET: /api/i3dm/by-model/<model_id>/
    """
    try:
        tilesets = I3DMTileset.objects.filter(source_model_id=model_id)
        
        data = [
            {
                'id': ts.id,
                'name': ts.name,
                'count': ts.count,
                'tileset_url': f'/media/i3dm/{ts.tileset_file}',
                'created_at': ts.created_at.isoformat()
            }
            for ts in tilesets
        ]
        
        return JsonResponse({
            'success': True,
            'model_id': model_id,
            'count': len(data),
            'tilesets': data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def cleanup_orphan_files(request):
    """
    Xóa các files i3dm không có trong database
    POST: /api/i3dm/cleanup/
    """
    try:
        i3dm_dir = Path(settings.MEDIA_ROOT) / 'i3dm'
        
        if not i3dm_dir.exists():
            return JsonResponse({
                'success': True,
                'message': 'No i3dm directory found',
                'deleted': 0
            })
        
        all_i3dm_files = set(f.name for f in i3dm_dir.glob('instances_*.i3dm'))
        all_tileset_files = set(f.name for f in i3dm_dir.glob('tileset_*.json'))
        
        db_i3dm_files = set(I3DMTileset.objects.values_list('i3dm_file', flat=True))
        db_tileset_files = set(I3DMTileset.objects.values_list('tileset_file', flat=True))
        
        orphan_i3dm = all_i3dm_files - db_i3dm_files
        orphan_tileset = all_tileset_files - db_tileset_files
        
        deleted_count = 0
        for filename in orphan_i3dm:
            file_path = i3dm_dir / filename
            file_path.unlink()
            deleted_count += 1
            print(f"🗑️ Deleted orphan: {filename}")
        
        for filename in orphan_tileset:
            file_path = i3dm_dir / filename
            file_path.unlink()
            deleted_count += 1
            print(f"🗑️ Deleted orphan: {filename}")
        
        return JsonResponse({
            'success': True,
            'message': f'Cleaned up {deleted_count} orphan files',
            'deleted': deleted_count,
            'orphan_i3dm': list(orphan_i3dm),
            'orphan_tileset': list(orphan_tileset)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def generate_i3dm_from_points(request):
    """
    ✅ NEW API: Tạo I3DM từ danh sách điểm đã có độ cao thực - KHÔNG ROTATION
    
    Request body:
    {
        "model_id": 1,
        "instances": [
            {
                "lon": 105.123456,
                "lat": 21.234567,
                "height": 15.5,  // Độ cao thực từ pickPosition
                "scale": 1.0
                // ❌ KHÔNG CÓ rotation_z - model tự đứng thẳng
            },
            ...
        ]
    }
    """
    try:
        data = json.loads(request.body)
        
        model_id = data.get('model_id')
        instances = data.get('instances', [])
        
        print(f"\n🔥 NEW REQUEST - POINT-BASED I3DM (NO ROTATION)")
        print(f"={'='*60}")
        print(f"Model ID: {model_id}")
        print(f"Points count: {len(instances)}")
        
        # Validation
        if not model_id:
            return JsonResponse({
                'success': False,
                'error': 'model_id is required'
            }, status=400)
        
        if not instances or len(instances) == 0:
            return JsonResponse({
                'success': False,
                'error': 'instances list is empty'
            }, status=400)
        
        if len(instances) > 10000:
            return JsonResponse({
                'success': False,
                'error': 'Maximum 10,000 instances allowed'
            }, status=400)
        
        # Get model from database
        try:
            model = GlbModel.objects.get(id=model_id)
            print(f"✅ Found model: {model.name}")
        except GlbModel.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Model with id {model_id} not found'
            }, status=404)
        
        # Validate each instance - CHỈ CẦN 3 KEY, KHÔNG CẦN rotation_z
        for i, inst in enumerate(instances):
            required_keys = ['lon', 'lat', 'height']
            if not all(key in inst for key in required_keys):
                return JsonResponse({
                    'success': False,
                    'error': f'Instance {i} missing required keys: {required_keys}'
                }, status=400)
        
        # Calculate bbox from points
        lons = [inst['lon'] for inst in instances]
        lats = [inst['lat'] for inst in instances]
        heights = [inst['height'] for inst in instances]
        
        min_lon = min(lons)
        max_lon = max(lons)
        min_lat = min(lats)
        max_lat = max(lats)
        
        avg_height = sum(heights) / len(heights)
        avg_scale = sum(inst.get('scale', 1.0) for inst in instances) / len(instances)
        
        print(f"📍 BBox: [{min_lon:.6f}, {min_lat:.6f}] → [{max_lon:.6f}, {max_lat:.6f}]")
        print(f"📊 Heights: {min(heights):.2f}m → {max(heights):.2f}m (avg: {avg_height:.2f}m)")
        print(f"📏 Scales: {avg_scale:.2f}x average")
        
        # Log first 3 instances - KHÔNG LOG rotation_z
        for i, inst in enumerate(instances[:3]):
            print(f"\n📍 Instance {i+1}:")
            print(f"   Position: {inst['lon']:.6f}, {inst['lat']:.6f}")
            print(f"   Height: {inst['height']:.2f}m (REAL HEIGHT from pickPosition)")
            print(f"   Scale: {inst.get('scale', 1.0):.2f}x")
            print(f"   ✅ NO ROTATION - Model tự đứng thẳng")
        
        if len(instances) > 3:
            print(f"\n... and {len(instances) - 3} more instances")
        
        # Create unique filenames
        unique_id = hashlib.md5(
            f"{model_id}_{len(instances)}_{time.time()}".encode()
        ).hexdigest()[:8]
        
        i3dm_filename = f'instances_{model_id}_{len(instances)}_{unique_id}.i3dm'
        tileset_filename = f'tileset_{model_id}_{len(instances)}_{unique_id}.json'
        
        # Paths
        i3dm_dir = Path(settings.MEDIA_ROOT) / 'i3dm'
        i3dm_dir.mkdir(parents=True, exist_ok=True)
        
        i3dm_path = i3dm_dir / i3dm_filename
        tileset_path = i3dm_dir / tileset_filename
        
        # Get GLB file path
        glb_path = model.glb_file.path
        print(f"📦 Using GLB: {glb_path}")
        
        # Generate I3DM
        print(f"⚙️  Generating I3DM file (NO ROTATION)...")
        generator = I3DMGenerator(glb_path, debug=True)
        generator.generate_i3dm(instances, i3dm_path)
        
        # Generate tileset.json
        print(f"⚙️  Generating tileset.json...")
        I3DMGenerator.create_tileset_json(
            instances,
            i3dm_filename,
            tileset_path
        )
        
        # Save to database
        tileset_record = I3DMTileset.objects.create(
            source_model=model,
            name=f"{model.name} - {len(instances)} instances (point-based, NO ROTATION)",
            count=len(instances),
            min_lon=min_lon,
            max_lon=max_lon,
            min_lat=min_lat,
            max_lat=max_lat,
            height=avg_height,
            scale=avg_scale,
            tileset_file=tileset_filename,
            i3dm_file=i3dm_filename
        )
        print(f"💾 Saved to database: ID={tileset_record.id}")
        
        # Return URLs
        tileset_url = f'/media/i3dm/{tileset_filename}'
        i3dm_url = f'/media/i3dm/{i3dm_filename}'
        
        print(f"\n✅ SUCCESS!")
        print(f"   Tileset URL: {tileset_url}")
        print(f"   I3DM URL: {i3dm_url}")
        print(f"   Total instances: {len(instances)} (NO ROTATION)")
        print(f"={'='*60}\n")
        
        return JsonResponse({
            'success': True,
            'id': tileset_record.id,
            'count': len(instances),
            'tileset_url': tileset_url,
            'i3dm_url': i3dm_url,
            'model_name': model.name,
            'message': f'Successfully created {len(instances)} instances with real terrain heights (NO ROTATION)'
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request body'
        }, status=400)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def generate_i3dm_from_upload(request):
    """
    ✅ NEW API: Tạo I3DM từ file GLB upload + danh sách điểm - KHÔNG ROTATION
    
    Request:
    - FormData với:
      - glb_file: File GLB
      - instances: JSON string của array điểm
    """
    try:
        # Get uploaded file
        glb_file = request.FILES.get('glb_file')
        if not glb_file:
            return JsonResponse({
                'success': False,
                'error': 'No GLB file uploaded'
            }, status=400)
        
        # Validate file extension
        if not glb_file.name.lower().endswith('.glb'):
            return JsonResponse({
                'success': False,
                'error': 'Only .glb files are allowed'
            }, status=400)
        
        # Get instances data
        instances_json = request.POST.get('instances')
        if not instances_json:
            return JsonResponse({
                'success': False,
                'error': 'instances data is required'
            }, status=400)
        
        try:
            instances = json.loads(instances_json)
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON in instances data'
            }, status=400)
        
        if not instances or len(instances) == 0:
            return JsonResponse({
                'success': False,
                'error': 'instances list is empty'
            }, status=400)
        
        if len(instances) > 10000:
            return JsonResponse({
                'success': False,
                'error': 'Maximum 10,000 instances allowed'
            }, status=400)
        
        print(f"\n🔥 NEW REQUEST - UPLOAD-BASED I3DM (NO ROTATION)")
        print(f"={'='*60}")
        print(f"File: {glb_file.name}")
        print(f"File size: {glb_file.size:,} bytes")
        print(f"Points count: {len(instances)}")
        
        # Validate each instance - CHỈ CẦN 3 KEY, KHÔNG CẦN rotation
        for i, inst in enumerate(instances):
            required_keys = ['lon', 'lat', 'height']
            if not all(key in inst for key in required_keys):
                return JsonResponse({
                    'success': False,
                    'error': f'Instance {i} missing required keys: {required_keys}'
                }, status=400)
        
        # Calculate bbox from points
        lons = [inst['lon'] for inst in instances]
        lats = [inst['lat'] for inst in instances]
        heights = [inst['height'] for inst in instances]
        
        min_lon = min(lons)
        max_lon = max(lons)
        min_lat = min(lats)
        max_lat = max(lats)
        
        avg_height = sum(heights) / len(heights)
        avg_scale = sum(inst.get('scale', 1.0) for inst in instances) / len(instances)
        
        print(f"📍 BBox: [{min_lon:.6f}, {min_lat:.6f}] → [{max_lon:.6f}, {max_lat:.6f}]")
        print(f"📊 Heights: {min(heights):.2f}m → {max(heights):.2f}m (avg: {avg_height:.2f}m)")
        print(f"📏 Average scale: {avg_scale:.2f}x")
        
        # Save uploaded GLB to temporary location
        temp_dir = Path(settings.MEDIA_ROOT) / 'temp_uploads'
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        temp_glb_filename = f'temp_{int(time.time())}_{glb_file.name}'
        temp_glb_path = temp_dir / temp_glb_filename
        
        # Write uploaded file
        with open(temp_glb_path, 'wb+') as destination:
            for chunk in glb_file.chunks():
                destination.write(chunk)
        
        print(f"💾 Saved temp GLB: {temp_glb_path}")
        
        # Create unique filenames for I3DM
        unique_id = hashlib.md5(
            f"{glb_file.name}_{len(instances)}_{time.time()}".encode()
        ).hexdigest()[:8]
        
        i3dm_filename = f'instances_upload_{len(instances)}_{unique_id}.i3dm'
        tileset_filename = f'tileset_upload_{len(instances)}_{unique_id}.json'
        
        # Paths
        i3dm_dir = Path(settings.MEDIA_ROOT) / 'i3dm'
        i3dm_dir.mkdir(parents=True, exist_ok=True)
        
        i3dm_path = i3dm_dir / i3dm_filename
        tileset_path = i3dm_dir / tileset_filename
        
        # Generate I3DM
        print(f"⚙️  Generating I3DM file from uploaded GLB (NO ROTATION)...")
        generator = I3DMGenerator(str(temp_glb_path), debug=True)
        generator.generate_i3dm(instances, i3dm_path)
        
        # Generate tileset.json
        print(f"⚙️  Generating tileset.json...")
        I3DMGenerator.create_tileset_json(
            instances,
            i3dm_filename,
            tileset_path
        )
        
        # Create a temporary GlbModel record (optional - for tracking)
        # Or save as I3DMTileset without source_model
        tileset_record = I3DMTileset.objects.create(
            source_model=None,  # No source model for uploads
            name=f"{glb_file.name} - {len(instances)} instances (uploaded, NO ROTATION)",
            count=len(instances),
            min_lon=min_lon,
            max_lon=max_lon,
            min_lat=min_lat,
            max_lat=max_lat,
            height=avg_height,
            scale=avg_scale,
            tileset_file=tileset_filename,
            i3dm_file=i3dm_filename
        )
        print(f"💾 Saved to database: ID={tileset_record.id}")
        
        # Clean up temp file
        try:
            temp_glb_path.unlink()
            print(f"🗑️ Cleaned up temp GLB file")
        except Exception as e:
            print(f"⚠️ Could not delete temp file: {e}")
        
        # Return URLs
        tileset_url = f'/media/i3dm/{tileset_filename}'
        i3dm_url = f'/media/i3dm/{i3dm_filename}'
        
        print(f"\n✅ SUCCESS!")
        print(f"   Tileset URL: {tileset_url}")
        print(f"   I3DM URL: {i3dm_url}")
        print(f"   Total instances: {len(instances)} (NO ROTATION)")
        print(f"={'='*60}\n")
        
        return JsonResponse({
            'success': True,
            'id': tileset_record.id,
            'count': len(instances),
            'tileset_url': tileset_url,
            'i3dm_url': i3dm_url,
            'model_name': glb_file.name,
            'message': f'Successfully created {len(instances)} instances from uploaded file (NO ROTATION)'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)