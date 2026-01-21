from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('glb_app.urls')),
    path('api/i3dm/', include('i3dm_app.urls')),
    path('QLModel/', include('QLModel.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
