import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Transforms,
  Model,
} from "cesium";

export class UploadModelHandler {
  constructor(viewer) {
    this.viewer = viewer;
    this.selectedCoordinates = null;
    this.isSelectingLocation = false;
    this.handler = null;
    this.isUploading = false;
    this.init();
  }

  init() {
    const btnUpModel = document.getElementById("btnUpModel");
    if (btnUpModel) {
      btnUpModel.addEventListener("click", () => this.startLocationSelection());
    }

    this.fetchCsrfToken();
    this.createUploadPopup();
    this.setupPopupEvents();
  }

  /**
   * ✅ Hiển thị thông báo notification với vị trí lũy tiến
   */
  showNotification(message, type = "info") {
    console.log(`${type.toUpperCase()}: ${message}`);

    // Lấy tất cả notification hiện tại
    const existingNotifications = document.querySelectorAll(".notification");
    let topPosition = 10; // Vị trí bắt đầu

    // Tính toán vị trí mới dựa trên số lượng notification hiện có
    existingNotifications.forEach((notification) => {
      const notificationHeight = notification.offsetHeight + 10; // Chiều cao + margin
      topPosition += notificationHeight;
    });

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: ${topPosition}px;
    right: 180px;
    background: ${
      type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"
    };
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;

    // Thêm animation nếu chưa có
    if (!document.querySelector("#notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }
  /**
   * ✅ Fetch CSRF token từ backend
   */
  async fetchCsrfToken() {
    try {
      const response = await fetch("http://localhost:8000/api/csrf-token/");
      const data = await response.json();
      this.showNotification("CSRF Token đã được lấy thành công", "success");
      return data.csrfToken;
    } catch (error) {
      console.error("❌ Failed to fetch CSRF token:", error);
      this.showNotification("Không thể lấy CSRF Token", "error");
      return null;
    }
  }

  /**
   * ✅ Disable bản đồ khi upload
   */
  disableMapInteraction() {
    this.viewer.scene.screenSpaceCameraController.enableRotate = false;
    this.viewer.scene.screenSpaceCameraController.enableZoom = false;
    this.viewer.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer.scene.screenSpaceCameraController.enableLook = false;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
    this.showNotification("Bản đồ đã bị khóa trong khi upload", "info");
  }

  /**
   * ✅ Enable bản đồ sau upload
   */
  enableMapInteraction() {
    this.viewer.scene.screenSpaceCameraController.enableRotate = true;
    this.viewer.scene.screenSpaceCameraController.enableZoom = true;
    this.viewer.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer.scene.screenSpaceCameraController.enableLook = true;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
    this.showNotification("Bản đồ đã được mở khóa", "success");
  }

  /**
   * Bước 1: Người dùng click nút "Thêm model"
   */
  startLocationSelection() {
    this.isSelectingLocation = true;
    const btnUpModel = document.getElementById("btnUpModel");

    btnUpModel.classList.add("active");

    // Không thay đổi textContent, thay vào đó hiển thị notification
    this.showNotification("📍 Vui lòng chọn vị trí trên bản đồ", "info");
    this.showNotification("Nhấn ESC để hủy", "info");

    this.handler = new ScreenSpaceEventHandler(this.viewer.canvas);

    const onLeftClick = (click) => {
      const cartesian = this.viewer.scene.pickPosition(click.position);

      if (!cartesian) {
        this.showNotification(
          "Không thể xác định vị trí, vui lòng thử lại",
          "error"
        );
        return;
      }

      const cartographic = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      this.showNotification(
        `📍 Đã chọn vị trí: Lon=${lon.toFixed(6)}, Lat=${lat.toFixed(
          6
        )}, Height=${height.toFixed(2)}m`,
        "success"
      );

      btnUpModel.classList.remove("active");
      this.isSelectingLocation = false;

      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);

      this.showUploadPopup(lon, lat, height);
    };

    this.handler.setInputAction(onLeftClick, ScreenSpaceEventType.LEFT_CLICK);

    const escapeHandler = (e) => {
      if (e.key === "Escape" && this.isSelectingLocation) {
        this.cancelLocationSelection();
        if (this.handler) {
          this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        }
        document.removeEventListener("keydown", escapeHandler);
      }
    };

    document.addEventListener("keydown", escapeHandler);
  }

  cancelLocationSelection() {
    this.isSelectingLocation = false;
    const btnUpModel = document.getElementById("btnUpModel");
    btnUpModel.classList.remove("active");
    this.showNotification("Đã hủy chọn vị trí", "info");
  }

  /**
   * Tạo HTML popup với rotation controls
   */
  createUploadPopup() {
    const popupHtml = `
      <div id="uploadModal" class="modal">
        <div class="modal-content upload-container">
          <span class="close">&times;</span>
          <h2>📦 Upload Model 3D (.glb)</h2>

          <!-- Hiển thị tọa độ tự động -->
          <div class="coordinates-display">
            <div class="coord-item">
              <label>Kinh độ (Lon):</label>
              <input type="number" id="coordLon" readonly step="0.0001">
            </div>
            <div class="coord-item">
              <label>Vĩ độ (Lat):</label>
              <input type="number" id="coordLat" readonly step="0.0001">
            </div>
            <div class="coord-item">
              <label>Độ cao (m):</label>
              <input type="number" id="coordHeight" readonly step="0.01">
            </div>
          </div>

          <!-- Điền tên model -->
          <div class="form-group">
            <label for="modelName">Tên model:</label>
            <input type="text" id="modelName" placeholder="Ví dụ: Tòa nhà A" required>
          </div>

          <!-- Tỷ lệ model -->
          <div class="form-group">
            <label for="modelScale">Tỷ lệ (scale):</label>
            <input type="number" id="modelScale" value="1" min="0.1" step="0.1" required>
          </div>

          <!-- ✅ Rotation Controls -->
          <div class="rotation-controls">
            <h3>🔄 Góc xoay (độ)</h3>
            
            <div class="rotation-item">
              <label for="rotationX">Xoay X (Pitch):</label>
              <div class="rotation-input">
                <input type="range" id="rotationX" min="0" max="360" value="0" step="1">
                <input type="number" id="rotationXValue" value="0" min="0" max="360" step="1">
                <span>°</span>
              </div>
            </div>

            <div class="rotation-item">
              <label for="rotationY">Xoay Y (Roll):</label>
              <div class="rotation-input">
                <input type="range" id="rotationY" min="0" max="360" value="0" step="1">
                <input type="number" id="rotationYValue" value="0" min="0" max="360" step="1">
                <span>°</span>
              </div>
            </div>

            <div class="rotation-item">
              <label for="rotationZ">Xoay Z (Yaw):</label>
              <div class="rotation-input">
                <input type="range" id="rotationZ" min="0" max="360" value="0" step="1">
                <input type="number" id="rotationZValue" value="0" min="0" max="360" step="1">
                <span>°</span>
              </div>
            </div>
          </div>

          <!-- Chọn file .glb -->
          <div class="form-group">
            <label for="glbFile">Chọn file .glb:</label>
            <input type="file" id="glbFile" accept=".glb" required>
            <span class="file-info"></span>
          </div>

          <!-- Nút Upload & Huỷ -->
          <div class="button-group">
            <button id="btnUploadSubmit" class="btn-submit">✓ Upload</button>
            <button id="btnUploadCancel" class="btn-cancel">✕ Huỷ</button>
          </div>

          <!-- Hiển thị trạng thái (loading, success, error) -->
          <div id="uploadStatus" class="upload-status"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", popupHtml);
  }

  /**
   * Setup events cho popup - CHỈ THÊM EVENT LISTENER MỘT LẦN
   */
  setupPopupEvents() {
    const modal = document.getElementById("uploadModal");

    // Kiểm tra xem đã có listener chưa bằng cách đặt custom attribute
    if (modal.getAttribute("data-events-bound") === "true") {
      return; // Đã có listener rồi, không thêm nữa
    }

    const closeBtn = modal.querySelector(".close");
    const cancelBtn = document.getElementById("btnUploadCancel");
    const submitBtn = document.getElementById("btnUploadSubmit");
    const fileInput = document.getElementById("glbFile");

    // Tạo hàm xử lý đóng modal
    const closeModalHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeModal();
    };

    // Tạo hàm xử lý submit
    const submitHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submitUpload();
    };

    // Thêm event listeners với cùng function reference
    closeBtn.addEventListener("click", closeModalHandler);
    cancelBtn.addEventListener("click", closeModalHandler);
    submitBtn.addEventListener("click", submitHandler);

    // ✅ Sync rotation slider và input
    const setupRotationSync = (sliderId, inputId) => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);

      if (slider && input) {
        const syncHandler = () => {
          input.value = slider.value;
        };
        const syncInputHandler = () => {
          slider.value = input.value;
        };

        slider.addEventListener("input", syncHandler);
        input.addEventListener("input", syncInputHandler);
      }
    };

    setupRotationSync("rotationX", "rotationXValue");
    setupRotationSync("rotationY", "rotationYValue");
    setupRotationSync("rotationZ", "rotationZValue");

    fileInput.addEventListener("change", (e) => {
      const fileName = e.target.files[0]?.name || "";
      const fileInfo = modal.querySelector(".file-info");
      if (fileName) {
        fileInfo.textContent = `✓ ${fileName}`;
        fileInfo.style.color = "#4caf50";
        this.showNotification(`Đã chọn file: ${fileName}`, "success");
      }
    });

    window.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });

    // Đánh dấu đã bind events
    modal.setAttribute("data-events-bound", "true");
  }

  /**
   * Bước 2: Hiển thị popup với tọa độ được điền sẵn
   */
  showUploadPopup(lon, lat, height) {
    const modal = document.getElementById("uploadModal");

    document.getElementById("coordLon").value = lon.toFixed(6);
    document.getElementById("coordLat").value = lat.toFixed(6);
    document.getElementById("coordHeight").value = height.toFixed(2);

    document.getElementById("modelName").value = "";
    document.getElementById("modelScale").value = "1";
    document.getElementById("rotationX").value = "0";
    document.getElementById("rotationXValue").value = "0";
    document.getElementById("rotationY").value = "0";
    document.getElementById("rotationYValue").value = "0";
    document.getElementById("rotationZ").value = "0";
    document.getElementById("rotationZValue").value = "0";
    document.getElementById("glbFile").value = "";
    document.querySelector(".file-info").textContent = "";
    document.getElementById("uploadStatus").innerHTML = "";

    modal.style.display = "block";
    this.showNotification("Vui lòng điền thông tin model và chọn file", "info");
  }

  closeModal() {
    const modal = document.getElementById("uploadModal");
    modal.style.display = "none";
    this.showNotification("Đã đóng cửa sổ upload", "info");
  }

  /**
   * Bước 3: Người dùng fill form và click Upload
   */
  async submitUpload() {
    const glbFile = document.getElementById("glbFile").files[0];
    const modelName = document.getElementById("modelName").value.trim();
    const modelScale = parseFloat(document.getElementById("modelScale").value);
    const lon = parseFloat(document.getElementById("coordLon").value);
    const lat = parseFloat(document.getElementById("coordLat").value);
    const height = parseFloat(document.getElementById("coordHeight").value);
    const rotationX = parseFloat(
      document.getElementById("rotationXValue").value
    );
    const rotationY = parseFloat(
      document.getElementById("rotationYValue").value
    );
    const rotationZ = parseFloat(
      document.getElementById("rotationZValue").value
    );

    if (!glbFile) {
      this.showError("❌ Vui lòng chọn file .glb");
      this.showNotification("Vui lòng chọn file .glb", "error");
      return;
    }

    if (!modelName) {
      this.showError("❌ Vui lòng nhập tên model");
      this.showNotification("Vui lòng nhập tên model", "error");
      return;
    }

    if (!glbFile.name.endsWith(".glb")) {
      this.showError("❌ Chỉ chấp nhận file .glb");
      this.showNotification("Chỉ chấp nhận file định dạng .glb", "error");
      return;
    }

    this.showNotification(`Đang upload: ${modelName}`, "info");
    this.uploadModel(
      glbFile,
      modelName,
      lon,
      lat,
      height,
      modelScale,
      rotationX,
      rotationY,
      rotationZ
    );
  }

  /**
   * Bước 4: Gửi API tới backend + Disable map
   */
  async uploadModel(file, name, lon, lat, height, scale, rotX, rotY, rotZ) {
    const statusDiv = document.getElementById("uploadStatus");
    const submitBtn = document.getElementById("btnUploadSubmit");

    try {
      // ✅ Disable bản đồ
      this.disableMapInteraction();
      this.isUploading = true;

      statusDiv.innerHTML = '<p class="loading">⏳ Đang upload...</p>';
      submitBtn.disabled = true;

      const formData = new FormData();
      formData.append("glb_file", file);
      formData.append("model_name", name);
      formData.append("lon", lon);
      formData.append("lat", lat);
      formData.append("height", height);
      formData.append("scale", scale);
      formData.append("rotation_x", rotX);
      formData.append("rotation_y", rotY);
      formData.append("rotation_z", rotZ);

      this.showNotification("Đang gửi dữ liệu lên server...", "info");

      const response = await fetch("http://localhost:8000/api/upload-glb/", {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": this.getCsrfToken(),
        },
      });

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Response không phải JSON:", text);
        this.showError(
          `❌ Server Error: ${response.status} ${response.statusText}`
        );
        this.showNotification("Lỗi server: Phản hồi không hợp lệ", "error");
        return;
      }

      const data = await response.json();

      if (response.ok) {
        this.showNotification(`✅ Upload thành công: ${name}`, "success");
        statusDiv.innerHTML = '<p class="success">✅ Upload thành công!</p>';

        // ✅ Load model realtime (không cần reload)
        setTimeout(() => {
          this.loadModelRealtime(
            data,
            lon,
            lat,
            height,
            scale,
            rotX,
            rotY,
            rotZ
          );

          setTimeout(() => {
            this.closeModal();
            this.enableMapInteraction();
            this.isUploading = false;
          }, 1000);
        }, 500);
      } else {
        console.error("❌ Upload failed:", data);
        this.showError(data.message || `❌ Lỗi: ${data.error}`);
        this.showNotification(
          `Upload thất bại: ${data.error || "Lỗi không xác định"}`,
          "error"
        );
        this.enableMapInteraction();
        this.isUploading = false;
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      this.showError(`❌ Lỗi: ${error.message}`);
      this.showNotification(`Lỗi mạng: ${error.message}`, "error");
      this.enableMapInteraction();
      this.isUploading = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  /**
   * ✅ Load model realtime lên bản đồ (không refresh)
   */
  async loadModelRealtime(
    modelData,
    lon,
    lat,
    height,
    scale,
    rotX,
    rotY,
    rotZ
  ) {
    try {
      this.showNotification("Đang tải model lên bản đồ...", "info");

      const position = Cartesian3.fromDegrees(lon, lat, height);
      const modelMatrix = Transforms.eastNorthUpToFixedFrame(position);

      const model = await Model.fromGltfAsync({
        url: `http://localhost:8000${modelData.url}`,
        modelMatrix: modelMatrix,
        scale: scale || 1,
      });

      this.viewer.scene.primitives.add(model);
      this.showNotification("Model đã được tải thành công!", "success");

      // ✅ Zoom tới model
      this.viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, height + 200),
        duration: 1,
      });
    } catch (error) {
      console.error("❌ Error loading model realtime:", error);
      this.showNotification("Lỗi khi tải model lên bản đồ", "error");
    }
  }

  showError(message) {
    const statusDiv = document.getElementById("uploadStatus");
    statusDiv.innerHTML = `<p class="error">${message}</p>`;
  }

  getCsrfToken() {
    const name = "csrftoken";
    let cookieValue = null;

    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }

    if (!cookieValue) {
      const csrfElement = document.querySelector(
        '[name="csrfmiddlewaretoken"]'
      );
      if (csrfElement) {
        cookieValue = csrfElement.value;
      }
    }

    return cookieValue || "";
  }
}

export default UploadModelHandler;
