import { Cartesian3, Transforms, Model } from "cesium";

export class ModelManager {
  constructor(viewer) {
    this.viewer = viewer;
    window.modelManager = this;
    this.models = [];
    this.allModels = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.primitives = new Map();
    this.csrfToken = null;

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
      const response = await fetch("http://localhost:8000/api/csrf-token/", {
        credentials: "include",
      });
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      console.log("🔐 ModelManager: CSRF Token fetched");
      return this.csrfToken;
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
    <div id="modelManagerPanel" class="manager-panel">
      <div class="panel-header">
        <h2>🎯 Models</h2>
        <button class="btn-close-panel" id="btnClosePanel">&times;</button>
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
  `;

    document.body.insertAdjacentHTML("beforeend", panelHtml);
    this.setupPanelEvents();
  }

  setupPanelEvents() {
    const panel = document.getElementById("modelManagerPanel");

    document.getElementById("btnClosePanel").addEventListener("click", () => {
      panel.classList.remove("active");
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
          <td colspan="4">Chưa có model</td>
        </tr>
      `;
    } else {
      tbody.innerHTML = this.models
        .map(
          (m) => `
        <tr class="model-row">
          <td width="40">
            <input type="checkbox" class="model-checkbox" data-model-id="${m.id}">
          </td>
          <td class="model-name">${m.name}</td>
          <td class="model-scale">${m.scale}x</td>
          <td class="model-tools">
            <button class="btn-tool btn-zoom" onclick="window.modelManager.zoomToModel(${m.id})" title="Zoom">🔍</button>
            <button class="btn-tool btn-edit" onclick="window.modelManager.editModel(${m.id})" title="Sửa">✏️</button>
            <button class="btn-tool btn-delete" onclick="window.modelManager.deleteModel(${m.id})" title="Xoá">🗑️</button>
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
    if (!confirm("❌ Xác nhận xoá model này?")) return;

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
          headers: { "X-CSRFToken": this.csrfToken },
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

  showManagerStatus(message) {
    const div = document.getElementById("managerStatus");
    div.textContent = message;
    setTimeout(() => (div.textContent = ""), 3000);
  }

  editModel(modelId) {
    console.log("Edit model:", modelId);
    // TODO: Implement edit functionality
  }
}

export default ModelManager;
