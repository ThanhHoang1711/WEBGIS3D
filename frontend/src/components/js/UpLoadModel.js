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
} from "cesium";

export class UploadModelHandler {
  constructor(viewer) {
    this.viewer = viewer;
    this.isSelectingLocation = false;
    this.handler = null;

    // Vị trí đã chọn trên map
    this.selectedCoords = { lon: null, lat: null, height: null };

    // Preview model trên map
    this.previewModel = null;
    this.previewMarker = null; // entity đánh dấu điểm

    // Rotation state
    this.currentRotation = { heading: 0, pitch: 0, roll: 0 };
    this.isRotating = false;
    this.rotationHandler = null;

    // Data từ API
    this.canhOptions = [];
    this.loaiMoHinhOptions = [];

    // File GLB đang chọn
    this.selectedGlbFile = null;

    this.init();
  }

  // ─────────────────────────────────────────
  // INIT: gắn event cho nút btnUpModel
  // ─────────────────────────────────────────
  init() {
    const btn = document.getElementById("btnUpModel");
    if (btn) {
      btn.addEventListener("click", () => this.startFlow());
    }
    this.createModal();
  }

  // ─────────────────────────────────────────
  // STEP 1: Bắt đầu flow -> hiện overlay "click chọn điểm"
  // ─────────────────────────────────────────
  startFlow() {
    this.resetState();
    this.showPickingOverlay();
    this.startLocationSelection();
  }

  // ─────────────────────────────────────────
  // Hiện overlay "Đang chọn vị trí..."
  // ─────────────────────────────────────────
  showPickingOverlay() {
    const overlay = document.getElementById("uploadPickOverlay");
    if (overlay) overlay.style.display = "flex";
  }

  hidePickingOverlay() {
    const overlay = document.getElementById("uploadPickOverlay");
    if (overlay) overlay.style.display = "none";
  }

