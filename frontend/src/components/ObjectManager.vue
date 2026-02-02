<template>
  <div class="object-manager">
    <!-- PANEL CHÍNH -->
    <div class="main-panel">
      
      <!-- HEADER -->
      <div class="panel-header">
        <h2>🗺️ Quản Lý Đối Tượng Trên Bản Đồ</h2>
        
        <div class="action-buttons">
          <button @click="showAddForm" class="btn btn-primary">
            ➕ Thêm Đối Tượng
          </button>
          <button @click="refreshData" class="btn btn-secondary">
            🔄 Làm Mới
          </button>
        </div>
      </div>

      <!-- SEARCH & FILTER -->
      <div class="filter-section">
        <select v-model="filterCanh" @change="handleFilterChange" class="filter-select">
          <option value="">Tất cả cảnh</option>
          <option v-for="canh in canhList" :key="canh.ma_canh" :value="canh.ma_canh">
            {{ canh.ten_canh }}
          </option>
        </select>
        
        <select v-model="filterLoaiDoiTuong" @change="handleFilterChange" class="filter-select">
          <option value="">Tất cả loại đối tượng</option>
          <option value="1">Đối tượng chuyển động</option>
          <option value="2">Cây</option>
          <option value="3">Công trình</option>
        </select>
      </div>

      <!-- DATA TABLE -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cảnh</th>
              <th>Loại Mô Hình</th>
              <th>Vị Trí</th>
              <th>Loại Đối Tượng</th>
              <th>Tên/Thông Tin</th>
              <th>Trạng Thái</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="loading-cell">⏳ Đang tải dữ liệu...</td>
            </tr>
            <tr v-else-if="doiTuongList.length === 0">
              <td colspan="8" class="empty-cell">📭 Không có dữ liệu</td>
            </tr>
            <tr v-else v-for="item in doiTuongList" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.ma_canh }}</td>
              <td>{{ item.loai_mo_hinh }}</td>
              <td class="position-cell">{{ item.vi_tri }}</td>
              <td>{{ item.loai_doi_tuong_text }}</td>
              <td>{{ item.loai_dt_info || '-' }}</td>
              <td>
                <span :class="['status-badge', item.trang_thai === 1 ? 'status-active' : 'status-inactive']">
                  {{ item.trang_thai === 1 ? 'Hoạt động' : 'Ngưng' }}
                </span>
              </td>
              <td class="action-cell">
                <button @click="confirmDelete(item)" class="btn-action btn-delete">
                  🗑️ Xóa
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- PAGINATION -->
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

    <!-- ADD FORM DIALOG -->
    <div v-if="showForm" class="dialog-overlay" @click.self="closeForm">
      <div class="dialog-content large-dialog">
        <div class="dialog-header">
          <h3>➕ Thêm Đối Tượng Mới</h3>
          <button @click="closeForm" class="btn-close">✖</button>
        </div>

        <div class="dialog-body">
          <!-- BƯỚC 1: THÔNG TIN CƠ BẢN -->
          <div class="form-section">
            <h4>📌 Thông Tin Cơ Bản</h4>
            
            <!-- Chọn Cảnh -->
            <div class="form-group">
              <label>Cảnh <span class="required">*</span></label>
              <select v-model="formData.ma_canh_id" class="form-select">
                <option value="">-- Chọn cảnh --</option>
                <option v-for="canh in canhList" :key="canh.ma_canh" :value="canh.ma_canh">
                  {{ canh.ten_canh }}
                </option>
              </select>
            </div>

            <!-- Chọn Loại Mô Hình -->
            <div class="form-group">
              <label>Loại Mô Hình</label>
              <div class="input-with-button">
                <select v-model="formData.ma_loai_mo_hinh_id" class="form-select">
                  <option value="">-- Chọn loại mô hình --</option>
                  <option v-for="lmh in loaiMoHinhList" :key="lmh.value" :value="lmh.value">
                    {{ lmh.label }}
                  </option>
                </select>
                <button @click="showUploadModelDialog" class="btn btn-secondary btn-small">
                  📤 Upload Model
                </button>
              </div>
            </div>

            <!-- Loại Đối Tượng -->
            <div class="form-group">
              <label>Loại Đối Tượng <span class="required">*</span></label>
              <select v-model="formData.loai_doi_tuong" @change="handleLoaiDoiTuongChange" class="form-select">
                <option value="">-- Chọn loại --</option>
                <option value="1">Đối tượng chuyển động</option>
                <option value="2">Cây</option>
                <option value="3">Công trình</option>
              </select>
            </div>

            <!-- Trạng Thái -->
            <div class="form-group">
              <label>Trạng Thái</label>
              <select v-model="formData.trang_thai" class="form-select">
                <option value="1">Hoạt động</option>
                <option value="0">Ngưng hoạt động</option>
              </select>
            </div>
          </div>

          <!-- BƯỚC 2: VỊ TRÍ -->
          <div class="form-section">
            <h4>📍 Thông Tin Vị Trí</h4>
            
            <div class="position-picker">
              <button @click="pickPositionOnMap" class="btn btn-primary btn-block">
                🗺️ Chọn Vị Trí Trên Bản Đồ
              </button>
              <p class="help-text">Click vào nút trên, sau đó double-click vào vị trí trên bản đồ để chọn tọa độ</p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Latitude (Vĩ độ) <span class="required">*</span></label>
                <input 
                  v-model="formData.lat" 
                  type="number" 
                  step="0.000001"
                  placeholder="21.028511"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label>Longitude (Kinh độ) <span class="required">*</span></label>
                <input 
                  v-model="formData.lon" 
                  type="number" 
                  step="0.000001"
                  placeholder="105.804817"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Height (Độ cao - m)</label>
                <input 
                  v-model="formData.height" 
                  type="number" 
                  step="0.1"
                  placeholder="0"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label>Scale (Tỷ lệ)</label>
                <input 
                  v-model="formData.scale" 
                  type="number" 
                  step="0.1"
                  placeholder="1.0"
                  class="form-input"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Heading (độ)</label>
                <input v-model="formData.heading" type="number" step="0.1" class="form-input" />
              </div>
              
              <div class="form-group">
                <label>Pitch (độ)</label>
                <input v-model="formData.pitch" type="number" step="0.1" class="form-input" />
              </div>
              
              <div class="form-group">
                <label>Roll (độ)</label>
                <input v-model="formData.roll" type="number" step="0.1" class="form-input" />
              </div>
            </div>
          </div>

          <!-- BƯỚC 3: HÌNH ẢNH -->
          <div class="form-section">
            <h4>🖼️ Hình Ảnh</h4>
            
            <div class="file-upload-container">
              <input 
                ref="imageFileInput"
                type="file" 
                accept="image/*"
                @change="handleImageSelect"
                class="file-input"
                id="imageFileInput"
              />
              <label for="imageFileInput" class="file-label">
                <span class="file-icon">📁</span>
                <span class="file-text">
                  {{ formData.hinh_anh_name || 'Chọn hình ảnh...' }}
                </span>
              </label>
              <button 
                v-if="formData.hinh_anh_file" 
                @click="clearImage" 
                class="btn-clear-file"
                type="button"
              >
                ✖
              </button>
            </div>
          </div>

          <!-- BƯỚC 4: THÔNG TIN ĐỐI TƯỢNG CỤ THỂ -->
          <div class="form-section" v-if="formData.loai_doi_tuong">
            <h4>📝 Thông Tin Chi Tiết</h4>
            
            <!-- FORM ĐỐI TƯỢNG CHUYỂN ĐỘNG -->
            <div v-if="formData.loai_doi_tuong === '1'">
              <div class="form-group">
                <label>Loại Đối Tượng</label>
                <select v-model="formData.loai_DT" class="form-select">
                  <option value="TAU">Tàu</option>
                  <option value="XE">Xe</option>
                  <option value="MAY_BAY">Máy bay</option>
                  <option value="UAV">UAV</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Tên Đối Tượng <span class="required">*</span></label>
                <input 
                  v-model="formData.ten_doi_tuong" 
                  type="text" 
                  placeholder="VD: Tàu 123"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label>Đường Chuyển Động</label>
                <textarea 
                  v-model="formData.duong_chuyen_dong" 
                  rows="3"
                  placeholder="Nhập GeoJSON hoặc polyline..."
                  class="form-textarea"
                ></textarea>
              </div>
              
              <div class="form-group">
                <label>Vận Tốc (m/s)</label>
                <input 
                  v-model="formData.van_toc" 
                  type="number" 
                  step="0.1"
                  placeholder="10.5"
                  class="form-input"
                />
              </div>
            </div>

            <!-- FORM CÂY -->
            <div v-if="formData.loai_doi_tuong === '2'">
              <div class="form-group">
                <label>Tên Loài Cây <span class="required">*</span></label>
                <input 
                  v-model="formData.ten_loai" 
                  type="text" 
                  placeholder="VD: Phượng vĩ"
                  class="form-input"
                />
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label>Chiều Cao (m)</label>
                  <input 
                    v-model="formData.cay_height" 
                    type="number" 
                    step="0.1"
                    placeholder="5.5"
                    class="form-input"
                  />
                </div>
                
                <div class="form-group">
                  <label>Đường Kính Thân (cm)</label>
                  <input 
                    v-model="formData.duong_kinh" 
                    type="number" 
                    step="0.1"
                    placeholder="30"
                    class="form-input"
                  />
                </div>
              </div>
              
              <div class="form-group">
                <label>Tuổi Cây (năm)</label>
                <input 
                  v-model="formData.tuoi" 
                  type="number"
                  placeholder="10"
                  class="form-input"
                />
              </div>
            </div>

            <!-- FORM CÔNG TRÌNH -->
            <div v-if="formData.loai_doi_tuong === '3'">
              <div class="form-group">
                <label>Tên Công Trình <span class="required">*</span></label>
                <input 
                  v-model="formData.ten_cong_trinh" 
                  type="text" 
                  placeholder="VD: Nhà văn hóa xã"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label>Loại Công Trình</label>
                <select v-model="formData.loai_cong_trinh" class="form-select">
                  <option value="NHA">Nhà</option>
                  <option value="CAU">Cầu</option>
                  <option value="CANG">Cảng</option>
                  <option value="TRAM">Trạm</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Cấp Bảo Mật</label>
                <select v-model="formData.cap_bao_mat" class="form-select">
                  <option value="0">Thường</option>
                  <option value="1">Hạn chế</option>
                  <option value="2">Mật</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button @click="closeForm" class="btn btn-secondary">
            Hủy
          </button>
          <button @click="handleSubmit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? '⏳ Đang xử lý...' : '➕ Tạo Đối Tượng' }}
          </button>
        </div>
      </div>
    </div>

    <!-- NOTIFICATION -->
    <div v-if="notification.show" :class="['notification', `notification-${notification.type}`]">
      {{ notification.message }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'ObjectManager',
  
  data() {
    return {
      backendUrl: 'http://localhost:8000',
      
      // Data lists
      doiTuongList: [],
      canhList: [],
      loaiMoHinhList: [],
      
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
      filterCanh: '',
      filterLoaiDoiTuong: '',
      
      // Loading states
      loading: false,
      submitting: false,
      
      // Form
      showForm: false,
      formData: this.getEmptyFormData(),
      
      // Notification
      notification: {
        show: false,
        message: '',
        type: 'info'
      }
    };
  },
  
  mounted() {
    this.loadCanhList();
    this.loadLoaiMoHinhOptions();
    this.loadData();
  },
  
  methods: {
    getEmptyFormData() {
      return {
        // Thông tin cơ bản
        ma_canh_id: '',
        ma_loai_mo_hinh_id: '',
        loai_doi_tuong: '',
        trang_thai: 1,
        
        // Vị trí
        lat: '',
        lon: '',
        height: 0,
        heading: 0,
        pitch: 0,
        roll: 0,
        scale: 1.0,
        
        // Hình ảnh
        hinh_anh_file: null,
        hinh_anh_name: '',
        
        // Đối tượng chuyển động
        loai_DT: 'TAU',
        ten_doi_tuong: '',
        duong_chuyen_dong: '',
        van_toc: '',
        
        // Cây
        ten_loai: '',
        cay_height: '',
        duong_kinh: '',
        tuoi: '',
        
        // Công trình
        ten_cong_trinh: '',
        loai_cong_trinh: 'NHA',
        cap_bao_mat: 0
      };
    },
    
    // ============ DATA LOADING ============
    async loadData() {
      this.loading = true;
      try {
        const params = new URLSearchParams({
          page: this.pagination.page,
          page_size: this.pagination.page_size
        });
        
        if (this.filterCanh) {
          params.append('ma_canh', this.filterCanh);
        }
        
        if (this.filterLoaiDoiTuong) {
          params.append('loai_doi_tuong', this.filterLoaiDoiTuong);
        }
        
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/doi-tuong/?${params.toString()}`
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.doiTuongList = data.data;
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
    
    async loadCanhList() {
      try {
        const response = await fetch(`${this.backendUrl}/QLModel/api/scenes/`);
        const data = await response.json();
        if (data.success) {
          // Chuyển đổi từ scenes -> canhList
          this.canhList = data.scenes.map(scene => ({
            ma_canh: scene.ma_canh,
            ten_canh: scene.ten_canh
          }));
        }
      } catch (error) {
        console.error('❌ Error loading canh list:', error);
      }
    },
    
    async loadLoaiMoHinhOptions() {
      try {
        const response = await fetch(`${this.backendUrl}/QLModel/api/model-types/parent-options/`);
        const data = await response.json();
        if (data.success) {
          this.loaiMoHinhList = data.options.map(opt => ({
            value: opt.value,
            label: opt.label
          }));
        }
      } catch (error) {
        console.error('❌ Error loading loai mo hinh list:', error);
      }
    },
    
    refreshData() {
      this.pagination.page = 1;
      this.loadData();
      this.loadCanhList();
      this.loadLoaiMoHinhOptions();
      this.showNotification('Đã làm mới dữ liệu', 'success');
    },
    
    // ============ FILTER & PAGINATION ============
    handleFilterChange() {
      this.pagination.page = 1;
      this.loadData();
    },
    
    goToPage(page) {
      if (page >= 1 && page <= this.pagination.total_pages) {
        this.pagination.page = page;
        this.loadData();
      }
    },
    
    // ============ FORM HANDLING ============
    showAddForm() {
      this.formData = this.getEmptyFormData();
      this.showForm = true;
    },
    
    closeForm() {
      this.showForm = false;
      this.formData = this.getEmptyFormData();
    },
    
    handleLoaiDoiTuongChange() {
      // Reset các field khi đổi loại đối tượng
      this.formData.ten_doi_tuong = '';
      this.formData.ten_loai = '';
      this.formData.ten_cong_trinh = '';
    },
    
    handleImageSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.formData.hinh_anh_file = file;
        this.formData.hinh_anh_name = file.name;
      }
    },
    
    clearImage() {
      this.formData.hinh_anh_file = null;
      this.formData.hinh_anh_name = '';
      if (this.$refs.imageFileInput) {
        this.$refs.imageFileInput.value = '';
      }
    },
    
    // ============ CHỌN VỊ TRÍ TRÊN BẢN ĐỒ ============
    pickPositionOnMap() {
      // Emit event để chuyển về tab bản đồ và kích hoạt chế độ chọn vị trí
      this.$emit('request-position-pick', (position) => {
        // Callback khi đã chọn vị trí
        this.formData.lat = position.lat;
        this.formData.lon = position.lon;
        this.formData.height = position.height || 0;
        this.showNotification('Đã chọn vị trí thành công', 'success');
      });
    },
    
    // ============ UPLOAD MODEL DIALOG ============
    showUploadModelDialog() {
      this.showNotification('Chức năng upload model - Chuyển đến tab Quản lý Mô hình', 'info');
      // Emit event để chuyển tab
      this.$emit('navigate-to', 'model-manager');
    },
    
    // ============ SUBMIT ============
    async handleSubmit() {
      // Validate
      if (!this.formData.ma_canh_id) {
        this.showNotification('Vui lòng chọn cảnh', 'warning');
        return;
      }
      
      if (!this.formData.loai_doi_tuong) {
        this.showNotification('Vui lòng chọn loại đối tượng', 'warning');
        return;
      }
      
      if (!this.formData.lat || !this.formData.lon) {
        this.showNotification('Vui lòng nhập vị trí (lat, lon)', 'warning');
        return;
      }
      
      // Validate theo loại đối tượng
      if (this.formData.loai_doi_tuong === '1' && !this.formData.ten_doi_tuong) {
        this.showNotification('Vui lòng nhập tên đối tượng', 'warning');
        return;
      }
      
      if (this.formData.loai_doi_tuong === '2' && !this.formData.ten_loai) {
        this.showNotification('Vui lòng nhập tên loài cây', 'warning');
        return;
      }
      
      if (this.formData.loai_doi_tuong === '3' && !this.formData.ten_cong_trinh) {
        this.showNotification('Vui lòng nhập tên công trình', 'warning');
        return;
      }
      
      this.submitting = true;
      
      try {
        // Tạo FormData
        const formData = new FormData();
        
        // Thông tin cơ bản
        formData.append('ma_canh_id', this.formData.ma_canh_id);
        if (this.formData.ma_loai_mo_hinh_id) {
          formData.append('ma_loai_mo_hinh_id', this.formData.ma_loai_mo_hinh_id);
        }
        formData.append('loai_doi_tuong', this.formData.loai_doi_tuong);
        formData.append('trang_thai', this.formData.trang_thai);
        
        // Vị trí
        formData.append('lat', this.formData.lat);
        formData.append('lon', this.formData.lon);
        formData.append('height', this.formData.height || 0);
        formData.append('heading', this.formData.heading || 0);
        formData.append('pitch', this.formData.pitch || 0);
        formData.append('roll', this.formData.roll || 0);
        formData.append('scale', this.formData.scale || 1.0);
        
        // Hình ảnh
        if (this.formData.hinh_anh_file) {
          formData.append('hinh_anh_file', this.formData.hinh_anh_file);
        }
        
        // Thông tin theo loại đối tượng
        if (this.formData.loai_doi_tuong === '1') {
          formData.append('loai_DT', this.formData.loai_DT);
          formData.append('ten_doi_tuong', this.formData.ten_doi_tuong);
          formData.append('duong_chuyen_dong', this.formData.duong_chuyen_dong || '');
          if (this.formData.van_toc) {
            formData.append('van_toc', this.formData.van_toc);
          }
        } else if (this.formData.loai_doi_tuong === '2') {
          formData.append('ten_loai', this.formData.ten_loai);
          if (this.formData.cay_height) {
            formData.append('cay_height', this.formData.cay_height);
          }
          if (this.formData.duong_kinh) {
            formData.append('duong_kinh', this.formData.duong_kinh);
          }
          if (this.formData.tuoi) {
            formData.append('tuoi', this.formData.tuoi);
          }
        } else if (this.formData.loai_doi_tuong === '3') {
          formData.append('ten_cong_trinh', this.formData.ten_cong_trinh);
          formData.append('loai_cong_trinh', this.formData.loai_cong_trinh);
          formData.append('cap_bao_mat', this.formData.cap_bao_mat);
        }
        
        // Submit
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/doi-tuong/create/`,
          {
            method: 'POST',
            body: formData
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.showNotification(data.message, 'success');
          this.closeForm();
          this.loadData();
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
      if (!confirm(`Bạn có chắc muốn xóa đối tượng ID ${item.id}?`)) {
        return;
      }
      
      try {
        const response = await fetch(
          `${this.backendUrl}/QLModel/api/doi-tuong/${item.id}/delete/`,
          { method: 'DELETE' }
        );
        
        const data = await response.json();
        
        if (data.success) {
          this.showNotification(data.message, 'success');
          this.loadData();
        } else {
          throw new Error(data.error || 'Có lỗi xảy ra');
        }
        
      } catch (error) {
        console.error('❌ Error deleting:', error);
        this.showNotification('Lỗi: ' + error.message, 'error');
      }
    },
    
    // ============ UTILITIES ============
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
/* Container */
.object-manager {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
  padding: 20px;
}

.main-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Header */
.panel-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px 8px 0 0;
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

.position-cell {
  font-family: monospace;
  font-size: 12px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
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
    position: absolute;
    right: 500px;
    background: #667eea;
    color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
    position: absolute;
    right: 300px;
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-block {
  width: 100%;
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
  padding: 20px;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.large-dialog {
  max-width: 900px;
}

.dialog-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px 8px 0 0;
  position: sticky;
  top: 0;
  z-index: 100;
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

.form-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.form-section h4 {
  margin: 0 0 20px 0;
  color: #667eea;
  font-size: 18px;
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

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.input-with-button {
  display: flex;
  gap: 10px;
}

.input-with-button .form-select {
  flex: 1;
}

.position-picker {
  margin-bottom: 20px;
}

.help-text {
  margin-top: 10px;
  font-size: 13px;
  color: #666;
  font-style: italic;
}

/* File upload */
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
  background: white;
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

.dialog-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  position: sticky;
  bottom: 0;
  background: white;
  border-radius: 0 0 8px 8px;
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
</style>