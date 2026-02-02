/* eslint-disable */
import * as Cesium from "cesium";
import {
  Ion,
  Viewer,
  Cartesian3,
  Math as CesiumMath,
  Transforms,
  CesiumTerrainProvider,
  Cesium3DTileset,
  WebMapServiceImageryProvider,
  GeographicTilingScheme,
  Model,
  HeadingPitchRoll,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { setupWaterControl } from "./WaterControl";
import { ModelManager } from "./ModelManager";
import { UploadModelHandler } from "./UpLoadModel";
import { UploadI3DM } from "./UploadI3DM";
import { setupWaterFill } from "./WaterFill";
import NavigationControl from "./Tool/XoayBanDo.js";
import { MeasurementSystem } from "./Tool/DoDac";
import { CoordinateSystem } from "./Tool/ToaDo.js";

// =========================
// LỚP QUẢN LÝ LOD (LEVEL OF DETAIL) - TẢI HOÀN TOÀN TỪ BACKEND
// =========================
class LODManager {
  constructor(viewer, backendUrl = "http://localhost:8000") {
    this.viewer = viewer;
    this.backendUrl = backendUrl;
    this.currentLOD = null; // Lưu LOD hiện tại (mã cảnh)
    this.isLoading = false; // Trạng thái đang tải
    this.scenes = []; // Danh sách cảnh từ backend
    this.loadedModels = []; // Danh sách model đã tải
  }

  // ✅ Tải danh sách cảnh từ backend
  async initScenes() {
    try {
      console.log('🔄 Đang tải danh sách cảnh từ backend...');
      
      const response = await fetch(`${this.backendUrl}/QLModel/api/scenes/`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        this.scenes = data.scenes;
        console.log(`✅ Đã tải ${data.count} cảnh từ backend:`, this.scenes);
        
        // Thiết lập các nút LOD dựa trên danh sách cảnh
        this.setupLODButtons();
        
        return true;
      } else {
        console.error('❌ Lỗi khi tải danh sách cảnh:', data.error);
        this.showNotification('Không thể tải danh sách cảnh từ backend', 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ Lỗi khi kết nối backend:', error);
      this.showNotification('Lỗi kết nối backend: ' + error.message, 'error');
      return false;
    }
  }

  setupLODButtons() {
    // Tạo mapping động dựa trên danh sách cảnh
    this.scenes.forEach(scene => {
      const buttonId = `btnLoD${scene.ma_canh}`;
      const button = document.getElementById(buttonId);
      
      if (button) {
        // Xóa event listener cũ nếu có
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Gán sự kiện click mới
        newButton.addEventListener('click', () => {
          this.switchToLOD(scene.ma_canh);
        });
        
        // Cập nhật tooltip
        newButton.title = `Chuyển sang ${scene.ten_canh}`;
        newButton.classList.add('lod-button');
        
        console.log(`✅ Đã thiết lập nút ${buttonId} cho ${scene.ten_canh}`);
      } else {
        console.warn(`⚠️ Không tìm thấy nút ${buttonId} trong HTML`);
      }
    });
  }

  // ✅ Chuyển đổi sang cảnh cụ thể
  async switchToLOD(ma_canh) {
    // Kiểm tra nếu đang tải
    if (this.isLoading) {
      console.log('⏳ Đang tải cảnh, vui lòng đợi...');
      this.showNotification('Đang tải cảnh, vui lòng đợi...', 'warning');
      return;
    }

    // Kiểm tra nếu đã ở cảnh này
    if (ma_canh === this.currentLOD) {
      console.log(`✓ Đã ở cảnh ${ma_canh}`);
      this.showNotification(`Đã ở cảnh ${ma_canh}`, 'info');
      return;
    }

    try {
      this.isLoading = true;
      console.log(`🔄 Đang chuyển sang cảnh ${ma_canh}...`);

      // Tìm thông tin cảnh
      const scene = this.scenes.find(s => s.ma_canh === ma_canh);
      if (!scene) {
        throw new Error(`Không tìm thấy cảnh ${ma_canh} trong danh sách`);
      }

      // 1. Xóa các model cũ trước
      this.clearLoadedModels();

      // 2. Tải terrain
      await this.loadTerrainForScene(scene);

      // 3. Di chuyển camera đến vị trí cảnh
      await this.moveCameraToScene(scene);

      // 4. Tải các model của cảnh mới
      await this.loadModelsForScene(scene.ma_canh);

      // 5. Cập nhật trạng thái hiện tại
      this.currentLOD = ma_canh;

      // 6. Cập nhật giao diện nút
      this.updateLODButtonStates(ma_canh);

      console.log(`✅ Đã chuyển sang cảnh ${ma_canh} thành công`);
      this.showNotification(`✓ Đã tải thành công ${scene.ten_canh}`, 'success');
      
    } catch (error) {
      console.error(`❌ Lỗi khi chuyển sang cảnh ${ma_canh}:`, error);
      this.showNotification(`Lỗi khi tải cảnh ${ma_canh}: ${error.message}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // ✅ Tải terrain cho cảnh (TỪ DB)
  async loadTerrainForScene(scene) {
    if (!scene.url_terrain) {
      console.warn(`⚠️ Cảnh ${scene.ma_canh} không có URL terrain trong DB`);
      return;
    }

    try {
      console.log(`🌍 Đang tải terrain từ DB: ${scene.url_terrain}`);
      
      this.showNotification(`Đang tải terrain ${scene.ten_canh}...`, 'info');

      const terrainProvider = await CesiumTerrainProvider.fromUrl(scene.url_terrain, {
        requestVertexNormals: true,
        requestWaterMask: true,
      });

      if (terrainProvider.readyPromise) {
        await terrainProvider.readyPromise;
      }

      this.viewer.terrainProvider = terrainProvider;
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      console.log(`✅ Terrain ${scene.ten_canh} đã sẵn sàng`);
      
    } catch (error) {
      console.error(`❌ Lỗi khi tải terrain:`, error);
      throw error;
    }
  }

  // ✅ Di chuyển camera đến vị trí cảnh (TỪ DB)
  async moveCameraToScene(scene) {
    if (!scene.camera) {
      console.warn(`⚠️ Cảnh ${scene.ma_canh} không có thông tin camera trong DB`);
      return;
    }

    try {
      const { lat, lon, height, heading, pitch, roll } = scene.camera;
      
      console.log(`📷 Di chuyển camera đến: lat=${lat}, lon=${lon}, height=${height}m`);
      
      await this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: CesiumMath.toRadians(heading || 0),
          pitch: CesiumMath.toRadians(pitch || -30),
          roll: CesiumMath.toRadians(roll || 0)
        },
        duration: 2.0 // 2 giây animation
      });

      console.log(`✅ Camera đã di chuyển đến vị trí cảnh ${scene.ma_canh}`);
    } catch (error) {
      console.error(`❌ Lỗi khi di chuyển camera:`, error);
    }
  }

  // ✅ Xóa tất cả model đã tải
  clearLoadedModels() {
    console.log(`🗑️ Đang xóa ${this.loadedModels.length} model cũ...`);
    
    this.loadedModels.forEach(model => {
      try {
        this.viewer.scene.primitives.remove(model);
      } catch (error) {
        console.warn('Lỗi khi xóa model:', error);
      }
    });
    
    this.loadedModels = [];
    console.log('✅ Đã xóa tất cả model cũ');
  }

  // ✅ FIXED: Tải các model cho cảnh - SỬA URL ĐÃ ĐÚNG
  async loadModelsForScene(ma_canh) {
    try {
      console.log(`🔄 Đang tải model cho cảnh ${ma_canh}...`);
      
      // ✅ FIXED: Thêm /QLModel/ vào đầu URL
      const response = await fetch(`${this.backendUrl}/QLModel/api/scenes/${ma_canh}/models/`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Không thể tải danh sách model');
      }

      const models = data.models || [];
      console.log(`📦 Tìm thấy ${models.length} model cho cảnh ${ma_canh}`);

      if (models.length === 0) {
        console.log(`ℹ️ Cảnh ${ma_canh} không có model`);
        this.showNotification(`Cảnh ${ma_canh} không có model`, 'info');
        return;
      }

      // Tải từng model
      let loadedCount = 0;
      let errorCount = 0;

      for (const modelData of models) {
        try {
          const model = await this.loadSingleModel(modelData);
          if (model) {
            this.loadedModels.push(model);
            loadedCount++;
          }
        } catch (error) {
          console.error(`❌ Lỗi khi tải model ${modelData.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Đã tải ${loadedCount}/${models.length} model cho cảnh ${ma_canh}`);
      
      if (errorCount > 0) {
        this.showNotification(`Đã tải ${loadedCount} model, ${errorCount} lỗi`, 'warning');
      } else if (loadedCount > 0) {
        this.showNotification(`Đã tải ${loadedCount} model thành công`, 'success');
      }

    } catch (error) {
      console.error(`❌ Lỗi khi tải model cho cảnh ${ma_canh}:`, error);
      this.showNotification(`Lỗi: ${error.message}`, 'error');
    }
  }

  // ✅ Tải một model đơn lẻ
  async loadSingleModel(modelData) {
    try {
      // Kiểm tra dữ liệu model
      if (!modelData.position) {
        console.warn('⚠️ Model thiếu thông tin vị trí:', modelData);
        return null;
      }

      const { position, orientation, scale, url_glb } = modelData;

      if (!url_glb) {
        console.warn('⚠️ Model không có URL GLB:', modelData);
        return null;
      }

      // Tạo vị trí Cartesian3
      const cartesianPosition = Cartesian3.fromDegrees(
        position.lon,
        position.lat,
        position.height || 0
      );

      // Tạo orientation (HPR - Heading, Pitch, Roll)
      const hpr = orientation ? new HeadingPitchRoll(
        CesiumMath.toRadians(orientation.heading || 0),
        CesiumMath.toRadians(orientation.pitch || 0),
        CesiumMath.toRadians(orientation.roll || 0)
      ) : new HeadingPitchRoll(0, 0, 0);

      // Tạo model matrix
      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        cartesianPosition,
        hpr
      );

      // Tải model GLB
      const model = await Model.fromGltfAsync({
        url: url_glb,
        modelMatrix: modelMatrix,
        scale: scale || 1.0,
        incrementallyLoadTextures: true,
      });

      // Thêm model vào scene
      this.viewer.scene.primitives.add(model);

      console.log(`✅ Đã tải model ${modelData.id} từ ${url_glb}`);
      return model;

    } catch (error) {
      console.error(`❌ Lỗi khi tải model:`, error);
      throw error;
    }
  }

  updateLODButtonStates(activeLOD) {
    this.scenes.forEach(scene => {
      const buttonId = `btnLoD${scene.ma_canh}`;
      const button = document.getElementById(buttonId);
      
      if (button) {
        if (scene.ma_canh === activeLOD) {
          // Nút đang active
          button.classList.add('active-lod');
          button.style.backgroundColor = '#4CAF50';
          button.style.color = 'white';
          button.style.border = '2px solid #2E7D32';
          button.style.fontWeight = 'bold';
        } else {
          button.classList.remove("active-lod");
          button.style.backgroundColor = "#f5f5f5";
          button.style.color = "#333";
          button.style.border = "1px solid #ddd";
          button.style.fontWeight = "normal";
        }
      }
    });
  }

  // Lấy thông tin về cảnh hiện tại
  getCurrentLODInfo() {
    const currentScene = this.scenes.find(s => s.ma_canh === this.currentLOD);
    
    return {
      level: this.currentLOD,
      scene: currentScene,
      description: currentScene ? currentScene.mo_ta || currentScene.ten_canh : 'Không xác định',
      isLoading: this.isLoading,
      modelCount: this.loadedModels.length
    };
  }

  // Hiển thị thông báo
  showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);

    const notification = document.createElement('div');
    notification.className = `lod-notification lod-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${
        type === "success"
          ? "#4CAF50"
          : type === "error"
          ? "#f44336"
          : type === "warning"
          ? "#FF9800"
          : "#2196F3"
      };
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 10000;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 500;
    `;

    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = "0";
        notification.style.transition = "opacity 0.3s";
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }
}

// =========================
// EXPORT DEFAULT OBJECT CHO MAPVIEW.VUE
// =========================
export default {
  name: "MapView",

  data() {
    return {
      viewer: null,
      basemapLayer: null,
      modelManager: null,
      uploadModelHandler: null,
      uploadI3DM: null,
      lodManager: null, 
      
      // Backend URL
      backendUrl: "http://localhost:8000",
      
      // attribute (bảng thuộc tính)
      attrHandler: null,
      attrActive: false,
      attrVisible: false,
      attrContent: "",
      viewshedActive: false,
    };
  },

  methods: {
    /* =========================
       Khởi tạo Viewer Cesium với chức năng LOD từ backend
       ========================= */
    async initCesium() {
      try {
        Ion.defaultAccessToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMjFiMTVhMy0yOTliLTQ2ODQtYTEzNy0xZDI0YTVlZWVkNTkiLCJpZCI6MzI2NjIyLCJpYXQiOjE3NTM3OTQ1NTB9.CB33-d5mVIlNDJeLUMWSyovvOtqLC2ewy0_rBOMwM8k";

        // Tạo viewer Cesium với terrain mặc định
        this.viewer = new Viewer("cesiumContainer", {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
        });

        // ✅ BẮT BUỘC: Enable depth test
        this.viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("✅ Cesium Viewer đã khởi tạo");

        // 1. KHỞI TẠO LOD MANAGER
        this.lodManager = new LODManager(this.viewer, this.backendUrl);
        console.log("✅ LOD Manager đã khởi tạo");
        
        // 2. TẢI DANH SÁCH CẢNH TỪ BACKEND
        const scenesLoaded = await this.lodManager.initScenes();
        
        if (!scenesLoaded) {
          throw new Error('Không thể tải danh sách cảnh từ backend');
        }

        // 3. TẢI CẢNH MẶC ĐỊNH TỪ API
        const defaultScene = await this.loadDefaultScene();
        
        if (defaultScene && defaultScene.ma_canh !== undefined) {
          console.log(`📍 Tải cảnh mặc định: Cảnh ${defaultScene.ma_canh} - ${defaultScene.ten_canh}`);
          await this.lodManager.switchToLOD(defaultScene.ma_canh);
        } else {
          console.warn('⚠️ Không tìm thấy cảnh mặc định, thử tải cảnh đầu tiên');
          
          // Fallback: tải cảnh đầu tiên trong danh sách
          if (this.lodManager.scenes.length > 0) {
            const firstScene = this.lodManager.scenes[0];
            await this.lodManager.switchToLOD(firstScene.ma_canh);
          } else {
            throw new Error('Không có cảnh nào trong hệ thống');
          }
        }

        // 4. THIẾT LẬP CÁC NÚT CHỨC NĂNG
        this.setupMeasureButton();
        this.setupLoDButton();

        // 5. KÍCH HOẠT MÔ PHỎNG NƯỚC
        setupWaterControl(this.viewer);

        // 6. KHỞI TẠO MODEL MANAGER
        this.modelManager = new ModelManager(this.viewer);
        console.log("✅ Model Manager initialized");
        window.modelManager = this.modelManager;

        // 7. Khởi tạo UploadModelHandler
        this.uploadModelHandler = new UploadModelHandler(this.viewer);
        console.log("✅ UploadModelHandler initialized");
        window.uploadModelHandler = this.uploadModelHandler;

        // 8. Khởi tạo UploadI3DM
        this.uploadI3DM = new UploadI3DM(this.viewer);
        console.log("✅ UploadI3DM initialized");
        window.uploadI3DM = this.uploadI3DM;

        // 9. Gán nút toggle bản đồ nền
        const btnBasemap = document.getElementById("btnBasemap");
        if (btnBasemap) {
          btnBasemap.addEventListener("click", () => this.toggleBasemap());
        }

        console.log("✅ Cesium đã khởi tạo hoàn toàn");

      } catch (error) {
        console.error("❌ Lỗi khi khởi tạo Cesium:", error);
        this.showNotification("Lỗi khởi tạo Cesium: " + error.message, "error");
        throw error;
      }
    },

    /* =========================
       ✅ MỚI: Tải cảnh mặc định từ API
       ========================= */
    async loadDefaultScene() {
      try {
        console.log('🔄 Đang tải cảnh mặc định từ API...');
        
        const response = await fetch(`${this.backendUrl}/QLModel/api/scenes/default/`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.scene) {
          console.log('✅ Đã tải cảnh mặc định:', data.scene);
          return data.scene;
        } else {
          console.warn('⚠️ API không trả về cảnh mặc định:', data.error);
          return null;
        }
      } catch (error) {
        console.error('❌ Lỗi khi tải cảnh mặc định:', error);
        return null;
      }
    },

    /* =========================
       Phương thức đo đạc
       ========================= */

    setupMeasureButton() {
      const btnMeasure = document.getElementById("btnMeasure");
      const panelMeasure = document.getElementById("panelMeasure");

      if (!btnMeasure || !panelMeasure) return;

      btnMeasure.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (
          panelMeasure.style.display === "none" ||
          panelMeasure.style.display === ""
        ) {
          panelMeasure.style.display = "flex";
        } else {
          panelMeasure.style.display = "none";
        }
      });

      panelMeasure.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      document.addEventListener("click", (e) => {
        if (!panelMeasure.contains(e.target) && e.target !== btnMeasure) {
          panelMeasure.style.display = "none";
        }
      });
    },

    setupLoDButton() {
      const btnLoD = document.getElementById("btnLoD");
      const panelLoD = document.getElementById("panelLoD");

      if (!btnLoD || !panelLoD) {
        console.warn("Không tìm thấy nút LoD hoặc panel LoD");
        return;
      }

      btnLoD.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (panelLoD.style.display === "none" || panelLoD.style.display === "") {
          panelLoD.style.display = "flex";
          console.log("Panel LOD đã hiển thị");
        } else {
          panelLoD.style.display = "none";
          console.log("Panel LOD đã ẩn");
        }
      });

      panelLoD.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      document.addEventListener("click", (e) => {
        if (!panelLoD.contains(e.target) && e.target !== btnLoD) {
          panelLoD.style.display = "none";
        }
      });
    },
    
    showCurrentLODInfo() {
      const oldDisplay = document.querySelector('.lod-info-display');
      if (oldDisplay) {
        oldDisplay.remove();
      }
      
      const lodInfo = this.lodManager.getCurrentLODInfo();
      
      const display = document.createElement('div');
      display.className = 'lod-info-display';
      display.innerHTML = `
        <h4>📊 THÔNG TIN CẢNH HIỆN TẠI</h4>
        <p><strong>Cảnh:</strong> ${lodInfo.level} - ${lodInfo.scene ? lodInfo.scene.ten_canh : 'N/A'}</p>
        <p><strong>Mô tả:</strong> ${lodInfo.description}</p>
        <p><strong>Số model:</strong> ${lodInfo.modelCount}</p>
        <p><strong>Trạng thái:</strong> ${lodInfo.isLoading ? 'Đang tải...' : 'Đã tải ✓'}</p>
      `;
      
      display.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 9999;
        min-width: 300px;
      `;
      
      document.body.appendChild(display);
      
      setTimeout(() => {
        if (display.parentNode) {
          display.style.opacity = "0";
          display.style.transition = "opacity 0.5s";
          setTimeout(() => {
            if (display.parentNode) {
              display.parentNode.removeChild(display);
            }
          }, 500);
        }
      }, 5000);
    },

    // ✅ PHƯƠNG THỨC ĐO CHIỀU CAO (gọi từ template)
    toggleHeightMeasure() {
      if (this.locateActive) {
        this.deactivateLocatePoint();
        this.locateActive = false;
      }

      if (this.measureActive) {
        this.deactivateHeightMeasure();
        this.measureActive = false;
        this.showNotification("Chế độ đo chiều cao đã tắt!", "success");
      } else {
        this.activateHeightMeasure();
        this.measureActive = true;
        this.showNotification(
          "Chế độ đo chiều cao đã bật. Click 2 điểm để đo Δh.",
          "info"
        );
      }
    },

    activateHeightMeasure() {
      this.measureHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas
      );

      this.measureHandler.setInputAction(
        (click) => this.handleHeightClick(click),
        ScreenSpaceEventType.LEFT_CLICK
      );

      this.measureHandler.setInputAction(
        (movement) => this.handleHeightMouseMove(movement),
        ScreenSpaceEventType.MOUSE_MOVE
      );

      this.measureHandler.setInputAction(
        () => this.cancelCurrentHeightMeasurement(),
        ScreenSpaceEventType.RIGHT_CLICK
      );
    },

    deactivateHeightMeasure() {
      if (this.measureHandler) {
        this.measureHandler.destroy();
        this.measureHandler = null;
      }

      if (this.dynamicMeasureLine) {
        this.viewer.entities.remove(this.dynamicMeasureLine);
        this.dynamicMeasureLine = null;
      }

      this.firstMeasurePoint = null;
    },

    handleHeightClick(click) {
      const pickedPos = this.viewer.scene.pickPosition(click.position);
      if (!pickedPos) {
        this.showNotification("Không thể xác định vị trí từ click!", "warning");
        return;
      }

      if (!this.firstMeasurePoint) {
        this.firstMeasurePoint = pickedPos;
        this.addHeightPointMarker(this.firstMeasurePoint, Color.RED, "Điểm A");

        this.dynamicMeasureLine = this.viewer.entities.add({
          polyline: {
            positions: [this.firstMeasurePoint, this.firstMeasurePoint],
            width: 3,
            material: Color.YELLOW.withAlpha(0.5),
          },
        });
      } else {
        const secondPoint = pickedPos;
        this.addHeightPointMarker(secondPoint, Color.BLUE, "Điểm B");
        this.completeHeightMeasurement(this.firstMeasurePoint, secondPoint);

        if (this.dynamicMeasureLine) {
          this.viewer.entities.remove(this.dynamicMeasureLine);
          this.dynamicMeasureLine = null;
        }

        this.firstMeasurePoint = null;
      }
    },

    handleHeightMouseMove(movement) {
      if (!this.firstMeasurePoint || !this.dynamicMeasureLine) return;

      const pickedPos = this.viewer.scene.pickPosition(movement.endPosition);
      if (!pickedPos) return;

      this.dynamicMeasureLine.polyline.positions = [
        this.firstMeasurePoint,
        pickedPos,
      ];
    },

    completeHeightMeasurement(pointA, pointB) {
      const cartoA = Cartographic.fromCartesian(pointA);
      const cartoB = Cartographic.fromCartesian(pointB);

      const heightA = parseFloat(cartoA.height).toFixed(2);
      const heightB = parseFloat(cartoB.height).toFixed(2);
      const diff = (cartoB.height - cartoA.height).toFixed(2);

      const line = this.viewer.entities.add({
        polyline: {
          positions: [pointA, pointB],
          width: 4,
          material: Color.ORANGE,
        },
      });

      const midpoint = Cartesian3.midpoint(pointA, pointB, new Cartesian3());
      const label = this.viewer.entities.add({
        position: midpoint,
        label: {
          text: `Δh = ${diff} m\n(A: ${heightA}m → B: ${heightB}m)`,
          font: "16px sans-serif",
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.7),
          pixelOffset: new Cartesian2(0, -30),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      this.measureLines.push(line);
      this.measureLabels.push(label);

      const resultMessage = `Đo chiều cao hoàn thành:\nĐiểm A: ${heightA}m\nĐiểm B: ${heightB}m\nChênh lệch: ${diff}m`;
      this.showNotification(resultMessage, "success");
    },

    addHeightPointMarker(position, color, labelText) {
      const carto = Cartographic.fromCartesian(position);
      const height = parseFloat(carto.height).toFixed(2);

      const point = this.viewer.entities.add({
        position: position,
        point: {
          pixelSize: 12,
          color: color,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `${labelText}: ${height} m`,
          font: "14px sans-serif",
          pixelOffset: new Cartesian2(0, -25),
          fillColor: Color.YELLOW,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      this.measurePoints.push(point);
      return point;
    },

    cancelCurrentHeightMeasurement() {
      if (this.firstMeasurePoint) {
        const lastPoint = this.measurePoints.pop();
        if (lastPoint) {
          this.viewer.entities.remove(lastPoint);
        }

        if (this.dynamicMeasureLine) {
          this.viewer.entities.remove(this.dynamicMeasureLine);
          this.dynamicMeasureLine = null;
        }

        this.firstMeasurePoint = null;
        this.showNotification("Đã huỷ phép đo hiện tại", "info");
      }
    },

    /* =========================
       Lấy tọa độ điểm
       ========================= */
    toggleLocatePoint() {
      if (this.measureActive) {
        this.deactivateHeightMeasure();
        this.measureActive = false;
      }

      if (this.locateActive) {
        this.deactivateLocatePoint();
        this.locateActive = false;
        this.showNotification("Chế độ lấy tọa độ đã tắt!", "success");
      } else {
        this.activateLocatePoint();
        this.locateActive = true;
        this.showNotification(
          "Chế độ lấy tọa độ đã bật. Click vào bản đồ!",
          "info"
        );
      }
    },

    activateLocatePoint() {
      this.locateHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas
      );

      this.locateHandler.setInputAction(
        (click) => this.handleCoordinateClick(click),
        ScreenSpaceEventType.LEFT_CLICK
      );
    },

    deactivateLocatePoint() {
      if (this.locateHandler) {
        this.locateHandler.destroy();
        this.locateHandler = null;
      }
    },

    handleCoordinateClick(click) {
      const cartesian = this.viewer.scene.pickPosition(click.position);
      if (!cartesian) {
        this.showNotification("Không thể xác định vị trí!", "warning");
        return;
      }

      const carto = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(carto.longitude).toFixed(6);
      const lat = CesiumMath.toDegrees(carto.latitude).toFixed(6);
      const height = carto.height.toFixed(2);

      const marker = this.addCoordinateMarker(cartesian, lat, lon, height);
      this.coordMarkers.push(marker);

      const coordMessage = `Tọa độ đã lấy:\nLat: ${lat}°\nLon: ${lon}°\nĐộ cao: ${height}m`;
      this.showNotification(coordMessage, "success");

      console.log(coordMessage);
    },

    addCoordinateMarker(position, lat, lon, height) {
      const randomColor = Color.fromRandom({ alpha: 1.0 });

      const marker = this.viewer.entities.add({
        position: position,
        point: {
          pixelSize: 10,
          color: randomColor,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `📍 ${
            this.coordMarkers.length + 1
          }\nLat: ${lat}°\nLon: ${lon}°\nH: ${height}m`,
          font: "14px sans-serif",
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.7),
          fillColor: Color.YELLOW,
          pixelOffset: new Cartesian2(0, -40),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `Tọa độ điểm ${
          this.coordMarkers.length + 1
        }: ${lat}°, ${lon}°, ${height}m`,
      });

      return marker;
    },

    /* =========================
       Xóa các phép đo
       ========================= */
    clearAllMeasurements() {
      this.measurePoints.forEach((point) => {
        if (point) this.viewer.entities.remove(point);
      });

      this.measureLines.forEach((line) => {
        if (line) this.viewer.entities.remove(line);
      });

      this.measureLabels.forEach((label) => {
        if (label) this.viewer.entities.remove(label);
      });

      this.coordMarkers.forEach((marker) => {
        if (marker) this.viewer.entities.remove(marker);
      });

      this.measurePoints = [];
      this.measureLines = [];
      this.measureLabels = [];
      this.coordMarkers = [];

      if (this.firstMeasurePoint) {
        this.cancelCurrentHeightMeasurement();
      }

      const panelMeasure = document.getElementById("panelMeasure");
      if (panelMeasure) {
        panelMeasure.style.display = "none";
      }

      this.showNotification("Đã xóa tất cả các phép đo và marker", "success");
    },

    toggleBasemap() {
      if (!this.viewer) return alert("Viewer chưa sẵn sàng!");
      if (!this.basemapLayer) {
        this.basemapLayer = this.viewer.imageryLayers.addImageryProvider(
          new WebMapServiceImageryProvider({
            url: "http://localhost:8080/geoserver/BM/wms",
            layers: "BM:vn50000_WGS84",
            parameters: {
              service: "WMS",
              version: "1.1.0",
              request: "GetMap",
              format: "image/png",
              transparent: true,
            },
            tilingScheme: new GeographicTilingScheme(),
          }),
        );
        console.log("Basemap WMS bật");
      } else {
        this.basemapLayer.show = !this.basemapLayer.show;
        console.log("Basemap visibility:", this.basemapLayer.show);
      }
    },

    toggleAttr() {
      if (!this.viewer) return alert("Viewer chưa sẵn sàng!");
      if (this.attrHandler) {
        this.attrHandler.destroy();
        this.attrHandler = null;
        this.attrActive = false;
        this.attrVisible = false;
        this.attrContent = "";
        alert("Chế độ xem thuộc tính đã tắt!");
        return;
      }

      this.attrHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
      this.attrActive = true;
      this.attrVisible = true;
      alert("Chế độ xem thuộc tính đã bật. Click vào model để xem thuộc tính!");

      this.attrHandler.setInputAction((click) => {
        const picked = this.viewer.scene.pick(click.position);
        if (defined(picked) && picked.getProperty) {
          const ids = picked.getPropertyIds ? picked.getPropertyIds() : [];
          let rows = "";
          if (ids && ids.length) {
            ids.forEach((id) => {
              const val = picked.getProperty(id);
              if (val !== undefined && val !== null && val !== "")
                rows += `<tr><td>${id}</td><td>${val}</td></tr>`;
            });
          }
          this.attrContent =
            rows || "<tr><td colspan='2'>Không có thuộc tính</td></tr>";
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    },

    toggleViewshed() {
      this.viewshedActive = !this.viewshedActive;
      if (this.viewshedActive) alert("Chế độ Viewshed bật!");
      else alert("Viewshed đã tắt!");
    },

    showNotification(message, type = "info") {
      console.log(`${type.toUpperCase()}: ${message}`);

      const notification = document.createElement("div");
      notification.className = `notification notification-${type}`;
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${
          type === "success"
            ? "#4CAF50"
            : type === "error"
            ? "#f44336"
            : type === "warning"
            ? "#FF9800"
            : "#2196F3"
        };
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-size: 14px;
        font-weight: 500;
      `;

      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.opacity = "0";
          notification.style.transition = "opacity 0.3s";
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }
      }, 3000);
    },
  },

  mounted() {
    this.initCesium().catch((e) => {
      console.error("initCesium error:", e);
      alert("Lỗi khi khởi tạo Cesium. Xem console để biết chi tiết.");
    });
  },

  beforeUnmount() {
    if (this.measureHandler) this.measureHandler.destroy();
    if (this.locateHandler) this.locateHandler.destroy();
    if (this.attrHandler) this.attrHandler.destroy();
    
    this.lodManager = null;
    
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }

    console.log("✅ Đã dọn dẹp tất cả tài nguyên Map.js");
  },
};
