import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Transforms,
  Model,
} from "cesium";

export class ModelManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.models = [];
    this.allModels = []; // ✅ Lưu tất cả models
    this.selectedModel = null;
    this.isSelectingLocation = false;
    this.handler = null;
    this.currentPage = 1; // ✅ Phân trang
    this.itemsPerPage = 10; // ✅ 10 items/trang
    this.primitives = new Map(); // ✅ Map model ID -> primitive
    this.init();
  }

  init() {
    const btnModel = document.getElementById("btnModel");
    if (btnModel) {
      btnModel.addEventListener("click", () => this.toggleManagerPanel());
    }

    this.fetchCsrfToken();
    this.createManagerPanel();
    this.loadModelsFromServer();
  }

  /**
   * ✅ Fetch CSRF token
   */
  async fetchCsrfToken() {
    try {
      const response = await fetch("http://localhost:8000/api/csrf-token/");
      const data = await response.json();
      console.log("🔐 CSRF Token fetched");
      return data.csrfToken;
    } catch (error) {
      console.error("❌ Failed to fetch CSRF token:", error);
      return null;
    }
  }

  /**
   * ✅ Load models từ server
   */
  async loadModelsFromServer() {
    try {
      const response = await fetch("http://localhost:8000/api/models/");
      this.allModels = await response.json();
      console.log(`✅ Loaded ${this.allModels.length} models`);
      this.currentPage = 1; // ✅ Reset trang
      this.updatePaginationTable();
      this.loadAllModelsOnMap();
    } catch (error) {
      console.error("❌ Error loading models:", error);
    }
  }

  /**
   * ✅ Load tất cả models lên bản đồ
   */
  async loadAllModelsOnMap() {
    try {
      for (const modelData of this.allModels) {
        if (!this.primitives.has(modelData.id)) {
          const position = Cartesian3.fromDegrees(
            modelData.lon,
            modelData.lat,
            modelData.height
          );
          const modelMatrix = Transforms.eastNorthUpToFixedFrame(position);

          const model = await Model.fromGltfAsync({
            url: modelData.url,
            modelMatrix: modelMatrix,
            scale: modelData.scale || 1,
          });

          const primitive = this.viewer.scene.primitives.add(model);
          this.primitives.set(modelData.id, primitive);
          console.log(`✅ Loaded on map: ${modelData.name}`);
        }
      }
    } catch (error) {
      console.error("❌ Error loading models on map:", error);
    }
  }

  /**
   * Tạo giao diện quản lý - Sidebar
   */
  createManagerPanel() {
    const panelHtml = `
      <!-- ✅ SIDEBAR PANEL -->
      <div id="modelManagerPanel" class="manager-panel">
        <div class="panel-header">
          <h2>🎯 Models</h2>
          <button class="btn-close-panel" id="btnClosePanel">&times;</button>
        </div>

        <!-- Toolbar -->
        <div class="panel-toolbar">
          <button id="btnAddNewModel" class="btn-add-new">➕ Thêm</button>
          <button id="btnConvert3DTiles" class="btn-convert-3d">🔄 Convert 3DTiles</button>
        </div>

        <!-- Bảng models (phân trang) -->
        <div class="panel-content">
          <table class="models-table">
            <thead>
              <tr>
                <th width="40">
                  <input type="checkbox" id="checkAllModels" title="Chọn tất cả">
                </th>
                <th>Tên</th>
                <th>Tỷ Lệ</th>
                <th>Rotation</th>
                <th>Công Cụ</th>
              </tr>
            </thead>
            <tbody id="modelsTableBody">
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="panel-pagination" id="paginationControls">
        </div>

        <!-- Status -->
        <div id="managerStatus" class="manager-status"></div>
      </div>

      <!-- ✅ UPLOAD POPUP (Không overlay) -->
      <div id="uploadPanel" class="upload-panel" style="display: none;">
        <div class="panel-header">
          <button class="btn-back" id="btnBackToManager" title="Quay lại">←</button>
          <h2>📦 Upload</h2>
          <button class="btn-close-panel" id="btnCloseUpload">&times;</button>
        </div>

        <div class="panel-content">
          <div class="coordinates-display">
            <div class="coord-item">
              <label>Lon:</label>
              <input type="number" id="coordLon" readonly step="0.0001">
            </div>
            <div class="coord-item">
              <label>Lat:</label>
              <input type="number" id="coordLat" readonly step="0.0001">
            </div>
            <div class="coord-item">
              <label>Height:</label>
              <input type="number" id="coordHeight" readonly step="0.01">
            </div>
          </div>

          <button id="btnSelectLocation" class="btn-select">📍 Chọn Vị Trí</button>

          <div class="form-group">
            <label>Tên:</label>
            <input type="text" id="modelName" placeholder="Tên model">
          </div>

          <div class="form-group">
            <label>Scale:</label>
            <input type="number" id="modelScale" value="1" min="0.1" step="0.1">
          </div>

          <div class="rotation-controls">
            <h4>Góc Xoay</h4>
            <div class="rotation-item">
              <label>X:</label>
              <input type="number" id="rotationX" value="0" min="0" max="360" step="1">
            </div>
            <div class="rotation-item">
              <label>Y:</label>
              <input type="number" id="rotationY" value="0" min="0" max="360" step="1">
            </div>
            <div class="rotation-item">
              <label>Z:</label>
              <input type="number" id="rotationZ" value="0" min="0" max="360" step="1">
            </div>
          </div>

          <div class="form-group">
            <label>File:</label>
            <input type="file" id="glbFile" accept=".glb">
            <span class="file-info"></span>
          </div>

          <div class="button-group">
            <button id="btnUploadSubmit" class="btn-submit">✓ Upload</button>
          </div>

          <div id="uploadStatus" class="upload-status"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", panelHtml);
    this.setupPanelEvents();
    this.setupUploadEvents();
  }

  /**
   * Setup events cho manager panel
   */
  setupPanelEvents() {
    const panel = document.getElementById("modelManagerPanel");
    const uploadPanel = document.getElementById("uploadPanel");
    const tbody = document.getElementById("modelsTableBody");

    // Đóng panel
    document.getElementById("btnClosePanel").addEventListener("click", () => {
      panel.classList.remove("active");
    });

    // Nút thêm mới
    document.getElementById("btnAddNewModel").addEventListener("click", () => {
      this.resetUploadForm();
      this.showUploadPanel();
    });

    // ✅ Nút Convert 3DTiles
    document
      .getElementById("btnConvert3DTiles")
      .addEventListener("click", () => {
        // Lấy các model được chọn
        const checkboxes = document.querySelectorAll(".model-checkbox:checked");
        const selectedIds = Array.from(checkboxes).map((cb) =>
          parseInt(cb.dataset.modelId)
        );

        if (selectedIds.length === 0) {
          alert("❌ Vui lòng chọn ít nhất 1 model để convert!");
          return;
        }

        if (window.glbConvert3Dtiles) {
          // Gửi danh sách model được chọn
          window.glbConvert3Dtiles.setSelectedModels(selectedIds);
          window.glbConvert3Dtiles.showConvertPanel();
        } else {
          alert("❌ GlbConvert3Dtiles chưa được khởi tạo!");
        }
      });

    // ✅ Check all / Uncheck all - dùng event delegation
    document.addEventListener("change", (e) => {
      if (e.target.id === "checkAllModels") {
        const checkboxes = document.querySelectorAll(".model-checkbox");
        checkboxes.forEach((cb) => (cb.checked = e.target.checked));
      }
    });

    // ✅ Individual checkbox change - dùng event delegation
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("model-checkbox")) {
        // Cập nhật check all button
        const checkAllBtn = document.getElementById("checkAllModels");
        const totalCheckboxes =
          document.querySelectorAll(".model-checkbox").length;
        const checkedCheckboxes = document.querySelectorAll(
          ".model-checkbox:checked"
        ).length;

        if (checkAllBtn) {
          checkAllBtn.checked =
            totalCheckboxes === checkedCheckboxes && totalCheckboxes > 0;
          checkAllBtn.indeterminate =
            checkedCheckboxes > 0 && checkedCheckboxes < totalCheckboxes;
        }
      }
    });

    // Quay lại từ upload
    document
      .getElementById("btnBackToManager")
      .addEventListener("click", () => {
        this.hideUploadPanel();
      });

    // Đóng upload panel
    document.getElementById("btnCloseUpload").addEventListener("click", () => {
      this.hideUploadPanel();
    });
  }

  /**
   * ✅ Hiển thị upload panel
   */
  showUploadPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const uploadPanel = document.getElementById("uploadPanel");

    // Ensure panel is visible
    uploadPanel.style.display = "flex";

    // Trigger animation
    setTimeout(() => {
      managerPanel.classList.add("slide-out");
      uploadPanel.classList.add("slide-in");
    }, 10);
  }

  /**
   * ✅ Ẩn upload panel
   */
  hideUploadPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const uploadPanel = document.getElementById("uploadPanel");
    managerPanel.classList.remove("slide-out");
    uploadPanel.classList.remove("slide-in");

    setTimeout(() => {
      uploadPanel.style.display = "none";
    }, 300);
  }

  /**
   * Setup events cho upload popup
   */
  setupUploadEvents() {
    const uploadPanel = document.getElementById("uploadPanel");
    const fileInput = document.getElementById("glbFile");

    document
      .getElementById("btnSelectLocation")
      .addEventListener("click", () => {
        this.startLocationSelection();
      });

    fileInput.addEventListener("change", (e) => {
      const fileName = e.target.files[0]?.name || "";
      const fileInfo = uploadPanel.querySelector(".file-info");
      if (fileName) {
        fileInfo.textContent = `✓ ${fileName}`;
        fileInfo.style.color = "#4caf50";
      }
    });

    document.getElementById("btnUploadSubmit").addEventListener("click", () => {
      this.submitUpload();
    });
  }

  /**
   * ✅ Toggle manager panel
   */
  toggleManagerPanel() {
    const panel = document.getElementById("modelManagerPanel");
    const isActive = panel.classList.contains("active");

    if (isActive) {
      // Đóng panel
      panel.classList.remove("active");
    } else {
      // Mở panel
      panel.classList.add("active");
    }
  }
  /**
   * ✅ Update bảng với phân trang
   */
  updatePaginationTable() {
    const tbody = document.getElementById("modelsTableBody");
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.models = this.allModels.slice(start, end);

    if (this.models.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="4">Chưa có model</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = this.models
        .map(
          (m) => `
        <tr class="model-row">
          <td width="40">
            <input type="checkbox" class="model-checkbox" data-model-id="${
              m.id
            }">
          </td>
          <td class="model-name">${m.name}</td>
          <td class="model-scale">${m.scale}x</td>
          <td class="model-rotation">${m.rotation.x.toFixed(
            0
          )}°/${m.rotation.y.toFixed(0)}°/${m.rotation.z.toFixed(0)}°</td>
          <td class="model-tools">
            <button class="btn-tool btn-zoom" onclick="window.modelManager.zoomToModel(${
              m.id
            })" title="Zoom">🔍</button>
            <button class="btn-tool btn-edit" onclick="window.modelManager.editModel(${
              m.id
            })" title="Sửa">✏️</button>
            <button class="btn-tool btn-delete" onclick="window.modelManager.deleteModel(${
              m.id
            })" title="Xoá">🗑️</button>
          </td>
        </tr>
      `
        )
        .join("");
    }

    this.updatePaginationControls();
  }

  /**
   * ✅ Update controls phân trang
   */
  updatePaginationControls() {
    const totalPages = Math.ceil(this.allModels.length / this.itemsPerPage);
    const controlsDiv = document.getElementById("paginationControls");

    let html = "";
    if (totalPages > 1) {
      html += `<button class="btn-page ${
        this.currentPage === 1 ? "disabled" : ""
      }" onclick="window.modelManager.goToPage(${
        this.currentPage - 1
      })">&lt;</button>`;

      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="btn-page ${
          this.currentPage === i ? "active" : ""
        }" onclick="window.modelManager.goToPage(${i})">${i}</button>`;
      }

      html += `<button class="btn-page ${
        this.currentPage === totalPages ? "disabled" : ""
      }" onclick="window.modelManager.goToPage(${
        this.currentPage + 1
      })">&gt;</button>`;
    }

    controlsDiv.innerHTML = html;
  }

  /**
   * ✅ Go to page
   */
  goToPage(page) {
    const totalPages = Math.ceil(this.allModels.length / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.updatePaginationTable();
    }
  }

  /**
   * Chọn vị trí trên bản đồ
   */
  startLocationSelection() {
    this.isSelectingLocation = true;
    const btn = document.getElementById("btnSelectLocation");
    btn.textContent = "📍 Chọn...";
    btn.disabled = true;

    this.handler = new ScreenSpaceEventHandler(this.viewer.canvas);

    const onLeftClick = (click) => {
      const cartesian = this.viewer.scene.pickPosition(click.position);
      if (!cartesian) return;

      const cartographic = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      document.getElementById("coordLon").value = lon.toFixed(6);
      document.getElementById("coordLat").value = lat.toFixed(6);
      document.getElementById("coordHeight").value = height.toFixed(2);

      this.isSelectingLocation = false;
      this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
      btn.textContent = "📍 Chọn Vị Trí";
      btn.disabled = false;

      console.log(`📍 Vị trí: ${lon.toFixed(6)}, ${lat.toFixed(6)}`);
    };

    this.handler.setInputAction(onLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  }

  /**
   * Submit upload
   */
  async submitUpload() {
    const file = document.getElementById("glbFile").files[0];
    const name = document.getElementById("modelName").value.trim();
    const lon = parseFloat(document.getElementById("coordLon").value);
    const lat = parseFloat(document.getElementById("coordLat").value);
    const height = parseFloat(document.getElementById("coordHeight").value);
    const scale = parseFloat(document.getElementById("modelScale").value);
    const rotX = parseFloat(document.getElementById("rotationX").value);
    const rotY = parseFloat(document.getElementById("rotationY").value);
    const rotZ = parseFloat(document.getElementById("rotationZ").value);

    if (!file || !name) {
      this.showUploadStatus("❌ Điền đầy đủ", "error");
      return;
    }

    const statusDiv = document.getElementById("uploadStatus");
    statusDiv.innerHTML = '<p class="loading">⏳ Uploading...</p>';

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

    try {
      const response = await fetch("http://localhost:8000/api/upload-glb/", {
        method: "POST",
        body: formData,
        headers: { "X-CSRFToken": this.getCsrfToken() },
      });

      const data = await response.json();

      if (response.ok) {
        statusDiv.innerHTML = '<p class="success">✅ Thành công!</p>';
        this.loadModelRealtime(data, lon, lat, height, scale);

        setTimeout(() => {
          this.hideUploadPanel();
          this.loadModelsFromServer();
        }, 1500);
      } else {
        this.showUploadStatus(`❌ ${data.error}`, "error");
      }
    } catch (error) {
      this.showUploadStatus(`❌ ${error.message}`, "error");
    }
  }

  /**
   * ✅ Zoom tới model
   */
  zoomToModel(modelId) {
    const model = this.allModels.find((m) => m.id === modelId);
    if (!model) return;

    const position = Cartesian3.fromDegrees(
      model.lon,
      model.lat,
      model.height + 100
    );

    this.viewer.camera.flyTo({
      destination: position,
      duration: 1,
    });

    console.log(`🔍 Zoomed to: ${model.name}`);
  }

  /**
   * ✅ Delete model (xoá trên map luôn)
   */
  async deleteModel(modelId) {
    if (!confirm("❌ Xác nhận xoá?")) return;

    try {
      // ✅ Xoá trên bản đồ ngay
      const primitive = this.primitives.get(modelId);
      if (primitive) {
        this.viewer.scene.primitives.remove(primitive);
        this.primitives.delete(modelId);
        console.log(`✅ Model removed from map`);
      }

      // Xoá trên server
      const response = await fetch(
        `http://localhost:8000/api/models/${modelId}/delete/`,
        {
          method: "DELETE",
          headers: { "X-CSRFToken": this.getCsrfToken() },
        }
      );

      if (response.ok) {
        console.log("✅ Deleted from server!");
        this.showManagerStatus("✅ Xoá thành công!");
        // ✅ Cập nhật bảng mà không reload
        this.allModels = this.allModels.filter((m) => m.id !== modelId);
        if (this.models.length === 0 && this.currentPage > 1) {
          this.currentPage--;
        }
        this.updatePaginationTable();
      }
    } catch (error) {
      this.showManagerStatus(`❌ ${error.message}`);
    }
  }

  /**
   * Reset form upload
   */
  resetUploadForm() {
    document.getElementById("coordLon").value = "";
    document.getElementById("coordLat").value = "";
    document.getElementById("coordHeight").value = "";
    document.getElementById("modelName").value = "";
    document.getElementById("modelScale").value = "1";
    document.getElementById("rotationX").value = "0";
    document.getElementById("rotationY").value = "0";
    document.getElementById("rotationZ").value = "0";
    document.getElementById("glbFile").value = "";
    document.querySelector(".file-info").textContent = "";
    document.getElementById("uploadStatus").innerHTML = "";
  }

  /**
   * Load model realtime
   */
  async loadModelRealtime(modelData, lon, lat, height, scale) {
    try {
      const position = Cartesian3.fromDegrees(lon, lat, height);
      const modelMatrix = Transforms.eastNorthUpToFixedFrame(position);

      const model = await Model.fromGltfAsync({
        url: `http://localhost:8000${modelData.url}`,
        modelMatrix: modelMatrix,
        scale: scale || 1,
      });

      const primitive = this.viewer.scene.primitives.add(model);
      this.primitives.set(modelData.id, primitive);
      console.log("✅ Model loaded!");
    } catch (error) {
      console.error("❌ Error loading model:", error);
    }
  }

  showManagerStatus(message) {
    const div = document.getElementById("managerStatus");
    div.textContent = message;
    setTimeout(() => (div.textContent = ""), 3000);
  }

  showUploadStatus(message, type = "error") {
    const div = document.getElementById("uploadStatus");
    div.innerHTML = `<p class="${type}">${message}</p>`;
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

    return cookieValue || "";
  }
}

export default ModelManager;
