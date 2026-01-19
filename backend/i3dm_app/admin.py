from django.contrib import admin
from .models import I3DMTileset

@admin.register(I3DMTileset)
class I3DMTilesetAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'source_model', 'count', 'created_at']
    list_filter = ['source_model', 'created_at']
    search_fields = ['name', 'source_model__name']
    readonly_fields = ['created_at', 'file_size']
    
    fieldsets = (
        ('General', {
            'fields': ('name', 'source_model', 'count')
        }),
        ('Bounding Box', {
            'fields': (
                ('min_lon', 'max_lon'),
                ('min_lat', 'max_lat')
            )
        }),
        ('Transform', {
            'fields': ('height', 'scale')
        }),
        ('Files', {
            'fields': ('tileset_file', 'i3dm_file', 'file_size')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        })
    )