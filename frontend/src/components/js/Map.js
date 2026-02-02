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
// LỚP QUẢN LÝ LOD (LEVEL OF DETAIL)
// =========================
class LODManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.currentLOD = 0;
    this.isLoading = false;

    this.initLODUrls();
    this.setupLODButtons();
  }

  initLODUrls() {
    this.lodUrls = {
      0: "http://localhost:8006/tilesets/tiles",
      1: "http://localhost:8010/tilesets/tiles",
      2: "http://localhost:8011/tilesets/tiles",
      3: "http://localhost:8012/tilesets/tiles",
    };
  }

  setupLODButtons() {
    const lodButtons = {
      btnLoD0: 0,
      btnLoD1: 1,
      btnLoD2: 2,
      btnLoD3: 3,
    };

    Object.keys(lodButtons).forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        const lodLevel = lodButtons[buttonId];
        button.addEventListener("click", () => {
          this.switchToLOD(lodLevel);
        });
        button.title = `Chuyển sang LoD${lodLevel} (Cảnh ${lodLevel})`;
        button.classList.add("lod-button");
      }
    });
  }

  async switchToLOD(lodLevel) {
    if (this.isLoading) {
      this.showNotification("Đang tải terrain, vui lòng đợi...", "warning");
      return;
    }

    if (lodLevel === this.currentLOD) {
      this.showNotification(`Đã ở LoD${lodLevel}`, "info");
      return;
    }

    try {
      this.isLoading = true;
      console.log(`🔄 Đang chuyển sang terrain LoD${lodLevel}...`);

      await this.loadTilesetByLOD(lodLevel);
      this.currentLOD = lodLevel;
      this.updateLODButtonStates(lodLevel);

      console.log(`✅ Đã chuyển sang terrain LoD${lodLevel} thành công`);
    } catch (error) {
      console.error(`❌ Lỗi khi chuyển sang LoD${lodLevel}:`, error);
      let errorMessage = `Lỗi khi tải terrain LoD${lodLevel}`;
      if (error.message.includes("404")) {
        errorMessage += ": Server không tìm thấy (404)";
      } else if (error.message.includes("ECONNREFUSED")) {
        errorMessage += ": Không thể kết nối tới server";
      } else {
        errorMessage += `: ${error.message}`;
      }
      this.showNotification(errorMessage, "error");
    } finally {
      this.isLoading = false;
    }
  }

  async loadTilesetByLOD(lodLevel) {
    const url = this.lodUrls[lodLevel];

    if (!url) {
      throw new Error(`Không tìm thấy URL cho LoD${lodLevel}`);
    }

    try {
      console.log(`🌍 Đang tải terrain từ: ${url}`);
      this.showNotification(`Đang tải terrain LoD${lodLevel}...`, "info");

      const terrainProvider = await CesiumTerrainProvider.fromUrl(url, {
        requestVertexNormals: true,
        requestWaterMask: true,
      });

      if (terrainProvider.readyPromise) {
        await terrainProvider.readyPromise;
      }

      this.viewer.terrainProvider = terrainProvider;
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      console.log(`✅ Terrain LoD${lodLevel} đã sẵn sàng`);
      this.showNotification(
        `✓ Đã tải thành công terrain LoD${lodLevel}`,
        "success",
      );

      return terrainProvider;
    } catch (error) {
      console.error(`❌ Lỗi khi tải terrain LoD${lodLevel}:`, error);
      let errorMessage = `Lỗi khi tải terrain LoD${lodLevel}`;
      if (error.message.includes("404")) {
        errorMessage += ": Server không tìm thấy (404)";
      } else if (error.message.includes("ECONNREFUSED")) {
        errorMessage += ": Không thể kết nối tới server";
      } else {
        errorMessage += `: ${error.message}`;
      }
      this.showNotification(errorMessage, "error");
      throw error;
    }
  }

  updateLODButtonStates(activeLOD) {
    const lodButtons = ["btnLoD0", "btnLoD1", "btnLoD2", "btnLoD3"];

    lodButtons.forEach((buttonId, index) => {
      const button = document.getElementById(buttonId);
      if (button) {
        if (index === activeLOD) {
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
    return {
      level: this.currentLOD,
      url: this.lodUrls[this.currentLOD],
      description: this.getLODDescription(this.currentLOD),
      isLoading: this.isLoading,
    };
  }

  getLODDescription(lodLevel) {
    const descriptions = {
      0: "Cảnh 0 - Mức chi tiết thấp nhất, tối ưu hiệu năng",
      1: "Cảnh 1 - Mức chi tiết thấp, hiển thị nhanh",
      2: "Cảnh 2 - Mức chi tiết trung bình, cân bằng hiệu năng và chất lượng",
      3: "Cảnh 3 - Mức chi tiết cao, hiển thị đầy đủ chi tiết",
    };
    return descriptions[lodLevel] || "Không xác định";
  }

  showNotification(message, type = "info") {
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
      measurementSystem: null, // ✅ Thêm measurement system
      coordinateSystem: null, // ✅ Thêm coordinate system
      attrHandler: null,
      attrActive: false,
      attrVisible: false,
      attrContent: "",
      viewshedActive: false,
    };
  },

  methods: {
    async loadTileset() {
      try {
        const response = await fetch("http://localhost:8000/tiles/");
        const data = await response.json();
        const tilesetUrl = `http://localhost:8000${data.tileset_url}`;
        const tileset = await Cesium3DTileset.fromUrl(tilesetUrl);
        this.viewer.scene.primitives.add(tileset);
        await tileset.readyPromise;
        await this.viewer.zoomTo(tileset);
        console.log("Tileset loaded:", tilesetUrl);
      } catch (err) {
        console.error("Lỗi load tileset:", err);
      }
    },

    async loadGLBModels() {
      try {
        const response = await fetch("http://localhost:8000/api/models/");
        const models = await response.json();

        const {
          Model,
          HeadingPitchRoll,
          Math: CesiumMath,
          Matrix4,
          Transforms,
        } = await import("cesium");

        for (const item of models) {
          const position = Cartesian3.fromDegrees(
            item.lon,
            item.lat,
            item.height,
          );

          const rotation = item.rotation || {};

          const hpr = new HeadingPitchRoll(
            CesiumMath.toRadians(rotation.z || 0),
            CesiumMath.toRadians(rotation.x || 0),
            CesiumMath.toRadians(rotation.y || 0),
          );

          const modelMatrix = Transforms.headingPitchRollToFixedFrame(
            position,
            hpr,
          );

          Matrix4.multiplyByUniformScale(
            modelMatrix,
            item.scale || 1,
            modelMatrix,
          );

          const model = await Model.fromGltfAsync({
            url: item.url,
            modelMatrix: modelMatrix,
          });

          this.viewer.scene.primitives.add(model);
        }

        console.log(`✅ Loaded ${models.length} GLB models`);
      } catch (err) {
        console.error("❌ Lỗi load GLB models:", err);
      }
    },

    async initCesium() {
      Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMjFiMTVhMy0yOTliLTQ2ODQtYTEzNy0xZDI0YTVlZWVkNTkiLCJpZCI6MzI2NjIyLCJpYXQiOjE3NTM3OTQ1NTB9.CB33-d5mVIlNDJeLUMWSyovvOtqLC2ewy0_rBOMwM8k";

      // Tạo viewer Cesium
      this.viewer = new Viewer("cesiumContainer", {
        terrainProvider: await CesiumTerrainProvider.fromUrl(
          "http://localhost:8006/tilesets/tiles",
        ),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
      });

      // ✅ BẮT BUỘC: Enable depth test
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      // Bay đến vị trí mặc định
      await this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(105.302657, 21.025975, 500),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-30),
        },
      });

      // 1. KHỞI TẠO LOD MANAGER
      this.lodManager = new LODManager(this.viewer);
      console.log("✅ LOD Manager đã khởi tạo");

      // 2. TẢI TILESET MẶC ĐỊNH (LoD0)
      await this.lodManager.switchToLOD(0);

      // 3. LOAD GLB MODELS
      await this.loadGLBModels();

      // ✅ 4. KHỞI TẠO NAVIGATION CONTROL (XOAY BẢN ĐỒ)
      this.initNavigationControl();

      // ✅ 5. KHỞI TẠO MEASUREMENT SYSTEM (ĐO ĐẠC)
      this.initMeasurementSystem();

      // ✅ 6. KHỞI TẠO COORDINATE SYSTEM (LẤY TỌA ĐỘ)
      this.initCoordinateSystem();

      // 7. THIẾT LẬP CÁC NÚT CHỨC NĂNG
      this.setupMeasureButton();
      this.setupLoDButton();

      // 8. KÍCH HOẠT MÔ PHỎNG NƯỚC
      setupWaterControl(this.viewer);

      // 9. KÍCH HOẠT MÔ PHỎNG NƯỚC TRÀN
      setupWaterFill(this.viewer);
      console.log("✅ Water Fill Simulation initialized");

      // 10. KHỞI TẠO MODEL MANAGER
      this.modelManager = new ModelManager(this.viewer);
      console.log("✅ Model Manager initialized");
      window.modelManager = this.modelManager;

      // 11. KHỞI TẠO UploadModelHandler
      this.uploadModelHandler = new UploadModelHandler(this.viewer);
      console.log("✅ UploadModelHandler initialized");
      window.uploadModelHandler = this.uploadModelHandler;

      // 12. KHỞI TẠO UploadI3DM
      this.uploadI3DM = new UploadI3DM(this.viewer);
      console.log("✅ UploadI3DM initialized");
      window.uploadI3DM = this.uploadI3DM;

      // 13. Gán nút toggle bản đồ nền
      document
        .getElementById("btnBasemap")
        .addEventListener("click", () => this.toggleBasemap());
    },

    // ✅ PHƯƠNG THỨC KHỞI TẠO NAVIGATION CONTROL
    initNavigationControl() {
      if (this.viewer && !this.navigationControl) {
        this.navigationControl = new NavigationControl(this.viewer);
        console.log("✅ Navigation Control initialized");
      }
    },

    // ✅ KHỞI TẠO MEASUREMENT SYSTEM
    initMeasurementSystem() {
      if (this.viewer && !this.measurementSystem) {
        this.measurementSystem = new MeasurementSystem(
          this.viewer,
          this.showNotification.bind(this),
        );
        console.log("✅ Measurement System initialized");
      }
    },

    // ✅ KHỞI TẠO COORDINATE SYSTEM
    initCoordinateSystem() {
      if (this.viewer && !this.coordinateSystem) {
        this.coordinateSystem = new CoordinateSystem(
          this.viewer,
          this.showNotification.bind(this),
        );
        console.log("✅ Coordinate System initialized");
      }
    },

    setupMeasureButton() {
      const btnMeasure = document.getElementById("btnMeasure");
      const panelMeasure = document.getElementById("panelMeasure");

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

    showCurrentLODInfo() {
      const oldDisplay = document.querySelector(".lod-info-display");
      if (oldDisplay) {
        oldDisplay.remove();
      }

      const lodInfo = this.lodManager.getCurrentLODInfo();

      const display = document.createElement("div");
      display.className = "lod-info-display";
      display.innerHTML = `
        <h4>📊 THÔNG TIN LOD HIỆN TẠI</h4>
        <p><strong>Cấp độ:</strong> LoD${lodInfo.level}</p>
        <p><strong>Mô tả:</strong> ${lodInfo.description}</p>
        <p><strong>URL:</strong> ${lodInfo.url}</p>
        <p><strong>Trạng thái:</strong> ${
          lodInfo.isLoading ? "Đang tải..." : "Đã tải ✓"
        }</p>
      `;

      document.querySelector(".map-wrapper").appendChild(display);

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
      if (this.measurementSystem) {
        this.measurementSystem.toggleHeightMeasure(this.coordinateSystem);
      }
    },

    // ✅ PHƯƠNG THỨC LẤY TỌA ĐỘ (gọi từ template)
    toggleLocatePoint() {
      if (this.coordinateSystem) {
        this.coordinateSystem.toggleLocatePoint(this.measurementSystem);
      }
    },

    // ✅ PHƯƠNG THỨC XÓA TẤT CẢ PHÉP ĐO
    clearAllMeasurements() {
      if (this.measurementSystem) {
        this.measurementSystem.clearAllMeasurements();
      }
      if (this.coordinateSystem) {
        this.coordinateSystem.clearAllMarkers();
      }

      // Đóng panel measure
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
    // Dọn dẹp navigation control
    if (this.navigationControl) {
      this.navigationControl.destroy();
      this.navigationControl = null;
    }

    // Dọn dẹp measurement system
    if (this.measurementSystem) {
      this.measurementSystem.destroy();
      this.measurementSystem = null;
    }

    // Dọn dẹp coordinate system
    if (this.coordinateSystem) {
      this.coordinateSystem.destroy();
      this.coordinateSystem = null;
    }

    // Dọn dẹp các handler khác
    if (this.attrHandler) this.attrHandler.destroy();

    // Dọn dẹp manager
    this.lodManager = null;

    // Dọn dẹp viewer
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }

    console.log("✅ Đã dọn dẹp tất cả tài nguyên Map.js");
  },
};