  // ─────────────────────────────────────────
  // Lắng nghe click trên map -> lấy tọa độ
  // ─────────────────────────────────────────
  startLocationSelection() {
    this.isSelectingLocation = true;
    this.showNotification(
      "📍 Click lên bản đồ để chọn vị trí đặt model",
      "info",
    );

    this.handler = new ScreenSpaceEventHandler(this.viewer.canvas);

    // ESC -> hủy
    this._escHandler = (e) => {
      if (e.key === "Escape") this.cancelFlow();
    };
    document.addEventListener("keydown", this._escHandler);

    this.handler.setInputAction((click) => {
      const cartesian = this.viewer.scene.pickPosition(click.position);
      if (!cartesian) {
        this.showNotification("Không xác định được vị trí, thử lại", "error");
        return;
      }

      const carto = Cartographic.fromCartesian(cartesian);
      this.selectedCoords = {
        lon: CesiumMath.toDegrees(carto.longitude),
        lat: CesiumMath.toDegrees(carto.latitude),
        height: carto.height,
      };

      // Cleanup handler
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
      this.isSelectingLocation = false;
      document.removeEventListener("keydown", this._escHandler);

      // Đánh dấu điểm trên map
      this.addMarker();

      this.showNotification(
        "✅ Đã chọn vị trí. Điền thông tin model.",
        "success",
      );

      // Fetch options rồi mở modal form
      this.hidePickingOverlay();
      this.loadOptions().then(() => {
        this.fillCoordFields();
        this.showModal();
      });
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  cancelFlow() {
    this.isSelectingLocation = false;
    if (this.handler) {
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
      this.handler.destroy();
      this.handler = null;
    }
    if (this._escHandler)
      document.removeEventListener("keydown", this._escHandler);
    this.hidePickingOverlay();
    this.clearPreview();
    this.showNotification("Đã hủy chọn vị trí", "info");
  }

  // ─────────────────────────────────────────
  // Marker đánh dấu điểm đã chọn
  // ─────────────────────────────────────────
  addMarker() {
    this.removeMarker();
    this.previewMarker = this.viewer.entities.add({
      position: Cartesian3.fromDegrees(
        this.selectedCoords.lon,
        this.selectedCoords.lat,
        this.selectedCoords.height,
      ),
      billboard: {
        image: this.createPinImage(), // SVG pin
        verticalOrigin: 1, // BOTTOM
        scale: 1.5,
      },
    });
  }

  removeMarker() {
    if (this.previewMarker) {
      this.viewer.entities.remove(this.previewMarker);
      this.previewMarker = null;
    }
  }

  // Tạo SVG pin đơn giản dùng data URL
  createPinImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="#e53935"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ─────────────────────────────────────────
  // FETCH options từ API
  // ─────────────────────────────────────────
  async loadOptions() {
    try {
      const [canhRes, loaiRes] = await Promise.all([
        fetch("http://localhost:8000/api/canh/options/"),
        fetch("http://localhost:8000/api/loai-mo-hinh/options/"),
      ]);
      const canhData = await canhRes.json();
      const loaiData = await loaiRes.json();

      if (canhData.success) this.canhOptions = canhData.data;
      if (loaiData.success) this.loaiMoHinhOptions = loaiData.data;

      this.renderSelects();
    } catch (err) {
      console.error("❌ loadOptions:", err);
      this.showNotification(
        "Không tải được danh sách cảnh / loại mô hình",
        "error",
      );
    }
  }

  renderSelects() {
    // Cảnh
    const canhSelect = document.getElementById("umCanhSelect");
    if (canhSelect) {
      canhSelect.innerHTML = '<option value="">-- Chọn cảnh --</option>';
      this.canhOptions.forEach((c) => {
        canhSelect.innerHTML += `<option value="${c.ma_canh}">${c.ten_canh}</option>`;
      });
    }

    // Loại mô hình
    const loaiSelect = document.getElementById("umLoaiMoHinhSelect");
    if (loaiSelect) {
      loaiSelect.innerHTML =
        '<option value="">-- Chọn loại mô hình --</option>';
      this.loaiMoHinhOptions.forEach((l) => {
        loaiSelect.innerHTML += `<option value="${l.value}">${l.label}</option>`;
      });
    }
  }

  // ─────────────────────────────────────────
  // Fill tọa độ vào form
  // ─────────────────────────────────────────
  fillCoordFields() {
    document.getElementById("umLon").value = this.selectedCoords.lon.toFixed(6);
    document.getElementById("umLat").value = this.selectedCoords.lat.toFixed(6);
    document.getElementById("umHeight").value =
      this.selectedCoords.height.toFixed(2);
  }

  // ─────────────────────────────────────────
  // MODAL: tạo HTML
  // ─────────────────────────────────────────
  createModal() {
    const html = `
    <!-- Overlay: "Chọn điểm trên bản đồ" -->
    <div id="uploadPickOverlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45);
         z-index:9000; align-items:flex-end; justify-content:center; pointer-events:none;">
      <div style="background:#1e2a3a; color:#fff; padding:14px 28px; border-radius:12px 12px 0 0;
           font-size:16px; display:flex; align-items:center; gap:12px; pointer-events:auto; box-shadow:0 -4px 20px rgba(0,0,0,.4);">
        <span style="font-size:22px;">📍</span>
        <span>Click lên bản đồ để chọn vị trí đặt model</span>
        <button onclick="window.__uploadHandler && window.__uploadHandler.cancelFlow()"
          style="margin-left:auto; background:#e53935; border:none; color:#fff; width:28px; height:28px;
                 border-radius:6px; cursor:pointer; font-size:16px;">✕</button>
      </div>
    </div>

    <!-- Modal Form -->
    <div id="uploadModal" class="um-overlay" style="display:none;">
      <div class="um-modal">

        <!-- Header -->
        <div class="um-header">
          <h3>📦 Thêm Model Lên Bản Đồ</h3>
          <button class="um-close" id="umClose">✕</button>
        </div>

        <!-- Body -->
        <div class="um-body">

          <!-- Tọa độ (readonly) -->
          <div class="um-section um-coords">
            <label>Vị trí đã chọn</label>
            <div class="um-coord-row">
              <div class="um-coord-item">
                <span>Kinh độ</span>
                <input type="text" id="umLon" readonly />
              </div>
              <div class="um-coord-item">
                <span>Vĩ độ</span>
                <input type="text" id="umLat" readonly />
              </div>
              <div class="um-coord-item">
                <span>Độ cao (m)</span>
                <input type="text" id="umHeight" readonly />
              </div>
            </div>
            <!-- Đổi vị trí -->
            <button class="um-btn-reselect" id="umReselect">🔄 Đổi vị trí</button>
          </div>

          <!-- Chọn cảnh -->
          <div class="um-section">
            <label>Cảnh <span class="um-req">*</span></label>
            <select id="umCanhSelect" class="um-select"></select>
          </div>

          <!-- Chọn loại mô hình -->
          <div class="um-section">
            <label>Loại mô hình <span class="um-req">*</span></label>
            <select id="umLoaiMoHinhSelect" class="um-select"></select>
          </div>

          <!-- Chọn loại đối tượng -->
          <div class="um-section">
            <label>Loại đối tượng <span class="um-req">*</span></label>
            <select id="umLoaiDoiTuong" class="um-select">
              <option value="">-- Chọn loại --</option>
              <option value="1">Đối tượng chuyển động</option>
              <option value="2">Cây</option>
              <option value="3">Công trình</option>
            </select>
          </div>

          <!-- Form con: thay đổi theo loại đối tượng -->
          <div id="umDynamicForm" class="um-section um-dynamic"></div>

          <!-- Scale -->
          <div class="um-section um-row">
            <div class="um-col">
              <label>Scale</label>
              <input type="number" id="umScale" value="1" min="0.01" step="0.1" class="um-input" />
            </div>
          </div>

          <!-- Rotation -->
          <div class="um-section">
            <label>Góc xoay</label>
            <div class="um-rotation-grid">
              <div class="um-rot-item">
                <span>Heading (°)</span>
                <input type="range" id="umSliderHeading" min="0" max="360" value="0" step="1" />
                <input type="number" id="umValHeading" value="0" min="0" max="360" step="1" class="um-rot-num" />
              </div>
              <div class="um-rot-item">
                <span>Pitch (°)</span>
                <input type="range" id="umSliderPitch" min="-90" max="90" value="0" step="1" />
                <input type="number" id="umValPitch" value="0" min="-90" max="90" step="1" class="um-rot-num" />
              </div>
              <div class="um-rot-item">
                <span>Roll (°)</span>
                <input type="range" id="umSliderRoll" min="-180" max="180" value="0" step="1" />
                <input type="number" id="umValRoll" value="0" min="-180" max="180" step="1" class="um-rot-num" />
              </div>
            </div>
          </div>

          <!-- Chọn file GLB để preview -->
          <div class="um-section">
            <label>Preview file GLB (tùy chọn)</label>
            <div class="um-file-row">
              <label class="um-file-label" for="umGlbFile">
                <span>📁</span>
                <span id="umGlbFileName">Chọn file .glb</span>
              </label>
              <input type="file" id="umGlbFile" accept=".glb" class="um-file-input" />
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="um-footer">
          <button class="um-btn um-btn-cancel" id="umCancel">Hủy</button>
          <button class="um-btn um-btn-submit" id="umSubmit">
            <span id="umSubmitText">✓ Thêm Model</span>
          </button>
        </div>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
    this.bindModalEvents();
  }

  // ─────────────────────────────────────────
  // Bind events cho modal
  // ─────────────────────────────────────────
  bindModalEvents() {
    // Đóng modal
    document
      .getElementById("umClose")
      .addEventListener("click", () => this.closeModal());
    document
      .getElementById("umCancel")
      .addEventListener("click", () => this.closeModal());
    document.getElementById("uploadModal").addEventListener("click", (e) => {
      if (e.target.id === "uploadModal") this.closeModal();
    });

    // Đổi vị trí -> quay lại chọn điểm
    document.getElementById("umReselect").addEventListener("click", () => {
      this.closeModal();
      this.clearPreview();
      this.showPickingOverlay();
      this.startLocationSelection();
    });

    // Submit
    document
      .getElementById("umSubmit")
      .addEventListener("click", () => this.submitModel());

    // Loại đối tượng thay đổi -> render form con
    document
      .getElementById("umLoaiDoiTuong")
      .addEventListener("change", () => this.renderDynamicForm());

    // Loại mô hình thay đổi -> load preview nếu có file
    document
      .getElementById("umLoaiMoHinhSelect")
      .addEventListener("change", () => {
        this.loadPreviewFromServer();
      });

    // File GLB chọn -> preview
    document.getElementById("umGlbFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.selectedGlbFile = file;
        document.getElementById("umGlbFileName").textContent = file.name;
        this.loadPreviewFromBlob(file);
      }
    });

    // Sync rotation sliders <-> number inputs
    this.syncRotation("umSliderHeading", "umValHeading", "heading");
    this.syncRotation("umSliderPitch", "umValPitch", "pitch");
    this.syncRotation("umSliderRoll", "umValRoll", "roll");

    // Scale change -> update preview
    document
      .getElementById("umScale")
      .addEventListener("input", () => this.applyRotationToPreview());
  }

  syncRotation(sliderId, inputId, key) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    slider.addEventListener("input", () => {
      input.value = slider.value;
      this.currentRotation[key] = parseFloat(slider.value);
      this.applyRotationToPreview();
    });
    input.addEventListener("input", () => {
      slider.value = input.value;
      this.currentRotation[key] = parseFloat(input.value);
      this.applyRotationToPreview();
    });
  }

  // ─────────────────────────────────────────
  // Render form con theo loại đối tượng
  // ─────────────────────────────────────────
  renderDynamicForm() {
    const loai = document.getElementById("umLoaiDoiTuong").value;
    const container = document.getElementById("umDynamicForm");

    const templates = {
      1: `<!-- Đối tượng chuyển động -->
        <div class="um-section">
          <label>Loại <span class="um-req">*</span></label>
          <select id="umLoaiDT" class="um-select">
            <option value="TAU">Tàu</option>
            <option value="XE">Xe</option>
            <option value="MAY_BAY">Máy bay</option>
            <option value="UAV">UAV</option>
          </select>
        </div>
        <div class="um-section">
          <label>Tên đối tượng <span class="um-req">*</span></label>
          <input type="text" id="umTenDoiTuong" placeholder="VD: Tàu A..." class="um-input" />
        </div>
        <div class="um-section um-row">
          <div class="um-col">
            <label>Đường chuyển động</label>
            <input type="text" id="umDuongCDong" placeholder="VD: Route A-B" class="um-input" />
          </div>
          <div class="um-col">
            <label>Vận tốc (km/h)</label>
            <input type="number" id="umVanToc" placeholder="0" step="0.1" class="um-input" />
          </div>
        </div>`,

      2: `<!-- Cây -->
        <div class="um-section">
          <label>Tên loài cây <span class="um-req">*</span></label>
          <input type="text" id="umTenLoai" placeholder="VD: Cây xoài..." class="um-input" />
        </div>
        <div class="um-section um-row">
          <div class="um-col">
            <label>Chiều cao (m)</label>
            <input type="number" id="umCayHeight" placeholder="0" step="0.1" class="um-input" />
          </div>
          <div class="um-col">
            <label>Đường kính (m)</label>
            <input type="number" id="umDuongKinh" placeholder="0" step="0.1" class="um-input" />
          </div>
          <div class="um-col">
            <label>Tuổi (năm)</label>
            <input type="number" id="umTuoi" placeholder="0" step="1" class="um-input" />
          </div>
        </div>`,

      3: `<!-- Công trình -->
        <div class="um-section">
          <label>Tên công trình <span class="um-req">*</span></label>
          <input type="text" id="umTenCongTrinh" placeholder="VD: Tòa nhà A..." class="um-input" />
        </div>
        <div class="um-section um-row">
          <div class="um-col">
            <label>Loại công trình</label>
            <select id="umLoaiCongTrinh" class="um-select">
              <option value="NHA">Nhà</option>
              <option value="CAU">Cầu</option>
              <option value="CANG">Cảng</option>
              <option value="TRAM">Trạm</option>
            </select>
          </div>
          <div class="um-col">
            <label>Cấp bảo mật</label>
            <select id="umCapBaoMat" class="um-select">
              <option value="0">Công khai</option>
              <option value="1">Hạn chế</option>
              <option value="2">Tí mật</option>
            </select>
          </div>
        </div>`,
    };

    container.innerHTML = templates[loai] || "";
  }

  // ─────────────────────────────────────────
  // Preview: load từ file blob (user chọn file)
  // ─────────────────────────────────────────
  async loadPreviewFromBlob(file) {
    try {
      this.clearPreviewModel();
      const blobUrl = URL.createObjectURL(file);
      await this.loadModelAtPosition(blobUrl);
      this.showNotification("Preview model đã tải", "success");
    } catch (err) {
      console.error("❌ preview blob:", err);
      this.showNotification("Lỗi tải preview", "error");
    }
  }

  // Preview: load từ server dựa loại mô hình đã chọn
  async loadPreviewFromServer() {
    const loaiId = document.getElementById("umLoaiMoHinhSelect").value;
    if (!loaiId) return;

    try {
      this.clearPreviewModel();
      const res = await fetch(
        `http://localhost:8000/api/model-types/${loaiId}/`,
      );
      const data = await res.json();
      if (data.success && data.data.url_glb) {
        const url = `http://localhost:8000/media/${data.data.url_glb}`;
        await this.loadModelAtPosition(url);
        this.showNotification("Preview model đã tải từ server", "success");
      }
    } catch (err) {
      console.error("❌ preview server:", err);
    }
  }

  async loadModelAtPosition(url) {
    const { lon, lat, height } = this.selectedCoords;
    const position = Cartesian3.fromDegrees(lon, lat, height);
    const hpr = new HeadingPitchRoll(0, 0, 0);
    const modelMatrix = Transforms.headingPitchRollToFixedFrame(position, hpr);
    const scale = parseFloat(document.getElementById("umScale").value) || 1;
    Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

    this.previewModel = await Model.fromGltfAsync({
      url,
      modelMatrix,
      silhouetteColor: Color.CYAN,
      silhouetteSize: 2.0,
    });
    this.previewModel.color = Color.fromAlpha(Color.WHITE, 0.7);
    this.viewer.scene.primitives.add(this.previewModel);
  }

  // ─────────────────────────────────────────
  // Áp dụng rotation + scale lên preview
  // ─────────────────────────────────────────
  applyRotationToPreview() {
    if (!this.previewModel) return;

    const { lon, lat, height } = this.selectedCoords;
    const position = Cartesian3.fromDegrees(lon, lat, height);
    const hpr = new HeadingPitchRoll(
      CesiumMath.toRadians(this.currentRotation.heading),
      CesiumMath.toRadians(this.currentRotation.pitch),
      CesiumMath.toRadians(this.currentRotation.roll),
    );
    const modelMatrix = Transforms.headingPitchRollToFixedFrame(position, hpr);
    const scale = parseFloat(document.getElementById("umScale").value) || 1;
    Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

    this.previewModel.modelMatrix = modelMatrix;
  }

  // ─────────────────────────────────────────
  // SUBMIT -> POST /api/doi-tuong/create/
  // ─────────────────────────────────────────
  async submitModel() {
    // ── Validate chung ──
    const canhId = document.getElementById("umCanhSelect").value;
    const loaiMoHinhId = document.getElementById("umLoaiMoHinhSelect").value;
    const loaiDoiTuong = document.getElementById("umLoaiDoiTuong").value;

    if (!canhId) {
      this.showNotification("Chọn cảnh", "error");
      return;
    }
    if (!loaiMoHinhId) {
      this.showNotification("Chọn loại mô hình", "error");
      return;
    }
    if (!loaiDoiTuong) {
      this.showNotification("Chọn loại đối tượng", "error");
      return;
    }

    // ── Validate form con ──
    if (!this.validateDynamicForm(loaiDoiTuong)) return;

    // ── Build FormData ──
    const formData = new FormData();
    formData.append("ma_canh_id", canhId);
    formData.append("ma_loai_mo_hinh_id", loaiMoHinhId);
    formData.append("loai_doi_tuong", loaiDoiTuong);
    formData.append("lat", this.selectedCoords.lat);
    formData.append("lon", this.selectedCoords.lon);
    formData.append("height", this.selectedCoords.height);
    formData.append("heading", this.currentRotation.heading);
    formData.append("pitch", this.currentRotation.pitch);
    formData.append("roll", this.currentRotation.roll);
    formData.append("scale", document.getElementById("umScale").value);

    // Thêm fields theo loại
    this.appendDynamicFields(formData, loaiDoiTuong);

    // ── Submit ──
    document.getElementById("umSubmitText").textContent = "⏳ Đang gửi...";
    document.getElementById("umSubmit").disabled = true;

    try {
      const res = await fetch("http://localhost:8000/api/doi-tuong/create/", {
        method: "POST",
        body: formData,
        headers: { "X-CSRFToken": this.getCsrfToken() },
      });

      const data = await res.json();

      if (data.success) {
        this.showNotification("✅ Đã thêm model thành công!", "success");
        // Model đã có trên map (preview) -> chỉ cần xóa silhouette / giữ model
        this.finalizePreview();
        this.closeModal();
      } else {
        this.showNotification("Lỗi: " + (data.error || "Unknown"), "error");
      }
    } catch (err) {
      console.error("❌ submit:", err);
      this.showNotification("Lỗi mạng: " + err.message, "error");
    } finally {
      document.getElementById("umSubmitText").textContent = "✓ Thêm Model";
      document.getElementById("umSubmit").disabled = false;
    }
  }

  // Validate fields trong form con
  validateDynamicForm(loai) {
    if (loai === "1") {
      const ten = document.getElementById("umTenDoiTuong")?.value.trim();
      if (!ten) {
        this.showNotification("Nhập tên đối tượng", "error");
        return false;
      }
    }
    if (loai === "2") {
      const ten = document.getElementById("umTenLoai")?.value.trim();
      if (!ten) {
        this.showNotification("Nhập tên loài cây", "error");
        return false;
      }
    }
    if (loai === "3") {
      const ten = document.getElementById("umTenCongTrinh")?.value.trim();
      if (!ten) {
        this.showNotification("Nhập tên công trình", "error");
        return false;
      }
    }
    return true;
  }

  // Append fields theo loại đối tượng
  appendDynamicFields(formData, loai) {
    if (loai === "1") {
      formData.append(
        "loai_DT",
        document.getElementById("umLoaiDT")?.value || "UNKNOWN",
      );
      formData.append(
        "ten_doi_tuong",
        document.getElementById("umTenDoiTuong")?.value.trim(),
      );
      const duong = document.getElementById("umDuongCDong")?.value.trim();
      if (duong) formData.append("duong_chuyen_dong", duong);
      const vt = document.getElementById("umVanToc")?.value;
      if (vt) formData.append("van_toc", vt);
    }
    if (loai === "2") {
      formData.append(
        "ten_loai",
        document.getElementById("umTenLoai")?.value.trim(),
      );
      const h = document.getElementById("umCayHeight")?.value;
      if (h) formData.append("cay_height", h);
      const dk = document.getElementById("umDuongKinh")?.value;
      if (dk) formData.append("duong_kinh", dk);
      const t = document.getElementById("umTuoi")?.value;
      if (t) formData.append("tuoi", t);
    }
    if (loai === "3") {
      formData.append(
        "ten_cong_trinh",
        document.getElementById("umTenCongTrinh")?.value.trim(),
      );
      formData.append(
        "loai_cong_trinh",
        document.getElementById("umLoaiCongTrinh")?.value || "NHA",
      );
      formData.append(
        "cap_bao_mat",
        document.getElementById("umCapBaoMat")?.value || "0",
      );
    }
  }

  // Sau submit thành công: giữ model trên map, xóa silhouette
  finalizePreview() {
    if (this.previewModel) {
      this.previewModel.silhouetteSize = 0;
      this.previewModel.color = Color.WHITE;
      this.previewModel = null; // không quản lý nữa, để nó tồn tại trên scene
    }
    this.removeMarker();
  }

  // ─────────────────────────────────────────
  // Show / Close modal
  // ─────────────────────────────────────────
  showModal() {
    document.getElementById("uploadModal").style.display = "flex";
  }

  closeModal() {
    document.getElementById("uploadModal").style.display = "none";
    this.clearPreview();
  }

  // ─────────────────────────────────────────
  // Cleanup helpers
  // ─────────────────────────────────────────
  resetState() {
    this.selectedCoords = { lon: null, lat: null, height: null };
    this.currentRotation = { heading: 0, pitch: 0, roll: 0 };
    this.selectedGlbFile = null;
    this.clearPreview();

    // Reset form fields
    const ids = [
      "umScale",
      "umValHeading",
      "umValPitch",
      "umValRoll",
      "umSliderHeading",
      "umSliderPitch",
      "umSliderRoll",
    ];
    const defaults = ["1", "0", "0", "0", "0", "0", "0"];
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.value = defaults[i];
    });

