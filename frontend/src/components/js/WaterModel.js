/* eslint-disable */
import {
  Cartesian3,
  Transforms,
  HeadingPitchRoll,
  Matrix4,
  Math as CesiumMath,
} from "cesium";

/**
 * Hàm tạo và điều khiển mô hình nổi trên mặt nước
 * @param {Cesium.Viewer} viewer - Viewer Cesium đang hoạt động
 * @param {Object} options - Cấu hình mô hình
 * @param {string} options.url - Đường dẫn tới file GLB
 * @param {number[]} options.position - Tọa độ [kinh độ, vĩ độ]
 * @param {Function} options.getWaterLevel - Hàm trả về mực nước hiện tại
 */
function addFloatingModel(viewer, { url, position, getWaterLevel }) {
  if (!viewer || !url || !position || !getWaterLevel) {
    console.error("⚠️ Thiếu tham số cần thiết khi tạo mô hình nổi!");
    return;
  }

  // const [lon, lat] = position;

  // // Khởi tạo mô hình 3D
  // const modelEntity = viewer.entities.add({
  //   name: "Floating Model",
  //   position: Cartesian3.fromDegrees(lon, lat, getWaterLevel()),
  //   model: {
  //     uri: url,
  //     scale: 1.0,
  //     minimumPixelSize: 64,
  //     maximumScale: 100,
  //     runAnimations: true,
  //   },
  // });

  // // Biến điều khiển hiệu ứng nổi
  // let angle = 0;
  // const waveSpeed = 0.02;
  // const floatAmplitude = 0.5;

  // viewer.clock.onTick.addEventListener(() => {
  //   const waterLevel = getWaterLevel();
  //   angle += waveSpeed;

  //   const verticalOffset = Math.sin(angle) * floatAmplitude;
  //   const height = waterLevel + verticalOffset;

  //   const newPos = Cartesian3.fromDegrees(lon, lat, height);
  //   modelEntity.position = newPos;

  //   const heading = CesiumMath.toRadians((angle * 20) % 360);
  //   const roll = CesiumMath.toRadians(Math.sin(angle) * 2);
  //   const hpr = new HeadingPitchRoll(heading, 0, roll);
  //   modelEntity.orientation = Transforms.headingPitchRollQuaternion(newPos, hpr);
  // });

  // console.log("✅ Mô hình nổi đã được thêm:", url);
  // return modelEntity;




  const [lon, lat] = position;
  const totalDistanceMeters = 200000; // 5 km
  const speedMetersPerSecond = 100; // tốc độ di chuyển (m/s)
  //const lonPerMeter = 1 / (111320 * Math.cos(CesiumMath.toRadians(lat))); // quy đổi mét -> độ kinh

  let distanceTraveled = 0;

  // Khởi tạo mô hình
  const modelEntity = viewer.entities.add({
    name: "Floating Model",
    position: Cartesian3.fromDegrees(lon, lat, getWaterLevel()),
    model: {
      uri: url,
      scale: 1.0,
      minimumPixelSize: 64,
      maximumScale: 100,
      runAnimations: true,
    },
  });

  // Biến hiệu ứng nổi
  let angle = 0;
  const waveSpeed = 0.02;
  const floatAmplitude = 0.5;

  viewer.clock.onTick.addEventListener((clock) => {
    const deltaTime = viewer.clock.deltaTime || 1 / 60;
    const waterLevel = getWaterLevel();

    // Cập nhật góc sóng
    angle += waveSpeed;

    // Hiệu ứng nổi
    const verticalOffset = Math.sin(angle) * floatAmplitude;
    const height = waterLevel + verticalOffset;

    // Di chuyển về phía Đông (tăng kinh độ)
    if (distanceTraveled < totalDistanceMeters) {
      distanceTraveled += speedMetersPerSecond * deltaTime;
    } else {
      distanceTraveled = 0; // 👉 Nếu muốn dừng lại thì xóa dòng này
    }

    const newLon = lon;
    const latPerMeter = 1 / 111320; 
    const newLat = lat - distanceTraveled * latPerMeter;

    const newPos = Cartesian3.fromDegrees(newLon, newLat, height);
    modelEntity.position = newPos;

    // Nghiêng nhẹ khi di chuyển (mô phỏng sóng)
    const heading = CesiumMath.toRadians(180); // Quay mặt về hướng Nam
    const roll = CesiumMath.toRadians(Math.sin(angle) * 0);
    const hpr = new HeadingPitchRoll(heading, 0, roll);
    modelEntity.orientation = Transforms.headingPitchRollQuaternion(newPos, hpr);
  });

  console.log("✅ Mô hình nổi đã được thêm và đang di chuyển về phía Đông:", url);
  return modelEntity;
}

// ✅ Xuất theo kiểu default object để tránh lỗi webpack/vite bundling
export default {
  addFloatingModel,
};
