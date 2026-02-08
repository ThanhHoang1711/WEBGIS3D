// assets/components/js/Tool/XoayBanDo.js
import * as Cesium from "cesium";

export default class NavigationControl {
  constructor(viewer, containerElement = null) {
    this.viewer = viewer;
    this.containerElement = containerElement; // ✅ Container cha (cesiumContainer hoặc body)
    this.rotationSpeed = 0.5; // Độ mỗi lần nhấn
    this.tiltSpeed = 5; // Độ nghiêng mỗi lần nhấn
    this.continuousRotation = false;
    this.rotationInterval = null;
    this.currentRotationDirection = null;
    this.navContainer = null; // ✅ Lưu reference để destroy sau

    this.initializeNavigation();
  }

  initializeNavigation() {
    // Tạo container cho điều hướng
    this.navContainer = document.createElement("div");
    this.navContainer.id = "navigationControl";
    this.navContainer.className = "navigation-container";

    // HTML cho các nút điều hướng với icon từ assets
    this.navContainer.innerHTML = `
      <div class="navigation-wrapper">
        <div class="navigation-row">
          <button class="nav-btn" id="navTiltUp" title="Nâng lên">
            <img class="nav-icon" src="${this.getImagePath(
              "nangLen.png",
            )}" alt="Nâng lên" />
          </button>
        </div>
        
        <div class="navigation-row">
          <button class="nav-btn" id="navRotateLeft" title="Xoay trái">
            <img class="nav-icon" src="${this.getImagePath(
              "xoayTrai.png",
            )}" alt="Xoay trái" />
          </button>
          
          <div class="nav-center">
            <button class="nav-btn nav-center-btn" id="navReset" title="Reset góc nhìn">
              <img class="nav-icon" src="${this.getImagePath(
                "datLaiGocNhin.png",
              )}" alt="Reset" />
            </button>
          </div>
          
          <button class="nav-btn" id="navRotateRight" title="Xoay phải">
            <img class="nav-icon" src="${this.getImagePath(
              "xoayPhai.png",
            )}" alt="Xoay phải" />
          </button>
        </div>
        
        <div class="navigation-row">
          <button class="nav-btn" id="navTiltDown" title="Hạ xuống">
            <img class="nav-icon" src="${this.getImagePath(
              "haXuong.png",
            )}" alt="Hạ xuống" />
          </button>
        </div>
        
        <!-- Nút giữ để xoay liên tục -->
        <div class="navigation-options">
          <button class="nav-option-btn" id="navHoldRotateLeft" title="Giữ để xoay trái liên tục">
            <img class="nav-option-icon" src="${this.getImagePath(
              "diQuaTrai.png",
            )}" alt="Xoay trái liên tục" />
          </button>
          
          <button class="nav-option-btn" id="navHoldRotateRight" title="Giữ để xoay phải liên tục">
            <img class="nav-option-icon" src="${this.getImagePath(
              "diQuaPhai.png",
            )}" alt="Xoay phải liên tục" />
          </button>
        </div>
      </div>
    `;

    // ✅ FIXED: Thêm vào container cụ thể thay vì body
    const targetContainer = this.containerElement || document.body;
    targetContainer.appendChild(this.navContainer);

    this.setupEventListeners();
  }

  // Phương thức lấy đường dẫn hình ảnh
  getImagePath(filename) {
    // Điều chỉnh đường dẫn theo cấu trúc dự án của bạn
    return require(`@/assets/img/${filename}`);
  }

