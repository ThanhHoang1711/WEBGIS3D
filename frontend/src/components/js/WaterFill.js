/* eslint-disable */
import * as Cesium from "cesium";
import {
  Color,
  Cartesian3,
  Cartographic,
  sampleTerrainMostDetailed,
  CallbackProperty,
  Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math as CesiumMath,
  PolygonHierarchy,
  ImageMaterialProperty,
  buildModuleUrl,
  HeightReference,
  ClassificationType,
  ColorMaterialProperty,
  Ellipsoid,
  VertexFormat,
} from "cesium";

export class WaterFillSimulation {
  constructor(viewer) {
    this.viewer = viewer;
    this.isActive = false;
    this.polygonPoints = [];
    this.polygonEntity = null;
    this.drawHandler = null;
    this.sourcePoint = null;
    this.sourceMarker = null;
    this.waterVolume = 0;
    this.waterLevel = 0;
    this.floodedCells = new Map();
    this.gridResolution = 10;
    this.terrainSamples = [];
    this.waterEntity = null;
    this.isSimulating = false;
    this.simulationInterval = null;
    this.popup = null;
    this.bounds = null;
    this.step = 0;

    // Các biến cho hiệu ứng nước
    this.waterHeightMap = new Map();
    this.waterPositions = [];
    this.waterIndices = [];
    this.waterNormals = [];
    this.waveTime = 0;
    this.waterPrimitive = null;
    this.terrainProvider = viewer.terrainProvider;

    // Tham số sóng
    this.waveAmplitude = 0.3;
    this.waveFrequency = 0.5;
    this.waveSpeed = 1.0;
    this.waterColor = new Color(0.0, 0.3, 0.6, 0.8);
  }

  // ====== KHỞI ĐỘNG CÔNG CỤ ======
  activate() {
    if (this.isActive) {
      this.showNotification("Công cụ đã được kích hoạt!", "warning");
      return;
    }

    this.isActive = true;
    this.step = 1;
    this.createControlUI();
    this.showNotification(
      "Bước 1: Vẽ vùng mô phỏng (click để thêm điểm, chuột phải để hoàn thành)",
      "info",
    );
    this.startDrawingPolygon();
  }

  // ====== TẠO GIAO DIỆN ĐIỀU KHIỂN ======
  createControlUI() {
    if (this.popup) return;

    this.popup = document.createElement("div");
    this.popup.id = "waterFillPopup";
    this.popup.innerHTML = `
      <div class="wf-popup-header">
        <h3>💧 Mô phỏng nước tràn</h3>
        <button id="wfClosePopup">✖</button>
      </div>
      <div class="wf-popup-body">
        <div class="wf-status">
          <p id="wfStatusText">Đang vẽ vùng mô phỏng...</p>
        </div>
        <div class="wf-info">
          <p>Mực nước: <strong id="wfLevelValue">0.0</strong> m</p>
          <p>Thể tích: <strong id="wfVolumeText">0</strong> m³</p>
          <p>Diện tích ngập: <strong id="wfAreaText">0</strong> m²</p>
          <div class="wf-slider-control">
            <label>Điều chỉnh mực nước:</label>
            <input type="range" id="wfLevelSlider" min="0" max="50" value="0" step="0.5">
            <div class="slider-value"><span id="wfSliderValue">0.0 m</span></div>
          </div>
        </div>
        <div class="wf-controls" style="display: none;">
          <button id="wfAddWater" class="wf-btn wf-btn-add">
            ⬆️ Tăng 0.5m
          </button>
          <button id="wfRemoveWater" class="wf-btn wf-btn-remove">
            ⬇️ Giảm 0.5m
          </button>
          <button id="wfAutoFill" class="wf-btn wf-btn-auto">
            🌊 Tự động dâng
          </button>
          <button id="wfReset" class="wf-btn wf-btn-reset">
            🔄 Reset
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.popup);
    this.addPopupStyles();

    // Gán sự kiện
    document.getElementById("wfClosePopup").addEventListener("click", () => {
      this.deactivate();
    });

    document.getElementById("wfAddWater").addEventListener("click", () => {
      this.setWaterLevel(this.waterLevel + 0.5);
    });

    document.getElementById("wfRemoveWater").addEventListener("click", () => {
      this.setWaterLevel(Math.max(0, this.waterLevel - 0.5));
    });

    document.getElementById("wfReset").addEventListener("click", () => {
      this.resetSimulation();
    });

    document.getElementById("wfAutoFill").addEventListener("click", () => {
      this.toggleAutoFill();
    });

    // Slider mực nước
    const levelSlider = document.getElementById("wfLevelSlider");
    levelSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("wfSliderValue").textContent = `${value.toFixed(
        1,
      )} m`;
      this.setWaterLevel(value);
    });
  }

  // ====== THÊM CSS ======
  addPopupStyles() {
    if (document.getElementById("waterFillStyles")) return;

    const style = document.createElement("style");
    style.id = "waterFillStyles";
    style.textContent = `
      #waterFillPopup {
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(0, 20, 40, 0.95);
        border: 2px solid #00bcd4;
        border-radius: 15px;
        padding: 20px;
        width: 320px;
        box-shadow: 0 10px 40px rgba(0, 188, 212, 0.5);
        z-index: 9999;
        color: white;
        font-family: 'Segoe UI', Arial, sans-serif;
        backdrop-filter: blur(10px);
      }

