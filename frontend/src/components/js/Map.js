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
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Color,
  Cartesian2,
  defined,
  WebMapServiceImageryProvider,
  GeographicTilingScheme,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { setupWaterControl } from "./WaterControl";
import { ModelManager } from "./ModelManager";
// ✅ Import 2 module mới
import { UploadModelHandler } from "./UpLoadModel";
import { UploadI3DM } from "./UploadI3DM";
import { setupWaterFill } from "./WaterFill";
// =========================
// LỚP QUẢN LÝ LOD (LEVEL OF DETAIL)
// =========================
class LODManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.currentLOD = 0; // Lưu LOD hiện tại
    this.isLoading = false; // Trạng thái đang tải

    // Khởi tạo URLs cho các cấp độ chi tiết
    this.initLODUrls();

    // Thiết lập sự kiện cho các nút LOD
    this.setupLODButtons();
  }

  // Khởi tạo URLs cho từng cấp độ LOD
  initLODUrls() {
    this.lodUrls = {
      0: "http://localhost:8006/tilesets/tiles", // LoD0: Mức chi tiết thấp nhất
      1: "http://localhost:8010/tilesets/tiles", // LoD1: Mức chi tiết thấp
      2: "http://localhost:8011/tilesets/tiles", // LoD2: Mức chi tiết trung bình
      3: "http://localhost:8012/tilesets/tiles", // LoD3: Mức chi tiết cao (dùng chung URL với LoD2)
    };
  }

  // Thiết lập sự kiện click cho các nút LOD trong panel
  setupLODButtons() {
    // Ánh xạ ID nút với cấp độ LOD
    const lodButtons = {
      btnLoD0: 0,
      btnLoD1: 1,
      btnLoD2: 2,
      btnLoD3: 3,
    };

    // Gán sự kiện cho từng nút
    Object.keys(lodButtons).forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        const lodLevel = lodButtons[buttonId];
        button.addEventListener("click", () => {
          this.switchToLOD(lodLevel);
        });

        // Thêm tooltip cho nút
        button.title = `Chuyển sang LoD${lodLevel} (Cảnh ${lodLevel})`;

        // Thêm lớp CSS cho nút
        button.classList.add("lod-button");
      }
    });
  }

  // Chuyển đổi sang cấp độ LOD cụ thể
  async switchToLOD(lodLevel) {
    // Kiểm tra nếu đang tải
    if (this.isLoading) {
      console.log("⏳ Đang tải terrain, vui lòng đợi...");
      this.showNotification("Đang tải terrain, vui lòng đợi...", "warning");
      return;
    }

    // Kiểm tra nếu đã ở LOD này
    if (lodLevel === this.currentLOD) {
      console.log(`✓ LoD${lodLevel} đã được tải`);
      this.showNotification(`Đã ở LoD${lodLevel}`, "info");
      return;
    }

    try {
      this.isLoading = true;
      console.log(`🔄 Đang chuyển sang terrain LoD${lodLevel}...`);

      // Tải terrain mới
      await this.loadTilesetByLOD(lodLevel);

      // Cập nhật trạng thái hiện tại
      this.currentLOD = lodLevel;

      // Cập nhật giao diện nút
      this.updateLODButtonStates(lodLevel);

      console.log(`✅ Đã chuyển sang terrain LoD${lodLevel} thành công`);
    } catch (error) {
      console.error(`❌ Lỗi khi chuyển sang LoD${lodLevel}:`, error);
      this.showNotification(
        `Lỗi khi tải LoD${lodLevel}: ${error.message}`,
        "error",
      );
    } finally {
      this.isLoading = false;
    }
  }

  // Tải tileset dựa trên cấp độ LOD
  async loadTilesetByLOD(lodLevel) {
    const url = this.lodUrls[lodLevel];

    if (!url) {
      throw new Error(`Không tìm thấy URL cho LoD${lodLevel}`);
    }

    try {
      console.log(`🌍 Đang tải terrain từ: ${url}`);

      // Hiển thị thông báo loading
      this.showNotification(`Đang tải terrain LoD${lodLevel}...`, "info");

      // ✅ SỬA: Tham số đầu tiên là URL string, tham số thứ hai là options object
      const terrainProvider = await CesiumTerrainProvider.fromUrl(url, {
        requestVertexNormals: true,
        requestWaterMask: true,
      });

      // ✅ Đợi terrain provider sẵn sàng
      if (terrainProvider.readyPromise) {
        await terrainProvider.readyPromise;
      }

      // Cập nhật terrain provider cho viewer
      this.viewer.terrainProvider = terrainProvider;

      // Bật depth test để đảm bảo terrain tương tác đúng với các đối tượng khác
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      console.log(`✅ Terrain LoD${lodLevel} đã sẵn sàng`);

      // Hiển thị thông báo thành công
      this.showNotification(
        `✓ Đã tải thành công terrain LoD${lodLevel}`,
        "success",
      );

      return terrainProvider;
    } catch (error) {
      console.error(`❌ Lỗi khi tải terrain LoD${lodLevel}:`, error);

      // Hiển thị thông báo lỗi chi tiết
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

  // Cập nhật trạng thái visual của các nút LOD
  updateLODButtonStates(activeLOD) {
    const lodButtons = ["btnLoD0", "btnLoD1", "btnLoD2", "btnLoD3"];

    lodButtons.forEach((buttonId, index) => {
      const button = document.getElementById(buttonId);
      if (button) {
        if (index === activeLOD) {
          // Nút đang active
          button.classList.add("active-lod");
          button.style.backgroundColor = "#4CAF50"; // Màu xanh lá
          button.style.color = "white";
          button.style.border = "2px solid #2E7D32";
          button.style.fontWeight = "bold";
        } else {
          // Nút không active
          button.classList.remove("active-lod");
          button.style.backgroundColor = "#f5f5f5";
          button.style.color = "#333";
          button.style.border = "1px solid #ddd";
          button.style.fontWeight = "normal";
        }
      }
    });
  }

  // Lấy thông tin về LOD hiện tại
  getCurrentLODInfo() {
    return {
      level: this.currentLOD,
      url: this.lodUrls[this.currentLOD],
      description: this.getLODDescription(this.currentLOD),
      isLoading: this.isLoading,
    };
  }

  // Mô tả cho từng cấp độ LOD
  getLODDescription(lodLevel) {
    const descriptions = {
      0: "Cảnh 0 - Mức chi tiết thấp nhất, tối ưu hiệu năng",
      1: "Cảnh 1 - Mức chi tiết thấp, hiển thị nhanh",
      2: "Cảnh 2 - Mức chi tiết trung bình, cân bằng hiệu năng và chất lượng",
      3: "Cảnh 3 - Mức chi tiết cao, hiển thị đầy đủ chi tiết",
    };
    return descriptions[lodLevel] || "Không xác định";
  }

  // Hiển thị thông báo
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

    // Tự động xóa sau 3 giây
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
      // ✅ Thêm 2 module mới
      uploadModelHandler: null,
      uploadI3DM: null,
      lodManager: null,
      // attribute (bảng thuộc tính)
      attrHandler: null,
      attrActive: false,
      attrVisible: false,
      attrContent: "",

      // viewshed
      viewshedActive: false,

      // Measurement properties
      measureActive: false,
      locateActive: false,
      measureHandler: null,
      locateHandler: null,
      firstMeasurePoint: null,
      dynamicMeasureLine: null,
      measurePoints: [],
      measureLines: [],
      measureLabels: [],
      coordMarkers: [],
    };
  },

  methods: {
    /* =========================
       Load tileset từ backend
       ========================= */
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

    /* =========================
       Load GLB Models từ backend
       ========================= */
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

          // ✅ ĐỌC ĐÚNG ROTATION
          const rotation = item.rotation || {};

          const hpr = new HeadingPitchRoll(
            CesiumMath.toRadians(rotation.z || 0), // heading
            CesiumMath.toRadians(rotation.x || 0), // pitch
            CesiumMath.toRadians(rotation.y || 0), // roll
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
    /* =========================
       Khởi tạo Viewer Cesium với chức năng LOD
       ========================= */
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

      // ✅ BẮT BUỘC: Enable depth test để nước tương tác với terrain
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      // Bay đến vị trí mặc định
      await this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(105.302657, 21.025975, 500),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-30),
        },
      });

      // 1. KHỞI TẠO LOD MANAGER - QUAN TRỌNG: Phải tạo trước khi tải tileset
      this.lodManager = new LODManager(this.viewer);
      console.log("✅ LOD Manager đã khởi tạo");

      // 2. TẢI TILESET MẶC ĐỊNH (LoD0) - ĐÃ THAY THẾ loadTileset()
      await this.lodManager.switchToLOD(0);

      // 3. LOAD GLB MODELS (nếu có)
      await this.loadGLBModels();

      // 4. THIẾT LẬP CÁC NÚT CHỨC NĂNG
      this.setupMeasureButton(); // Nút đo đạc
      this.setupLoDButton(); // Nút hiển thị panel LOD

      // 5. KÍCH HOẠT MÔ PHỎNG NƯỚC
      setupWaterControl(this.viewer);

      // 5.5. KÍCH HOẠT MÔ PHỎNG NƯỚC TRÀN (mới)
      setupWaterFill(this.viewer);
      console.log("✅ Water Fill Simulation initialized");

      // 6. KHỞI TẠO MODEL MANAGER
      this.modelManager = new ModelManager(this.viewer);
      console.log("✅ Model Manager initialized");
      window.modelManager = this.modelManager;

      // ✅ Khởi tạo UploadModelHandler (thêm 1 model GLB)
      this.uploadModelHandler = new UploadModelHandler(this.viewer);
      console.log("✅ UploadModelHandler initialized");
      window.uploadModelHandler = this.uploadModelHandler;

      // ✅ Khởi tạo UploadI3DM (thêm nhiều models)
      this.uploadI3DM = new UploadI3DM(this.viewer);
      console.log("✅ UploadI3DM initialized");
      window.uploadI3DM = this.uploadI3DM;

      // 🔹 Gán nút toggle bản đồ nền
      document
        .getElementById("btnBasemap")
        .addEventListener("click", () => this.toggleBasemap());
    },

    /* =========================
       Phương thức đo đạc - TẤT CẢ TRONG 1 FILE
       ========================= */

    setupMeasureButton() {
      const btnMeasure = document.getElementById("btnMeasure");
      const panelMeasure = document.getElementById("panelMeasure");

      // Toggle panel
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

      // ✅ Ngăn panel đóng khi click vào bên trong panel
      panelMeasure.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      // Đóng panel khi click ra ngoài
      document.addEventListener("click", (e) => {
        if (!panelMeasure.contains(e.target) && e.target !== btnMeasure) {
          panelMeasure.style.display = "none";
        }
      });
    },

    // =========================
    // PHƯƠNG THỨC XỬ LÝ NÚT LOD PANEL
    // =========================
    setupLoDButton() {
      const btnLoD = document.getElementById("btnLoD");
      const panelLoD = document.getElementById("panelLoD");

      // Kiểm tra nếu element tồn tại
      if (!btnLoD || !panelLoD) {
        console.warn("Không tìm thấy nút LoD hoặc panel LoD");
        return;
      }

      // Toggle hiển thị panel LOD
      btnLoD.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Hiển thị hoặc ẩn panel
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

      // ✅ Ngăn panel đóng khi click vào bên trong panel
      panelLoD.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      // Đóng panel khi click ra ngoài
      document.addEventListener("click", (e) => {
        if (!panelLoD.contains(e.target) && e.target !== btnLoD) {
          panelLoD.style.display = "none";
        }
      });
    },

    // =========================
    // HIỂN THỊ THÔNG TIN LOD HIỆN TẠI
    // =========================
    showCurrentLODInfo() {
      // Xóa hiển thị cũ nếu có
      const oldDisplay = document.querySelector(".lod-info-display");
      if (oldDisplay) {
        oldDisplay.remove();
      }

      // Lấy thông tin LOD hiện tại
      const lodInfo = this.lodManager.getCurrentLODInfo();

      // Tạo element hiển thị
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

      // Tự động ẩn sau 5 giây
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

    /* =========================
       Đo chiều cao
       ========================= */
    toggleHeightMeasure() {
      // ✅ Tắt chế độ lấy tọa độ nếu đang bật
      if (this.locateActive) {
        this.deactivateLocatePoint();
        this.locateActive = false;
      }

      if (this.measureActive) {
        // Tắt chế độ đo
        this.deactivateHeightMeasure();
        this.measureActive = false;
        this.showNotification("Chế độ đo chiều cao đã tắt!", "success");
      } else {
        // Bật chế độ đo
        this.activateHeightMeasure();
        this.measureActive = true;
        this.showNotification(
          "Chế độ đo chiều cao đã bật. Click 2 điểm để đo Δh.",
          "info",
        );
      }
    },

    activateHeightMeasure() {
      this.measureHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );

      // Xử lý click chuột trái
      this.measureHandler.setInputAction(
        (click) => this.handleHeightClick(click),
        ScreenSpaceEventType.LEFT_CLICK,
      );

      // Xử lý di chuyển chuột
      this.measureHandler.setInputAction(
        (movement) => this.handleHeightMouseMove(movement),
        ScreenSpaceEventType.MOUSE_MOVE,
      );

      // Xử lý click chuột phải để huỷ
      this.measureHandler.setInputAction(
        () => this.cancelCurrentHeightMeasurement(),
        ScreenSpaceEventType.RIGHT_CLICK,
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
        // Điểm đầu tiên
        this.firstMeasurePoint = pickedPos;
        this.addHeightPointMarker(this.firstMeasurePoint, Color.RED, "Điểm A");

        // Tạo đường tạm thời
        this.dynamicMeasureLine = this.viewer.entities.add({
          polyline: {
            positions: [this.firstMeasurePoint, this.firstMeasurePoint],
            width: 3,
            material: Color.YELLOW.withAlpha(0.5),
          },
        });
      } else {
        // Điểm thứ hai - hoàn thành phép đo
        const secondPoint = pickedPos;
        this.addHeightPointMarker(secondPoint, Color.BLUE, "Điểm B");
        this.completeHeightMeasurement(this.firstMeasurePoint, secondPoint);

        // Xóa đường tạm thời
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

      // Cập nhật vị trí cuối của đường tạm thời
      this.dynamicMeasureLine.polyline.positions = [
        this.firstMeasurePoint,
        pickedPos,
      ];
    },

    completeHeightMeasurement(pointA, pointB) {
      // Tính toán chiều cao
      const cartoA = Cartographic.fromCartesian(pointA);
      const cartoB = Cartographic.fromCartesian(pointB);

      const heightA = parseFloat(cartoA.height).toFixed(2);
      const heightB = parseFloat(cartoB.height).toFixed(2);
      const diff = (cartoB.height - cartoA.height).toFixed(2);

      // Tạo đường nối giữa hai điểm
      const line = this.viewer.entities.add({
        polyline: {
          positions: [pointA, pointB],
          width: 4,
          material: Color.ORANGE,
        },
      });

      // Thêm label hiển thị chênh lệch độ cao
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

      // Thông báo kết quả
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
        // Xóa điểm đầu tiên
        const lastPoint = this.measurePoints.pop();
        if (lastPoint) {
          this.viewer.entities.remove(lastPoint);
        }

        // Xóa đường tạm thời
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
      // ✅ Tắt chế độ đo chiều cao nếu đang bật
      if (this.measureActive) {
        this.deactivateHeightMeasure();
        this.measureActive = false;
      }

      if (this.locateActive) {
        // Tắt chế độ lấy tọa độ
        this.deactivateLocatePoint();
        this.locateActive = false;
        this.showNotification("Chế độ lấy tọa độ đã tắt!", "success");
      } else {
        // Bật chế độ lấy tọa độ
        this.activateLocatePoint();
        this.locateActive = true;
        this.showNotification(
          "Chế độ lấy tọa độ đã bật. Click vào bản đồ!",
          "info",
        );
      }
    },

    activateLocatePoint() {
      this.locateHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );

      // Xử lý click chuột trái
      this.locateHandler.setInputAction(
        (click) => this.handleCoordinateClick(click),
        ScreenSpaceEventType.LEFT_CLICK,
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

      // Thêm marker
      const marker = this.addCoordinateMarker(cartesian, lat, lon, height);
      this.coordMarkers.push(marker);

      // Thông báo tọa độ
      const coordMessage = `Tọa độ đã lấy:\nLat: ${lat}°\nLon: ${lon}°\nĐộ cao: ${height}m`;
      this.showNotification(coordMessage, "success");

      // Log ra console
      console.log(coordMessage);
    },

    addCoordinateMarker(position, lat, lon, height) {
      // Tạo màu ngẫu nhiên cho marker
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
       Xóa các phép đo đi
       ========================= */
    clearAllMeasurements() {
      // Xóa tất cả điểm đo chiều cao
      this.measurePoints.forEach((point) => {
        if (point) this.viewer.entities.remove(point);
      });

      // Xóa tất cả đường đo chiều cao
      this.measureLines.forEach((line) => {
        if (line) this.viewer.entities.remove(line);
      });

      // Xóa tất cả label đo chiều cao
      this.measureLabels.forEach((label) => {
        if (label) this.viewer.entities.remove(label);
      });

      // Xóa tất cả marker tọa độ
      this.coordMarkers.forEach((marker) => {
        if (marker) this.viewer.entities.remove(marker);
      });

      // Reset tất cả mảng
      this.measurePoints = [];
      this.measureLines = [];
      this.measureLabels = [];
      this.coordMarkers = [];

      // Nếu đang trong quá trình đo, huỷ
      if (this.firstMeasurePoint) {
        this.cancelCurrentHeightMeasurement();
      }

      // Đóng panel measure
      const panelMeasure = document.getElementById("panelMeasure");
      if (panelMeasure) {
        panelMeasure.style.display = "none";
      }

      this.showNotification("Đã xóa tất cả các phép đo", "success");
    },

    /* =========================
       Toggle Basemap WMS
       ========================= */
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

    /* =========================
       Xem thuộc tính feature
       ========================= */
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

    /* =========================
       Viewshed
       ========================= */
    toggleViewshed() {
      this.viewshedActive = !this.viewshedActive;
      if (this.viewshedActive) alert("Chế độ Viewshed bật!");
      else alert("Viewshed đã tắt!");
    },

    /* =========================
       Tiện ích chung
       ========================= */
    showNotification(message, type = "info") {
      // Có thể thay thế bằng toast notification hoặc alert
      console.log(`${type.toUpperCase()}: ${message}`);

      // Hiển thị thông báo đơn giản
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

      // Tự động xóa sau 3 giây
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
    // Dọn dẹp tất cả handler và manager
    if (this.measureHandler) this.measureHandler.destroy();
    if (this.locateHandler) this.locateHandler.destroy();
    if (this.attrHandler) this.attrHandler.destroy();

    // Dọn dẹp LOD Manager (không cần clearAllTilesets vì chỉ thay đổi terrainProvider)
    this.lodManager = null;

    // Dọn dẹp viewer
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }

    console.log("✅ Đã dọn dẹp tất cả tài nguyên Map.js");
  },
};
