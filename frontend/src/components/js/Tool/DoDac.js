// assets/components/js/DoDac.js
import * as Cesium from "cesium";

export class MeasurementSystem {
  constructor(viewer, notificationCallback) {
    this.viewer = viewer;
    this.notificationCallback = notificationCallback;

    // Measurement properties
    this.measureActive = false;
    this.measureHandler = null;
    this.firstMeasurePoint = null;
    this.dynamicMeasureLine = null;
    this.measurePoints = [];
    this.measureLines = [];
    this.measureLabels = [];
  }

  // Toggle chế độ đo chiều cao
  toggleHeightMeasure(locateSystem) {
    // Tắt chế độ lấy tọa độ nếu đang bật
    if (locateSystem && locateSystem.isActive()) {
      locateSystem.deactivate();
    }

    if (this.measureActive) {
      // Tắt chế độ đo
      this.deactivate();
      this.measureActive = false;
      this.showNotification("Chế độ đo chiều cao đã tắt!", "success");
    } else {
      // Bật chế độ đo
      this.activate();
      this.measureActive = true;
      this.showNotification(
        "Chế độ đo chiều cao đã bật. Click 2 điểm để đo Δh.",
        "info",
      );
    }
  }

  // Kích hoạt hệ thống đo đạc
  activate() {
    this.measureHandler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas,
    );

    // Xử lý click chuột trái
    this.measureHandler.setInputAction(
      (click) => this.handleHeightClick(click),
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    // Xử lý di chuyển chuột
    this.measureHandler.setInputAction(
      (movement) => this.handleHeightMouseMove(movement),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE,
    );

    // Xử lý click chuột phải để huỷ
    this.measureHandler.setInputAction(
      () => this.cancelCurrentMeasurement(),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK,
    );
  }

  // Hủy kích hoạt hệ thống đo đạc
  deactivate() {
    if (this.measureHandler) {
      this.measureHandler.destroy();
      this.measureHandler = null;
    }

    if (this.dynamicMeasureLine) {
      this.viewer.entities.remove(this.dynamicMeasureLine);
      this.dynamicMeasureLine = null;
    }

    this.firstMeasurePoint = null;
  }

  // Kiểm tra xem hệ thống có đang active không
  isActive() {
    return this.measureActive;
  }

  // Xử lý click chuột để đo đạc
  handleHeightClick(click) {
    const pickedPos = this.viewer.scene.pickPosition(click.position);
    if (!pickedPos) {
      this.showNotification("Không thể xác định vị trí từ click!", "warning");
      return;
    }

    if (!this.firstMeasurePoint) {
      // Điểm đầu tiên
      this.firstMeasurePoint = pickedPos;
      this.addHeightPointMarker(
        this.firstMeasurePoint,
        Cesium.Color.RED,
        "Điểm A",
      );

      // Tạo đường tạm thời
      this.dynamicMeasureLine = this.viewer.entities.add({
        polyline: {
          positions: [this.firstMeasurePoint, this.firstMeasurePoint],
          width: 3,
          material: Cesium.Color.YELLOW.withAlpha(0.5),
        },
      });
    } else {
      // Điểm thứ hai - hoàn thành phép đo
      const secondPoint = pickedPos;
      this.addHeightPointMarker(secondPoint, Cesium.Color.BLUE, "Điểm B");
      this.completeHeightMeasurement(this.firstMeasurePoint, secondPoint);

      // Xóa đường tạm thời
      if (this.dynamicMeasureLine) {
        this.viewer.entities.remove(this.dynamicMeasureLine);
        this.dynamicMeasureLine = null;
      }

      this.firstMeasurePoint = null;
    }
  }

  // Xử lý di chuyển chuột
  handleHeightMouseMove(movement) {
    if (!this.firstMeasurePoint || !this.dynamicMeasureLine) return;

    const pickedPos = this.viewer.scene.pickPosition(movement.endPosition);
    if (!pickedPos) return;

    // Cập nhật vị trí cuối của đường tạm thời
    this.dynamicMeasureLine.polyline.positions = [
      this.firstMeasurePoint,
      pickedPos,
    ];
  }

  // Hoàn thành phép đo
  completeHeightMeasurement(pointA, pointB) {
    // Tính toán chiều cao
    const cartoA = Cesium.Cartographic.fromCartesian(pointA);
    const cartoB = Cesium.Cartographic.fromCartesian(pointB);

    const heightA = parseFloat(cartoA.height).toFixed(2);
    const heightB = parseFloat(cartoB.height).toFixed(2);
    const diff = (cartoB.height - cartoA.height).toFixed(2);

    // Tạo đường nối giữa hai điểm
    const line = this.viewer.entities.add({
      polyline: {
        positions: [pointA, pointB],
        width: 4,
        material: Cesium.Color.ORANGE,
      },
    });

    // Thêm label hiển thị chênh lệch độ cao
    const midpoint = Cesium.Cartesian3.midpoint(
      pointA,
      pointB,
      new Cesium.Cartesian3(),
    );
    const label = this.viewer.entities.add({
      position: midpoint,
      label: {
        text: `Δh = ${diff} m\n(A: ${heightA}m → B: ${heightB}m)`,
        font: "16px sans-serif",
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        pixelOffset: new Cesium.Cartesian2(0, -30),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    this.measureLines.push(line);
    this.measureLabels.push(label);

    // Thông báo kết quả
    const resultMessage = `Đo chiều cao hoàn thành:\nĐiểm A: ${heightA}m\nĐiểm B: ${heightB}m\nChênh lệch: ${diff}m`;
    this.showNotification(resultMessage, "success");
  }

  // Thêm marker điểm đo
  addHeightPointMarker(position, color, labelText) {
    const carto = Cesium.Cartographic.fromCartesian(position);
    const height = parseFloat(carto.height).toFixed(2);

    const point = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: 12,
        color: color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `${labelText}: ${height} m`,
        font: "14px sans-serif",
        pixelOffset: new Cesium.Cartesian2(0, -25),
        fillColor: Cesium.Color.YELLOW,
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    this.measurePoints.push(point);
    return point;
  }

  // Hủy phép đo hiện tại
  cancelCurrentMeasurement() {
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
  }

  // Xóa tất cả phép đo
  clearAllMeasurements() {
    // Xóa tất cả điểm đo
    this.measurePoints.forEach((point) => {
      if (point) this.viewer.entities.remove(point);
    });

    // Xóa tất cả đường đo
    this.measureLines.forEach((line) => {
      if (line) this.viewer.entities.remove(line);
    });

    // Xóa tất cả label đo
    this.measureLabels.forEach((label) => {
      if (label) this.viewer.entities.remove(label);
    });

    // Reset tất cả mảng
    this.measurePoints = [];
    this.measureLines = [];
    this.measureLabels = [];

    // Nếu đang trong quá trình đo, huỷ
    if (this.firstMeasurePoint) {
      this.cancelCurrentMeasurement();
    }

    this.showNotification("Đã xóa tất cả các phép đo", "success");
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
    this.clearAllMeasurements();
  }
}