  setupEventListeners() {
    // Xoay trái
    document.getElementById("navRotateLeft").addEventListener("click", () => {
      this.rotateCamera("right");
    });

    document
      .getElementById("navHoldRotateLeft")
      .addEventListener("mousedown", () => {
        this.startContinuousRotation("right");
      });

    document
      .getElementById("navHoldRotateLeft")
      .addEventListener("mouseup", () => {
        this.stopContinuousRotation();
      });

    document
      .getElementById("navHoldRotateLeft")
      .addEventListener("mouseleave", () => {
        this.stopContinuousRotation();
      });

    // Xoay phải
    document.getElementById("navRotateRight").addEventListener("click", () => {
      this.rotateCamera("left");
    });

    document
      .getElementById("navHoldRotateRight")
      .addEventListener("mousedown", () => {
        this.startContinuousRotation("left");
      });

    document
      .getElementById("navHoldRotateRight")
      .addEventListener("mouseup", () => {
        this.stopContinuousRotation();
      });

    document
      .getElementById("navHoldRotateRight")
      .addEventListener("mouseleave", () => {
        this.stopContinuousRotation();
      });

    // Nâng lên/hạ xuống
    document.getElementById("navTiltUp").addEventListener("click", () => {
      this.tiltCamera("down");
    });

    document.getElementById("navTiltDown").addEventListener("click", () => {
      this.tiltCamera("up");
    });

    // Reset góc nhìn
    document.getElementById("navReset").addEventListener("click", () => {
      this.resetView();
    });

    // Thêm sự kiện cho mobile (touch)
    this.setupTouchEvents();
  }

  setupTouchEvents() {
    const buttons = ["navHoldRotateLeft", "navHoldRotateRight"];

    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("touchstart", (e) => {
          e.preventDefault();
          const direction = btnId.includes("Left") ? "left" : "right";
          this.startContinuousRotation(direction);
        });

        btn.addEventListener("touchend", (e) => {
          e.preventDefault();
          this.stopContinuousRotation();
        });

        btn.addEventListener("touchcancel", (e) => {
          e.preventDefault();
          this.stopContinuousRotation();
        });
      }
    });
  }

  rotateCamera(direction) {
    if (!this.viewer) return;

    const currentHeading = Cesium.Math.toDegrees(this.viewer.camera.heading);
    let newHeading;

    if (direction === "left") {
      newHeading = currentHeading + this.rotationSpeed;
    } else {
      newHeading = currentHeading - this.rotationSpeed;
    }

    this.viewer.camera.setView({
      orientation: {
        heading: Cesium.Math.toRadians(newHeading),
        pitch: this.viewer.camera.pitch,
        roll: this.viewer.camera.roll,
      },
    });
  }

  tiltCamera(direction) {
    if (!this.viewer) return;

    const currentPitch = Cesium.Math.toDegrees(this.viewer.camera.pitch);
    let newPitch;

    // Giới hạn góc nghiêng từ -90 đến 0 độ
    const minPitch = -90;
    const maxPitch = 0;

    if (direction === "up") {
      newPitch = Math.max(minPitch, currentPitch - this.tiltSpeed);
    } else {
      newPitch = Math.min(maxPitch, currentPitch + this.tiltSpeed);
    }

    this.viewer.camera.setView({
      orientation: {
        heading: this.viewer.camera.heading,
        pitch: Cesium.Math.toRadians(newPitch),
        roll: this.viewer.camera.roll,
      },
    });
  }

  startContinuousRotation(direction) {
    this.currentRotationDirection = direction;

    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }

    this.rotationInterval = setInterval(() => {
      this.rotateCamera(direction);
    }, 50); // Mỗi 50ms xoay một lần
  }

  stopContinuousRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
      this.currentRotationDirection = null;
    }
  }

  resetView() {
    if (!this.viewer) return;
    const Degrees = Cesium.Math.toRadians(20); //góc reset
    this.viewer.camera.setView({
      orientation: {
        heading: 0,
        pitch: -Degrees,
        roll: 0.0,
      },
    });
  }

  setRotationSpeed(speed) {
    this.rotationSpeed = speed;
  }

  setTiltSpeed(speed) {
    this.tiltSpeed = speed;
  }

  destroy() {
    this.stopContinuousRotation();

    // ✅ FIXED: Xóa navContainer khỏi DOM
    if (this.navContainer && this.navContainer.parentNode) {
      this.navContainer.parentNode.removeChild(this.navContainer);
      this.navContainer = null;
    }
  }
}
