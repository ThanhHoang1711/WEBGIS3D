<template>
  <div class="model-type-manager">
    <!-- Split Screen Container -->
    <div class="split-container">
      
      <!-- LEFT PANEL: Data Table -->
      <div class="left-panel">
        <div class="panel-header">
          <h2>📋 Quản Lý Loại Mô Hình</h2>
          
          <!-- Action Buttons -->
          <div class="action-buttons">
            <button @click="showAddDialog" class="btn btn-primary">
              ➕ Thêm Mới
            </button>
            <button @click="refreshData" class="btn btn-secondary">
              🔄 Làm Mới
            </button>
          </div>
        </div>

        <!-- Search & Filter -->
        <div class="filter-section">
          <input 
            v-model="searchQuery" 
            @input="handleSearch"
            type="text" 
            placeholder="🔍 Tìm kiếm theo loại mô hình hoặc tên..."
            class="search-input"
          />
          
          <select v-model="parentFilter" @change="handleFilterChange" class="filter-select">
            <option value="">Tất cả Parent</option>
            <option value="null">Không có Parent</option>
            <option v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Data Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>URL GLB</th>
                <th>URL B3DM</th>
                <th>Parent</th>
                <th>Loại Cập Nhật</th>
                <th>Tên Loại Mô Hình</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="loading-cell">
                  ⏳ Đang tải dữ liệu...
                </td>
              </tr>
              <tr v-else-if="modelTypes.length === 0">
                <td colspan="7" class="empty-cell">
                  📭 Không có dữ liệu
                </td>
              </tr>
              <tr 
                v-else 
                v-for="item in modelTypes" 
                :key="item.id"
                :class="{ 'selected-row': selectedModelType && selectedModelType.id === item.id }"
              >
                <td>{{ item.id }}</td>
                <td class="url-cell" :title="item.url_glb">
                  {{ truncateUrl(item.url_glb) }}
                </td>
                <td class="url-cell" :title="item.url_b3dm">
                  {{ truncateUrl(item.url_b3dm) }}
                </td>
                <td>{{ item.parent || '-' }}</td>
                <td>{{ item.loai_cap_nhat }}</td>
                <td>{{ item.ten_loai_mo_hinh || '-' }}</td>
                <td class="action-cell">
                  <button 
                    @click="viewModelDetail(item)" 
                    class="btn-action btn-view"
                    :disabled="!item.url_glb"
                    :title="item.url_glb ? 'Xem mô hình 3D' : 'Không có URL GLB'"
                  >
                    👁️ Xem
                  </button>
                  <button 
                    @click="showEditDialog(item)" 
                    class="btn-action btn-edit"
                  >
                    ✏️ Sửa
                  </button>
                  <button 
                    @click="confirmDelete(item)" 
                    class="btn-action btn-delete"
                  >
                    🗑️ Xóa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination" v-if="pagination.total_pages > 1">
          <button 
            @click="goToPage(pagination.page - 1)"
            :disabled="!pagination.has_previous"
            class="btn-page"
          >
            ◀ Trước
          </button>
          
          <span class="page-info">
            Trang {{ pagination.page }} / {{ pagination.total_pages }}
            (Tổng: {{ pagination.total_items }} mục)
          </span>
          
          <button 
            @click="goToPage(pagination.page + 1)"
            :disabled="!pagination.has_next"
            class="btn-page"
          >
            Sau ▶
          </button>
        </div>
      </div>

      <!-- RIGHT PANEL: 3D Viewer -->
      <div class="right-panel">
        <div class="viewer-header">
          <h3>🎨 Xem Trước Mô Hình 3D</h3>
          <button 
            v-if="selectedModelType" 
            @click="clearViewer" 
            class="btn btn-secondary"
          >
            ✖ Đóng
          </button>
        </div>
        
        <div id="previewCesiumContainer" class="cesium-viewer">
          <div v-if="!selectedModelType" class="placeholder">
            <div class="placeholder-icon">🏗️</div>
            <p>👆 Chọn "Xem" tại một loại mô hình để xem trước</p>
          </div>
          <div v-else-if="viewerLoading" class="loading-overlay">
            <p>⏳ Đang tải mô hình...</p>
          </div>
        </div>

        <!-- Model Info -->
        <div v-if="selectedModelType" class="model-info">
          <h4>ℹ️ Thông Tin Mô Hình</h4>
          <div class="info-grid">
            <div class="info-item">
              <strong>ID:</strong> {{ selectedModelType.id }}
            </div>
            <div class="info-item">
              <strong>Loại Cập Nhật:</strong> {{ selectedModelType.loai_cap_nhat }}
            </div>
            <div class="info-item">
              <strong>Tên Loại Mô Hình:</strong> {{ selectedModelType.ten_loai_mo_hinh || 'Chưa đặt tên' }}
            </div>
            <div class="info-item">
              <strong>Parent:</strong> {{ selectedModelType.parent || 'Không có' }}
            </div>
            <div class="info-item full-width">
              <strong>URL GLB:</strong> 
              <span class="url-path">{{ selectedModelType.url_glb }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ✅ ADD/EDIT DIALOG WITH FILE UPLOAD -->
    <div v-if="showDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog-content">
        <div class="dialog-header">
          <h3>{{ isEditMode ? '✏️ Chỉnh Sửa' : '➕ Thêm Mới' }} Loại Mô Hình</h3>
          <button @click="closeDialog" class="btn-close">✖</button>
        </div>

        <div class="dialog-body">
          <!-- Loại cập nhật -->
          <div class="form-group">
            <label>Loại Cập Nhật <span class="required">*</span></label>
            <input 
              v-model="formData.loai_cap_nhat" 
              type="text" 
              placeholder="Nhập loại cập nhật..."
              class="form-input"
            />
            <small class="form-help">
              Ví dụ: Cập nhật lần 1, Phiên bản 2.0, Bản sửa lỗi...
            </small>
          </div>

          <!-- Tên loại mô hình -->
          <div class="form-group">
            <label>Tên Loại Mô Hình</label>
            <input 
              v-model="formData.ten_loai_mo_hinh" 
              type="text" 
              placeholder="Nhập tên loại mô hình..."
              class="form-input"
            />
            <small class="form-help">
              Ví dụ: Nhà cao tầng, Cầu đường, Công trình công cộng...
            </small>
          </div>

          <!-- ✅ FILE UPLOAD GLB -->
          <div class="form-group">
            <label>File GLB</label>
            <div class="file-upload-container">
              <input 
                ref="glbFileInput"
                type="file" 
                accept=".glb"
                @change="handleFileSelect($event, 'glb')"
                class="file-input"
                id="glbFileInput"
              />
              <label for="glbFileInput" class="file-label">
                <span class="file-icon">📁</span>
                <span class="file-text">
                  {{ formData.glb_file_name || 'Chọn file GLB...' }}
                </span>
              </label>
              <button 
                v-if="formData.glb_file || formData.url_glb" 
                @click="clearFile('glb')" 
                class="btn-clear-file"
                type="button"
              >
                ✖
              </button>
            </div>
            <div v-if="formData.url_glb && !formData.glb_file" class="current-file">
              <strong>File hiện tại:</strong> {{ formData.url_glb }}
            </div>
          </div>

          <!-- ✅ FILE UPLOAD B3DM -->
          <div class="form-group">
            <label>File B3DM</label>
            <div class="file-upload-container">
              <input 
                ref="b3dmFileInput"
                type="file" 
                accept=".b3dm"
                @change="handleFileSelect($event, 'b3dm')"
                class="file-input"
                id="b3dmFileInput"
              />
              <label for="b3dmFileInput" class="file-label">
                <span class="file-icon">📁</span>
                <span class="file-text">
                  {{ formData.b3dm_file_name || 'Chọn file B3DM...' }}
                </span>
              </label>
              <button 
                v-if="formData.b3dm_file || formData.url_b3dm" 
                @click="clearFile('b3dm')" 
                class="btn-clear-file"
                type="button"
              >
                ✖
              </button>
            </div>
            <div v-if="formData.url_b3dm && !formData.b3dm_file" class="current-file">
              <strong>File hiện tại:</strong> {{ formData.url_b3dm }}
            </div>
          </div>

          <!-- Parent -->
          <div class="form-group">
            <label>Parent</label>
            <select v-model="formData.parent" class="form-select">
              <option :value="null">Không có parent</option>
              <option 
                v-for="opt in parentOptions" 
                :key="opt.value" 
                :value="opt.value"
                :disabled="isEditMode && opt.value === formData.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="form-note">
            <strong>Lưu ý:</strong> 
            <ul>
              <li>Loại cập nhật là trường bắt buộc</li>
              <li>Tên loại mô hình là trường tùy chọn</li>
              <li>Phải upload ít nhất một file (GLB hoặc B3DM)</li>
            </ul>
          </div>
        </div>

        <div class="dialog-footer">
          <button @click="closeDialog" class="btn btn-secondary">
            Hủy
          </button>
          <button @click="handleSubmit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? '⏳ Đang xử lý...' : (isEditMode ? '💾 Cập Nhật' : '➕ Thêm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Notification -->
    <div v-if="notification.show" :class="['notification', `notification-${notification.type}`]">
      {{ notification.message }}
    </div>
  </div>
</template>

<script>
import * as Cesium from 'cesium';

export default {
  name: 'ModelTypeManager',
  
  data() {
    return {
      backendUrl: 'http://localhost:8000',
      
      // Data
      modelTypes: [],
      parentOptions: [],
      selectedModelType: null,
      
      // Pagination
      pagination: {
        page: 1,
        page_size: 10,
        total_pages: 1,
        total_items: 0,
        has_next: false,
        has_previous: false
      },
      
      // Filters
      searchQuery: '',
      parentFilter: '',
      searchTimeout: null,
      
      // Loading states
      loading: false,
      viewerLoading: false,
      submitting: false,
      
      // Dialog
      showDialog: false,
      isEditMode: false,
      formData: {
        id: null,
        url_glb: '',
        url_b3dm: '',
        parent: null,
        loai_cap_nhat: '',
        ten_loai_mo_hinh: '',
        // ✅ File uploads
        glb_file: null,
        b3dm_file: null,
        glb_file_name: '',
        b3dm_file_name: ''
      },
      
      // Cesium Viewer
      previewViewer: null,
      currentModel: null,
      
      // Notification
      notification: {
        show: false,
        message: '',
        type: 'info'
      }
    };
  },
  
  mounted() {
    this.initPreviewViewer();
    this.loadData();
    this.loadParentOptions();
  },
  
  beforeUnmount() {
    this.destroyPreviewViewer();
  },
  
  methods: {
    // ============ FILE HANDLING ============
    handleFileSelect(event, type) {
      const file = event.target.files[0];
      if (file) {
        if (type === 'glb') {
          this.formData.glb_file = file;
          this.formData.glb_file_name = file.name;
        } else if (type === 'b3dm') {
          this.formData.b3dm_file = file;
          this.formData.b3dm_file_name = file.name;
        }
      }
    },
    
    clearFile(type) {
      if (type === 'glb') {
        this.formData.glb_file = null;
        this.formData.glb_file_name = '';
        if (this.$refs.glbFileInput) {
          this.$refs.glbFileInput.value = '';
        }
      } else if (type === 'b3dm') {
        this.formData.b3dm_file = null;
        this.formData.b3dm_file_name = '';
        if (this.$refs.b3dmFileInput) {
          this.$refs.b3dmFileInput.value = '';
        }
      }
    },
    
    // ============ DATA LOADING ============
    async loadData() {
      this.loading = true;
      try {
        const params = new URLSearchParams({
          page: this.pagination.page,
          page_size: this.pagination.page_size
        });
        
        if (this.searchQuery) {
          params.append('search', this.searchQuery);
        }
        
        if (this.parentFilter) {
          params.append('parent', this.parentFilter);
        }
        
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/model-types/?${params.toString()}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          this.modelTypes = data.data;
          this.pagination = data.pagination;
        } else {
          throw new Error(data.error || 'Lỗi khi tải dữ liệu');
        }
        
      } catch (error) {
        console.error('❌ Error loading data:', error);
        this.showNotification('Lỗi tải dữ liệu: ' + error.message, 'error');
      } finally {
        this.loading = false;
      }
    },
    
    async loadParentOptions() {
      try {
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/model-types/parent-options/`
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.parentOptions = data.options;
        }
      } catch (error) {
        console.error('❌ Error loading parent options:', error);
      }
    },
    
    refreshData() {
      this.pagination.page = 1;
      this.loadData();
      this.loadParentOptions();
      this.showNotification('Đã làm mới dữ liệu', 'success');
    },
    
    // ============ SEARCH & FILTER ============
    handleSearch() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.pagination.page = 1;
        this.loadData();
      }, 500);
    },
    
    handleFilterChange() {
      this.pagination.page = 1;
      this.loadData();
    },
    
    // ============ PAGINATION ============
    goToPage(page) {
      if (page >= 1 && page <= this.pagination.total_pages) {
        this.pagination.page = page;
        this.loadData();
      }
    },
    
    // ============ CESIUM VIEWER ============
    initPreviewViewer() {
      try {
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMjFiMTVhMy0yOTliLTQ2ODQtYTEzNy0xZDI0YTVlZWVkNTkiLCJpZCI6MzI2NjIyLCJpYXQiOjE3NTM3OTQ1NTB9.CB33-d5mVIlNDJeLUMWSyovvOtqLC2ewy0_rBOMwM8k';
        
        this.previewViewer = new Cesium.Viewer('previewCesiumContainer', {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
        });
        
        this.previewViewer.scene.globe.depthTestAgainstTerrain = false;
        
        console.log('✅ Preview Viewer initialized');
      } catch (error) {
        console.error('❌ Error initializing preview viewer:', error);
      }
    },
    
    destroyPreviewViewer() {
      if (this.previewViewer && !this.previewViewer.isDestroyed()) {
        this.previewViewer.destroy();
        this.previewViewer = null;
      }
    },
    
    async viewModelDetail(item) {
      if (!item.url_glb) {
        this.showNotification('Loại mô hình này không có URL GLB', 'warning');
        return;
      }
      
      this.selectedModelType = item;
      this.viewerLoading = true;
      
      try {
        // Xóa model cũ nếu có
        if (this.currentModel) {
          this.previewViewer.scene.primitives.remove(this.currentModel);
          this.currentModel = null;
        }
        
        // Tạo URL đầy đủ từ đường dẫn tương đối
        const fullUrl = `${this.backendUrl}/media/${item.url_glb}`;
        
        // Tải model mới
        const position = Cesium.Cartesian3.fromDegrees(105.845002, 21.066872, 22);
        const heading = Cesium.Math.toRadians(87);
        const pitch = Cesium.Math.toRadians(0);
        const roll = Cesium.Math.toRadians(0);
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        
        const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
          position,
          hpr
        );
        
        this.currentModel = await Cesium.Model.fromGltfAsync({
          url: fullUrl,
          modelMatrix: modelMatrix,
          scale: 1.0,
        });
        
        this.previewViewer.scene.primitives.add(this.currentModel);
        
        // Zoom đến model
        this.previewViewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(105.84175, 21.065, 50),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0.0
          },
          duration: 1.5
        });
        
        this.showNotification('Đã tải mô hình thành công', 'success');
        
      } catch (error) {
        console.error('❌ Error loading model:', error);
        this.showNotification('Lỗi tải mô hình: ' + error.message, 'error');
      } finally {
        this.viewerLoading = false;
      }
    },
    
    clearViewer() {
      if (this.currentModel) {
        this.previewViewer.scene.primitives.remove(this.currentModel);
        this.currentModel = null;
      }
      this.selectedModelType = null;
      
      // Reset camera
      this.previewViewer.camera.flyHome(1);
    },
    
    // ============ DIALOG ============
    showAddDialog() {
      this.isEditMode = false;
      this.formData = {
        id: null,
        url_glb: '',
        url_b3dm: '',
        parent: null,
        loai_cap_nhat: '',
        ten_loai_mo_hinh: '',
        glb_file: null,
        b3dm_file: null,
        glb_file_name: '',
        b3dm_file_name: ''
      };
      this.showDialog = true;
    },
    
    async showEditDialog(item) {
      try {
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/model-types/${item.id}/`
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.isEditMode = true;
          this.formData = {
            id: data.data.id,
            url_glb: data.data.url_glb || '',
            url_b3dm: data.data.url_b3dm || '',
            parent: data.data.parent,
            loai_cap_nhat: data.data.loai_cap_nhat,
            ten_loai_mo_hinh: data.data.ten_loai_mo_hinh || '',
            glb_file: null,
            b3dm_file: null,
            glb_file_name: '',
            b3dm_file_name: ''
          };
          this.showDialog = true;
        }
        
      } catch (error) {
        console.error('❌ Error loading model for edit:', error);
        this.showNotification('Lỗi tải dữ liệu: ' + error.message, 'error');
      }
    },
    
    closeDialog() {
      this.showDialog = false;
      this.formData = {
        id: null,
        url_glb: '',
        url_b3dm: '',
        parent: null,
        loai_cap_nhat: '',
        ten_loai_mo_hinh: '',
        glb_file: null,
        b3dm_file: null,
        glb_file_name: '',
        b3dm_file_name: ''
      };
    },
    
    async handleSubmit() {
      // Validate loại cập nhật
      if (!this.formData.loai_cap_nhat.trim()) {
        this.showNotification('Vui lòng nhập loại cập nhật', 'warning');
        return;
      }
      
      // Validate file: phải có ít nhất 1 file mới hoặc URL cũ
      const hasNewFile = this.formData.glb_file || this.formData.b3dm_file;
      const hasExistingUrl = this.formData.url_glb || this.formData.url_b3dm;
      
      if (!hasNewFile && !hasExistingUrl) {
        this.showNotification('Phải có ít nhất một file (GLB hoặc B3DM)', 'warning');
        return;
      }
      
      this.submitting = true;
      
      try {
        // Tạo FormData để upload file
        const formData = new FormData();
        formData.append('loai_cap_nhat', this.formData.loai_cap_nhat.trim());
        
        // Thêm tên loại mô hình nếu có
        if (this.formData.ten_loai_mo_hinh.trim()) {
          formData.append('ten_loai_mo_hinh', this.formData.ten_loai_mo_hinh.trim());
        }
        
        if (this.formData.parent !== null && this.formData.parent !== '') {
          formData.append('parent', this.formData.parent);
        }
        
        // Thêm files nếu có
        if (this.formData.glb_file) {
          formData.append('glb_file', this.formData.glb_file);
        }
        if (this.formData.b3dm_file) {
          formData.append('b3dm_file', this.formData.b3dm_file);
        }
        
        // Endpoint khác nhau cho create/update
        const url = this.isEditMode
          ? `${this.backendUrl}/QLModel/api/model-types/${this.formData.id}/update-with-file/`
          : `${this.backendUrl}/QLModel/api/model-types/upload/`;
        
        const response = await fetch(url, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.showNotification(data.message, 'success');
          this.closeDialog();
          this.loadData();
          this.loadParentOptions();
        } else {
          throw new Error(data.error || 'Có lỗi xảy ra');
        }
        
      } catch (error) {
        console.error('❌ Error submitting:', error);
        this.showNotification('Lỗi: ' + error.message, 'error');
      } finally {
        this.submitting = false;
      }
    },
    
    // ============ DELETE ============
    async confirmDelete(item) {
      if (!confirm(`Bạn có chắc muốn xóa loại mô hình "${item.loai_cap_nhat}"?`)) {
        return;
      }
      
      try {
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/model-types/${item.id}/delete/`,
          { method: 'DELETE' }
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.showNotification(data.message, 'success');
          
          // Nếu đang xem model này thì clear
          if (this.selectedModelType && this.selectedModelType.id === item.id) {
            this.clearViewer();
          }
          
          this.loadData();
          this.loadParentOptions();
        } else {
          throw new Error(data.error || 'Có lỗi xảy ra');
        }
        
      } catch (error) {
        console.error('❌ Error deleting:', error);
        this.showNotification('Lỗi: ' + error.message, 'error');
      }
    },
    
    // ============ UTILITIES ============
    truncateUrl(url) {
      if (!url) return '-';
      if (url.length <= 30) return url;
      return url.substring(0, 27) + '...';
    },
    
    showNotification(message, type = 'info') {
      this.notification = {
        show: true,
        message: message,
        type: type
      };
      
      setTimeout(() => {
        this.notification.show = false;
      }, 3000);
    }
  }
};
</script>

<style scoped>
/* ✅ Container - XÓA margin-left để MainPage handle positioning */
.model-type-manager {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  padding: 20px;
}

.split-container {
  display: flex;
  height: 100%;
  gap: 10px;
}

/* Left Panel */
.left-panel {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.panel-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 24px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

/* Filter Section */
.filter-section {
  padding: 15px 20px;
  display: flex;
  gap: 10px;
  border-bottom: 1px solid #eee;
}

.search-input {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filter-select {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

/* Table */
.table-container {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
  font-size: 14px;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.selected-row {
  background: #e3f2fd !important;
}

.url-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-cell {
  display: flex;
  gap: 5px;
}

.loading-cell, .empty-cell {
  text-align: center;
  padding: 40px !important;
  color: #999;
  font-size: 16px;
}

/* Pagination */
.pagination {
  padding: 15px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  border-top: 1px solid #eee;
}

.page-info {
  font-size: 14px;
  color: #666;
}

/* Right Panel */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.viewer-header {
  padding: 15px 20px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.viewer-header h3 {
  margin: 0;
  font-size: 18px;
}

.cesium-viewer {
  flex: 1;
  position: relative;
  background: #000;
  width: 100%;
}

.placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #999;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  z-index: 1000;
}

.model-info {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  max-height: 200px;
  overflow-y: auto;
}

.model-info h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-item {
  font-size: 13px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.url-path {
  color: #667eea;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-page {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-page:not(:disabled):hover {
  background: #f8f9fa;
}

.btn-action {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-view {
  background: #17a2b8;
  color: white;
}

.btn-view:hover:not(:disabled) {
  background: #138496;
}

.btn-view:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-edit {
  background: #ffc107;
  color: #000;
}

.btn-edit:hover {
  background: #e0a800;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.dialog-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px 8px 0 0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 20px;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.btn-close:hover {
  background: rgba(255,255,255,0.2);
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
}

.required {
  color: #dc3545;
}

.form-input, .form-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

/* ✅ FILE UPLOAD STYLES */
.file-upload-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-input {
  display: none;
}

.file-label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  border: 2px dashed #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
}

.file-label:hover {
  border-color: #667eea;
  background: #e8eaf6;
}

.file-icon {
  font-size: 20px;
}

.file-text {
  color: #666;
  font-size: 14px;
}

.btn-clear-file {
  padding: 8px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.btn-clear-file:hover {
  background: #c82333;
}

.current-file {
  margin-top: 8px;
  padding: 8px 12px;
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
  border-radius: 4px;
  font-size: 13px;
  color: #1976d2;
}

.form-note {
  padding: 12px;
  background: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 4px;
  font-size: 13px;
  color: #856404;
}

.dialog-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Notification */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 10001;
  animation: slideIn 0.3s;
  height: 20px;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-success {
  background: #28a745;
}

.notification-error {
  background: #dc3545;
}

.notification-warning {
  background: #ffc107;
  color: #000;
}

.notification-info {
  background: #17a2b8;
}

/* Thêm một số style mới cho form help text */
.form-help {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 12px;
  font-style: italic;
}

/* Điều chỉnh lại table cho thêm cột mới */
.data-table th:nth-child(5), 
.data-table td:nth-child(5) {
  min-width: 120px;
}

.data-table th:nth-child(6), 
.data-table td:nth-child(6) {
  min-width: 150px;
}
</style>