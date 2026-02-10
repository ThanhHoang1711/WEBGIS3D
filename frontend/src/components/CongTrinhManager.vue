<template>
  <div class="cong-trinh-manager">
    <!-- TOP SECTION: Search + LOD + Stats | Map -->
    <div class="top-section">
      <!-- LEFT: Search & Filter & Stats -->
      <div class="left-panel">
        <h2>🏗️ Quản lý Công trình theo LOD</h2>

        <div class="filter-card">
          <div class="filter-group">
            <label>🔍 Tìm tên công trình:</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Nhập tên công trình..."
              class="input-search"
              @keyup.enter="handleSearch"
            />
          </div>

          <div class="filter-group">
            <label>📐 Chọn LOD:</label>
            <select
              v-model.number="selectedLOD"
              @change="handleLODChange"
              class="select-lod"
            >
              <option value="">-- Tất cả LOD --</option>
              <option
                v-for="lod in lodOptions"
                :key="lod.value"
                :value="lod.value"
              >
                {{ lod.label }}
              </option>
            </select>
          </div>

          <button @click="handleSearch" class="btn-search">
            🔍 Tìm kiếm & Zoom
          </button>
        </div>

        <!-- Stats Summary -->
        <div class="stats-card">
          <h3>📊 Thống kê tổng quan</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ allObjects.length }}</div>
              <div class="stat-label">Tổng công trình</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ filteredObjects.length }}</div>
              <div class="stat-label">Đang hiển thị</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ lodStats.length }}</div>
              <div class="stat-label">Số LOD</div>
            </div>
          </div>

          <!-- Chart -->
          <div class="chart-container">
            <canvas ref="lodChart"></canvas>
          </div>
        </div>
      </div>

      <!-- RIGHT: Map (always visible) -->
      <div class="right-panel">
        <div class="map-header">
          <h3>🗺️ Bản đồ 3D</h3>
          <button @click="showCreateForm" class="btn-add-map">
            ➕ Thêm công trình
          </button>
        </div>
        <div class="map-container">
          <div id="cesiumContainer" ref="cesiumContainer"></div>
        </div>
      </div>
    </div>

    <!-- BOTTOM SECTION: Table (show when filtered) -->
    <div
      v-if="filteredObjects.length > 0 && (selectedLOD || searchQuery)"
      class="bottom-section"
    >
      <div class="table-header">
        <h3>📋 Danh sách công trình ({{ filteredObjects.length }} kết quả)</h3>
        <button @click="clearFilter" class="btn-clear">✕ Xóa bộ lọc</button>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên công trình</th>
              <th>LOD</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Cảnh</th>
              <th>Thời gian tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredObjects" :key="item.id">
              <td>{{ item.id }}</td>
              <td>
                <strong>{{ item.ten_cong_trinh }}</strong>
              </td>
              <td>
                <span class="badge-lod">{{ item.lod }}</span>
              </td>
              <td>{{ item.lat.toFixed(6) }}</td>
              <td>{{ item.lon.toFixed(6) }}</td>
              <td>{{ item.ma_canh }}</td>
              <td>{{ item.thoi_gian_tao }}</td>
              <td>
                <button @click="zoomToObject(item)" class="btn-sm btn-zoom">
                  🔍
                </button>
                <button
                  @click="deleteObject(item.id)"
                  class="btn-sm btn-delete"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>

    <!-- MODAL: Create Form -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content">
        <div class="modal-header">
          <h3>➕ Thêm mới công trình</h3>
          <button @click="closeForm" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Tên công trình <span class="required">*</span></label>
            <input
              v-model="formData.ten_cong_trinh"
              type="text"
              placeholder="Nhập tên công trình"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Loại công trình</label>
              <select v-model="formData.loai_cong_trinh">
                <option value="NHA">Nhà</option>
                <option value="CHUNGCU">Chung cư</option>
                <option value="TRUONG">Trường học</option>
                <option value="BENH_VIEN">Bệnh viện</option>
                <option value="KHAC">Khác</option>
              </select>
            </div>

            <div class="form-group">
              <label>Cấp bảo mật</label>
              <select v-model="formData.cap_bao_mat">
                <option :value="0">Công khai</option>
                <option :value="1">Hạn chế</option>
                <option :value="2">Mật</option>
                <option :value="3">Tối mật</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>LOD (Loại mô hình) <span class="required">*</span></label>
            <select v-model="formData.ma_loai_mo_hinh">
              <option value="">-- Chọn LOD --</option>
              <option
                v-for="lod in lodOptions"
                :key="lod.value"
                :value="lod.value"
              >
                {{ lod.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Cảnh <span class="required">*</span></label>
            <select v-model="formData.ma_canh">
              <option value="">-- Chọn cảnh --</option>
              <option
                v-for="scene in sceneOptions"
                :key="scene.ma_canh"
                :value="scene.ma_canh"
              >
                {{ scene.ten_canh }}
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Latitude</label>
              <input
                v-model.number="formData.lat"
                type="number"
                step="0.000001"
                readonly
              />
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input
                v-model.number="formData.lon"
                type="number"
                step="0.000001"
                readonly
              />
            </div>
            <div class="form-group">
              <label>Height</label>
              <input
                v-model.number="formData.height"
                type="number"
                step="0.1"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Hình ảnh</label>
            <input type="file" @change="handleFileUpload" accept="image/*" />
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeForm" class="btn-cancel">Hủy</button>
          <button @click="createObject" class="btn-submit">
            ✅ Tạo công trình
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Viewer, Cartesian3, Math as CesiumMath, Color } from "cesium";
import Chart from "chart.js/auto";
import axios from "axios";

export default {
  name: "CongTrinhManager",

  data() {
    return {
      loading: false,
      searchQuery: "",
      selectedLOD: "",

      lodOptions: [],
      sceneOptions: [],
      lodStats: [],

      allObjects: [],
      filteredObjects: [],

      viewer: null,
      chart: null,

      showForm: false,
      formData: {
        ten_cong_trinh: "",
        loai_cong_trinh: "NHA",
        cap_bao_mat: 0,
        ma_canh: "",
        ma_loai_mo_hinh: "",
        lat: 0,
        lon: 0,
        height: 0,
        heading: 0,
        pitch: 0,
        roll: 0,
        scale: 1.0,
        hinh_anh_file: null,
      },
    };
  },

  async mounted() {
    console.log("🚀 Component mounted - Loading REAL data");
    await this.testAPIs();
    this.initCesiumMap();
    await this.loadAllData();
  },

  beforeUnmount() {
    if (this.viewer) {
      this.viewer.destroy();
    }
    if (this.chart) {
      this.chart.destroy();
    }
  },

  methods: {
    // ==================== TEST APIs ====================
    async testAPIs() {
      try {
        console.log("🔍 Testing APIs connection...");

        // Test LOD options
        const lodRes = await axios.get(
          "http://localhost:8000/api/loai-mo-hinh/options/",
        );
        console.log("📦 LOD API response status:", lodRes.status);

        // Test Scene options
        const sceneRes = await axios.get(
          "http://localhost:8000/api/canh/options/",
        );
        console.log("🌍 Scene API response status:", sceneRes.status);

        // Test CongTrinh API mới
        const ctRes = await axios.get(
          "http://localhost:8000/api/cong-trinh/lod/",
          {
            params: { page_size: 3 },
          },
        );
        console.log("🏛️ CongTrinh API response:", ctRes.data);
      } catch (err) {
        console.error("❌ API test failed:", err);
        if (err.response) {
          console.error("Response data:", err.response.data);
          console.error("Response status:", err.response.status);
        }
        alert(
          "❌ Không thể kết nối đến server. Vui lòng kiểm tra Django server!",
        );
      }
    },

    // ==================== LOAD DATA THẬT ====================
    async loadAllData() {
      this.loading = true;
      try {
        await Promise.all([
          this.loadLODOptions(),
          this.loadSceneOptions(),
          this.loadCongTrinhData(),
        ]);

        this.calculateLODStats();

        this.$nextTick(() => {
          this.renderChart();
        });
      } catch (err) {
        console.error("Lỗi load dữ liệu:", err);
        alert("❌ Lỗi tải dữ liệu từ server!");
      } finally {
        this.loading = false;
      }
    },

    async loadLODOptions() {
      try {
        const res = await axios.get(
          "http://localhost:8000/api/loai-mo-hinh/options/",
        );

        if (res.data?.success) {
          this.lodOptions = res.data.data || [];
          console.log("✅ LOD options loaded from DB:", this.lodOptions.length);
          console.log("LOD Options:", this.lodOptions);
        } else {
          console.error("⚠️ LOD API trả về lỗi:", res.data);
          this.lodOptions = []; // Không dùng mock data
        }
      } catch (err) {
        console.error("❌ Lỗi load LOD options:", err);
        this.lodOptions = []; // Không dùng mock data
      }
    },

    async loadSceneOptions() {
      try {
        const res = await axios.get("http://localhost:8000/api/canh/options/");
        if (res.data.success) {
          this.sceneOptions = Array.isArray(res.data.data) ? res.data.data : [];
          console.log(
            "✅ Loaded scene options from DB:",
            this.sceneOptions.length,
          );
          console.log("Scene Options:", this.sceneOptions);
        } else {
          console.error("⚠️ Scene API error:", res.data);
          this.sceneOptions = []; // Không dùng mock data
        }
      } catch (err) {
        console.error("❌ Lỗi load scene options:", err);
        this.sceneOptions = []; // Không dùng mock data
      }
    },

    // ==================== LOAD DỮ LIỆU CÔNG TRÌNH THẬT ====================
    async loadCongTrinhData() {
      this.loading = true;
      try {
        console.log("📡 Loading REAL công trình data from database...");

        // Sử dụng API mới lấy dữ liệu THẬT
        const res = await axios.get(
          "http://localhost:8000/api/cong-trinh/lod/",
          {
            params: {
              page_size: 1000, // Lấy tất cả
            },
          },
        );

        if (res.data?.success) {
          console.log(
            "✅ Got REAL data from API:",
            res.data.data.length,
            "items",
          );

          // Xử lý dữ liệu THẬT
          this.allObjects = res.data.data.map((item) => {
            // Kiểm tra và xử lý dữ liệu THẬT
            const lat = parseFloat(item.lat) || 0;
            const lon = parseFloat(item.lon) || 0;

            console.log(
              `  - ID: ${item.id}, Tên: ${item.ten_cong_trinh}, Lat: ${lat}, Lon: ${lon}`,
            );

            return {
              id: item.id,
              ten_cong_trinh: item.ten_cong_trinh || `Công trình #${item.id}`,
              loai_cong_trinh: item.loai_cong_trinh || "NHA",
              cap_bao_mat: item.cap_bao_mat || 0,
              lod: item.lod || "Không xác định",
              loai_mo_hinh_id: item.loai_mo_hinh_id || null,
              ma_canh: item.ma_canh || "-",
              ma_canh_id: item.ma_canh_id || null,
              lat: lat,
              lon: lon,
              height: parseFloat(item.height) || 0,
              thoi_gian_tao: item.thoi_gian_tao || "-",
              vi_tri_id: item.vi_tri_id || null,
            };
          });

          console.log(
            `📊 Total REAL công trình loaded: ${this.allObjects.length}`,
          );

          if (this.allObjects.length === 0) {
            console.warn("⚠️ Database chưa có dữ liệu công trình!");
          }
        } else {
          console.error("❌ API không trả về success:", res.data);
          this.allObjects = []; // Không có dữ liệu
        }

        this.filteredObjects = [...this.allObjects];
      } catch (err) {
        console.error("❌ Lỗi load công trình THẬT:", err);
        if (err.response) {
          console.error("Error response:", err.response.data);
          console.error("Error status:", err.response.status);
        }
        this.allObjects = []; // Không dùng mock data
        this.filteredObjects = [];
        alert("❌ Không thể tải dữ liệu công trình từ server!");
      } finally {
        this.loading = false;
      }
    },

    calculateLODStats() {
      // Chỉ tính toán nếu có dữ liệu THẬT
      if (this.allObjects.length === 0) {
        this.lodStats = [];
        console.log("📊 Không có dữ liệu để tính LOD stats");
        return;
      }

      const lodCount = {};
      this.allObjects.forEach((obj) => {
        const lod = obj.lod || "Không xác định";
        lodCount[lod] = (lodCount[lod] || 0) + 1;
      });

      const total = this.allObjects.length;
      this.lodStats = Object.keys(lodCount)
        .map((lod) => ({
          lod,
          count: lodCount[lod],
          percentage: ((lodCount[lod] / total) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);

      console.log("📊 LOD Stats từ dữ liệu THẬT:", this.lodStats);
    },

    // ==================== FILTER & SEARCH DỮ LIỆU THẬT ====================
    handleLODChange() {
      console.log("🔄 LOD changed to:", this.selectedLOD);
      this.filterObjects();
    },

    handleSearch() {
      console.log("🔍 Searching for:", this.searchQuery);
      this.filterObjects();

      // Zoom đến đối tượng đầu tiên nếu có dữ liệu THẬT
      if (this.filteredObjects.length > 0 && this.viewer) {
        this.zoomToObject(this.filteredObjects[0]);
      } else if (
        this.filteredObjects.length === 0 &&
        this.allObjects.length > 0
      ) {
        alert("Không tìm thấy công trình nào phù hợp!");
      } else {
        alert("Không có dữ liệu công trình trong database!");
      }
    },

    filterObjects() {
      let result = [...this.allObjects];

      // Filter theo LOD (loai_mo_hinh_id) - DỮ LIỆU THẬT
      if (this.selectedLOD !== "" && this.selectedLOD !== null) {
        console.log("Filtering by LOD:", this.selectedLOD);
        result = result.filter(
          (obj) => Number(obj.loai_mo_hinh_id) === Number(this.selectedLOD),
        );
      }

      // Filter theo search query - DỮ LIỆU THẬT
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter((obj) =>
          obj.ten_cong_trinh.toLowerCase().includes(query),
        );
      }

      this.filteredObjects = result;
      console.log(
        `🔍 Filtered REAL data: ${this.filteredObjects.length} / ${this.allObjects.length}`,
      );
    },

    clearFilter() {
      this.searchQuery = "";
      this.selectedLOD = "";
      this.filteredObjects = [...this.allObjects];
      console.log("🧹 Filter cleared");
    },

    // ==================== CHART ====================
    renderChart() {
      if (this.chart) {
        this.chart.destroy();
      }

      // Chỉ render chart nếu có dữ liệu THẬT
      if (this.lodStats.length === 0) {
        console.log("📊 Không có dữ liệu để render chart");
        return;
      }

      this.$nextTick(() => {
        const ctx = this.$refs.lodChart?.getContext("2d");
        if (!ctx) {
          console.warn("❌ Chart canvas not found");
          return;
        }

        try {
          this.chart = new Chart(ctx, {
            type: "bar",
            data: {
              labels: this.lodStats.map((s) => s.lod),
              datasets: [
                {
                  label: "Số lượng",
                  data: this.lodStats.map((s) => s.count),
                  backgroundColor: [
                    "rgba(52, 152, 219, 0.8)",
                    "rgba(46, 204, 113, 0.8)",
                    "rgba(155, 89, 182, 0.8)",
                    "rgba(241, 196, 15, 0.8)",
                    "rgba(231, 76, 60, 0.8)",
                  ],
                  borderColor: [
                    "rgba(52, 152, 219, 1)",
                    "rgba(46, 204, 113, 1)",
                    "rgba(155, 89, 182, 1)",
                    "rgba(241, 196, 15, 1)",
                    "rgba(231, 76, 60, 1)",
                  ],
                  borderWidth: 2,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: {
                  display: true,
                  text: "Phân bố công trình theo LOD",
                  font: { size: 14, weight: "bold" },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 },
                },
              },
            },
          });
          console.log("✅ Chart rendered from REAL data");
        } catch (err) {
          console.error("❌ Chart error:", err);
        }
      });
    },

    // ==================== CESIUM MAP ====================
    initCesiumMap() {
      this.$nextTick(() => {
        if (!this.$refs.cesiumContainer) {
          console.error("❌ Cesium container not found");
          return;
        }

        try {
          this.viewer = new Viewer(this.$refs.cesiumContainer, {
            terrainProvider: undefined,
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: true,
            navigationHelpButton: false,
            sceneModePicker: false,
          });

          // Set camera mặc định (Cần Thơ)
          this.viewer.camera.setView({
            destination: Cartesian3.fromDegrees(105.77, 10.03, 15000),
            orientation: {
              heading: 0,
              pitch: CesiumMath.toRadians(-45),
              roll: 0,
            },
          });

          console.log("✅ Cesium map initialized");
        } catch (err) {
          console.error("❌ Cesium error:", err);
        }
      });
    },

    zoomToObject(obj) {
      if (!this.viewer) {
        console.error("❌ Viewer not initialized");
        return;
      }

      console.log(
        `🎯 Zoom to REAL object: ${obj.ten_cong_trinh} (${obj.lat}, ${obj.lon})`,
      );

      this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(obj.lon, obj.lat, 500),
        duration: 2,
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-45),
          roll: 0,
        },
      });

      // Thêm marker tạm thời
      this.viewer.entities.removeAll();
      this.viewer.entities.add({
        position: Cartesian3.fromDegrees(obj.lon, obj.lat, 50),
        point: {
          pixelSize: 15,
          color: Color.RED,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: obj.ten_cong_trinh,
          font: "14px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 0,
          pixelOffset: new Cartesian3(0, -20, 0),
        },
      });
    },

    // ==================== CREATE FORM ====================
    showCreateForm() {
      if (!this.viewer) {
        alert("Bản đồ chưa sẵn sàng!");
        return;
      }

      // Lấy tọa độ camera hiện tại
      const cameraPos = this.viewer.camera.positionCartographic;
      this.formData.lat = parseFloat(
        CesiumMath.toDegrees(cameraPos.latitude).toFixed(6),
      );
      this.formData.lon = parseFloat(
        CesiumMath.toDegrees(cameraPos.longitude).toFixed(6),
      );
      this.formData.height = parseFloat(cameraPos.height.toFixed(2));

      // Auto-select LOD nếu đang filter
      if (this.selectedLOD) {
        this.formData.ma_loai_mo_hinh = this.selectedLOD;
      }

      // Auto-select cảnh đầu tiên nếu có
      if (this.sceneOptions.length > 0) {
        this.formData.ma_canh = this.sceneOptions[0].ma_canh;
      }

      this.showForm = true;
      console.log("📝 Show create form");
    },

    closeForm() {
      this.showForm = false;
      this.resetForm();
      console.log("📝 Close create form");
    },

    resetForm() {
      this.formData = {
        ten_cong_trinh: "",
        loai_cong_trinh: "NHA",
        cap_bao_mat: 0,
        ma_canh: "",
        ma_loai_mo_hinh: "",
        lat: 0,
        lon: 0,
        height: 0,
        heading: 0,
        pitch: 0,
        roll: 0,
        scale: 1.0,
        hinh_anh_file: null,
      };
    },

    handleFileUpload(event) {
      this.formData.hinh_anh_file = event.target.files[0];
      console.log("📸 File selected:", this.formData.hinh_anh_file?.name);
    },

    async createObject() {
      // Validate
      if (!this.formData.ten_cong_trinh.trim()) {
        alert("⚠️ Vui lòng nhập tên công trình!");
        return;
      }
      if (!this.formData.ma_loai_mo_hinh) {
        alert("⚠️ Vui lòng chọn LOD!");
        return;
      }
      if (!this.formData.ma_canh) {
        alert("⚠️ Vui lòng chọn cảnh!");
        return;
      }

      this.loading = true;
      try {
        const formData = new FormData();
        formData.append("ten_cong_trinh", this.formData.ten_cong_trinh);
        formData.append("loai_cong_trinh", this.formData.loai_cong_trinh);
        formData.append("cap_bao_mat", this.formData.cap_bao_mat);
        formData.append("ma_canh", this.formData.ma_canh);
        formData.append("ma_loai_mo_hinh", this.formData.ma_loai_mo_hinh);
        formData.append("lat", this.formData.lat);
        formData.append("lon", this.formData.lon);
        formData.append("height", this.formData.height);
        formData.append("heading", this.formData.heading);
        formData.append("pitch", this.formData.pitch);
        formData.append("roll", this.formData.roll);
        formData.append("scale", this.formData.scale);
        formData.append("loai_doi_tuong", 3); // Công trình
        formData.append("trang_thai", 1);

        if (this.formData.hinh_anh_file) {
          formData.append("hinh_anh_file", this.formData.hinh_anh_file);
        }

        console.log("📤 Sending create request...");
        const res = await axios.post(
          "http://localhost:8000/api/doi-tuong/create/",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        if (res.data.success) {
          alert("✅ Tạo công trình thành công!");
          this.closeForm();

          // Reload dữ liệu THẬT
          await this.loadCongTrinhData();
          this.calculateLODStats();
          this.$nextTick(() => {
            this.renderChart();
          });

          this.filterObjects();

          // Emit event để MainPage reload map
          this.$emit("object-created", this.formData.ma_canh);
        }
      } catch (err) {
        console.error("❌ Lỗi tạo công trình:", err);
        alert("❌ Lỗi: " + (err.response?.data?.error || err.message));
      } finally {
        this.loading = false;
      }
    },

    async deleteObject(id) {
      if (!confirm("❓ Bạn có chắc muốn xóa công trình này?")) return;

      this.loading = true;
      try {
        const res = await axios.delete(
          `http://localhost:8000/api/doi-tuong/${id}/delete/`,
        );
        if (res.data.success) {
          alert("✅ Đã xóa công trình!");

          // Reload dữ liệu THẬT
          await this.loadCongTrinhData();
          this.calculateLODStats();
          this.renderChart();
          this.filterObjects();
        }
      } catch (err) {
        console.error("❌ Lỗi xóa:", err);
        alert("❌ Lỗi xóa công trình!");
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.cong-trinh-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ecf0f1;
  overflow: hidden;
}

/* ==================== TOP SECTION ==================== */
.top-section {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
  padding: 20px;
  height: 60vh;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
}

.left-panel h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 20px;
}

.filter-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filter-group {
  margin-bottom: 15px;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.input-search,
.select-lod {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.input-search:focus,
.select-lod:focus {
  outline: none;
  border-color: #3498db;
}

.btn-search {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  margin-top: 15px;
  transition: transform 0.2s;
}

.btn-search:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.stats-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stats-card h3 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.stat-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  color: white;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.chart-container {
  height: 200px;
  margin-top: 15px;
}

/* ==================== MAP PANEL ==================== */
.right-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #34495e;
  color: white;
}

.map-header h3 {
  margin: 0;
  font-size: 16px;
}

.btn-add-map {
  padding: 8px 16px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.3s;
}

.btn-add-map:hover {
  background: #229954;
}

.map-container {
  flex: 1;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

/* ==================== BOTTOM TABLE ==================== */
.bottom-section {
  background: white;
  margin: 0 20px 20px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 35vh;
  display: flex;
  flex-direction: column;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 2px solid #ecf0f1;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.table-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.btn-clear {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.3s;
}

.btn-clear:hover {
  background: #c0392b;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px 20px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 10px;
  border: 1px solid #ddd;
  text-align: left;
}

.data-table th {
  background: #34495e;
  color: white;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table tbody tr:hover {
  background: #f0f8ff;
}

.badge-lod {
  background: #3498db;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.btn-sm {
  padding: 5px 10px;
  margin-right: 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: transform 0.2s;
}

.btn-sm:hover {
  transform: scale(1.1);
}

.btn-zoom {
  background: #3498db;
  color: white;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

/* ==================== LOADING ==================== */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ==================== MODAL ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #ecf0f1;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.btn-close {
  background: #e74c3c;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  transition: background 0.3s;
}

.btn-close:hover {
  background: #c0392b;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3498db;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.form-row:last-child {
  grid-template-columns: repeat(3, 1fr);
}

.required {
  color: #e74c3c;
  font-weight: bold;
}

.modal-footer {
  padding: 20px;
  border-top: 2px solid #ecf0f1;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
}

.btn-cancel {
  padding: 10px 24px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.btn-cancel:hover {
  background: #7f8c8d;
}

.btn-submit {
  padding: 10px 24px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s;
}

.btn-submit:hover {
  background: #229954;
}

/* ==================== SCROLLBAR ==================== */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #bdc3c7;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #95a5a6;
}
</style>