      .wf-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #00bcd4;
      }

      .wf-popup-header h3 {
        margin: 0;
        font-size: 18px;
        color: #00bcd4;
        font-weight: 600;
      }

      #wfClosePopup {
        background: rgba(255, 82, 82, 0.2);
        border: none;
        color: #ff5252;
        font-size: 18px;
        cursor: pointer;
        padding: 5px 10px;
        border-radius: 5px;
        transition: all 0.3s;
      }

      #wfClosePopup:hover {
        background: rgba(255, 82, 82, 0.4);
        transform: scale(1.1);
      }

      .wf-status {
        background: linear-gradient(135deg, rgba(0, 188, 212, 0.2), rgba(33, 150, 243, 0.2));
        border-left: 4px solid #2196F3;
        padding: 12px;
        margin-bottom: 15px;
        border-radius: 8px;
      }

      .wf-status p {
        margin: 0;
        font-size: 14px;
        color: #bbdefb;
        font-weight: 500;
      }

      .wf-info {
        background: rgba(255, 255, 255, 0.05);
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 15px;
        border: 1px solid rgba(0, 188, 212, 0.3);
      }

      .wf-info p {
        margin: 8px 0;
        font-size: 14px;
        color: #e3f2fd;
        display: flex;
        justify-content: space-between;
      }

      .wf-info strong {
        color: #00bcd4;
        font-weight: 600;
      }

      .wf-slider-control {
        margin-top: 15px;
      }

      .wf-slider-control label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #bbdefb;
        font-weight: 500;
      }

      #wfLevelSlider {
        width: 100%;
        height: 8px;
        background: linear-gradient(to right, #006064, #00bcd4);
        border-radius: 4px;
        outline: none;
        -webkit-appearance: none;
        margin: 10px 0;
      }

      #wfLevelSlider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        background: #00bcd4;
        border-radius: 50%;
        cursor: pointer;
        border: 3px solid white;
        box-shadow: 0 0 10px rgba(0, 188, 212, 0.8);
      }

      .slider-value {
        text-align: center;
        margin-top: 8px;
      }

      .slider-value span {
        background: rgba(0, 188, 212, 0.3);
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        color: #00bcd4;
      }

      .wf-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .wf-btn {
        padding: 12px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .wf-btn-add {
        background: linear-gradient(135deg, #00C853, #64DD17);
        color: white;
      }

      .wf-btn-add:hover {
        background: linear-gradient(135deg, #00E676, #76FF03);
        transform: translateY(-2px);
      }

      .wf-btn-remove {
        background: linear-gradient(135deg, #FF9800, #FFB300);
        color: white;
      }

      .wf-btn-remove:hover {
        background: linear-gradient(135deg, #FFB74D, #FFCA28);
        transform: translateY(-2px);
      }

      .wf-btn-auto {
        background: linear-gradient(135deg, #2196F3, #2979FF);
        color: white;
      }

      .wf-btn-auto:hover {
        background: linear-gradient(135deg, #42A5F5, #448AFF);
        transform: translateY(-2px);
      }

      .wf-btn-reset {
        background: linear-gradient(135deg, #F44336, #D50000);
        color: white;
      }

      .wf-btn-reset:hover {
        background: linear-gradient(135deg, #EF5350, #FF1744);
        transform: translateY(-2px);
      }

      .wf-btn-auto, .wf-btn-reset {
        grid-column: span 2;
      }

      .wf-btn-auto.active {
        background: linear-gradient(135deg, #F44336, #D50000);
      }
    `;

    document.head.appendChild(style);
  }

  // ====== VẼ VÙNG MÔ PHỎNG ======
  startDrawingPolygon() {
    this.drawHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.drawHandler.setInputAction((click) => {
      const earthPos = this.viewer.scene.pickPosition(click.position);
      if (!earthPos) return;

      const carto = Cartographic.fromCartesian(earthPos);
      this.polygonPoints.push(carto);

      this.updatePolygonPreview();

      this.showNotification(
        `Đã thêm điểm ${this.polygonPoints.length}. Chuột phải để hoàn thành.`,
        "info",
      );
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.drawHandler.setInputAction(() => {
      if (this.polygonPoints.length < 3) {
        this.showNotification("Cần ít nhất 3 điểm để tạo vùng!", "warning");
        return;
      }

      this.finishDrawingPolygon();
    }, ScreenSpaceEventType.RIGHT_CLICK);
  }

  updatePolygonPreview() {
    if (this.polygonEntity) {
      this.viewer.entities.remove(this.polygonEntity);
    }

    if (this.polygonPoints.length < 2) return;

    const positions = this.polygonPoints.map((carto) =>
      Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
    );

    this.polygonEntity = this.viewer.entities.add({
      polyline: {
        positions: positions,
        width: 4,
        material: Color.CYAN,
        clampToGround: true,
      },
    });
  }

  async finishDrawingPolygon() {
    this.drawHandler.destroy();
    this.drawHandler = null;
    this.step = 2;

    if (this.polygonEntity) {
      this.viewer.entities.remove(this.polygonEntity);
    }

    const positions = this.polygonPoints.map((carto) =>
      Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
    );

    this.polygonEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.CYAN.withAlpha(0.1),
        outline: true,
        outlineColor: Color.CYAN,
        outlineWidth: 3,
        height: 0,
        extrudedHeight: 0,
      },
    });

    this.calculateBounds();

    this.showNotification("Đang phân tích địa hình...", "info");
    await this.sampleTerrain();

    document.getElementById("wfStatusText").textContent =
      "Bước 2: Click để chọn điểm xả nước";
    this.showNotification("Click vào bản đồ để chọn điểm xả nước", "info");
    this.startSelectingSourcePoint();
  }

  // ====== LẤY MẪU ĐỊA HÌNH ======
  async sampleTerrain() {
    const { minLon, maxLon, minLat, maxLat } = this.bounds;

    const centerLat = (minLat + maxLat) / 2;
    const metersPerDegreeLon =
      111320 * Math.cos(CesiumMath.toRadians(centerLat));
    const metersPerDegreeLat = 110540;

    const widthMeters = (maxLon - minLon) * metersPerDegreeLon;
    const heightMeters = (maxLat - minLat) * metersPerDegreeLat;

    const numX = Math.ceil(widthMeters / this.gridResolution);
    const numY = Math.ceil(heightMeters / this.gridResolution);

    const positions = [];
    for (let i = 0; i <= numX; i++) {
      for (let j = 0; j <= numY; j++) {
        const lon = minLon + (maxLon - minLon) * (i / numX);
        const lat = minLat + (maxLat - minLat) * (j / numY);

        if (this.isPointInPolygon(lon, lat)) {
          positions.push(Cartographic.fromDegrees(lon, lat, 0));
        }
      }
    }

    try {
      this.terrainSamples = await sampleTerrainMostDetailed(
        this.viewer.terrainProvider,
        positions,
      );
    } catch (error) {
      console.error("Lỗi lấy mẫu địa hình:", error);
      this.showNotification("Lỗi khi phân tích địa hình", "error");
    }
  }

  // ====== TẠO MẶT NƯỚC ĐƠN GIẢN NHƯNG HIỆU QUẢ ======
  createWaterSurface(floodedCells, waterLevel) {
    // Xóa nước cũ nếu có
    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity);
    }

    if (floodedCells.size === 0) {
      this.waterEntity = null;
      return;
    }

    // Tạo mảng tọa độ cho polygon nước
    const waterCoordinates = [];
    const floodedArray = Array.from(floodedCells.values());

    // Nếu có ít nhất 3 điểm, tạo convex hull đơn giản
    if (floodedArray.length >= 3) {
      // Sắp xếp các điểm theo góc từ tâm
      const centerLon =
        floodedArray.reduce((sum, cell) => sum + cell.lon, 0) /
        floodedArray.length;
      const centerLat =
        floodedArray.reduce((sum, cell) => sum + cell.lat, 0) /
        floodedArray.length;

      floodedArray.sort((a, b) => {
        const angleA = Math.atan2(a.lat - centerLat, a.lon - centerLon);
        const angleB = Math.atan2(b.lat - centerLat, b.lon - centerLon);
        return angleA - angleB;
      });

      // Tạo polygon từ các điểm đã sắp xếp
      floodedArray.forEach((cell) => {
        waterCoordinates.push(cell.lon, cell.lat);
      });

      // Đóng polygon
      waterCoordinates.push(floodedArray[0].lon, floodedArray[0].lat);
    } else if (floodedArray.length === 2) {
      // Nếu chỉ có 2 điểm, tạo hình chữ nhật nhỏ xung quanh
      const cell1 = floodedArray[0];
      const cell2 = floodedArray[1];
      const centerLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
      const delta = 0.0001; // ~10m

      waterCoordinates.push(
        cell1.lon - delta,
        cell1.lat - delta,
        cell2.lon + delta,
        cell1.lat - delta,
        cell2.lon + delta,
        cell2.lat + delta,
        cell1.lon - delta,
        cell2.lat + delta,
        cell1.lon - delta,
        cell1.lat - delta,
      );
    } else if (floodedArray.length === 1) {
      // Nếu chỉ có 1 điểm, tạo hình vuông nhỏ
      const cell = floodedArray[0];
      const delta = 0.00005; // ~5m

      waterCoordinates.push(
        cell.lon - delta,
        cell.lat - delta,
        cell.lon + delta,
        cell.lat - delta,
        cell.lon + delta,
        cell.lat + delta,
        cell.lon - delta,
        cell.lat + delta,
        cell.lon - delta,
        cell.lat - delta,
      );
    }

    // Tạo water entity với material nước đẹp
    const waterMaterial = new ImageMaterialProperty({
      image: buildModuleUrl("Assets/Textures/waterNormals.jpg"),
      repeat: new Cartesian2(20, 20),
      color: new Color(0.0, 0.3, 0.6, 0.7),
      transparent: true,
    });

    // Sử dụng CallbackProperty để tạo hiệu ứng sóng động
    const waveOffsetProperty = new CallbackProperty(() => {
      return Math.sin(this.waveTime * this.waveSpeed) * this.waveAmplitude;
    }, false);

    // Tạo height property với sóng
    const waterHeightProperty = new CallbackProperty(() => {
      return waterLevel + waveOffsetProperty.getValue(new Cesium.JulianDate());
    }, false);

    this.waterEntity = this.viewer.entities.add({
      name: "Flood Water",
      polygon: {
        hierarchy: Cartesian3.fromDegreesArray(waterCoordinates),
        material: waterMaterial,
        height: waterHeightProperty,
        extrudedHeight: waterLevel,
        outline: false,
        classificationType: ClassificationType.TERRAIN,
      },
    });

    // Bắt đầu animation sóng
    this.startWaveAnimation();
  }

  // ====== ANIMATION SÓNG ĐƠN GIẢN ======
  startWaveAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const animate = () => {
      this.waveTime += 0.016; // ~60fps

      // Cập nhật texture drift
      if (this.waterEntity && this.waterEntity.polygon.material) {
        const drift = this.waveTime * 0.1;
        this.waterEntity.polygon.material.repeat = new Cartesian2(
          20 + Math.cos(this.waveTime * 0.3) * 2,
          20 + Math.sin(this.waveTime * 0.2) * 2,
        );

        // Di chuyển texture
        this.waterEntity.polygon.material.translation = new Cartesian2(
          -drift,
          0,
        );

        // Thay đổi màu sắc nhẹ
        const blueIntensity = 0.6 + Math.sin(this.waveTime * 0.5) * 0.05;
        this.waterEntity.polygon.material.color = new Color(
          0.0,
          0.3,
          blueIntensity,
          0.7 + Math.sin(this.waveTime * 0.3) * 0.05,
        );
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  // ====== CÁC HÀM HỖ TRỢ ======
  isPointInPolygon(lon, lat) {
    let inside = false;
    const points = this.polygonPoints;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = CesiumMath.toDegrees(points[i].longitude);
      const yi = CesiumMath.toDegrees(points[i].latitude);
      const xj = CesiumMath.toDegrees(points[j].longitude);
      const yj = CesiumMath.toDegrees(points[j].latitude);

      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  calculateBounds() {
    let minLon = Infinity,
      maxLon = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    this.polygonPoints.forEach((carto) => {
      const lon = CesiumMath.toDegrees(carto.longitude);
      const lat = CesiumMath.toDegrees(carto.latitude);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    this.bounds = { minLon, maxLon, minLat, maxLat };
  }

  startSelectingSourcePoint() {
    this.drawHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.drawHandler.setInputAction((click) => {
      const earthPos = this.viewer.scene.pickPosition(click.position);
      if (!earthPos) return;

      const carto = Cartographic.fromCartesian(earthPos);
      const lon = CesiumMath.toDegrees(carto.longitude);
      const lat = CesiumMath.toDegrees(carto.latitude);

      if (!this.isPointInPolygon(lon, lat)) {
        this.showNotification(
          "Điểm xả nước phải nằm trong vùng mô phỏng!",
          "warning",
        );
        return;
      }

      this.sourcePoint = carto;

      if (this.sourceMarker) {
        this.viewer.entities.remove(this.sourceMarker);
      }

      this.sourceMarker = this.viewer.entities.add({
        position: earthPos,
        point: {
          pixelSize: 20,
          color: Color.RED,
          outlineColor: Color.WHITE,
          outlineWidth: 4,
        },
        label: {
          text: "💧 NGUỒN NƯỚC",
          font: "bold 16px sans-serif",
          fillColor: Color.WHITE,
          showBackground: true,
          backgroundColor: Color.RED.withAlpha(0.8),
          pixelOffset: new Cartesian2(0, -30),
        },
      });

      this.drawHandler.destroy();
      this.drawHandler = null;

      this.step = 3;
      document.getElementById("wfStatusText").textContent = "Sẵn sàng mô phỏng";
      document.querySelector(".wf-controls").style.display = "grid";
      this.showNotification(
        "Đã chọn điểm xả nước. Sử dụng thanh trượt để điều chỉnh mực nước.",
        "success",
      );
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  // ====== ĐẶT MỰC NƯỚC ======
  setWaterLevel(level) {
    this.waterLevel = Math.max(0, Math.min(level, 50)); // Giới hạn 50m

    // Cập nhật UI
    document.getElementById("wfLevelValue").textContent =
      this.waterLevel.toFixed(1);
    document.getElementById(
      "wfSliderValue",
    ).textContent = `${this.waterLevel.toFixed(1)} m`;
    document.getElementById("wfLevelSlider").value = this.waterLevel;

    if (!this.sourcePoint) return;

    // Tính toán vùng ngập
    const flooded = this.findFloodedAreas(this.waterLevel);
    this.floodedCells = flooded;

    // Tính thể tích và diện tích
    this.waterVolume = this.calculateFloodVolume(flooded, this.waterLevel);
    const area = flooded.size * this.gridResolution * this.gridResolution;

    // Cập nhật UI
    document.getElementById("wfVolumeText").textContent = Math.floor(
      this.waterVolume,
    ).toLocaleString();
    document.getElementById("wfAreaText").textContent =
      Math.floor(area).toLocaleString();

    // Tạo mặt nước
    this.createWaterSurface(flooded, this.waterLevel);

    // Di chuyển camera nếu nước cao
    if (this.waterLevel > 2) {
      this.flyToWaterArea();
    }
  }

  // ====== TÌM VÙNG NGẬP ======
  findFloodedAreas(waterLevel) {
    const flooded = new Map();

    if (!this.sourcePoint) return flooded;

    const sourceLon = CesiumMath.toDegrees(this.sourcePoint.longitude);
    const sourceLat = CesiumMath.toDegrees(this.sourcePoint.latitude);
    const sourceKey = this.getGridKey(sourceLon, sourceLat);

    const queue = [sourceKey];
    const visited = new Set([sourceKey]);

    while (queue.length > 0) {
      const currentKey = queue.shift();
      const [lon, lat] = currentKey.split(",").map(Number);

      const height = this.getHeightAt(lon, lat);
      if (height === null || height > waterLevel) continue;

      const waterDepth = waterLevel - height;

      flooded.set(currentKey, {
        lon,
        lat,
        height,
        waterDepth,
        submerged: waterDepth > 0.1,
      });

      // Mở rộng tìm kiếm
      const neighbors = this.getNeighbors(lon, lat);
      for (const neighborKey of neighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push(neighborKey);
        }
      }
    }

    return flooded;
  }

  getNeighbors(lon, lat) {
    const centerLat = (this.bounds.minLat + this.bounds.maxLat) / 2;
    const metersPerDegreeLon =
      111320 * Math.cos(CesiumMath.toRadians(centerLat));
    const metersPerDegreeLat = 110540;

    const deltaLon = this.gridResolution / metersPerDegreeLon;
    const deltaLat = this.gridResolution / metersPerDegreeLat;

    const neighbors = [
      this.getGridKey(lon + deltaLon, lat),
      this.getGridKey(lon - deltaLon, lat),
      this.getGridKey(lon, lat + deltaLat),
      this.getGridKey(lon, lat - deltaLat),
    ];

    return neighbors.filter((key) => {
      const [nLon, nLat] = key.split(",").map(Number);
      return this.isPointInPolygon(nLon, nLat);
    });
  }

  getGridKey(lon, lat) {
    return `${lon.toFixed(6)},${lat.toFixed(6)}`;
  }

  getHeightAt(lon, lat) {
    let nearest = null;
    let minDist = Infinity;

    for (const sample of this.terrainSamples) {
      const sLon = CesiumMath.toDegrees(sample.longitude);
      const sLat = CesiumMath.toDegrees(sample.latitude);
      const dist = Math.sqrt(Math.pow(lon - sLon, 2) + Math.pow(lat - sLat, 2));

      if (dist < minDist) {
        minDist = dist;
        nearest = sample;
      }
    }

    return nearest ? nearest.height : null;
  }

  calculateFloodVolume(flooded, waterLevel) {
    const cellArea = this.gridResolution * this.gridResolution;
    let totalVolume = 0;

    flooded.forEach((cell) => {
      if (cell.submerged) {
        totalVolume += cellArea * cell.waterDepth;
      }
    });

    return totalVolume;
  }

  // ====== CÁC HÀM ĐIỀU KHIỂN ======
  toggleAutoFill() {
    const btn = document.getElementById("wfAutoFill");

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      btn.textContent = "🌊 Tự động dâng";
      btn.classList.remove("active");
    } else {
      btn.textContent = "⏸️ Dừng tự động";
      btn.classList.add("active");
      this.simulationInterval = setInterval(() => {
        if (this.waterLevel < 50) {
          this.setWaterLevel(this.waterLevel + 0.1);
        } else {
          this.toggleAutoFill(); // Dừng khi đạt max
        }
      }, 100);
    }
  }

  flyToWaterArea() {
    if (this.floodedCells.size === 0) return;

    // Tính tâm vùng ngập
    let sumLon = 0,
      sumLat = 0;
    let count = 0;

    this.floodedCells.forEach((cell) => {
      sumLon += cell.lon;
      sumLat += cell.lat;
      count++;
    });

    const centerLon = sumLon / count;
    const centerLat = sumLat / count;

    // Fly đến vùng ngập
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(centerLon, centerLat, 500),
      orientation: {
        heading: 0,
        pitch: -Math.PI / 3,
        roll: 0,
      },
      duration: 1.5,
    });
  }

  resetSimulation() {
    this.waterLevel = 0;
    this.waterVolume = 0;

    // Xóa nước
    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity);
      this.waterEntity = null;
    }

    // Dừng animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Dừng auto fill
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    // Reset UI
    this.updateUI();

    this.showNotification("Đã reset mô phỏng", "success");
  }

  updateUI() {
    document.getElementById("wfLevelValue").textContent =
      this.waterLevel.toFixed(1);
    document.getElementById(
      "wfSliderValue",
    ).textContent = `${this.waterLevel.toFixed(1)} m`;
    document.getElementById("wfLevelSlider").value = this.waterLevel;

    document.getElementById("wfVolumeText").textContent = Math.floor(
      this.waterVolume,
    ).toLocaleString();

    const area =
      this.floodedCells.size * this.gridResolution * this.gridResolution;
    document.getElementById("wfAreaText").textContent =
      Math.floor(area).toLocaleString();

    // Reset button text
    const autoBtn = document.getElementById("wfAutoFill");
    if (autoBtn) {
      autoBtn.textContent = "🌊 Tự động dâng";
      autoBtn.classList.remove("active");
    }
  }

  deactivate() {
    this.isActive = false;

    // Dừng tất cả animation và interval
    if (this.drawHandler) {
      this.drawHandler.destroy();
      this.drawHandler = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Xóa entities
    if (this.polygonEntity) {
      this.viewer.entities.remove(this.polygonEntity);
      this.polygonEntity = null;
    }

    if (this.sourceMarker) {
      this.viewer.entities.remove(this.sourceMarker);
      this.sourceMarker = null;
    }

    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity);
      this.waterEntity = null;
    }

    // Xóa popup
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    // Reset dữ liệu
    this.polygonPoints = [];
    this.sourcePoint = null;
    this.waterVolume = 0;
    this.waterLevel = 0;
    this.floodedCells.clear();
    this.terrainSamples = [];
    this.step = 0;
    this.waveTime = 0;

    console.log("✅ Đã tắt công cụ mô phỏng nước tràn");
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `wf-notification wf-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${
        type === "success"
          ? "rgba(76, 175, 80, 0.95)"
          : type === "error"
          ? "rgba(244, 67, 54, 0.95)"
          : type === "warning"
          ? "rgba(255, 152, 0, 0.95)"
          : "rgba(33, 150, 243, 0.95)"
      };
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 500;
      border-left: 4px solid ${
        type === "success"
          ? "#81C784"
          : type === "error"
          ? "#E57373"
          : type === "warning"
          ? "#FFB74D"
          : "#64B5F6"
      };
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

export function setupWaterFill(viewer) {
  const btn = document.getElementById("btnWaterFill");
  if (!btn || !viewer) return;

  let waterFill = null;

  btn.addEventListener("click", () => {
    if (!waterFill || !waterFill.isActive) {
      waterFill = new WaterFillSimulation(viewer);
      waterFill.activate();
      btn.innerHTML = "💧 TẮT MÔ PHỎNG";
      btn.style.background = "#f44336";
    } else {
      waterFill.deactivate();
      waterFill = null;
      btn.innerHTML = "💧 BẬT MÔ PHỎNG";
      btn.style.background = "";
    }
  });

  console.log("✅ Water Fill Simulation đã sẵn sàng");
}