    const selects = ["umCanhSelect", "umLoaiMoHinhSelect", "umLoaiDoiTuong"];
    selects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    document.getElementById("umDynamicForm").innerHTML = "";
    document.getElementById("umGlbFileName").textContent = "Chọn file .glb";
    document.getElementById("umGlbFile").value = "";
  }

  clearPreview() {
    this.clearPreviewModel();
    this.removeMarker();
  }

  clearPreviewModel() {
    if (this.previewModel) {
      this.viewer.scene.primitives.remove(this.previewModel);
      this.previewModel = null;
    }
  }

  // ─────────────────────────────────────────
  // CSRF token
  // ─────────────────────────────────────────
  getCsrfToken() {
    const name = "csrftoken";
    if (document.cookie) {
      for (const cookie of document.cookie.split(";")) {
        const c = cookie.trim();
        if (c.startsWith(name + "="))
          return decodeURIComponent(c.slice(name.length + 1));
      }
    }
    return "";
  }

  // ─────────────────────────────────────────
  // Notification (reuse pattern từ code cũ)
  // ─────────────────────────────────────────
  showNotification(message, type = "info") {
    // Xóa notification cũ
    document.querySelectorAll(".um-notification").forEach((n) => n.remove());

    const colors = {
      success: "#4CAF50",
      error: "#f44336",
      info: "#2196F3",
      warning: "#ff9800",
    };
    const n = document.createElement("div");
    n.className = "um-notification";
    n.textContent = message;
    n.style.cssText = `
      position:fixed; top:16px; right:16px; background:${
        colors[type] || colors.info
      };
      color:#fff; padding:10px 18px; border-radius:6px; z-index:20000;
      font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,.25);
      animation: umSlideIn .25s ease;
      max-width:320px;
    `;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }
}

export default UploadModelHandler;
