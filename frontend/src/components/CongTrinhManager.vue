<template>
  <div class="cong-trinh-manager">
    <!-- TOP: Scene Selector & Search -->
    <div class="top-bar">
      <div class="scene-selector">
        <label>🌍 Chọn cảnh: <span class="required">*</span></label>
        <select
          v-model="selectedScene"
          @change="handleSceneChange"
          class="select-scene"
        >
          <option value="">-- Vui lòng chọn cảnh --</option>
          <option
            v-for="scene in sceneOptions"
            :key="scene.ma_canh"
            :value="scene.ma_canh"
          >
            {{ scene.ten_canh }}
          </option>
        </select>
      </div>

      <div class="search-box" v-if="selectedScene">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Tìm công trình..."
          class="input-search"
          @keyup.enter="handleSearch"
        />
        <button
          @click="handleSearch"
          class="btn-search"
          :disabled="!searchQuery.trim()"
        >
          Tìm & Zoom
        </button>
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="btn-clear-search"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- MIDDLE: Map + Form (side by side) -->
    <div class="middle-section">
      <!-- Map Container -->
      <div class="map-panel" :class="{ 'has-form': showForm || showI3dmForm }">
        <div class="map-header">
          <h3>🗺️ Bản đồ 3D</h3>
          <div class="map-actions">
            <button
              @click="startLocationSelection"
              class="btn-add-glb"
              :disabled="!selectedScene"
            >
              ➕ GLB / B3DM
            </button>
            <button
              @click="openI3dmForm"
              class="btn-add-i3dm"
              :disabled="!selectedScene"
            >
              🔷 I3DM
            </button>
          </div>
        </div>
        <div class="map-container">
          <div id="cesiumContainer" ref="cesiumContainer"></div>
          <div v-if="isSelectingLocation" class="click-notification">
            <div class="notification-content">
              <div class="notification-icon">👆</div>
              <div class="notification-text">
                <strong>Click đúp</strong> trên bản đồ để chọn vị trí
                <button
                  @click="cancelLocationSelection"
                  class="btn-cancel-select"
                >
                  ✕ Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== FORM GLB/B3DM (bên phải map) ========== -->
      <div v-if="showForm" class="form-panel">
        <div class="form-header">
          <h3>➕ Thêm công trình</h3>
          <button @click="closeForm" class="btn-close-form">✕</button>
        </div>

        <div class="form-body">
          <div class="form-group">
            <label>Tên công trình <span class="required">*</span></label>
            <input
              v-model="formData.ten_cong_trinh"
              type="text"
              placeholder="Nhập tên..."
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
            <label>Model <span class="required">*</span></label>
            <select
              v-model="formData.ma_loai_mo_hinh"
              @change="onModelTypeChange"
            >
              <option value="">-- Chọn Model --</option>
              <option
                v-for="lod in lodOptionsFiltered(['GLB', 'B3DM'])"
                :key="lod.value"
                :value="lod.value"
              >
                {{ lod.label }}
              </option>
            </select>
            <div class="format-badge" v-if="selectedModelFormatInfo">
              <span
                class="badge"
                :class="`badge-${selectedModelFormatInfo.toLowerCase()}`"
              >
                {{ selectedModelFormatInfo }}
              </span>
              <span class="format-desc">
                {{
                  selectedModelFormatInfo === "GLB"
                    ? "Render trực tiếp"
                    : "Load 3D Tiles"
                }}
              </span>
            </div>
          </div>

          <div class="location-info">
            <strong>📍 Vị trí đã chọn:</strong>
            <div class="coords">
              Lat: {{ formData.lat.toFixed(6) }} | Lon:
              {{ formData.lon.toFixed(6) }} | Cao:
              {{ formData.height.toFixed(2) }}m
            </div>
          </div>

          <div class="form-group">
            <label>Hình ảnh</label>
            <input type="file" @change="handleFileUpload" accept="image/*" />
          </div>
        </div>

        <div class="form-footer">
          <button @click="closeForm" class="btn-cancel">Hủy</button>
          <button @click="createObject" class="btn-submit">
            ✅ Tạo công trình
          </button>
        </div>
      </div>

      <!-- ========== FORM I3DM (bên phải map) ========== -->
      <div v-if="showI3dmForm" class="form-panel form-panel-i3dm">
        <div class="form-header form-header-i3dm">
          <div>
            <h3>🔷 Thêm I3DM (Instanced)</h3>
            <p class="form-subtitle">
              Chọn GLB model, click bản đồ để thêm vị trí
            </p>
          </div>
          <button @click="closeI3dmForm" class="btn-close-form">✕</button>
        </div>

        <div class="form-body">
          <div class="form-row">
            <div class="form-group">
              <label>Tên nhóm <span class="required">*</span></label>
              <input
                v-model="i3dmFormData.ten_cong_trinh"
                type="text"
                placeholder="VD: Hàng cây..."
              />
            </div>
            <div class="form-group">
              <label>Model GLB <span class="required">*</span></label>
              <select v-model="i3dmFormData.ma_loai_mo_hinh">
                <option value="">-- Chọn GLB --</option>
                <option
                  v-for="lod in lodOptionsFiltered(['GLB'])"
                  :key="lod.value"
                  :value="lod.value"
                >
                  {{ lod.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- ✅ Upload GLB mới (tùy chọn) -->
          <div class="form-group upload-section">
            <label>📤 Hoặc upload GLB mới (tùy chọn)</label>
            <div class="file-upload-box">
              <input
                type="file"
                id="glbUpload"
                @change="handleGlbUpload"
                accept=".glb"
                class="file-input"
              />
              <label for="glbUpload" class="file-label">
                <span v-if="!uploadedGlbFile">📁 Chọn file GLB</span>
                <span v-else>✅ {{ uploadedGlbFile.name }}</span>
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Loại công trình</label>
              <select v-model="i3dmFormData.loai_cong_trinh">
                <option value="NHA">Nhà</option>
                <option value="CHUNGCU">Chung cư</option>
                <option value="TRUONG">Trường học</option>
                <option value="BENH_VIEN">Bệnh viện</option>
                <option value="KHAC">Khác</option>
              </select>
            </div>
            <div class="form-group">
              <label>Cấp bảo mật</label>
              <select v-model="i3dmFormData.cap_bao_mat">
                <option :value="0">Công khai</option>
                <option :value="1">Hạn chế</option>
                <option :value="2">Mật</option>
                <option :value="3">Tối mật</option>
              </select>
            </div>
          </div>

          <div class="instances-section">
            <div class="instances-header">
              <h4>📍 Danh sách vị trí ({{ i3dmFormData.instances.length }})</h4>
              <div class="instances-actions">
                <button @click="addInstanceFromMap" class="btn-pick">
                  🗺️ Click map
                </button>
                <button @click="addInstanceManual" class="btn-add-manual">
                  ➕ Thủ công
                </button>
              </div>
            </div>

            <div
              class="instances-empty"
              v-if="i3dmFormData.instances.length === 0"
            >
              ⚠️ Chưa có vị trí nào
            </div>

            <div
              class="instances-table-wrapper"
              v-if="i3dmFormData.instances.length > 0"
            >
              <table class="instances-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Lat</th>
                    <th>Lon</th>
                    <th>Height</th>
                    <th>Heading</th>
                    <th>Scale</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(inst, idx) in i3dmFormData.instances" :key="idx">
                    <td class="inst-num">{{ idx + 1 }}</td>
                    <td>
                      <input
                        v-model.number="inst.lat"
                        type="number"
                        step="0.000001"
                        class="inst-input"
                      />
                    </td>
                    <td>
                      <input
                        v-model.number="inst.lon"
                        type="number"
                        step="0.000001"
                        class="inst-input"
                      />
                    </td>
                    <td>
                      <input
                        v-model.number="inst.height"
                        type="number"
                        step="0.5"
                        class="inst-input-sm"
                      />
                    </td>
                    <td>
                      <input
                        v-model.number="inst.heading"
                        type="number"
                        step="1"
                        min="0"
                        max="360"
                        class="inst-input-sm"
                      />
                    </td>
                    <td>
                      <input
                        v-model.number="inst.scale"
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        class="inst-input-sm"
                      />
                    </td>
                    <td>
                      <button @click="removeInstance(idx)" class="btn-remove">
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="isPickingI3dmInstance" class="picking-notice">
              👆 Đang chờ click trên bản đồ...
              <button
                @click="cancelPickingI3dmInstance"
                class="btn-cancel-pick"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>

        <div class="form-footer">
          <div class="footer-info">
            <span class="badge badge-i3dm">I3DM</span>
            {{ i3dmFormData.instances.length }} instances
          </div>
          <div>
            <button @click="closeI3dmForm" class="btn-cancel">Hủy</button>
            <button
              @click="createI3dmObject"
              class="btn-submit btn-submit-i3dm"
              :disabled="i3dmFormData.instances.length === 0"
            >
              🔷 Tạo I3DM
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- BOTTOM: Table -->
    <div class="bottom-section" v-if="selectedScene">
      <div class="table-header">
        <h3>
          📋 Danh sách công trình - {{ getSceneName(selectedScene) }}
          <span v-if="searchResults.length > 0"
            >({{ searchResults.length }} kết quả)</span
          >
        </h3>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên công trình</th>
              <th>Model</th>
              <th>Định dạng</th>
              <th>Lat / Lon</th>
              <th>Instances</th>
              <th>Thời gian tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="tableObjects.length === 0">
              <td colspan="8" class="empty-row">📭 Không có công trình</td>
            </tr>
            <tr
              v-for="item in tableObjects"
              :key="item.id"
              :class="{ 'row-i3dm': item.format_type === 'I3DM' }"
            >
              <td>{{ item.id }}</td>
              <td>
                <strong>{{ item.ten_cong_trinh }}</strong>
              </td>
              <td>
                <span class="badge-model">{{ item.model_name }}</span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="`badge-${item.format_type?.toLowerCase() || 'glb'}`"
                  >{{ item.format_type || "GLB" }}</span
                >
              </td>
              <td>
                <template v-if="item.format_type === 'I3DM'">
                  <span class="text-muted">📦 Xem tileset</span>
                </template>
                <template v-else>
                  {{ item.lat.toFixed(5) }}, {{ item.lon.toFixed(5) }}
                </template>
              </td>
              <td>
                <template v-if="item.format_type === 'I3DM'">
                  <span class="badge-instances">{{
                    item.instance_count || "?"
                  }}</span>
                </template>
                <template v-else>
                  <span class="text-muted">1</span>
                </template>
              </td>
              <td>{{ item.thoi_gian_tao }}</td>
              <td>
                <button
                  @click="zoomToObject(item)"
                  class="btn-sm btn-zoom"
                  title="Zoom"
                >
                  🔍
                </button>
                <button
                  v-if="item.format_type === 'I3DM'"
                  @click="viewI3dmDetail(item)"
                  class="btn-sm btn-detail"
                  title="Chi tiết"
                >
                  📋
                </button>
                <button
                  @click="deleteObject(item.id)"
                  class="btn-sm btn-delete"
                  title="Xóa"
                >
                  🗑️
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <!-- Modal: I3DM Detail (view only) -->
    <div
      v-if="showI3dmDetail"
      class="modal-overlay"
      @click.self="showI3dmDetail = false"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3>📋 Chi tiết I3DM: {{ selectedI3dmItem?.ten_cong_trinh }}</h3>
          <button @click="showI3dmDetail = false" class="btn-close-modal">
            ✕
          </button>
        </div>
        <div class="modal-body">
          <div class="i3dm-info">
            <div class="info-row">
              <span class="info-label">Model:</span>
              <span class="info-value">{{ selectedI3dmItem?.model_name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Số instances:</span>
              <span class="info-value">
                <span class="badge-instances">{{
                  selectedI3dmItem?.instance_count || "?"
                }}</span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">Định dạng:</span>
              <span class="info-value"
                ><span class="badge badge-i3dm">I3DM</span></span
              >
            </div>
          </div>

          <div
            v-if="selectedI3dmItem?.instances?.length"
            class="instances-table-wrapper"
          >
            <table class="instances-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lat</th>
                  <th>Lon</th>
                  <th>Height</th>
                  <th>Heading</th>
                  <th>Scale</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(inst, i) in selectedI3dmItem.instances" :key="i">
                  <td>{{ i + 1 }}</td>
                  <td>{{ inst.lat?.toFixed(6) }}</td>
                  <td>{{ inst.lon?.toFixed(6) }}</td>
                  <td>{{ inst.height }}m</td>
                  <td>{{ inst.heading }}°</td>
                  <td>{{ inst.scale }}x</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty-instances">Không có dữ liệu instances</div>
        </div>
        <div class="modal-footer">
          <button @click="showI3dmDetail = false" class="btn-cancel">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Color,
  Cesium3DTileset,
  Cartographic,
  defined,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  CesiumTerrainProvider,
  Transforms,
  HeadingPitchRoll,
  Model,
} from "cesium";
import axios from "axios";

const BASE = "http://localhost:8000";

export default {
  name: "CongTrinhManager",

  data() {
    return {
      loading: false,
      loadingMessage: "Đang tải...",
      searchQuery: "",
      selectedScene: "",

      lodOptions: [],
      sceneOptions: [],
      displayedObjects: [],
      searchResults: [],

      viewer: null,
      handler: null,
      loadedModels: [],

      // Form GLB/B3DM
      showForm: false,
      isSelectingLocation: false,
      selectedModelFormatInfo: null,
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

      // Form I3DM
      showI3dmForm: false,
      isPickingI3dmInstance: false,
      i3dmPickHandler: null,
      uploadedGlbFile: null, // ✅ File GLB upload
      i3dmFormData: {
        ten_cong_trinh: "",
        loai_cong_trinh: "KHAC",
        cap_bao_mat: 0,
        ma_loai_mo_hinh: "",
        instances: [],
      },

      // Modal detail
      showI3dmDetail: false,
      selectedI3dmItem: null,
    };
  },

  computed: {
    tableObjects() {
      return this.searchQuery.trim()
        ? this.searchResults
        : this.displayedObjects;
    },
  },

  async mounted() {
    this.initCesiumMap();
    await this.loadOptions();
  },

  beforeUnmount() {
    if (this.handler) this.handler.destroy();
    if (this.i3dmPickHandler) this.i3dmPickHandler.destroy();
    if (this.viewer) this.viewer.destroy();
  },

  methods: {
    async loadOptions() {
      this.loading = true;
      try {
        await Promise.all([this.loadLODOptions(), this.loadSceneOptions()]);
      } catch (err) {
        alert("❌ Lỗi tải dữ liệu!");
      } finally {
        this.loading = false;
      }
    },

    async loadLODOptions() {
      const res = await axios.get(`${BASE}/QLModel/api/loai-mo-hinh/options/`);
      if (res.data.success) {
        this.lodOptions = res.data.data.map((opt) => ({
          ...opt,
          format_type: opt.format_type || this._detectFormat(opt.label),
        }));
      }
    },

    _detectFormat(label = "") {
      const l = label.toLowerCase();
      if (l.includes("i3dm")) return "I3DM";
      if (l.includes("b3dm")) return "B3DM";
      return "GLB";
    },

    lodOptionsFiltered(formats) {
      return this.lodOptions.filter((opt) => formats.includes(opt.format_type));
    },

    async loadSceneOptions() {
      const res = await axios.get(`${BASE}/QLModel/api/canh/options/`);
      if (res.data.success) this.sceneOptions = res.data.data;
    },

    async handleSceneChange() {
      if (!this.selectedScene) {
        this.displayedObjects = [];
        this.searchResults = [];
        this.searchQuery = "";
        this.clearMap();
        return;
      }
      this.loading = true;
      this.loadingMessage = `Đang tải cảnh ${this.getSceneName(
        this.selectedScene,
      )}...`;
      try {
        await this.loadCongTrinhData(this.selectedScene);
        await this.loadSceneData(this.selectedScene);
      } catch (err) {
        console.error("❌ Lỗi load cảnh:", err);
        alert("❌ Lỗi tải dữ liệu cảnh!");
      } finally {
        this.loading = false;
      }
    },

    async loadCongTrinhData(ma_canh) {
      const res = await axios.get(`${BASE}/QLModel/api/cong-trinh/lod/`, {
        params: { page_size: 1000, ma_canh },
      });

      if (res.data.success) {
        this.displayedObjects = res.data.data.map((item) => {
          const fmt =
            item.format_type || this._detectFormat(item.ten_loai_mo_hinh || "");
          return {
            id: item.id,
            ten_cong_trinh: item.ten_cong_trinh || `Công trình #${item.id}`,
            loai_cong_trinh: item.loai_cong_trinh || "NHA",
            cap_bao_mat: item.cap_bao_mat || 0,
            model_name: item.ten_loai_mo_hinh || item.lod || "Không xác định",
            loai_mo_hinh_id: item.loai_mo_hinh_id,
            format_type: fmt,
            ma_canh: item.ma_canh || "-",
            lat: parseFloat(item.lat) || 0,
            lon: parseFloat(item.lon) || 0,
            height: parseFloat(item.height) || 0,
            thoi_gian_tao: item.thoi_gian_tao || "-",
            instance_count: item.instance_count || null,
            tileset_url: item.tileset_url || null,
            instances: item.instances || [],
          };
        });
      }
    },

    handleSearch() {
      if (!this.searchQuery.trim()) {
        alert("⚠️ Nhập tên công trình!");
        return;
      }
      const q = this.searchQuery.toLowerCase();
      this.searchResults = this.displayedObjects.filter((o) =>
        o.ten_cong_trinh.toLowerCase().includes(q),
      );
      if (this.searchResults.length > 0)
        this.zoomToObject(this.searchResults[0]);
      else alert("❌ Không tìm thấy!");
    },

    clearSearch() {
      this.searchQuery = "";
      this.searchResults = [];
    },

    getSceneName(ma_canh) {
      const scene = this.sceneOptions.find((s) => s.ma_canh === ma_canh);
      return scene ? scene.ten_canh : "Không xác định";
    },

    initCesiumMap() {
      this.$nextTick(() => {
        if (!this.$refs.cesiumContainer) return;
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
        this.viewer.camera.setView({
          destination: Cartesian3.fromDegrees(105.77, 10.03, 20000000),
          orientation: {
            heading: 0,
            pitch: CesiumMath.toRadians(-90),
            roll: 0,
          },
        });
        this.setupClickHandler();
      });
    },

    setupClickHandler() {
      if (!this.viewer) return;
      this.handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
      this.handler.setInputAction((movement) => {
        if (!this.isSelectingLocation) return;

        // ✅ Dùng pickPosition để bám terrain
        let cartesian = this.viewer.scene.pickPosition(movement.position);

        // Fallback nếu không có terrain
        if (!cartesian) {
          const ray = this.viewer.camera.getPickRay(movement.position);
          cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        }

        if (defined(cartesian)) {
          const carto = Cartographic.fromCartesian(cartesian);
          this.formData.lat = parseFloat(
            CesiumMath.toDegrees(carto.latitude).toFixed(6),
          );
          this.formData.lon = parseFloat(
            CesiumMath.toDegrees(carto.longitude).toFixed(6),
          );
          this.formData.height = parseFloat(carto.height.toFixed(2));
          this._addMarker(cartesian, "📍 Vị trí mới", Color.YELLOW);
          this.isSelectingLocation = false;
          this.showFormWithLocation();
        }
      }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    },

    async loadSceneData(ma_canh) {
      if (!this.viewer) return;
      try {
        this.clearMap();
        const sceneRes = await axios.get(`${BASE}/QLModel/api/scenes/`);
        const scene = sceneRes.data.scenes.find((s) => s.ma_canh === ma_canh);
        if (!scene) return;

        if (scene.url_terrain) {
          try {
            this.viewer.terrainProvider = await CesiumTerrainProvider.fromUrl(
              scene.url_terrain,
              { requestVertexNormals: true },
            );
          } catch (e) {
            console.warn("⚠️ Terrain:", e.message);
          }
        }

        const modelsRes = await axios.get(
          `${BASE}/QLModel/api/scenes/${ma_canh}/models/`,
        );
        if (modelsRes.data.success) {
          for (const model of modelsRes.data.models)
            await this.loadModel(model);
        }

        await this.loadCongTrinhModels();

        this.viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            scene.camera.lon,
            scene.camera.lat,
            scene.camera.height,
          ),
          orientation: {
            heading: CesiumMath.toRadians(scene.camera.heading),
            pitch: CesiumMath.toRadians(scene.camera.pitch),
            roll: CesiumMath.toRadians(scene.camera.roll),
          },
          duration: 2,
        });
      } catch (err) {
        console.error("❌ loadSceneData:", err);
      }
    },

    async loadModel(model) {
      if (!this.viewer) return;
      try {
        const modelUrl = model.url_glb || model.url_b3dm;
        if (!modelUrl) return;
        const position = Cartesian3.fromDegrees(
          model.position.lon,
          model.position.lat,
          model.position.height,
        );
        if (model.url_glb) {
          const mm = Transforms.headingPitchRollToFixedFrame(
            position,
            new HeadingPitchRoll(
              CesiumMath.toRadians(model.orientation.heading || 0),
              CesiumMath.toRadians(model.orientation.pitch || 0),
              CesiumMath.toRadians(model.orientation.roll || 0),
            ),
          );
          const m = await Model.fromGltfAsync({
            url: modelUrl,
            modelMatrix: mm,
            scale: model.scale || 1.0,
            incrementallyLoadTextures: true,
          });
          this.viewer.scene.primitives.add(m);
          this.loadedModels.push(m);
        } else {
          const ts = await Cesium3DTileset.fromUrl(modelUrl);
          this.viewer.scene.primitives.add(ts);
          this.loadedModels.push(ts);
        }
      } catch (e) {
        console.error(`❌ loadModel ${model.id}:`, e.message);
      }
    },

    async loadCongTrinhModels() {
      for (const ct of this.displayedObjects) {
        if (ct.loai_mo_hinh_id) await this.loadCongTrinhModel(ct);
      }
    },

    async loadCongTrinhModel(congTrinh) {
      try {
        const res = await axios.get(
          `${BASE}/QLModel/api/model-types/${congTrinh.loai_mo_hinh_id}/`,
        );
        if (!res.data.success) return false;

        const mt = res.data.data;
        const fmt = congTrinh.format_type;

        if (fmt === "I3DM" || mt.url_i3dm) {
          let tilesetUrl = mt.url_tileset || mt.url_i3dm;
          if (!tilesetUrl) return false;
          if (!tilesetUrl.startsWith("http"))
            tilesetUrl = `${BASE}/media/${tilesetUrl}`;
          const tileset = await Cesium3DTileset.fromUrl(tilesetUrl);
          this.viewer.scene.primitives.add(tileset);
          this.loadedModels.push(tileset);
          return true;
        }

        if (fmt === "B3DM" || mt.url_b3dm) {
          let url = mt.url_b3dm;
          if (!url) return false;
          if (!url.startsWith("http")) url = `${BASE}/media/${url}`;
          const tileset = await Cesium3DTileset.fromUrl(url);
          this.viewer.scene.primitives.add(tileset);
          this.loadedModels.push(tileset);
          return true;
        }

        if (mt.url_glb) {
          let url = mt.url_glb;
          if (!url.startsWith("http")) url = `${BASE}/media/${url}`;
          const position = Cartesian3.fromDegrees(
            congTrinh.lon,
            congTrinh.lat,
            congTrinh.height,
          );
          const mm = Transforms.headingPitchRollToFixedFrame(
            position,
            new HeadingPitchRoll(
              CesiumMath.toRadians(congTrinh.heading || 0),
              CesiumMath.toRadians(congTrinh.pitch || 0),
              CesiumMath.toRadians(congTrinh.roll || 0),
            ),
          );
          const model = await Model.fromGltfAsync({
            url,
            modelMatrix: mm,
            scale: congTrinh.scale || 1.0,
            incrementallyLoadTextures: true,
          });
          this.viewer.scene.primitives.add(model);
          this.loadedModels.push(model);
          return true;
        }

        return false;
      } catch (e) {
        console.error(`❌ loadCongTrinhModel ${congTrinh.id}:`, e.message);
        return false;
      }
    },

    clearMap() {
      if (!this.viewer) return;
      this.viewer.entities.removeAll();
      this.loadedModels.forEach((item) => {
        try {
          this.viewer.scene.primitives.remove(item);
        } catch (e) {}
      });
      this.loadedModels = [];
      this.viewer.terrainProvider = undefined;
    },

    // ✅ FIX: Zoom với góc 30° và khoảng cách gần hơn
    zoomToObject(obj) {
      if (!this.viewer) return;
      const lat = obj.lat || 0;
      const lon = obj.lon || 0;
      const height = obj.height || 0;

      // ✅ Zoom tới object với distance 150m và pitch -30°
      this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, height + 150), // 150m phía trên object
        duration: 2,
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-30), // Góc nhìn 30°
          roll: 0,
        },
      });

      this._addMarker(
        Cartesian3.fromDegrees(lon, lat, height + 5),
        obj.ten_cong_trinh,
        Color.RED,
      );
    },

    _addMarker(cartesian, text, color) {
      // ✅ KHÔNG xóa entities - giữ tất cả marker
      this.viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 15,
          color,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text,
          font: "14px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cartesian3(0, -20, 0),
        },
      });
    },

    // ========== FORM GLB/B3DM ==========
    startLocationSelection() {
      if (!this.viewer) {
        alert("Bản đồ chưa sẵn sàng!");
        return;
      }
      if (!this.selectedScene) {
        alert("⚠️ Chọn cảnh trước!");
        return;
      }
      this.resetForm();
      this.isSelectingLocation = true;
    },

    showFormWithLocation() {
      this.formData.ma_canh = this.selectedScene;
      this.showForm = true;
    },

    cancelLocationSelection() {
      this.isSelectingLocation = false;
    },

    closeForm() {
      this.showForm = false;
      this.isSelectingLocation = false;
      this.resetForm();
    },

    resetForm() {
      this.formData = {
        ten_cong_trinh: "",
        loai_cong_trinh: "NHA",
        cap_bao_mat: 0,
        ma_canh: this.selectedScene || "",
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
      this.selectedModelFormatInfo = null;
    },

    onModelTypeChange() {
      const opt = this.lodOptions.find(
        (o) => o.value === this.formData.ma_loai_mo_hinh,
      );
      this.selectedModelFormatInfo = opt?.format_type || null;
    },

    handleFileUpload(event) {
      this.formData.hinh_anh_file = event.target.files[0];
    },

    async createObject() {
      if (!this.formData.ten_cong_trinh.trim()) {
        alert("⚠️ Nhập tên!");
        return;
      }
      if (!this.formData.ma_loai_mo_hinh) {
        alert("⚠️ Chọn Model!");
        return;
      }
      if (!this.formData.lat && !this.formData.lon) {
        alert("⚠️ Vị trí không hợp lệ!");
        return;
      }

      this.loading = true;
      this.loadingMessage = "Đang tạo...";
      try {
        const fd = new FormData();
        Object.entries(this.formData).forEach(([k, v]) => {
          if (k === "hinh_anh_file") {
            if (v) fd.append(k, v);
          } else fd.append(k, v);
        });
        fd.append("loai_doi_tuong", 3);
        fd.append("trang_thai", 1);

        const res = await axios.post(
          `${BASE}/QLModel/api/doi-tuong/create/`,
          fd,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        if (res.data.success) {
          alert("✅ Tạo thành công!");
          this.closeForm();
          await this.handleSceneChange();
          this.$emit("object-created", this.formData.ma_canh);
        }
      } catch (err) {
        alert("❌ Lỗi: " + (err.response?.data?.error || err.message));
      } finally {
        this.loading = false;
      }
    },

    // ========== FORM I3DM ==========
    openI3dmForm() {
      if (!this.selectedScene) {
        alert("⚠️ Chọn cảnh trước!");
        return;
      }
      this.i3dmFormData = {
        ten_cong_trinh: "",
        loai_cong_trinh: "KHAC",
        cap_bao_mat: 0,
        ma_loai_mo_hinh: "",
        instances: [],
      };
      this.uploadedGlbFile = null;
      this.showI3dmForm = true;
    },

    closeI3dmForm() {
      this.showI3dmForm = false;
      this.cancelPickingI3dmInstance();
      this.uploadedGlbFile = null;
    },

    // ✅ Upload GLB file
    handleGlbUpload(event) {
      const file = event.target.files[0];
      if (file && file.name.toLowerCase().endsWith(".glb")) {
        this.uploadedGlbFile = file;
        // Nếu upload file, clear model selection
        this.i3dmFormData.ma_loai_mo_hinh = "";
      } else {
        alert("⚠️ Chỉ chấp nhận file .glb!");
        event.target.value = "";
      }
    },

    addInstanceFromMap() {
      if (!this.viewer) {
        alert("Bản đồ chưa sẵn sàng!");
        return;
      }
      this.isPickingI3dmInstance = true;

      if (this.i3dmPickHandler) this.i3dmPickHandler.destroy();
      this.i3dmPickHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );

      this.i3dmPickHandler.setInputAction((movement) => {
        // ✅ Dùng pickPosition để bám terrain
        let cartesian = this.viewer.scene.pickPosition(movement.position);

        if (!cartesian) {
          const ray = this.viewer.camera.getPickRay(movement.position);
          cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        }

        if (defined(cartesian)) {
          const carto = Cartographic.fromCartesian(cartesian);
          const lat = parseFloat(
            CesiumMath.toDegrees(carto.latitude).toFixed(6),
          );
          const lon = parseFloat(
            CesiumMath.toDegrees(carto.longitude).toFixed(6),
          );
          const height = parseFloat(carto.height.toFixed(2));

          this.i3dmFormData.instances.push({
            lat,
            lon,
            height,
            heading: 0,
            scale: 1.0,
          });

          this.viewer.entities.add({
            position: Cartesian3.fromDegrees(lon, lat, height + 10),
            point: {
              pixelSize: 10,
              color: Color.fromCssColorString("#9b59b6"),
              outlineColor: Color.WHITE,
              outlineWidth: 2,
            },
            label: {
              text: `#${this.i3dmFormData.instances.length}`,
              font: "12px sans-serif",
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 1,
              pixelOffset: new Cartesian3(0, -18, 0),
            },
          });

          this.isPickingI3dmInstance = false;
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    },

    cancelPickingI3dmInstance() {
      this.isPickingI3dmInstance = false;
      if (this.i3dmPickHandler) {
        this.i3dmPickHandler.destroy();
        this.i3dmPickHandler = null;
      }
    },

    addInstanceManual() {
      this.i3dmFormData.instances.push({
        lat: 0,
        lon: 0,
        height: 0,
        heading: 0,
        scale: 1.0,
      });
    },

    removeInstance(idx) {
      this.i3dmFormData.instances.splice(idx, 1);
    },

    // ✅ Tạo I3DM từ GLB model
    async createI3dmObject() {
      if (!this.i3dmFormData.ten_cong_trinh.trim()) {
        alert("⚠️ Nhập tên!");
        return;
      }

      // Validate: phải có model HOẶC file upload
      if (!this.i3dmFormData.ma_loai_mo_hinh && !this.uploadedGlbFile) {
        alert("⚠️ Chọn GLB model hoặc upload file GLB!");
        return;
      }

      if (this.i3dmFormData.instances.length === 0) {
        alert("⚠️ Thêm ít nhất 1 vị trí!");
        return;
      }

      this.loading = true;
      this.loadingMessage = "Đang tạo I3DM từ GLB...";

      try {
        if (this.uploadedGlbFile) {
          // ========== UPLOAD FILE MỚI ==========
          const fd = new FormData();
          fd.append("glb_file", this.uploadedGlbFile);
          fd.append("instances", JSON.stringify(this.i3dmFormData.instances));
          fd.append("name", this.i3dmFormData.ten_cong_trinh);

          console.log(`🔗 Calling: ${BASE}/api/i3dm/generate-from-upload/`);
          const res = await axios.post(
            `${BASE}/api/i3dm/generate-from-upload/`,
            fd,
            {
              headers: { "Content-Type": "multipart/form-data" },
            },
          );

          if (res.data.success) {
            alert(
              `✅ Tạo I3DM thành công! (${this.i3dmFormData.instances.length} instances)`,
            );
            console.log("✅ I3DM created:", res.data);
            this.closeI3dmForm();
            this.viewer?.entities.removeAll();

            // ✅ Reload scene để hiện I3DM mới
            await this.handleSceneChange();
          }
        } else {
          // ========== DÙNG MODEL CÓ SẴN ==========
          const payload = {
            model_id: parseInt(this.i3dmFormData.ma_loai_mo_hinh),
            instances: this.i3dmFormData.instances,
          };

          console.log(`🔗 Calling: ${BASE}/api/i3dm/generate-from-points/`);
          console.log("📦 Payload:", payload);

          const res = await axios.post(
            `${BASE}/api/i3dm/generate-from-points/`,
            payload,
            {
              headers: { "Content-Type": "application/json" },
            },
          );

          if (res.data.success) {
            alert(
              `✅ Tạo I3DM thành công! (${this.i3dmFormData.instances.length} instances)`,
            );
            console.log("✅ I3DM created:", res.data);
            this.closeI3dmForm();
            this.viewer?.entities.removeAll();

            // ✅ Reload scene để hiện I3DM mới
            await this.handleSceneChange();
          }
        }
      } catch (err) {
        console.error("❌ Create I3DM error:", err);
        console.error("❌ Response:", err.response?.data);
        alert("❌ Lỗi: " + (err.response?.data?.error || err.message));
      } finally {
        this.loading = false;
      }
    },

    viewI3dmDetail(item) {
      this.selectedI3dmItem = item;
      this.showI3dmDetail = true;
    },

    async deleteObject(id) {
      if (!confirm("❓ Xóa công trình này?")) return;
      this.loading = true;
      this.loadingMessage = "Đang xóa...";
      try {
        const res = await axios.delete(
          `${BASE}/QLModel/api/doi-tuong/${id}/delete/`,
        );
        if (res.data.success) {
          alert("✅ Đã xóa!");
          await this.handleSceneChange();
        }
      } catch (err) {
        alert("❌ Lỗi xóa!");
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
  height: 100%;
  background: #ecf0f1;
  overflow: hidden;
  padding: 12px;
  gap: 12px;
}

/* ========== TOP BAR ========== */
.top-bar {
  display: flex;
  gap: 12px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.scene-selector {
  flex: 0 0 350px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scene-selector label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
  white-space: nowrap;
}

.select-scene {
  flex: 1;
  padding: 8px 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}

.select-scene:focus {
  outline: none;
  border-color: #3498db;
}

.search-box {
  flex: 1;
  display: flex;
  gap: 8px;
}

.input-search {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}

.input-search:focus {
  outline: none;
  border-color: #3498db;
}

.btn-search {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-search:hover:not(:disabled) {
  background: #2980b9;
}

.btn-search:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.btn-clear-search {
  padding: 8px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.btn-clear-search:hover {
  background: #c0392b;
}

/* ========== MIDDLE SECTION (Map + Form) ========== */
.middle-section {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.map-panel {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: flex 0.3s;
}

.map-panel.has-form {
  flex: 0 0 60%;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #34495e;
  color: white;
  flex-shrink: 0;
}

.map-header h3 {
  margin: 0;
  font-size: 15px;
}

.map-actions {
  display: flex;
  gap: 8px;
}

.btn-add-glb,
.btn-add-i3dm {
  padding: 7px 14px;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-add-glb {
  background: #27ae60;
}

.btn-add-glb:hover:not(:disabled) {
  background: #229954;
}

.btn-add-i3dm {
  background: #9b59b6;
}

.btn-add-i3dm:hover:not(:disabled) {
  background: #8e44ad;
}

.btn-add-glb:disabled,
.btn-add-i3dm:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.map-container {
  flex: 1 1 0;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

#cesiumContainer {
  position: absolute;
  inset: 0;
}

.click-notification {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  animation: slideDown 0.4s;
}

.notification-content {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 12px 20px;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-icon {
  font-size: 26px;
  animation: bounce 2s infinite;
}

.notification-text {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-cancel-select {
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

/* ========== FORM PANEL ========== */
.form-panel {
  flex: 0 0 40%;
  min-width: 380px;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideInRight 0.3s;
}

.form-panel-i3dm {
  min-width: 420px;
}

.form-header {
  padding: 14px 18px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.form-header-i3dm {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
}

.form-header h3 {
  margin: 0;
  font-size: 15px;
  color: white;
}

.form-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  opacity: 0.95;
}

.btn-close-form {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close-form:hover {
  background: rgba(255, 255, 255, 0.3);
}

.form-body {
  flex: 1 1 0;
  padding: 18px;
  overflow-y: auto;
  min-height: 0;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 13px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 10px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3498db;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.required {
  color: #e74c3c;
  font-weight: bold;
}

.format-badge {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e0e0e0;
}

.badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  color: white;
}

.badge-glb {
  background: #3498db;
}

.badge-b3dm {
  background: #e67e22;
}

.badge-i3dm {
  background: #9b59b6;
}

.format-desc {
  font-size: 12px;
  color: #666;
}

.location-info {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #155724;
}

.location-info strong {
  display: block;
  margin-bottom: 4px;
}

.coords {
  font-family: "Courier New", monospace;
  font-size: 11px;
}

/* ✅ Upload section */
.upload-section {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 2px dashed #ddd;
}

.file-upload-box {
  position: relative;
}

.file-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.file-label {
  display: block;
  padding: 10px 16px;
  background: white;
  border: 2px solid #3498db;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  color: #3498db;
  font-weight: 600;
  transition: all 0.3s;
}

.file-label:hover {
  background: #3498db;
  color: white;
}

.form-footer {
  padding: 12px 18px;
  border-top: 2px solid #ecf0f1;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #555;
}

.btn-cancel {
  padding: 8px 18px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}

.btn-cancel:hover {
  background: #7f8c8d;
}

.btn-submit {
  padding: 8px 18px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}

.btn-submit:hover {
  background: #229954;
}

.btn-submit-i3dm {
  background: #9b59b6;
}

.btn-submit-i3dm:hover {
  background: #8e44ad;
}

.btn-submit:disabled,
.btn-submit-i3dm:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

/* ========== INSTANCES SECTION ========== */
.instances-section {
  margin-top: 12px;
  border: 2px solid #d7aefb;
  border-radius: 8px;
  overflow: hidden;
}

.instances-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #f3e8ff, #faf5ff);
}

.instances-header h4 {
  margin: 0;
  color: #8e44ad;
  font-size: 13px;
}

.instances-actions {
  display: flex;
  gap: 8px;
}

.btn-pick,
.btn-add-manual {
  padding: 6px 12px;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-pick {
  background: #3498db;
}

.btn-pick:hover {
  background: #2980b9;
}

.btn-add-manual {
  background: #9b59b6;
}

.btn-add-manual:hover {
  background: #8e44ad;
}

.instances-empty {
  padding: 20px;
  text-align: center;
  color: #95a5a6;
  font-size: 13px;
}

.instances-table-wrapper {
  max-height: 300px;
  overflow-y: auto;
}

.instances-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.instances-table th {
  background: #9b59b6;
  color: white;
  padding: 7px 8px;
  font-weight: 600;
  font-size: 11px;
  position: sticky;
  top: 0;
}

.instances-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #f0e6ff;
}

.instances-table tr:hover td {
  background: #faf5ff;
}

.inst-num {
  font-weight: 600;
  color: #9b59b6;
  text-align: center;
}

.inst-input {
  width: 90px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.inst-input-sm {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.btn-remove {
  padding: 3px 7px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.btn-remove:hover {
  background: #c0392b;
}

.picking-notice {
  padding: 10px 14px;
  background: #fff3cd;
  border-top: 1px solid #ffc107;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #856404;
  animation: pulse 1.5s infinite;
}

.btn-cancel-pick {
  padding: 4px 10px;
  background: #856404;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

/* ========== BOTTOM TABLE ========== */
.bottom-section {
  flex: 0 0 220px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-header {
  padding: 10px 16px;
  border-bottom: 2px solid #ecf0f1;
  background: #f8f9fa;
  flex-shrink: 0;
}

.table-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 14px;
}

.table-wrapper {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: auto;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th,
.data-table td {
  padding: 7px 10px;
  border: 1px solid #e0e0e0;
  text-align: left;
  white-space: nowrap;
}

.data-table th {
  background: #34495e;
  color: white;
  font-weight: 600;
  font-size: 11px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table tbody tr:hover {
  background: #f0f8ff;
}

.row-i3dm {
  background: #faf5ff !important;
}

.row-i3dm:hover {
  background: #f3e8ff !important;
}

.empty-row {
  text-align: center;
  padding: 40px;
  color: #95a5a6;
  font-size: 14px;
}

.badge-model {
  background: #3498db;
  color: white;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.badge-instances {
  background: #f3e8ff;
  color: #9b59b6;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #d7aefb;
}

.text-muted {
  color: #95a5a6;
  font-size: 11px;
}

.btn-sm {
  padding: 4px 8px;
  margin-right: 3px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-sm:hover {
  transform: scale(1.12);
}

.btn-zoom {
  background: #3498db;
  color: white;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

.btn-detail {
  background: #9b59b6;
  color: white;
}

/* ========== LOADING ========== */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  color: white;
  gap: 16px;
}

.spinner {
  width: 46px;
  height: 46px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

/* ========== MODAL (Detail only) ========== */
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
  max-width: 680px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px solid #ecf0f1;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 15px;
}

.btn-close-modal {
  background: #e74c3c;
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.btn-close-modal:hover {
  background: #c0392b;
}

.modal-body {
  padding: 18px 20px;
}

.i3dm-info {
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #ecf0f1;
}

.info-label {
  font-weight: 600;
  color: #7f8c8d;
  flex: 0 0 120px;
}

.info-value {
  flex: 1;
  color: #2c3e50;
}

.empty-instances {
  text-align: center;
  padding: 30px;
  color: #95a5a6;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 2px solid #ecf0f1;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
  display: flex;
  justify-content: flex-end;
}

/* ========== ANIMATIONS ========== */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -16px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* ========== SCROLLBAR ========== */
::-webkit-scrollbar {
  width: 7px;
  height: 7px;
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
