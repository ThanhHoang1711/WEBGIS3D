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
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  Cartographic,
  defined,
  Cartesian2,
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
    this.currentLOD = null;
    this.isLoading = false;
    this.scenes = [];
    this.loadedModels = [];

    this.autoSwitchEnabled = true;
    this.cameraMoveListener = null;
    this.lastCheckedPosition = null;
    this.checkInterval = null;
    this.checkIntervalMs = 1000;
  }

  async initScenes() {
    try {
      console.log("🔄 Đang tải danh sách cảnh từ backend...");

      const response = await fetch(`${this.backendUrl}/QLModel/api/scenes/`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.scenes = data.scenes;
        console.log(`✅ Đã tải ${data.count} cảnh từ backend:`, this.scenes);
        this.setupLODButtons();
        return true;
      } else {
        console.error("❌ Lỗi khi tải danh sách cảnh:", data.error);
        this.showNotification(
          "Không thể tải danh sách cảnh từ backend",
          "error",
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Lỗi khi kết nối backend:", error);
      this.showNotification("Lỗi kết nối backend: " + error.message, "error");
      return false;
    }
  }

  setupLODButtons() {
    this.scenes.forEach((scene) => {
      const buttonId = `btnLoD${scene.ma_canh}`;
      const button = document.getElementById(buttonId);

      if (button) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener("click", () => {
          this.switchToLOD(scene.ma_canh);
        });

        newButton.title = `Chuyển sang ${scene.ten_canh}`;
        newButton.classList.add("lod-button");

        console.log(`✅ Đã thiết lập nút ${buttonId} cho ${scene.ten_canh}`);
      } else {
        console.warn(`⚠️ Không tìm thấy nút ${buttonId} trong HTML`);
      }
    });
  }

  async switchToLOD(ma_canh) {
    if (this.isLoading) {
      console.log("⏳ Đang tải cảnh, vui lòng đợi...");
      this.showNotification("Đang tải cảnh, vui lòng đợi...", "warning");
      return;
    }

    if (ma_canh === this.currentLOD) {
      console.log(`✓ Đã ở cảnh ${ma_canh}`);
      this.showNotification(`Đã ở cảnh ${ma_canh}`, "info");
      return;
    }

    try {
      this.isLoading = true;
      console.log(`🔄 Đang chuyển sang cảnh ${ma_canh}...`);

      const scene = this.scenes.find((s) => s.ma_canh === ma_canh);
      if (!scene) {
        throw new Error(`Không tìm thấy cảnh ${ma_canh} trong danh sách`);
      }

      this.clearLoadedModels();
      await this.loadTerrainForScene(scene);
      await this.moveCameraToScene(scene);
      await this.loadModelsForScene(scene.ma_canh);

      this.currentLOD = ma_canh;
      this.updateLODButtonStates(ma_canh);

      console.log(`✅ Đã chuyển sang cảnh ${ma_canh} thành công`);
      this.showNotification(`✓ Đã tải thành công ${scene.ten_canh}`, "success");
    } catch (error) {
      console.error(`❌ Lỗi khi chuyển sang cảnh ${ma_canh}:`, error);
      this.showNotification(
        `Lỗi khi tải cảnh ${ma_canh}: ${error.message}`,
        "error",
      );
    } finally {
      this.isLoading = false;
    }
  }

  async loadTerrainForScene(scene) {
    if (!scene.url_terrain) {
      console.warn(`⚠️ Cảnh ${scene.ma_canh} không có URL terrain trong DB`);
      return;
    }

    try {
      console.log(`🌍 Đang tải terrain từ DB: ${scene.url_terrain}`);
      this.showNotification(`Đang tải terrain ${scene.ten_canh}...`, "info");

      const terrainProvider = await CesiumTerrainProvider.fromUrl(
        scene.url_terrain,
        {
          requestVertexNormals: true,
          requestWaterMask: true,
        },
      );

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

  async moveCameraToScene(scene) {
    if (!scene.camera) {
      console.warn(
        `⚠️ Cảnh ${scene.ma_canh} không có thông tin camera trong DB`,
      );
      return;
    }

    try {
      const { lat, lon, height, heading, pitch, roll } = scene.camera;

      console.log(
        `📷 Di chuyển camera đến: lat=${lat}, lon=${lon}, height=${height}m`,
      );

      await this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: CesiumMath.toRadians(heading || 0),
          pitch: CesiumMath.toRadians(pitch || -30),
          roll: CesiumMath.toRadians(roll || 0),
        },
        duration: 2.0,
      });

      console.log(`✅ Camera đã di chuyển đến vị trí cảnh ${scene.ma_canh}`);
    } catch (error) {
      console.error(`❌ Lỗi khi di chuyển camera:`, error);
    }
  }

  clearLoadedModels() {
    console.log(`🗑️ Đang xóa ${this.loadedModels.length} model cũ...`);

    this.loadedModels.forEach((model) => {
      try {
        this.viewer.scene.primitives.remove(model);
      } catch (error) {
        console.warn("Lỗi khi xóa model:", error);
      }
    });

    this.loadedModels = [];
    console.log("✅ Đã xóa tất cả model cũ");
  }

  async loadModelsForScene(ma_canh) {
    try {
      console.log(`🔄 Đang tải model cho cảnh ${ma_canh}...`);

      const response = await fetch(
        `${this.backendUrl}/QLModel/api/scenes/${ma_canh}/models/`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Không thể tải danh sách model");
      }

      const models = data.models || [];
      console.log(`📦 Tìm thấy ${models.length} model cho cảnh ${ma_canh}`);

      if (models.length === 0) {
        console.log(`ℹ️ Cảnh ${ma_canh} không có model`);
        this.showNotification(`Cảnh ${ma_canh} không có model`, "info");
        return;
      }

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

      console.log(
        `✅ Đã tải ${loadedCount}/${models.length} model cho cảnh ${ma_canh}`,
      );

      if (errorCount > 0) {
        this.showNotification(
          `Đã tải ${loadedCount} model, ${errorCount} lỗi`,
          "warning",
        );
      } else if (loadedCount > 0) {
        this.showNotification(
          `Đã tải ${loadedCount} model thành công`,
          "success",
        );
      }
    } catch (error) {
      console.error(`❌ Lỗi khi tải model cho cảnh ${ma_canh}:`, error);
      this.showNotification(`Lỗi: ${error.message}`, "error");
    }
  }

  async loadSingleModel(modelData) {
    try {
      if (!modelData.position) {
        console.warn("⚠️ Model thiếu thông tin vị trí:", modelData);
        return null;
      }

      const { position, orientation, scale, url_glb } = modelData;

      if (!url_glb) {
        console.warn("⚠️ Model không có URL GLB:", modelData);
        return null;
      }

      const cartesianPosition = Cartesian3.fromDegrees(
        position.lon,
        position.lat,
        position.height || 0,
      );

      const hpr = orientation
        ? new HeadingPitchRoll(
            CesiumMath.toRadians(orientation.heading || 0),
            CesiumMath.toRadians(orientation.pitch || 0),
            CesiumMath.toRadians(orientation.roll || 0),
          )
        : new HeadingPitchRoll(0, 0, 0);

      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        cartesianPosition,
        hpr,
      );

      const model = await Model.fromGltfAsync({
        url: url_glb,
        modelMatrix: modelMatrix,
        scale: scale || 1.0,
        incrementallyLoadTextures: true,
      });

      this.viewer.scene.primitives.add(model);

      console.log(`✅ Đã tải model ${modelData.id} từ ${url_glb}`);
      return model;
    } catch (error) {
      console.error(`❌ Lỗi khi tải model:`, error);
      throw error;
    }
  }

  updateLODButtonStates(activeLOD) {
    this.scenes.forEach((scene) => {
      const buttonId = `btnLoD${scene.ma_canh}`;
      const button = document.getElementById(buttonId);

      if (button) {
        if (scene.ma_canh === activeLOD) {
          button.classList.add("active-lod");
          button.style.backgroundColor = "#4CAF50";
          button.style.color = "white";
          button.style.border = "2px solid #2E7D32";
          button.style.fontWeight = "bold";
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

  getCurrentLODInfo() {
    const currentScene = this.scenes.find((s) => s.ma_canh === this.currentLOD);

    return {
      level: this.currentLOD,
      scene: currentScene,
      description: currentScene
        ? currentScene.mo_ta || currentScene.ten_canh
        : "Không xác định",
      isLoading: this.isLoading,
      modelCount: this.loadedModels.length,
    };
  }

  enableAutoSwitch() {
    if (this.cameraMoveListener) {
      return;
    }

    this.autoSwitchEnabled = true;

    this.cameraMoveListener = this.viewer.camera.moveEnd.addEventListener(
      () => {
        this.checkAndSwitchScene();
      },
    );

    this.checkInterval = setInterval(() => {
      if (this.autoSwitchEnabled && !this.isLoading) {
        this.checkAndSwitchScene();
      }
    }, this.checkIntervalMs);

    console.log("✅ Đã bật tự động chuyển cảnh");
    this.showNotification("Đã bật tự động chuyển cảnh", "success");
  }

  disableAutoSwitch() {
    this.autoSwitchEnabled = false;

    if (this.cameraMoveListener) {
      this.cameraMoveListener();
      this.cameraMoveListener = null;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log("✅ Đã tắt tự động chuyển cảnh");
    this.showNotification("Đã tắt tự động chuyển cảnh", "info");
  }

  checkAndSwitchScene() {
    if (!this.autoSwitchEnabled || this.isLoading || this.scenes.length === 0) {
      return;
    }

    const cameraPosition = this.viewer.camera.positionCartographic;
    const cameraLon = CesiumMath.toDegrees(cameraPosition.longitude);
    const cameraLat = CesiumMath.toDegrees(cameraPosition.latitude);
    const cameraHeight = cameraPosition.height;

    if (this.lastCheckedPosition) {
      const deltaLat = Math.abs(cameraLat - this.lastCheckedPosition.lat);
      const deltaLon = Math.abs(cameraLon - this.lastCheckedPosition.lon);
      const deltaHeight = Math.abs(
        cameraHeight - this.lastCheckedPosition.height,
      );

      if (deltaLat < 0.0001 && deltaLon < 0.0001 && deltaHeight < 10) {
        return;
      }
    }

    this.lastCheckedPosition = {
      lat: cameraLat,
      lon: cameraLon,
      height: cameraHeight,
    };

    const matchedScene = this.findMatchingScene(
      cameraLat,
      cameraLon,
      cameraHeight,
    );

    if (matchedScene && matchedScene.ma_canh !== this.currentLOD) {
      console.log(
        `🔄 Tự động chuyển sang cảnh ${matchedScene.ma_canh} - ${matchedScene.ten_canh}`,
      );
      this.switchToLOD(matchedScene.ma_canh);
    }
  }

  findMatchingScene(cameraLat, cameraLon, cameraHeight) {
    let bestMatch = null;
    let minDistance = Infinity;

    for (const scene of this.scenes) {
      const heightTolerance = scene.camera?.height * 0.5 || 1000;
      const minHeight = (scene.camera?.height || 1000) - heightTolerance;
      const maxHeight = (scene.camera?.height || 1000) + heightTolerance;

      if (cameraHeight < minHeight || cameraHeight > maxHeight) {
        continue;
      }

      const sceneLat = scene.camera?.lat || 21.028511;
      const sceneLon = scene.camera?.lon || 105.804817;

      const distance = this.calculateDistance(
        cameraLat,
        cameraLon,
        sceneLat,
        sceneLon,
      );

      const radius = scene.camera?.height || 1000;

      if (distance <= radius) {
        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = scene;
        }
      }
    }

    return bestMatch;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = CesiumMath.toRadians(lat2 - lat1);
    const dLon = CesiumMath.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(CesiumMath.toRadians(lat1)) *
        Math.cos(CesiumMath.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  toggleAutoSwitch() {
    if (this.autoSwitchEnabled) {
      this.disableAutoSwitch();
      return false;
    } else {
      this.enableAutoSwitch();
      return true;
    }
  }

  showNotification(message, type = "info") {
    console.log(`${type.toUpperCase()}: ${message}`);

    const notification = document.createElement("div");
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
      navigationControl: null,
      measurementSystem: null,
      coordinateSystem: null,

      backendUrl: "http://localhost:8000",

      attrHandler: null,
      attrActive: false,
      attrVisible: false,
      attrContent: "",
      viewshedActive: false,
    };
  },

  methods: {
    async initCesium() {
      try {
        Ion.defaultAccessToken =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMjFiMTVhMy0yOTliLTQ2ODQtYTEzNy0xZDI0YTVlZWVkNTkiLCJpZCI6MzI2NjIyLCJpYXQiOjE3NTM3OTQ1NTB9.CB33-d5mVIlNDJeLUMWSyovvOtqLC2ewy0_rBOMwM8k";

        this.viewer = new Viewer("cesiumContainer", {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
        });

        this.viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("✅ Cesium Viewer đã khởi tạo");

        // 1. KHỞI TẠO LOD MANAGER
        this.lodManager = new LODManager(this.viewer, this.backendUrl);
        console.log("✅ LOD Manager đã khởi tạo");

        // 2. TẢI DANH SÁCH CẢNH TỪ BACKEND
        const scenesLoaded = await this.lodManager.initScenes();

        if (!scenesLoaded) {
          throw new Error("Không thể tải danh sách cảnh từ backend");
        }

        // 3. TẢI CẢNH MẶC ĐỊNH
        const defaultScene = await this.loadDefaultScene();

        if (defaultScene && defaultScene.ma_canh !== undefined) {
          console.log(
            `📍 Tải cảnh mặc định: Cảnh ${defaultScene.ma_canh} - ${defaultScene.ten_canh}`,
          );
          await this.lodManager.switchToLOD(defaultScene.ma_canh);
        } else {
          console.warn(
            "⚠️ Không tìm thấy cảnh mặc định, thử tải cảnh đầu tiên",
          );

          if (this.lodManager.scenes.length > 0) {
            const firstScene = this.lodManager.scenes[0];
            await this.lodManager.switchToLOD(firstScene.ma_canh);
          } else {
            throw new Error("Không có cảnh nào trong hệ thống");
          }
        }

        this.lodManager.enableAutoSwitch();

        // 4. KHỞI TẠO CÁC HỆ THỐNG ĐO ĐẠC VÀ TỌA ĐỘ
        this.measurementSystem = new MeasurementSystem(
          this.viewer,
          this.showNotification.bind(this),
        );
        console.log("✅ Measurement System đã khởi tạo");

        this.coordinateSystem = new CoordinateSystem(
          this.viewer,
          this.showNotification.bind(this),
        );
        console.log("✅ Coordinate System đã khởi tạo");

        // 5. KHỞI TẠO NAVIGATION CONTROL
        this.navigationControl = new NavigationControl(this.viewer);
        console.log("✅ Navigation Control đã khởi tạo");

        // 6. THIẾT LẬP CÁC NÚT CHỨC NĂNG
        this.setupMeasureButton();
        this.setupLoDButton();

        // 7. KÍCH HOẠT MÔ PHỎNG NƯỚC
        setupWaterControl(this.viewer);

        // 8. KHỞI TẠO MODEL MANAGER
        this.modelManager = new ModelManager(this.viewer);
        console.log("✅ Model Manager initialized");
        window.modelManager = this.modelManager;

        // 9. KHỞI TẠO UPLOAD HANDLER
        this.uploadModelHandler = new UploadModelHandler(this.viewer);
        console.log("✅ UploadModelHandler initialized");
        window.uploadModelHandler = this.uploadModelHandler;
        window.__uploadHandler = this.uploadModelHandler;

        // 10. KHỞI TẠO UPLOAD I3DM
        this.uploadI3DM = new UploadI3DM(this.viewer);
        console.log("✅ UploadI3DM initialized");
        window.uploadI3DM = this.uploadI3DM;

        // 11. GÁN NÚT TOGGLE BẢN ĐỒ NỀN
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

    async loadDefaultScene() {
      try {
        console.log("🔄 Đang tải cảnh mặc định từ API...");

        const response = await fetch(
          `${this.backendUrl}/QLModel/api/scenes/default/`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.scene) {
          console.log("✅ Đã tải cảnh mặc định:", data.scene);
          return data.scene;
        } else {
          console.warn("⚠️ API không trả về cảnh mặc định:", data.error);
          return null;
        }
      } catch (error) {
        console.error("❌ Lỗi khi tải cảnh mặc định:", error);
        return null;
      }
    },

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

        if (
          panelLoD.style.display === "none" ||
          panelLoD.style.display === ""
        ) {
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

    // ============================================
    // CÁC PHƯƠNG THỨC ĐO ĐẠC - SỬ DỤNG MeasurementSystem
    // ============================================
    toggleHeightMeasure() {
      if (this.measurementSystem) {
        this.measurementSystem.toggleHeightMeasure(this.coordinateSystem);
      }
    },

    // ============================================
    // CÁC PHƯƠNG THỨC TỌA ĐỘ - SỬ DỤNG CoordinateSystem
    // ============================================
    toggleLocatePoint() {
      if (this.coordinateSystem) {
        this.coordinateSystem.toggleLocatePoint(this.measurementSystem);
      }
    },

    // ============================================
    // XÓA TẤT CẢ PHÉP ĐO VÀ MARKER
    // ============================================
    clearAllMeasurements() {
      if (this.measurementSystem) {
        this.measurementSystem.clearAllMeasurements();
      }

      if (this.coordinateSystem) {
        this.coordinateSystem.clearAllMarkers();
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

    async reloadCurrentScene() {
      if (this.lodManager && this.lodManager.currentLOD !== null) {
        const currentLOD = this.lodManager.currentLOD;
        this.lodManager.currentLOD = null;
        await this.lodManager.switchToLOD(currentLOD);
        console.log("✅ Đã reload cảnh sau khi tạo model mới");
      } else {
        console.warn("⚠️ LODManager chưa có cảnh hiện tại để reload");
      }
    },

    toggleAutoSwitch() {
      if (this.lodManager) {
        const isEnabled = this.lodManager.toggleAutoSwitch();
        this.showNotification(
          `Tự động chuyển cảnh ${isEnabled ? "đã bật" : "đã tắt"}`,
          isEnabled ? "success" : "info",
        );
        return isEnabled;
      }
      return false;
    },

    showCurrentLODInfo() {
      if (!this.lodManager) {
        this.showNotification("LOD Manager chưa được khởi tạo", "warning");
        return;
      }

      const lodInfo = this.lodManager.getCurrentLODInfo();

      const oldDisplay = document.querySelector(".lod-info-display");
      if (oldDisplay) {
        oldDisplay.remove();
      }

      const display = document.createElement("div");
      display.className = "lod-info-display";
      display.innerHTML = `
        <h4>📊 THÔNG TIN CẢNH HIỆN TẠI</h4>
        <p><strong>Cảnh:</strong> ${lodInfo.level} - ${
        lodInfo.scene ? lodInfo.scene.ten_canh : "N/A"
      }</p>
        <p><strong>Mô tả:</strong> ${lodInfo.description}</p>
        <p><strong>Số model:</strong> ${lodInfo.modelCount}</p>
        <p><strong>Trạng thái:</strong> ${
          lodInfo.isLoading ? "Đang tải..." : "Đã tải ✓"
        }</p>
        <p><strong>Tự động chuyển cảnh:</strong> ${
          this.lodManager.autoSwitchEnabled ? "BẬT" : "TẮT"
        }</p>
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
    // Dọn dẹp Measurement System
    if (this.measurementSystem) {
      this.measurementSystem.destroy();
      this.measurementSystem = null;
    }

    // Dọn dẹp Coordinate System
    if (this.coordinateSystem) {
      this.coordinateSystem.destroy();
      this.coordinateSystem = null;
    }

    // Dọn dẹp Navigation Control
    if (this.navigationControl) {
      this.navigationControl.destroy();
      this.navigationControl = null;
    }

    if (this.attrHandler) this.attrHandler.destroy();

    // Dọn dẹp LOD Manager
    if (this.lodManager) {
      this.lodManager.disableAutoSwitch();
      this.lodManager = null;
    }

    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }

    console.log("✅ Đã dọn dẹp tất cả tài nguyên Map.js");
  },
};
