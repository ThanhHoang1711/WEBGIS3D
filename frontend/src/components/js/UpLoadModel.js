import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Transforms,
  Model,
  Matrix4,
  HeadingPitchRoll,
  Color,
  PolylineGraphics,
  Entity,
} from "cesium";

export class UploadModelHandler {
  constructor(viewer) {
    this.viewer = viewer;
    this.selectedCoordinates = null;
    this.isSelectingLocation = false;
    this.handler = null;
    this.isUploading = false;

    // Preview model state
    this.previewModel = null;
    this.previewEntity = null;
    this.rotationHandler = null;
    this.isRotating = false;
    this.currentRotation = { heading: 0, pitch: 0, roll: 0 };
    this.rotationGizmo = null;

    this.init();
  }

  init() {
    const btnUpModel = document.getElementById("btnUpModel");
    if (btnUpModel) {
      btnUpModel.addEventListener("click", () => this.openUploadPopup());
    }

    this.fetchCsrfToken();
    this.createUploadPopup();
    this.setupPopupEvents();
  }

  showNotification(message, type = "info") {
    console.log(`${type.toUpperCase()}: ${message}`);

    const existingNotifications = document.querySelectorAll(".notification");
    let topPosition = 10;

    existingNotifications.forEach((notification) => {
      const notificationHeight = notification.offsetHeight + 10;
      topPosition += notificationHeight;
    });

    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: ${topPosition}px;
    right: 440px;
    background: ${
      type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"
    };
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10001;
    max-width: 300px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;

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

  async fetchCsrfToken() {
    try {
      const response = await fetch("http://localhost:8000/api/csrf-token/");
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error("❌ Failed to fetch CSRF token:", error);
      this.showNotification("Không thể lấy CSRF Token", "error");
      return null;
    }
  }

  disableMapInteraction() {
    this.viewer.scene.screenSpaceCameraController.enableRotate = false;
    this.viewer.scene.screenSpaceCameraController.enableZoom = false;
    this.viewer.scene.screenSpaceCameraController.enableTilt = false;
    this.viewer.scene.screenSpaceCameraController.enableLook = false;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
  }

  enableMapInteraction() {
    this.viewer.scene.screenSpaceCameraController.enableRotate = true;
    this.viewer.scene.screenSpaceCameraController.enableZoom = true;
    this.viewer.scene.screenSpaceCameraController.enableTilt = true;
    this.viewer.scene.screenSpaceCameraController.enableLook = true;
    this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
  }

  // Mở popup đầu tiên
  openUploadPopup() {
    const modal = document.getElementById("uploadModal");

    // Reset form
    document.getElementById("coordLon").value = "";
    document.getElementById("coordLat").value = "";
    document.getElementById("coordHeight").value = "";
    document.getElementById("modelName").value = "";
    document.getElementById("modelScale").value = "1";
    document.getElementById("rotationHeading").value = "0";
    document.getElementById("rotationHeadingValue").value = "0";
    document.getElementById("rotationPitch").value = "0";
    document.getElementById("rotationPitchValue").value = "0";
    document.getElementById("rotationRoll").value = "0";
    document.getElementById("rotationRollValue").value = "0";
    document.getElementById("glbFile").value = "";
    document.querySelector(".file-info").textContent = "";
    document.getElementById("uploadStatus").innerHTML = "";
    document.getElementById("previewSection").style.display = "none";

    // Disable nút chọn vị trí và upload ban đầu
    document.getElementById("btnSelectLocation").disabled = false;
    document.getElementById("btnUploadSubmit").disabled = true;

    this.clearPreview();

    modal.style.display = "block";
    this.showNotification("Nhấn 'Chọn vị trí model' để bắt đầu", "info");
  }

  startLocationSelection() {
    this.isSelectingLocation = true;
    const btnSelect = document.getElementById("btnSelectLocation");
    btnSelect.textContent = "⏳ Đang chọn vị trí...";
    btnSelect.disabled = true;

    this.showNotification("📍 Click vào bản đồ để chọn vị trí", "info");
    this.showNotification("Nhấn ESC để hủy", "info");

    this.handler = new ScreenSpaceEventHandler(this.viewer.canvas);

    const onLeftClick = (click) => {
      const cartesian = this.viewer.scene.pickPosition(click.position);

      if (!cartesian) {
        this.showNotification(
          "Không thể xác định vị trí, vui lòng thử lại",
          "error",
        );
        return;
      }

      const cartographic = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      this.showNotification(
        `✅ Đã chọn vị trí: Lon=${lon.toFixed(6)}, Lat=${lat.toFixed(6)}`,
        "success",
      );

      this.isSelectingLocation = false;
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);

      // Cập nhật tọa độ vào form
      this.updateCoordinates(lon, lat, height);

      btnSelect.textContent = "✓ Đã chọn vị trí";
      btnSelect.disabled = false;
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
    const btnSelect = document.getElementById("btnSelectLocation");
    btnSelect.textContent = "📍 Chọn vị trí model";
    btnSelect.disabled = false;
    this.showNotification("Đã hủy chọn vị trí", "info");
  }

  updateCoordinates(lon, lat, height) {
    document.getElementById("coordLon").value = lon.toFixed(6);
    document.getElementById("coordLat").value = lat.toFixed(6);
    document.getElementById("coordHeight").value = height.toFixed(2);
  }

  createUploadPopup() {
    const popupHtml = `
      <div id="uploadModal" class="modal">
        <div class="modal-content upload-container">
          <span class="close">&times;</span>
          <h2>📦 Upload Model 3D (.glb)</h2>

          <!-- Nút chọn vị trí -->
          <div class="form-group">
            <button id="btnSelectLocation" class="btn-select-location">
              📍 Chọn vị trí model
            </button>
          </div>

          <!-- Tọa độ -->
          <div class="coordinates-display">
            <div class="coord-item">
              <label>Kinh độ (Lon):</label>
              <input type="number" id="coordLon" readonly step="0.0001" placeholder="Chưa chọn">
            </div>
            <div class="coord-item">
              <label>Vĩ độ (Lat):</label>
              <input type="number" id="coordLat" readonly step="0.0001" placeholder="Chưa chọn">
            </div>
            <div class="coord-item">
              <label>Độ cao (m):</label>
              <input type="number" id="coordHeight" readonly step="0.01" placeholder="Chưa chọn">
            </div>
          </div>

          <div class="form-group">
            <label for="modelName">Tên model:</label>
            <input type="text" id="modelName" placeholder="Ví dụ: Tòa nhà A" required>
          </div>

          <div class="form-group">
            <label for="modelScale">Tỷ lệ (scale):</label>
            <input type="number" id="modelScale" value="1" min="0.1" step="0.1" required>
          </div>

          <div class="form-group">
            <label for="glbFile">Chọn file .glb:</label>
            <input type="file" id="glbFile" accept=".glb" required>
            <span class="file-info"></span>
          </div>

          <div id="previewSection" style="display: none;">
            <div class="preview-controls">
              <h3>🔄 Điều chỉnh góc xoay</h3>
              <p class="instruction">Kéo mô hình để xoay hoặc dùng các slider bên dưới</p>
              <button id="btnEnableRotation" class="btn-rotation">
                🔄 Bật chế độ xoay
              </button>
            </div>

            <div class="rotation-controls">
              <div class="rotation-item">
                <label for="rotationHeading">Heading (Yaw - Z):</label>
                <div class="rotation-input">
                  <input type="range" id="rotationHeading" min="0" max="360" value="0" step="1">
                  <input type="number" id="rotationHeadingValue" value="0" min="0" max="360" step="1">
                  <span>°</span>
                </div>
              </div>

              <div class="rotation-item">
                <label for="rotationPitch">Pitch (X):</label>
                <div class="rotation-input">
                  <input type="range" id="rotationPitch" min="-90" max="90" value="0" step="1">
                  <input type="number" id="rotationPitchValue" value="0" min="-90" max="90" step="1">
                  <span>°</span>
                </div>
              </div>

              <div class="rotation-item">
                <label for="rotationRoll">Roll (Y):</label>
                <div class="rotation-input">
                  <input type="range" id="rotationRoll" min="-180" max="180" value="0" step="1">
                  <input type="number" id="rotationRollValue" value="0" min="-180" max="180" step="1">
                  <span>°</span>
                </div>
              </div>
            </div>
          </div>

          <div class="button-group">
            <button id="btnUploadSubmit" class="btn-submit">✓ Upload</button>
            <button id="btnUploadCancel" class="btn-cancel">✕ Huỷ</button>
          </div>

          <div id="uploadStatus" class="upload-status"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", popupHtml);
  }

  setupPopupEvents() {
    const modal = document.getElementById("uploadModal");

    if (modal.getAttribute("data-events-bound") === "true") {
      return;
    }

    const closeBtn = modal.querySelector(".close");
    const cancelBtn = document.getElementById("btnUploadCancel");
    const submitBtn = document.getElementById("btnUploadSubmit");
    const fileInput = document.getElementById("glbFile");
    const rotationBtn = document.getElementById("btnEnableRotation");
    const selectLocationBtn = document.getElementById("btnSelectLocation");

    const closeModalHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeModal();
    };

    const submitHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submitUpload();
    };

    closeBtn.addEventListener("click", closeModalHandler);
    cancelBtn.addEventListener("click", closeModalHandler);
    submitBtn.addEventListener("click", submitHandler);

    // Nút chọn vị trí
    selectLocationBtn.addEventListener("click", () => {
      this.startLocationSelection();
    });

    // Rotation slider sync
    const setupRotationSync = (sliderId, inputId, key) => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);

      if (slider && input) {
        slider.addEventListener("input", () => {
          input.value = slider.value;
          this.updatePreviewRotation(key, parseFloat(slider.value));
        });

        input.addEventListener("input", () => {
          slider.value = input.value;
          this.updatePreviewRotation(key, parseFloat(input.value));
        });
      }
    };

    setupRotationSync("rotationHeading", "rotationHeadingValue", "heading");
    setupRotationSync("rotationPitch", "rotationPitchValue", "pitch");
    setupRotationSync("rotationRoll", "rotationRollValue", "roll");

    // File selection
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileName = file.name;
        const fileInfo = modal.querySelector(".file-info");
        fileInfo.textContent = `✓ ${fileName}`;
        fileInfo.style.color = "#4caf50";
        this.showNotification(`Đã chọn file: ${fileName}`, "success");

        // Kiểm tra xem đã chọn vị trí chưa
        const lon = document.getElementById("coordLon").value;
        if (lon) {
          // Load preview
          this.loadPreviewModel(file);
          // Enable nút upload
          submitBtn.disabled = false;
        } else {
          this.showNotification(
            "Vui lòng chọn vị trí trên bản đồ trước",
            "error",
          );
        }
      }
    });

    // Rotation mode toggle
    rotationBtn.addEventListener("click", () => {
      this.toggleRotationMode();
    });

    modal.setAttribute("data-events-bound", "true");
  }

  async loadPreviewModel(file) {
    try {
      this.showNotification("Đang tải preview model...", "info");

      // Remove old preview
      this.clearPreview();

      const lon = parseFloat(document.getElementById("coordLon").value);
      const lat = parseFloat(document.getElementById("coordLat").value);
      const height = parseFloat(document.getElementById("coordHeight").value);
      const scale = parseFloat(document.getElementById("modelScale").value);

      if (!lon || !lat) {
        this.showNotification("Vui lòng chọn vị trí trước", "error");
        return;
      }

      // Create blob URL
      const blobUrl = URL.createObjectURL(file);

      const position = Cartesian3.fromDegrees(lon, lat, height);
      const hpr = new HeadingPitchRoll(0, 0, 0);

      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        position,
        hpr,
      );

      this.previewModel = await Model.fromGltfAsync({
        url: blobUrl,
        modelMatrix: modelMatrix,
        scale: scale,
        silhouetteColor: Color.YELLOW,
        silhouetteSize: 2.0,
      });

      // Set semi-transparent
      this.previewModel.color = Color.fromAlpha(Color.WHITE, 0.5);

      this.viewer.scene.primitives.add(this.previewModel);

      // Add rotation gizmo
      this.addRotationGizmo(position);

      // Show preview section
      document.getElementById("previewSection").style.display = "block";

      this.showNotification(
        "Preview model đã tải. Bạn có thể xoay model!",
        "success",
      );
    } catch (error) {
      console.error("❌ Error loading preview:", error);
      this.showNotification("Lỗi khi tải preview model", "error");
    }
  }

  addRotationGizmo(position) {
    // Add visual rotation indicator
    const radius = 20;

    this.rotationGizmo = this.viewer.entities.add({
      position: position,
      ellipse: {
        semiMinorAxis: radius,
        semiMajorAxis: radius,
        material: Color.YELLOW.withAlpha(0.3),
        outline: true,
        outlineColor: Color.YELLOW,
        outlineWidth: 2,
      },
    });
  }

  toggleRotationMode() {
    const btn = document.getElementById("btnEnableRotation");

    if (this.isRotating) {
      // Disable rotation mode
      this.isRotating = false;
      btn.textContent = "🔄 Bật chế độ xoay";
      btn.classList.remove("active");
      this.enableMapInteraction();

      if (this.rotationHandler) {
        this.rotationHandler.destroy();
        this.rotationHandler = null;
      }

      this.showNotification("Đã tắt chế độ xoay", "info");
    } else {
      // Enable rotation mode
      this.isRotating = true;
      btn.textContent = "🔒 Tắt chế độ xoay";
      btn.classList.add("active");
      this.disableMapInteraction();

      this.setupRotationHandler();
      this.showNotification("Kéo chuột để xoay model", "info");
    }
  }

  setupRotationHandler() {
    this.rotationHandler = new ScreenSpaceEventHandler(this.viewer.canvas);

    let startPosition = null;

    // 🖱️ Khi bắt đầu kéo chuột
    this.rotationHandler.setInputAction((movement) => {
      startPosition = movement.position;
    }, ScreenSpaceEventType.LEFT_DOWN);

    // 🖱️ Khi đang kéo
    this.rotationHandler.setInputAction((movement) => {
      if (!startPosition) return;

      const deltaX = movement.endPosition.x - startPosition.x;
      const deltaY = movement.endPosition.y - startPosition.y;

      if (movement.shiftKey) {
        // 🔄 ROLL
        this.currentRotation.roll =
          (this.currentRotation.roll + deltaX * 0.5) % 360;

        document.getElementById("rotationRoll").value =
          this.currentRotation.roll;
        document.getElementById("rotationRollValue").value = Math.round(
          this.currentRotation.roll,
        );
      } else {
        // 🔄 HEADING
        this.currentRotation.heading =
          (this.currentRotation.heading + deltaX * 0.5) % 360;

        // 🔄 PITCH
        this.currentRotation.pitch = Math.max(
          -90,
          Math.min(90, this.currentRotation.pitch - deltaY * 0.5),
        );

        document.getElementById("rotationHeading").value =
          this.currentRotation.heading;
        document.getElementById("rotationHeadingValue").value = Math.round(
          this.currentRotation.heading,
        );

        document.getElementById("rotationPitch").value =
          this.currentRotation.pitch;
        document.getElementById("rotationPitchValue").value = Math.round(
          this.currentRotation.pitch,
        );
      }

      this.applyRotationToPreview();
      startPosition = movement.endPosition;
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // 🖱️ Khi thả chuột
    this.rotationHandler.setInputAction(() => {
      startPosition = null;
    }, ScreenSpaceEventType.LEFT_UP);
  }

  updatePreviewRotation(key, value) {
    this.currentRotation[key] = value;
    this.applyRotationToPreview();
  }

  applyRotationToPreview() {
    if (!this.previewModel) return;

    const lon = parseFloat(document.getElementById("coordLon").value);
    const lat = parseFloat(document.getElementById("coordLat").value);
    const height = parseFloat(document.getElementById("coordHeight").value);

    const position = Cartesian3.fromDegrees(lon, lat, height);

    const heading = CesiumMath.toRadians(this.currentRotation.heading);
    const pitch = CesiumMath.toRadians(this.currentRotation.pitch);
    const roll = CesiumMath.toRadians(this.currentRotation.roll);

    const hpr = new HeadingPitchRoll(heading, pitch, roll);

    const modelMatrix = Transforms.headingPitchRollToFixedFrame(position, hpr);

    const scale = parseFloat(document.getElementById("modelScale").value);
    Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

    this.previewModel.modelMatrix = modelMatrix;
  }

  clearPreview() {
    if (this.previewModel) {
      this.viewer.scene.primitives.remove(this.previewModel);
      this.previewModel = null;
    }

    if (this.rotationGizmo) {
      this.viewer.entities.remove(this.rotationGizmo);
      this.rotationGizmo = null;
    }

    if (this.rotationHandler) {
      this.rotationHandler.destroy();
      this.rotationHandler = null;
    }

    this.isRotating = false;
    this.currentRotation = { heading: 0, pitch: 0, roll: 0 };
  }

  closeModal() {
    const modal = document.getElementById("uploadModal");
    modal.style.display = "none";
    this.clearPreview();
    this.enableMapInteraction();

    // Reset lại trạng thái chọn vị trí nếu đang chọn
    if (this.isSelectingLocation) {
      this.isSelectingLocation = false;
      if (this.handler) {
        this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
      }
    }
  }

  async submitUpload() {
    const glbFile = document.getElementById("glbFile").files[0];
    const modelName = document.getElementById("modelName").value.trim();
    const modelScale = parseFloat(document.getElementById("modelScale").value);
    const lon = parseFloat(document.getElementById("coordLon").value);
    const lat = parseFloat(document.getElementById("coordLat").value);
    const height = parseFloat(document.getElementById("coordHeight").value);

    // Get rotation in degrees
    const heading = parseFloat(
      document.getElementById("rotationHeadingValue").value,
    );
    const pitch = parseFloat(
      document.getElementById("rotationPitchValue").value,
    );
    const roll = parseFloat(document.getElementById("rotationRollValue").value);

    if (!lon || !lat) {
      this.showError("❌ Vui lòng chọn vị trí trên bản đồ");
      this.showNotification("Vui lòng chọn vị trí trên bản đồ", "error");
      return;
    }

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
      heading,
      pitch,
      roll,
    );
  }

  async uploadModel(file, name, lon, lat, height, scale, heading, pitch, roll) {
    const statusDiv = document.getElementById("uploadStatus");
    const submitBtn = document.getElementById("btnUploadSubmit");

    try {
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
      formData.append("rotation_x", pitch);
      formData.append("rotation_y", roll);
      formData.append("rotation_z", heading);

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
          `❌ Server Error: ${response.status} ${response.statusText}`,
        );
        this.showNotification("Lỗi server: Phản hồi không hợp lệ", "error");
        return;
      }

      const data = await response.json();

      if (response.ok) {
        this.showNotification(`✅ Upload thành công: ${name}`, "success");
        statusDiv.innerHTML = '<p class="success">✅ Upload thành công!</p>';

        setTimeout(() => {
          this.clearPreview();
          this.loadModelRealtime(
            data,
            lon,
            lat,
            height,
            scale,
            heading,
            pitch,
            roll,
          );

          setTimeout(() => {
            this.closeModal();
            this.isUploading = false;
          }, 1000);
        }, 500);
      } else {
        console.error("❌ Upload failed:", data);
        this.showError(data.message || `❌ Lỗi: ${data.error}`);
        this.showNotification(
          `Upload thất bại: ${data.error || "Lỗi không xác định"}`,
          "error",
        );
        this.isUploading = false;
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      this.showError(`❌ Lỗi: ${error.message}`);
      this.showNotification(`Lỗi mạng: ${error.message}`, "error");
      this.isUploading = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  async loadModelRealtime(
    modelData,
    lon,
    lat,
    height,
    scale,
    heading,
    pitch,
    roll,
  ) {
    try {
      this.showNotification("Đang tải model lên bản đồ...", "info");

      const position = Cartesian3.fromDegrees(lon, lat, height);

      const hpr = new HeadingPitchRoll(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch),
        CesiumMath.toRadians(roll),
      );

      const modelMatrix = Transforms.headingPitchRollToFixedFrame(
        position,
        hpr,
      );
      Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

      const model = await Model.fromGltfAsync({
        url: `http://localhost:8000${modelData.url}`,
        modelMatrix: modelMatrix,
      });

      this.viewer.scene.primitives.add(model);
      this.showNotification("Model đã được tải thành công!", "success");

      // Không zoom tự động - model chỉ hiển thị tại vị trí đã chọn
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
        '[name="csrfmiddlewaretoken"]',
      );
      if (csrfElement) {
        cookieValue = csrfElement.value;
      }
    }

    return cookieValue || "";
  }
}

export default UploadModelHandler;
