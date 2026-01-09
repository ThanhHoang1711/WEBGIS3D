/* eslint-disable */
import {
  Cartesian3,
  Transforms,
  HeadingPitchRoll,
  Math as CesiumMath,
} from "cesium";

/**
 * Hàm tạo và điều khiển mô hình nổi trên mặt nước
 * @param {Cesium.Viewer} viewer - Viewer Cesium đang hoạt động
 * @param {Object} options - Cấu hình mô hình
 * @param {string} options.url - Đường dẫn tới file GLB
 * @param {number[]} options.position - Tọa độ [kinh độ, vĩ độ]
 * @param {Function} options.getWaterLevel - Hàm trả về mực nước hiện tại
 * @param {number} [options.heading=0] - Hướng ban đầu (độ), 0=Bắc, 90=Đông, 180=Nam, 270=Tây
 * @param {number} [options.scale=1.0] - Tỷ lệ model
 * @param {number} [options.depthOffset=-30] - Độ sâu chìm xuống (m), giá trị âm = chìm xuống
 */
function addFloatingModel(
  viewer,
  {
    url,
    position,
    getWaterLevel,
    heading = 0,
    scale = 1.0,
    depthOffset = -30, // ✅ Thêm tham số độ sâu, mặc định chìm 20m
  }
) {
  if (!viewer || !url || !position || !getWaterLevel) {
    console.error("⚠️ Thiếu tham số cần thiết khi tạo mô hình nổi!");
    return;
  }

  const [lon, lat] = position;
  const totalDistanceMeters = 5000; // 5 km
  const speedMetersPerSecond = 100; // tốc độ di chuyển (m/s)

  let distanceTraveled = 0;

  // Khởi tạo mô hình
  const modelEntity = viewer.entities.add({
    name: "Floating Model",
    position: Cartesian3.fromDegrees(lon, lat, getWaterLevel() + depthOffset),
    model: {
      uri: url,
      scale: scale,
      minimumPixelSize: 0,
      maximumScale: undefined,
      runAnimations: true,
    },
  });

  // Biến hiệu ứng nổi
  let angle = 0;
  const waveSpeed = 0.02;
  const floatAmplitude = 0.5;

  // Chuyển đổi heading từ độ sang radian
  const baseHeadingRad = CesiumMath.toRadians(heading);

  viewer.clock.onTick.addEventListener((clock) => {
    const deltaTime = viewer.clock.deltaTime || 1 / 60;
    const waterLevel = getWaterLevel();

    // Cập nhật góc sóng
    angle += waveSpeed;

    // Hiệu ứng nổi (nhưng vẫn chìm so với mực nước)
    const verticalOffset = Math.sin(angle) * floatAmplitude;
    const height = waterLevel + depthOffset + verticalOffset; // ✅ Cộng thêm depthOffset

    // Di chuyển về phía Nam (giảm vĩ độ)
    if (distanceTraveled < totalDistanceMeters) {
      distanceTraveled += speedMetersPerSecond * deltaTime;
    } else {
      distanceTraveled = 0; // Reset để lặp lại
    }

    const newLon = lon;
    const latPerMeter = 1 / 111320;
    const newLat = lat - distanceTraveled * latPerMeter;

    const newPos = Cartesian3.fromDegrees(newLon, newLat, height);
    modelEntity.position = newPos;

    // ✅ Tính hướng di chuyển
    const movementDirection = 180; // Đi về hướng Nam
    const modelDefaultOffset = 90; // Model mặc định hướng Đông
    const correctedHeading = CesiumMath.toRadians(
      movementDirection - modelDefaultOffset
    );

    // Nghiêng nhẹ khi di chuyển (mô phỏng sóng)
    const roll = CesiumMath.toRadians(Math.sin(angle) * 5);
    const pitch = CesiumMath.toRadians(Math.cos(angle * 0.7) * 2);

    const hpr = new HeadingPitchRoll(correctedHeading, pitch, roll);
    modelEntity.orientation = Transforms.headingPitchRollQuaternion(
      newPos,
      hpr
    );
  });

  console.log(
    `✅ Mô hình đã được thêm (chìm ${Math.abs(
      depthOffset
    )}m dưới mực nước) và đang di chuyển về phía Nam:`,
    url
  );
  return modelEntity;
}

// ✅ Xuất theo kiểu default object
export default {
  addFloatingModel,
};
