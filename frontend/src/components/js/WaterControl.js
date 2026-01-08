import {
  Color,
  Cartesian3,
  ImageMaterialProperty,
  buildModuleUrl,
  Cartesian2,
  CallbackProperty,
} from "cesium";
import * as Cesium from "cesium";
import WaterModel from "./WaterModel";
const { addFloatingModel } = WaterModel;

export function setupWaterControl(viewer) {
  const btn = document.getElementById("btnSeaRise");
  if (!btn || !viewer) return;

  let waterLevel = 0;
  const maxWater = 500;
  let waterEntity = null;

  const waterBoundary = [105.2, 21.1, 105.5, 21.1, 105.5, 21.0, 105.2, 21.0];

  // ✅ Tạo popup HTML
  function createPopup() {
    const popup = document.createElement("div");
    popup.id = "waterControlPopup";
    popup.innerHTML = `
      <div class="popup-header">
        <h3>🌊 Điều khiển mực nước</h3>
        <button id="closePopup">✖</button>
      </div>
      <div class="popup-body">
        <div class="water-info">
          <p>Mực nước hiện tại: <strong id="waterLevelText">0m</strong></p>
          <div class="progress-bar">
            <div id="waterProgress" class="progress-fill"></div>
          </div>
        </div>
        <div class="control-buttons">
          <button id="btnIncrease" class="btn-control btn-increase">
            ⬆️ Tăng (+10m)
          </button>
          <button id="btnDecrease" class="btn-control btn-decrease">
            ⬇️ Giảm (-10m)
          </button>
          <button id="btnReset" class="btn-control btn-reset">
            🔄 Reset
          </button>
        </div>
        <div class="auto-control">
          <button id="btnAutoRise" class="btn-auto">
            ▶️ Tự động tăng
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    addPopupStyles();
    return popup;
  }

  // ✅ Thêm CSS cho popup
  function addPopupStyles() {
    if (document.getElementById("waterPopupStyles")) return;

    const style = document.createElement("style");
    style.id = "waterPopupStyles";
    style.textContent = `
      #waterControlPopup {
        position: fixed;
        top: 300px;
        left: 200px;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #00bcd4;
        border-radius: 12px;
        padding: 20px;
        min-width: 320px;
        box-shadow: 0 8px 32px rgba(0, 188, 212, 0.3);
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
      }

      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #00bcd4;
      }

      .popup-header h3 {
        margin: 0;
        font-size: 18px;
      }

      #closePopup {
        background: transparent;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
      }

      #closePopup:hover {
        color: #ff5252;
      }

      .water-info {
        margin-bottom: 20px;
        text-align: center;
      }

      .water-info p {
        margin: 10px 0;
        font-size: 16px;
      }

      .progress-bar {
        width: 100%;
        height: 20px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        overflow: hidden;
        margin-top: 10px;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #00bcd4, #0097a7);
        width: 0%;
        transition: width 0.3s ease;
      }

      .control-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 15px;
      }

      .btn-control {
        padding: 12px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: all 0.3s ease;
      }

      .btn-increase {
        background: #4caf50;
        color: white;
      }

      .btn-increase:hover {
        background: #66bb6a;
        transform: translateY(-2px);
      }

      .btn-decrease {
        background: #ff9800;
        color: white;
      }

      .btn-decrease:hover {
        background: #ffa726;
        transform: translateY(-2px);
      }

      .btn-reset {
        grid-column: 1 / -1;
        background: #f44336;
        color: white;
      }

      .btn-reset:hover {
        background: #e57373;
        transform: translateY(-2px);
      }

      .auto-control {
        margin-top: 10px;
      }

      .btn-auto {
        width: 100%;
        padding: 12px;
        background: #2196f3;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        transition: all 0.3s ease;
      }

      .btn-auto:hover {
        background: #42a5f5;
        transform: translateY(-2px);
      }

      .btn-auto.active {
        background: #f44336;
      }
    `;
    document.head.appendChild(style);
  }

  // ✅ Tạo mặt nước với CallbackProperty và hiệu ứng chuyển động
  // --- Thay thế createWaterSurface cũ bằng hàm mới này + các hàm phụ trợ ---

function createWaterSurface() {
  if (waterEntity) return;

  // ====== CẤU HÌNH CHUNG ======
  const centerLon = 105.29;
  const centerLat = 21.03;
  const zoneRadii = [500, 2000, 8000, 30000]; // mét: [sát bờ, ven bờ, trung gian, ngoài khơi]
  const zoneCount = zoneRadii.length;
  const NUM_POINTS = 12000;

  const degPerMeterLat = 1 / 110540;
  const degPerMeterLon = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));
  const maxRadius = zoneRadii[zoneCount - 1];
  const bbox = {
    minLon: centerLon - maxRadius * degPerMeterLon,
    maxLon: centerLon + maxRadius * degPerMeterLon,
    minLat: centerLat - maxRadius * degPerMeterLat,
    maxLat: centerLat + maxRadius * degPerMeterLat,
  };

  // ====== TẠO VÙNG SÓNG ======
  const zoneEntities = [];
  for (let i = 0; i < zoneCount; i++) {
    const outer = zoneRadii[i];
    const coords = circleDegrees(centerLon, centerLat, outer, 64);
    const ent = viewer.entities.add({
      name: `Water Zone ${i + 1}`,
      polygon: {
        hierarchy: Cartesian3.fromDegreesArray(coords),
        material: new ImageMaterialProperty({
          image: buildModuleUrl("Assets/Textures/waterNormals.jpg"),
          repeat: new Cartesian2(20 + i * 10, 20 + i * 10),
          color: new Color(0.0, 0.35 + i * 0.15, 0.7 - i * 0.05, 0.55 - i * 0.06),
        }),
        height: new CallbackProperty(() => 0, false),
        extrudedHeight: 0,
      },
      show: true,
    });
    zoneEntities.push(ent);
  }

  // ====== SINH NGẪU NHIÊN CÁC ĐIỂM SÓNG ======
  const points = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    const lon = randomBetween(bbox.minLon, bbox.maxLon);
    const lat = randomBetween(bbox.minLat, bbox.maxLat);
    const d = geodesicDistance(centerLon, centerLat, lon, lat);
    let zoneIndex = zoneRadii.findIndex(r => d <= r);
    if (zoneIndex === -1) zoneIndex = zoneCount - 1;

    const zoneParams = sampleParamsForZone(zoneIndex);
    const point = {
      lon,
      lat,
      zoneIndex,
      distanceToCenter: d,
      params: zoneParams,
      phase: Math.random() * Math.PI * 2,
    };
    points.push(point);
  }

  // ====== HEIGHT CALLBACK MỖI VÙNG ======
  const zoneOffsets = new Array(zoneCount).fill(0);
  for (let i = 0; i < zoneCount; i++) {
    zoneEntities[i].polygon.height = new CallbackProperty(() => {
      return waterLevel + (zoneOffsets[i] || 0);
    }, false);
  }

  // ====== THÊM MÔ HÌNH NỔI ======
  const model = addFloatingModel(viewer, {
    url: "http://localhost:8000/media/models/su57.glb",
    position: [centerLon, centerLat],
    getWaterLevel: () => waterLevel,
  });

  // ====== CẬP NHẬT SÓNG THEO THỜI GIAN ======
  let time = 0;
  const globalSpeedFactor = 2.5; // 💨 tăng tốc độ chu kỳ sóng (ban đầu 1.0)

  viewer.clock.onTick.addEventListener(() => {
    const dt = viewer.clock.deltaTime || 1 / 60;
    time += dt * 0.5; // 💨 tăng tốc trôi thời gian (ban đầu 0.5)

    // reset offset
    zoneOffsets.fill(0);

    // tính đóng góp của từng điểm sóng
    for (let p of points) {
      const par = p.params;
      const distToCenter = p.distanceToCenter;
      const k = (2 * Math.PI) / par.wavelength;
      const omega = (2 * Math.PI) / par.period;

      // tính dao động
      const disp =
        par.amplitude *
        Math.sin(
          k * distToCenter - omega * time * par.speed * globalSpeedFactor + p.phase
        );

      const decay = Math.exp(-Math.pow(distToCenter / (par.influenceRadius || 10000), 2));
      const contribution = disp * decay;
      zoneOffsets[p.zoneIndex] += contribution;
    }

    // hiệu ứng trôi texture
    for (let i = 0; i < zoneEntities.length; i++) {
      const ent = zoneEntities[i];
      if (!ent.polygon || !ent.polygon.material) continue;
      const mat = ent.polygon.material;
      const drift = time * (0.8 + i * 0.3);
      mat.repeat = new Cartesian2(
        40 + i * 10 + Math.cos(time * (0.8 + i * 0.2)) * 3,
        40 + i * 10
      );
      mat.translation = new Cartesian2(-drift, 0);
    }
  });

  // dùng zone đầu tiên làm đại diện
  waterEntity = zoneEntities[0];
}

//
// ====== HÀM PHỤ TRỢ ======
//

// tạo vòng tròn (lon/lat)
function circleDegrees(centerLon, centerLat, radiusMeters, numPoints = 64) {
  const points = [];
  const degPerMeterLat = 1 / 110540;
  const degPerMeterLon = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2;
    const dx = Math.cos(theta) * radiusMeters;
    const dy = Math.sin(theta) * radiusMeters;
    const lon = centerLon + dx * degPerMeterLon;
    const lat = centerLat + dy * degPerMeterLat;
    points.push(lon, lat);
  }
  return points;
}

// random between
function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

// tính khoảng cách địa lý (m)
function geodesicDistance(lon1, lat1, lon2, lat2) {
  const c1 = Cesium.Cartographic.fromDegrees(lon1, lat1);
  const c2 = Cesium.Cartographic.fromDegrees(lon2, lat2);
  const geod = new Cesium.EllipsoidGeodesic(c1, c2);
  return geod.surfaceDistance;
}

// sinh tham số sóng điển hình cho từng vùng
function sampleParamsForZone(zoneIndex) {
  const base = [
    { amplitude: 1.2, wavelength: 7, period: 2.5, speed: 1.0, influenceRadius: 800 }, // sát bờ
    { amplitude: 0.8, wavelength: 15, period: 4.0, speed: 1.0, influenceRadius: 2000 }, // ven bờ
    { amplitude: 0.6, wavelength: 35, period: 6.0, speed: 1.0, influenceRadius: 6000 }, // trung gian
    { amplitude: 0.5, wavelength: 60, period: 8.0, speed: 1.0, influenceRadius: 20000 }, // ngoài khơi
  ][zoneIndex];

  const jitter = (v, pct = 0.3) => v * (1 + (Math.random() - 0.5) * 2 * pct);

  return {
    amplitude: jitter(base.amplitude, 0.4),
    wavelength: jitter(base.wavelength, 0.25),
    period: jitter(base.period, 0.3),
    speed: base.speed * (0.8 + Math.random() * 0.8),
    influenceRadius: base.influenceRadius * (0.7 + Math.random() * 0.6),
  };
}

  // ✅ Cập nhật UI
  function updateUI() {
    const levelText = document.getElementById("waterLevelText");
    const progress = document.getElementById("waterProgress");

    if (levelText) levelText.textContent = `${waterLevel}m`;
    if (progress) {
      const percentage = (waterLevel / maxWater) * 100;
      progress.style.width = `${percentage}%`;
    }
  }

  // ✅ Tăng mực nước
  function increaseWater() {
    if (waterLevel < maxWater) {
      waterLevel = Math.min(waterLevel + 10, maxWater);
      updateUI();
      console.log(`⬆️ Tăng mực nước: ${waterLevel}m`);
    }
  }

  // ✅ Giảm mực nước
  function decreaseWater() {
    if (waterLevel > 0) {
      waterLevel = Math.max(waterLevel - 10, 0);
      updateUI();
      console.log(`⬇️ Giảm mực nước: ${waterLevel}m`);
    }
  }

  // ✅ Reset mực nước
  function resetWater() {
    waterLevel = 0;
    updateUI();
    console.log("🔄 Reset mực nước");
  }

  // ✅ Tự động tăng
  let autoInterval = null;
  function toggleAutoRise() {
    const autoBtn = document.getElementById("btnAutoRise");

    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      autoBtn.textContent = "▶️ Tự động tăng";
      autoBtn.classList.remove("active");
    } else {
      autoBtn.textContent = "⏸️ Dừng";
      autoBtn.classList.add("active");
      autoInterval = setInterval(() => {
        if (waterLevel >= maxWater) {
          toggleAutoRise();
          return;
        }
        waterLevel += 5;
        updateUI();
      }, 100);
    }
  }

  // ✅ Xử lý click nút chính
  btn.addEventListener("click", () => {
    let popup = document.getElementById("waterControlPopup");

    if (popup) {
      // Đóng popup
      popup.remove();
      if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
      }
      if (waterEntity) {
        viewer.entities.remove(waterEntity);
        waterEntity = null;
      }
      waterLevel = 0;
      return;
    }

    // Mở popup
    popup = createPopup();
    createWaterSurface();
    updateUI();

    // Gắn sự kiện
    document.getElementById("closePopup").addEventListener("click", () => {
      popup.remove();
      if (autoInterval) clearInterval(autoInterval);
    });

    document
      .getElementById("btnIncrease")
      .addEventListener("click", increaseWater);
    document
      .getElementById("btnDecrease")
      .addEventListener("click", decreaseWater);
    document.getElementById("btnReset").addEventListener("click", resetWater);
    document
      .getElementById("btnAutoRise")
      .addEventListener("click", toggleAutoRise);
  });
}
