import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Transforms,
  Model,
  ModelInstanceCollection,
  Matrix4,
} from "cesium";

export class ModelManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.models = [];
    this.allModels = [];
    this.selectedModel = null;
    this.isSelectingLocation = false;
    this.handler = null;
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.primitives = new Map();
    this.instanceCollections = []; // ✅ Lưu các instance collections
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

  async loadModelsFromServer() {
    try {
      const response = await fetch("http://localhost:8000/api/models/");
      this.allModels = await response.json();
      console.log(`✅ Loaded ${this.allModels.length} models`);
      this.currentPage = 1;
      this.updatePaginationTable();
      this.loadAllModelsOnMap();
    } catch (error) {
      console.error("❌ Error loading models:", error);
    }
  }

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
          <button id="btnAddInstances" class="btn-add-instances">🔥 Thêm Nhiều</button>
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

      <!-- ✅ UPLOAD PANEL -->
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

      <!-- ✅ INSTANCING PANEL -->
      <div id="instancingPanel" class="upload-panel" style="display: none;">
        <div class="panel-header">
          <button class="btn-back" id="btnBackFromInstancing" title="Quay lại">←</button>
          <h2>🔥 Thêm Nhiều Model (Instancing)</h2>
          <button class="btn-close-panel" id="btnCloseInstancing">&times;</button>
        </div>

        <div class="panel-content">
          <div class="form-group">
            <label>Chọn Model Mẫu:</label>
            <select id="instanceModelSelect" class="form-select">
              <option value="">-- Chọn model --</option>
            </select>
          </div>

          <div class="form-group">
            <label>Vùng Phủ (BBox):</label>
            <div class="coord-grid">
              <div class="coord-item">
                <label>Min Lon:</label>
                <input type="number" id="bboxMinLon" step="0.0001" placeholder="105.0">
              </div>
              <div class="coord-item">
                <label>Max Lon:</label>
                <input type="number" id="bboxMaxLon" step="0.0001" placeholder="105.1">
              </div>
              <div class="coord-item">
                <label>Min Lat:</label>
                <input type="number" id="bboxMinLat" step="0.0001" placeholder="21.0">
              </div>
              <div class="coord-item">
                <label>Max Lat:</label>
                <input type="number" id="bboxMaxLat" step="0.0001" placeholder="21.1">
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Số Lượng Instances:</label>
            <input type="number" id="instanceCount" value="100" min="1" max="10000" step="1">
            <small style="color: #888;">Tối đa 10,000 instances</small>
          </div>

          <div class="form-group">
            <label>Độ Cao (m):</label>
            <input type="number" id="instanceHeight" value="0" step="0.1">
          </div>

          <div class="form-group">
            <label>Scale:</label>
            <input type="number" id="instanceScale" value="1" min="0.1" max="10" step="0.1">
          </div>

          <div class="button-group">
            <button id="btnCreateInstances" class="btn-submit">✓ Tạo Instances</button>
            <button id="btnClearInstances" class="btn-delete-inst">🗑️ Xóa Tất Cả</button>
          </div>

          <div id="instancingStatus" class="upload-status"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", panelHtml);
    this.setupPanelEvents();
    this.setupUploadEvents();
    this.setupInstancingEvents();
  }

  setupPanelEvents() {
    const panel = document.getElementById("modelManagerPanel");

    document.getElementById("btnClosePanel").addEventListener("click", () => {
      panel.classList.remove("active");
    });

    document.getElementById("btnAddNewModel").addEventListener("click", () => {
      this.resetUploadForm();
      this.showUploadPanel();
    });

    // ✅ Nút Thêm Nhiều (Instancing)
    document.getElementById("btnAddInstances").addEventListener("click", () => {
      this.showInstancingPanel();
    });

    document.addEventListener("change", (e) => {
      if (e.target.id === "checkAllModels") {
        const checkboxes = document.querySelectorAll(".model-checkbox");
        checkboxes.forEach((cb) => (cb.checked = e.target.checked));
      }
    });

    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("model-checkbox")) {
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

    document
      .getElementById("btnBackToManager")
      .addEventListener("click", () => {
        this.hideUploadPanel();
      });

    document.getElementById("btnCloseUpload").addEventListener("click", () => {
      this.hideUploadPanel();
    });
  }

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

  // ✅ Setup Instancing Events
  setupInstancingEvents() {
    document
      .getElementById("btnBackFromInstancing")
      .addEventListener("click", () => {
        this.hideInstancingPanel();
      });

    document
      .getElementById("btnCloseInstancing")
      .addEventListener("click", () => {
        this.hideInstancingPanel();
      });

    document
      .getElementById("btnCreateInstances")
      .addEventListener("click", () => {
        this.createInstances();
      });

    document
      .getElementById("btnClearInstances")
      .addEventListener("click", () => {
        this.clearAllInstances();
      });
  }

  // ✅ Hiển thị Instancing Panel
  showInstancingPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const instancingPanel = document.getElementById("instancingPanel");

    // Populate model select
    this.populateModelSelect();

    instancingPanel.style.display = "flex";

    setTimeout(() => {
      managerPanel.classList.add("slide-out");
      instancingPanel.classList.add("slide-in");
    }, 10);
  }

  // ✅ Ẩn Instancing Panel
  hideInstancingPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const instancingPanel = document.getElementById("instancingPanel");
    managerPanel.classList.remove("slide-out");
    instancingPanel.classList.remove("slide-in");

    setTimeout(() => {
      instancingPanel.style.display = "none";
    }, 300);
  }

  // ✅ Populate Model Select Dropdown
  populateModelSelect() {
    const select = document.getElementById("instanceModelSelect");
    select.innerHTML = '<option value="">-- Chọn model --</option>';

    this.allModels.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} (ID: ${model.id})`;
      option.dataset.url = model.url;
      select.appendChild(option);
    });
  }

  // ✅ Tạo Instances
  async createInstances() {
    const modelId = document.getElementById("instanceModelSelect").value;
    const minLon = parseFloat(document.getElementById("bboxMinLon").value);
    const maxLon = parseFloat(document.getElementById("bboxMaxLon").value);
    const minLat = parseFloat(document.getElementById("bboxMinLat").value);
    const maxLat = parseFloat(document.getElementById("bboxMaxLat").value);
    const count = parseInt(document.getElementById("instanceCount").value);
    const height = parseFloat(document.getElementById("instanceHeight").value);
    const scale = parseFloat(document.getElementById("instanceScale").value);

    const statusDiv = document.getElementById("instancingStatus");

    if (
      !modelId ||
      isNaN(minLon) ||
      isNaN(maxLon) ||
      isNaN(minLat) ||
      isNaN(maxLat)
    ) {
      statusDiv.innerHTML =
        '<p class="error">❌ Vui lòng điền đầy đủ thông tin!</p>';
      return;
    }

    if (count < 1 || count > 10000) {
      statusDiv.innerHTML =
        '<p class="error">❌ Số lượng phải từ 1 đến 10,000!</p>';
      return;
    }

    statusDiv.innerHTML = '<p class="loading">⏳ Đang tạo instances...</p>';

    try {
      const selectedOption = document.querySelector(
        `#instanceModelSelect option[value="${modelId}"]`
      );
      const modelUrl = selectedOption.dataset.url;

      console.log(`🔥 Creating ${count} instances of model: ${modelUrl}`);

      // ✅ Tạo danh sách vị trí ngẫu nhiên
      const instances = [];
      for (let i = 0; i < count; i++) {
        const lon = minLon + Math.random() * (maxLon - minLon);
        const lat = minLat + Math.random() * (maxLat - minLat);
        const randomHeight = height + (Math.random() - 0.5) * 10; // Biến thiên ±5m

        const position = Cartesian3.fromDegrees(lon, lat, randomHeight);
        const modelMatrix = Transforms.eastNorthUpToFixedFrame(position);

        // ✅ Apply scale
        const scaleMatrix = Matrix4.fromScale(
          new Cartesian3(scale, scale, scale)
        );
        Matrix4.multiply(modelMatrix, scaleMatrix, modelMatrix);

        instances.push({ modelMatrix });
      }

      // ✅ Tạo ModelInstanceCollection
      const collection = new ModelInstanceCollection({
        url: modelUrl,
        instances: instances,
      });

      this.viewer.scene.primitives.add(collection);
      this.instanceCollections.push(collection);

      statusDiv.innerHTML = `<p class="success">✅ Đã tạo ${count} instances thành công!</p>`;

      console.log(`✅ Created ${count} instances successfully!`);

      setTimeout(() => {
        this.hideInstancingPanel();
      }, 2000);
    } catch (error) {
      console.error("❌ Error creating instances:", error);
      statusDiv.innerHTML = `<p class="error">❌ Lỗi: ${error.message}</p>`;
    }
  }

  // ✅ Xóa tất cả instances
  clearAllInstances() {
    if (this.instanceCollections.length === 0) {
      alert("ℹ️ Không có instances nào để xóa!");
      return;
    }

    if (
      !confirm(
        `❌ Xóa tất cả ${this.instanceCollections.length} instance collections?`
      )
    ) {
      return;
    }

    this.instanceCollections.forEach((collection) => {
      this.viewer.scene.primitives.remove(collection);
    });

    this.instanceCollections = [];

    const statusDiv = document.getElementById("instancingStatus");
    statusDiv.innerHTML = '<p class="success">✅ Đã xóa tất cả instances!</p>';

    console.log("🗑️ Cleared all instances");
  }

  showUploadPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const uploadPanel = document.getElementById("uploadPanel");

    uploadPanel.style.display = "flex";

    setTimeout(() => {
      managerPanel.classList.add("slide-out");
      uploadPanel.classList.add("slide-in");
    }, 10);
  }

  hideUploadPanel() {
    const managerPanel = document.getElementById("modelManagerPanel");
    const uploadPanel = document.getElementById("uploadPanel");
    managerPanel.classList.remove("slide-out");
    uploadPanel.classList.remove("slide-in");

    setTimeout(() => {
      uploadPanel.style.display = "none";
    }, 300);
  }

  toggleManagerPanel() {
    const panel = document.getElementById("modelManagerPanel");
    const isActive = panel.classList.contains("active");

    if (isActive) {
      panel.classList.remove("active");
    } else {
      panel.classList.add("active");
    }
  }

  updatePaginationTable() {
    const tbody = document.getElementById("modelsTableBody");
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.models = this.allModels.slice(start, end);

    if (this.models.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">Chưa có model</td>
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

  goToPage(page) {
    const totalPages = Math.ceil(this.allModels.length / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.updatePaginationTable();
    }
  }

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

  async deleteModel(modelId) {
    if (!confirm("❌ Xác nhận xoá?")) return;

    try {
      const primitive = this.primitives.get(modelId);
      if (primitive) {
        this.viewer.scene.primitives.remove(primitive);
        this.primitives.delete(modelId);
        console.log(`✅ Model removed from map`);
      }

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
