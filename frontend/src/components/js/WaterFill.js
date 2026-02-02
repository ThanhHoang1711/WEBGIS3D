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
  Material,
  defined,
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
    this.waterLevel = 0;
    this.sourceHeight = 0;
    this.floodedCells = new Map();
    this.gridResolution = 10; // Tăng độ chi tiết lưới
    this.terrainSamples = [];
    this.terrainMap = null;
    this.simulationInterval = null;
    this.popup = null;
    this.bounds = null;
    this.step = 0;

    // Các entity cho nước
    this.waterEntity = null;
    this.flowAnimationEntities = [];
    this.wavelineEntities = [];

    // Animation
    this.animationTime = 0;
    this.tickListener = null;
  }

  // ====== KHỞI ĐỘNG ======
  activate() {
    if (this.isActive) {
      this.showNotification("Công cụ đã được kích hoạt!", "warning");
      return;
    }

    this.isActive = true;
    this.step = 1;
    this.createControlUI();
    this.showNotification(
      "Bước 1: Vẽ vùng mô phỏng (click thêm điểm, chuột phải hoàn thành)",
      "info",
    );
    this.startDrawingPolygon();
  }

  // ====== GIAO DIỆN ======
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
          <div class="info-row">
            <span>Mực nước:</span>
            <strong id="wfLevelValue">0.0 m</strong>
          </div>
          <div class="info-row">
            <span>Độ cao nguồn:</span>
            <strong id="wfSourceHeight">-- m</strong>
          </div>
          <div class="info-row">
            <span>Diện tích ngập:</span>
            <strong id="wfAreaText">0 m²</strong>
          </div>
          <div class="info-row">
            <span>Thể tích nước:</span>
            <strong id="wfVolumeText">0 m³</strong>
          </div>
          <div class="wf-slider-control">
            <label>Điều chỉnh mực nước (m):</label>
            <input type="range" id="wfLevelSlider" min="0" max="30" value="0" step="0.5">
            <div class="slider-value">
              <span id="wfSliderValue">0.0 m</span>
            </div>
          </div>
        </div>
        <div class="wf-controls" style="display: none;">
          <button id="wfAddWater" class="wf-btn wf-btn-add">⬆️ +0.5m</button>
          <button id="wfRemoveWater" class="wf-btn wf-btn-remove">⬇️ -0.5m</button>
          <button id="wfAutoFill" class="wf-btn wf-btn-auto">🌊 Tự động tràn</button>
          <button id="wfReset" class="wf-btn wf-btn-reset">🔄 Reset</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.popup);
    this.addPopupStyles();

    // Sự kiện
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

    const levelSlider = document.getElementById("wfLevelSlider");
    levelSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("wfSliderValue").textContent = `${value.toFixed(
        1,
      )} m`;
      this.setWaterLevel(value);
    });
  }

  // ====== CSS ======
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
        width: 340px;
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

      .info-row {
        display: flex;
        justify-content: space-between;
        margin: 10px 0;
        font-size: 14px;
        color: #e3f2fd;
      }

      .info-row strong {
        color: #00bcd4;
        font-weight: 600;
      }

      .wf-slider-control {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid rgba(0, 188, 212, 0.2);
      }

      .wf-slider-control label {
        display: block;
        margin-bottom: 10px;
        font-size: 13px;
        color: #bbdefb;
        font-weight: 500;
      }

      #wfLevelSlider {
        width: 100%;
        height: 8px;
        background: linear-gradient(to right, #004d56, #00bcd4);
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
        transition: all 0.3s;
      }

      #wfLevelSlider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 0 15px rgba(0, 188, 212, 1);
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
        font-size: 13px;
        font-weight: 600;
        transition: all 0.3s ease;
      }

      .wf-btn-add {
        background: linear-gradient(135deg, #00C853, #64DD17);
        color: white;
      }

      .wf-btn-add:hover {
        background: linear-gradient(135deg, #00E676, #76FF03);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(0, 200, 83, 0.4);
      }

      .wf-btn-remove {
        background: linear-gradient(135deg, #FF9800, #FFB300);
        color: white;
      }

      .wf-btn-remove:hover {
        background: linear-gradient(135deg, #FFB74D, #FFCA28);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
      }

      .wf-btn-auto {
        background: linear-gradient(135deg, #2196F3, #2979FF);
        color: white;
        grid-column: span 2;
      }

      .wf-btn-auto:hover {
        background: linear-gradient(135deg, #42A5F5, #448AFF);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(33, 150, 243, 0.4);
      }

      .wf-btn-auto.active {
        background: linear-gradient(135deg, #F44336, #D50000);
      }

      .wf-btn-reset {
        background: linear-gradient(135deg, #F44336, #D50000);
        color: white;
        grid-column: span 2;
      }

      .wf-btn-reset:hover {
        background: linear-gradient(135deg, #EF5350, #FF1744);
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(244, 67, 54, 0.4);
      }
    `;

    document.head.appendChild(style);
  }

  // ====== VẼ VÙNG ======
  startDrawingPolygon() {
    this.drawHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.drawHandler.setInputAction((click) => {
      const earthPos = this.viewer.scene.pickPosition(click.position);
      if (!earthPos) return;

      const carto = Cartographic.fromCartesian(earthPos);
      this.polygonPoints.push(carto);

      this.viewer.entities.add({
        position: earthPos,
        point: {
          pixelSize: 8,
          color: Color.CYAN,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
      });

      this.updatePolygonPreview();
      this.showNotification(
        `Đã thêm điểm ${this.polygonPoints.length}. Chuột phải để hoàn thành.`,
        "info",
      );
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.drawHandler.setInputAction(() => {
      if (this.polygonPoints.length < 3) {
        this.showNotification("Cần ít nhất 3 điểm!", "warning");
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
      },
    });

    this.calculateBounds();

    this.showNotification("Đang phân tích địa hình DEM...", "info");
    await this.sampleTerrain();

    document.getElementById("wfStatusText").textContent =
      "Bước 2: Click chọn điểm xả nước";
    this.showNotification("Click chọn điểm xả nước trong vùng", "info");
    this.startSelectingSourcePoint();
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

  // ====== LẤY MẪU ĐỊA HÌNH DEM CHI TIẾT ======
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

    console.log(
      `🌍 Lấy mẫu DEM chi tiết: ${numX} x ${numY} điểm (độ phân giải ${this.gridResolution}m)`,
    );

    const positions = [];
    const gridKeys = [];

    for (let i = 0; i <= numX; i++) {
      for (let j = 0; j <= numY; j++) {
        const lon = minLon + (maxLon - minLon) * (i / numX);
        const lat = minLat + (maxLat - minLat) * (j / numY);

        if (this.isPointInPolygon(lon, lat)) {
          positions.push(Cartographic.fromDegrees(lon, lat, 0));
          gridKeys.push({ lon, lat, i, j });
        }
      }
    }

    console.log(`📍 ${positions.length} điểm trong vùng`);

    try {
      this.terrainSamples = await sampleTerrainMostDetailed(
        this.viewer.terrainProvider,
        positions,
      );

      // Tạo map chi tiết với interpolation
      this.terrainMap = new Map();
      this.terrainSamples.forEach((sample, idx) => {
        const { lon, lat } = gridKeys[idx];
        const key = `${lon.toFixed(7)},${lat.toFixed(7)}`;
        this.terrainMap.set(key, sample.height);
      });

      console.log(`✅ Đã lấy mẫu ${this.terrainSamples.length} điểm DEM`);
    } catch (error) {
      console.error("❌ Lỗi lấy mẫu địa hình:", error);
      this.showNotification("Lỗi khi phân tích địa hình DEM", "error");
    }
  }

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

  // ====== CHỌN ĐIỂM XẢ NƯỚC ======
  startSelectingSourcePoint() {
    this.drawHandler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.drawHandler.setInputAction((click) => {
      const earthPos = this.viewer.scene.pickPosition(click.position);
      if (!earthPos) return;

      const carto = Cartographic.fromCartesian(earthPos);
      const lon = CesiumMath.toDegrees(carto.longitude);
      const lat = CesiumMath.toDegrees(carto.latitude);

      if (!this.isPointInPolygon(lon, lat)) {
        this.showNotification("Điểm phải nằm trong vùng!", "warning");
        return;
      }

      this.sourcePoint = carto;
      this.sourceHeight = this.getHeightAt(lon, lat);

      if (this.sourceHeight === null) {
        this.showNotification("Không xác định được độ cao từ DEM!", "error");
        return;
      }

      console.log(
        `📍 Điểm nguồn: (${lon.toFixed(6)}, ${lat.toFixed(
          6,
        )}), Độ cao DEM: ${this.sourceHeight.toFixed(2)}m`,
      );

      if (this.sourceMarker) {
        this.viewer.entities.remove(this.sourceMarker);
      }

      this.sourceMarker = this.viewer.entities.add({
        position: Cartesian3.fromDegrees(lon, lat, this.sourceHeight + 5),
        point: {
          pixelSize: 20,
          color: Color.RED,
          outlineColor: Color.WHITE,
          outlineWidth: 4,
        },
        label: {
          text: `💧 NGUỒN\n${this.sourceHeight.toFixed(1)}m`,
          font: "bold 14px sans-serif",
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
      document.getElementById(
        "wfSourceHeight",
      ).textContent = `${this.sourceHeight.toFixed(2)} m`;
      document.querySelector(".wf-controls").style.display = "grid";
      this.showNotification(
        "Sử dụng thanh trượt để điều chỉnh mực nước",
        "success",
      );
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  // ====== LẤY ĐỘ CAO VỚI INTERPOLATION ======
  getHeightAt(lon, lat) {
    const key = `${lon.toFixed(7)},${lat.toFixed(7)}`;

    if (this.terrainMap && this.terrainMap.has(key)) {
      return this.terrainMap.get(key);
    }

    // Tìm 4 điểm gần nhất để interpolation (bilinear)
    const nearestPoints = [];
    let minDist = Infinity;

    for (const sample of this.terrainSamples) {
      const sLon = CesiumMath.toDegrees(sample.longitude);
      const sLat = CesiumMath.toDegrees(sample.latitude);
      const dist = Math.sqrt(Math.pow(lon - sLon, 2) + Math.pow(lat - sLat, 2));

      nearestPoints.push({ lon: sLon, lat: sLat, height: sample.height, dist });
    }

    nearestPoints.sort((a, b) => a.dist - b.dist);

    if (nearestPoints.length === 0) return null;

    // Bilinear interpolation với 4 điểm gần nhất
    if (nearestPoints.length >= 4) {
      const points = nearestPoints.slice(0, 4);
      let totalWeight = 0;
      let weightedHeight = 0;

      points.forEach((p) => {
        const weight = 1 / (p.dist + 0.0001); // Tránh chia 0
        weightedHeight += p.height * weight;
        totalWeight += weight;
      });

      return weightedHeight / totalWeight;
    }

    return nearestPoints[0].height;
  }

  // ====== ĐẶT MỰC NƯỚC ======
  setWaterLevel(level) {
    this.waterLevel = Math.max(0, Math.min(level, 30));

    document.getElementById(
      "wfLevelValue",
    ).textContent = `${this.waterLevel.toFixed(1)} m`;
    document.getElementById(
      "wfSliderValue",
    ).textContent = `${this.waterLevel.toFixed(1)} m`;
    document.getElementById("wfLevelSlider").value = this.waterLevel;

    if (!this.sourcePoint || this.sourceHeight === null) return;

    const absoluteWaterLevel = this.sourceHeight + this.waterLevel;

    console.log(`💧 Mực nước tuyệt đối: ${absoluteWaterLevel.toFixed(2)}m`);

    const flooded = this.findFloodedAreas(absoluteWaterLevel);
    this.floodedCells = flooded;

    const area = flooded.size * this.gridResolution * this.gridResolution;
    let volume = 0;

    // Tính thể tích chính xác
    flooded.forEach((cell) => {
      volume += cell.waterDepth * this.gridResolution * this.gridResolution;
    });

    document.getElementById("wfAreaText").textContent = `${Math.floor(
      area,
    ).toLocaleString()} m²`;
    document.getElementById("wfVolumeText").textContent = `${Math.floor(
      volume,
    ).toLocaleString()} m³`;

    // Tạo mặt nước phẳng và đẹp
    this.createRealisticWater(flooded, absoluteWaterLevel);
  }

  // ====== TÌM VÙNG NGẬP (BFS) ======
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

      flooded.set(currentKey, { lon, lat, height, waterDepth });

      const neighbors = this.getNeighbors(lon, lat);
      for (const neighborKey of neighbors) {
        if (!visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push(neighborKey);
        }
      }
    }

    console.log(`🌊 ${flooded.size} ô bị ngập`);
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
    return `${lon.toFixed(7)},${lat.toFixed(7)}`;
  }

  // ✅ ====== TẠO MẶT NƯỚC THỰC TẾ - PHẲNG VÀ ĐẸP ======
  createRealisticWater(flooded, waterLevel) {
    this.clearWater();

    if (flooded.size === 0) return;

    // Tạo contour của vùng ngập
    const floodedArray = Array.from(flooded.values());
    const boundary = this.calculateBoundary(floodedArray);

    if (boundary.length < 3) return;

    // Tạo polygon nước với mặt phẳng hoàn toàn
    const positions = boundary.map((point) =>
      Cartesian3.fromDegrees(point.lon, point.lat, waterLevel),
    );

    // Material nước trong suốt, phản chiếu
    this.waterEntity = this.viewer.entities.add({
      name: "Flood Water Surface",
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.fromCssColorString("#1E90FF").withAlpha(0.7),
        height: waterLevel,
        extrudedHeight: waterLevel, // Mặt phẳng hoàn toàn
        perPositionHeight: false, // Không theo địa hình
        outline: true,
        outlineColor: Color.fromCssColorString("#00BFFF").withAlpha(0.9),
        outlineWidth: 2,
        shadows: Cesium.ShadowMode.ENABLED,
      },
    });

    // Tạo hiệu ứng tràn vào - vẽ các đường mực nước
    this.createFlowLines(boundary, waterLevel, flooded);

    // Animation nhẹ nhàng
    this.startWaterAnimation();

    console.log("🌊 Đã tạo mặt nước phẳng thực tế");
  }

  // Tính boundary của vùng ngập
  calculateBoundary(floodedArray) {
    if (floodedArray.length === 0) return [];

    // Tìm các điểm biên
    const pointSet = new Set(floodedArray.map((p) => `${p.lon},${p.lat}`));
    const boundaryPoints = [];

    floodedArray.forEach((point) => {
      const neighbors = this.getNeighbors(point.lon, point.lat);
      const hasExternalNeighbor = neighbors.some((key) => !pointSet.has(key));

      if (hasExternalNeighbor) {
        boundaryPoints.push(point);
      }
    });

    // Sắp xếp các điểm theo thứ tự đường bao
    return this.sortBoundaryPoints(boundaryPoints);
  }

  sortBoundaryPoints(points) {
    if (points.length < 3) return points;

    // Tìm điểm trung tâm
    const centerLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;

    // Sắp xếp theo góc
    return points.sort((a, b) => {
      const angleA = Math.atan2(a.lat - centerLat, a.lon - centerLon);
      const angleB = Math.atan2(b.lat - centerLat, b.lon - centerLon);
      return angleA - angleB;
    });
  }

  // Tạo đường tràn vào đẹp
  createFlowLines(boundary, waterLevel, flooded) {
    if (!this.sourcePoint || boundary.length < 3) return;

    const sourceLon = CesiumMath.toDegrees(this.sourcePoint.longitude);
    const sourceLat = CesiumMath.toDegrees(this.sourcePoint.latitude);

    // Tạo các đường từ nguồn ra biên
    const numLines = Math.min(12, Math.floor(boundary.length / 3));

    for (let i = 0; i < numLines; i++) {
      const idx = Math.floor((i / numLines) * boundary.length);
      const edgePoint = boundary[idx];

      const flowLine = this.viewer.entities.add({
        name: "Flow Line",
        polyline: {
          positions: [
            Cartesian3.fromDegrees(sourceLon, sourceLat, waterLevel + 0.5),
            Cartesian3.fromDegrees(
              edgePoint.lon,
              edgePoint.lat,
              waterLevel + 0.5,
            ),
          ],
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Color.fromCssColorString("#00BFFF").withAlpha(0.4),
          }),
        },
      });

      this.flowAnimationEntities.push(flowLine);
    }

    // Tạo các vòng mực nước đồng mức
    this.createWaterLevelLines(flooded, waterLevel);
  }

  createWaterLevelLines(flooded, waterLevel) {
    const floodedArray = Array.from(flooded.values());

    // Tìm độ sâu max và min
    const depths = floodedArray.map((cell) => cell.waterDepth);
    const maxDepth = Math.max(...depths);
    const minDepth = Math.min(...depths);

    if (maxDepth - minDepth < 0.5) return; // Không cần vẽ nếu quá phẳng

    // Vẽ 3-5 đường mực nước
    const numLevels = Math.min(5, Math.ceil((maxDepth - minDepth) / 0.5));

    for (let i = 1; i <= numLevels; i++) {
      const targetDepth =
        minDepth + (maxDepth - minDepth) * (i / (numLevels + 1));
      const levelPoints = floodedArray.filter(
        (cell) => Math.abs(cell.waterDepth - targetDepth) < 0.3,
      );

      if (levelPoints.length > 5) {
        const sortedPoints = this.sortBoundaryPoints(levelPoints);
        const positions = sortedPoints.map((p) =>
          Cartesian3.fromDegrees(p.lon, p.lat, waterLevel + 0.3),
        );

        const contourLine = this.viewer.entities.add({
          name: "Water Level Contour",
          polyline: {
            positions: positions,
            width: 1.5,
            material: Color.fromCssColorString("#87CEEB").withAlpha(0.5),
          },
        });

        this.wavelineEntities.push(contourLine);
      }
    }
  }

  // Animation nhẹ cho water material
  startWaterAnimation() {
    this.animationTime = 0;

    if (this.tickListener) {
      this.viewer.clock.onTick.removeEventListener(this.tickListener);
    }

    this.tickListener = () => {
      if (!this.isActive || !this.waterEntity) return;

      this.animationTime += 0.01;

      // Thay đổi độ trong suốt nhẹ nhàng
      const alpha = 0.65 + Math.sin(this.animationTime) * 0.05;

      if (this.waterEntity && this.waterEntity.polygon) {
        this.waterEntity.polygon.material =
          Color.fromCssColorString("#1E90FF").withAlpha(alpha);
      }

      // Animation cho flow lines
      this.flowAnimationEntities.forEach((entity, idx) => {
        if (entity.polyline && entity.polyline.material) {
          const phase = this.animationTime + idx * 0.5;
          const glowAlpha = 0.3 + Math.sin(phase) * 0.2;
          entity.polyline.material.color =
            Color.fromCssColorString("#00BFFF").withAlpha(glowAlpha);
        }
      });
    };

    this.viewer.clock.onTick.addEventListener(this.tickListener);
  }

  // ====== XÓA NƯỚC ======
  clearWater() {
    if (this.tickListener) {
      this.viewer.clock.onTick.removeEventListener(this.tickListener);
      this.tickListener = null;
    }

    if (this.waterEntity) {
      this.viewer.entities.remove(this.waterEntity);
      this.waterEntity = null;
    }

    this.flowAnimationEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.flowAnimationEntities = [];

    this.wavelineEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.wavelineEntities = [];

    this.animationTime = 0;
  }

  // ====== TỰ ĐỘNG DÂNG NƯỚC ======
  toggleAutoFill() {
    const btn = document.getElementById("wfAutoFill");

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      btn.textContent = "🌊 Tự động tràn";
      btn.classList.remove("active");
    } else {
      btn.textContent = "⏸️ Dừng lại";
      btn.classList.add("active");
      this.simulationInterval = setInterval(() => {
        if (this.waterLevel < 30) {
          this.setWaterLevel(this.waterLevel + 0.3);
        } else {
          this.toggleAutoFill();
        }
      }, 300);
    }
  }

  // ====== RESET ======
  resetSimulation() {
    this.waterLevel = 0;
    this.clearWater();

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.floodedCells.clear();

    document.getElementById("wfLevelValue").textContent = "0.0 m";
    document.getElementById("wfSliderValue").textContent = "0.0 m";
    document.getElementById("wfLevelSlider").value = 0;
    document.getElementById("wfAreaText").textContent = "0 m²";
    document.getElementById("wfVolumeText").textContent = "0 m³";

    const autoBtn = document.getElementById("wfAutoFill");
    if (autoBtn) {
      autoBtn.textContent = "🌊 Tự động tràn";
      autoBtn.classList.remove("active");
    }

    this.showNotification("Đã reset mô phỏng", "success");
  }

  // ====== TẮT CÔNG CỤ ======
  deactivate() {
    this.isActive = false;

    if (this.drawHandler) {
      this.drawHandler.destroy();
      this.drawHandler = null;
    }

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    this.clearWater();

    if (this.polygonEntity) {
      this.viewer.entities.remove(this.polygonEntity);
      this.polygonEntity = null;
    }

    if (this.sourceMarker) {
      this.viewer.entities.remove(this.sourceMarker);
      this.sourceMarker = null;
    }

    const allEntities = this.viewer.entities.values;
    for (let i = allEntities.length - 1; i >= 0; i--) {
      const entity = allEntities[i];
      if (entity.point && entity.point.pixelSize === 8) {
        this.viewer.entities.remove(entity);
      }
    }

    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    this.polygonPoints = [];
    this.sourcePoint = null;
    this.sourceHeight = 0;
    this.waterLevel = 0;
    this.floodedCells.clear();
    this.terrainSamples = [];
    this.terrainMap = null;
    this.step = 0;
    this.animationTime = 0;

    console.log("✅ Đã tắt công cụ mô phỏng nước tràn");
  }

  // ====== THÔNG BÁO ======
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
      box-shadow: 0 5px 20px rgba(0,0,0,0.4);
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
      animation: slideIn 0.3s ease-out;
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
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
    `;
    document.head.appendChild(styleSheet);

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

// ====== HÀM KHỞI TẠO ======
export function setupWaterFill(viewer) {
  const btn = document.getElementById("btnWaterFill");
  if (!btn || !viewer) {
    console.warn("⚠️ Không tìm thấy nút btnWaterFill hoặc viewer");
    return;
  }

  let waterFill = null;

  btn.addEventListener("click", () => {
    if (!waterFill || !waterFill.isActive) {
      waterFill = new WaterFillSimulation(viewer);
      waterFill.activate();
      btn.style.background = "linear-gradient(135deg, #f44336, #d32f2f)";
      btn.style.transform = "scale(1.05)";
      console.log("✅ Đã bật Water Fill Simulation");
    } else {
      waterFill.deactivate();
      waterFill = null;
      btn.style.background = "";
      btn.style.transform = "";
      console.log("✅ Đã tắt Water Fill Simulation");
    }
  });

  console.log("✅ Water Fill Simulation (Improved) đã sẵn sàng");
}
