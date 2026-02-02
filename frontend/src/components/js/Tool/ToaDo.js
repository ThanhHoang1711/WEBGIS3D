// assets/components/js/ToaDo.js
import * as Cesium from "cesium";

export class CoordinateSystem {
  constructor(viewer, notificationCallback) {
    this.viewer = viewer;
    this.notificationCallback = notificationCallback;

    // Coordinate properties
    this.locateActive = false;
    this.locateHandler = null;
    this.coordMarkers = [];
  }

  // Toggle chế độ lấy tọa độ
  toggleLocatePoint(measurementSystem) {
    // Tắt chế độ đo chiều cao nếu đang bật
    if (measurementSystem && measurementSystem.isActive()) {
      measurementSystem.deactivate();
    }

    if (this.locateActive) {
      // Tắt chế độ lấy tọa độ
      this.deactivate();
      this.locateActive = false;
      this.showNotification("Chế độ lấy tọa độ đã tắt!", "success");
    } else {
      // Bật chế độ lấy tọa độ
      this.activate();
      this.locateActive = true;
      this.showNotification(
        "Chế độ lấy tọa độ đã bật. Click vào bản đồ!",
        "info",
      );
    }
  }

  // Kích hoạt hệ thống lấy tọa độ
  activate() {
    this.locateHandler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas,
    );

    // Xử lý click chuột trái
    this.locateHandler.setInputAction(
      (click) => this.handleCoordinateClick(click),
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  // Hủy kích hoạt hệ thống lấy tọa độ
  deactivate() {
    if (this.locateHandler) {
      this.locateHandler.destroy();
      this.locateHandler = null;
    }
  }

  // Kiểm tra xem hệ thống có đang active không
  isActive() {
    return this.locateActive;
  }

  // Xử lý click chuột để lấy tọa độ
  handleCoordinateClick(click) {
    const cartesian = this.viewer.scene.pickPosition(click.position);
    if (!cartesian) {
      this.showNotification("Không thể xác định vị trí!", "warning");
      return;
    }

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lon = Cesium.Math.toDegrees(carto.longitude).toFixed(6);
    const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(6);
    const height = carto.height.toFixed(2);

    // Thêm marker
    const marker = this.addCoordinateMarker(cartesian, lat, lon, height);
    this.coordMarkers.push(marker);

    // Thông báo tọa độ
    const coordMessage = `Tọa độ đã lấy:\nLat: ${lat}°\nLon: ${lon}°\nĐộ cao: ${height}m`;
    this.showNotification(coordMessage, "success");

    // Log ra console
    console.log(coordMessage);
  }

  // Thêm marker tọa độ
  addCoordinateMarker(position, lat, lon, height) {
    // Tạo màu ngẫu nhiên cho marker
    const randomColor = Cesium.Color.fromRandom({ alpha: 1.0 });

    const marker = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: 10,
        color: randomColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `📍 ${
          this.coordMarkers.length + 1
        }\nLat: ${lat}°\nLon: ${lon}°\nH: ${height}m`,
        font: "14px sans-serif",
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        fillColor: Cesium.Color.YELLOW,
        pixelOffset: new Cesium.Cartesian2(0, -40),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      description: `Tọa độ điểm ${
        this.coordMarkers.length + 1
      }: ${lat}°, ${lon}°, ${height}m`,
    });

    return marker;
  }

  // Xóa tất cả marker tọa độ
  clearAllMarkers() {
    this.coordMarkers.forEach((marker) => {
      if (marker) this.viewer.entities.remove(marker);
    });

    this.coordMarkers = [];
    this.showNotification("Đã xóa tất cả các marker tọa độ", "success");
  }

  // Xóa tất cả dữ liệu (marker và tắt chế độ)
  clearAllData() {
    this.clearAllMarkers();
    this.deactivate();
    this.locateActive = false;
  }

  // Lấy tất cả tọa độ đã lưu
  getAllCoordinates() {
    return this.coordMarkers.map((marker, index) => {
      const position = marker.position.getValue();
      const carto = Cesium.Cartographic.fromCartesian(position);
      return {
        id: index + 1,
        lat: Cesium.Math.toDegrees(carto.latitude).toFixed(6),
        lon: Cesium.Math.toDegrees(carto.longitude).toFixed(6),
        height: carto.height.toFixed(2),
        marker: marker,
      };
    });
  }

  // Xuất tọa độ ra file JSON
  exportToJSON(filename = "coordinates.json") {
    const coordinates = this.getAllCoordinates().map((coord) => ({
      id: coord.id,
      latitude: coord.lat,
      longitude: coord.lon,
      elevation: coord.height,
    }));

    const dataStr = JSON.stringify(coordinates, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();

    this.showNotification(
      `Đã xuất ${coordinates.length} tọa độ ra file ${filename}`,
      "success",
    );
  }

  // Hiển thị thông báo
  showNotification(message, type = "info") {
    if (this.notificationCallback) {
      this.notificationCallback(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  // Dọn dẹp
  destroy() {
    this.deactivate();
    this.clearAllMarkers();
  }
}
