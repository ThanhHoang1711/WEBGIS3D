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

        const { Model } = await import("cesium");

        for (const item of models) {
          const position = Cartesian3.fromDegrees(
            item.lon,
            item.lat,
            item.height
          );
          const modelMatrix = Transforms.eastNorthUpToFixedFrame(position);
          const model = await Model.fromGltfAsync({
            url: item.url,
            modelMatrix: modelMatrix,
            scale: item.scale,
          });
          this.viewer.scene.primitives.add(model);
        }
        console.log(`Loaded ${models.length} GLB models`);
      } catch (err) {
        console.error("Lỗi load GLB models:", err);
      }
    },

    /* =========================
       Khởi tạo Viewer Cesium
       ========================= */
    async initCesium() {
      Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMjFiMTVhMy0yOTliLTQ2ODQtYTEzNy0xZDI0YTVlZWVkNTkiLCJpZCI6MzI2NjIyLCJpYXQiOjE3NTM3OTQ1NTB9.CB33-d5mVIlNDJeLUMWSyovvOtqLC2ewy0_rBOMwM8k";

      this.viewer = new Viewer("cesiumContainer", {
        terrainProvider: await CesiumTerrainProvider.fromUrl(
          "http://localhost:8006/tilesets/tiles"
        ),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
      });

      // ✅ BẮT BUỘC: Enable depth test để nước tương tác với terrain
      this.viewer.scene.globe.depthTestAgainstTerrain = true;

      await this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(105.302657, 21.025975, 500),
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-30),
        },
      });

      await this.loadTileset();

      // 🔹 Load GLB models (nếu có)
      await this.loadGLBModels();

      // Gọi hàm sự kiện nút hiện panel
      this.setupMeasureButton();

      // 🔹 ✅ Kích hoạt mô phỏng nước - truyền terrain provider
      setupWaterControl(this.viewer);

      // ✅ Khởi tạo ModelManager
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

      if (!btnMeasure || !panelMeasure) {
        console.error("Không tìm thấy btnMeasure hoặc panelMeasure");
        return;
      }

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
          "info"
        );
      }
    },

    activateHeightMeasure() {
      this.measureHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas
      );

      // Xử lý click chuột trái
      this.measureHandler.setInputAction(
        (click) => this.handleHeightClick(click),
        ScreenSpaceEventType.LEFT_CLICK
      );

      // Xử lý di chuyển chuột
      this.measureHandler.setInputAction(
        (movement) => this.handleHeightMouseMove(movement),
        ScreenSpaceEventType.MOUSE_MOVE
      );

      // Xử lý click chuột phải để huỷ
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
          "info"
        );
      }
    },

    activateLocatePoint() {
      this.locateHandler = new ScreenSpaceEventHandler(
        this.viewer.scene.canvas
      );

      // Xử lý click chuột trái
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
          })
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
            : "#2196F3"
        };
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;

      document.body.appendChild(notification);

      // Tự động xóa sau 3 giây
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
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
    // Dọn dẹp tất cả handler
    if (this.measureHandler) this.measureHandler.destroy();
    if (this.locateHandler) this.locateHandler.destroy();
    if (this.attrHandler) this.attrHandler.destroy();
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.destroy();
  },
};
