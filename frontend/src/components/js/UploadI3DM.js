import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Cartesian2,
  Color,
  HeightReference,
  Cesium3DTileset,
} from "cesium";

export class UploadI3DM {
  constructor(viewer) {
    this.viewer = viewer;
    this.csrfToken = null;
    this.allModels = [];
    this.instanceCollections = [];

    // Point selection
    this.isSelectingPoints = false;
    this.selectedPoints = [];
    this.pointEntities = [];
    this.pointSelectionHandler = null;

    window.uploadI3DM = this;
    this.init();
  }

  async init() {
    const btnAddInstances = document.getElementById("btnAddInstances");
    if (btnAddInstances) {
      btnAddInstances.addEventListener("click", () => this.show());
    }

    await this.fetchCsrfToken();
    await this.loadModelsFromServer();
    this.createInstancingPanel();
    this.setupInstancingEvents();
  }

  async fetchCsrfToken() {
    try {
      const response = await fetch("http://localhost:8000/api/csrf-token/", {
        credentials: "include",
      });
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      console.log("🔐 UploadI3DM: CSRF Token fetched");
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
      console.log(`✅ UploadI3DM: Loaded ${this.allModels.length} models`);
    } catch (error) {
      console.error("❌ Error loading models:", error);
    }
  }

  createInstancingPanel() {
    const panelHtml = `
    <div id="instancingPanel" class="i3dm-panel" style="display: none;">
      <div class="i3dm-header">
        <button class="btn-back" id="btnBackFromInstancing" title="Quay lại">←</button>
        <h2>Thêm Nhiều Model</h2>
        <button class="btn-close-panel" id="btnCloseInstancing">&times;</button>
      </div>

      <div class="i3dm-content">
        <!-- Upload Mode Toggle -->
        <div class="upload-mode-toggle">
          <label class="toggle-label">
            <input type="checkbox" id="instanceUploadMode">
            <span>📤 Upload model mới từ máy tính</span>
          </label>
        </div>

        <!-- Existing Model Selection -->
        <div id="existingModelSection" class="form-group">
          <label>Chọn Model Mẫu:</label>
          <select id="instanceModelSelect" class="form-select">
            <option value="">-- Chọn model --</option>
          </select>
        </div>

        <!-- Upload Model Section -->
        <div id="uploadModelSection" class="form-group" style="display: none;">
          <label>Upload File GLB:</label>
          <input type="file" id="instanceGlbFile" accept=".glb">
          <span class="file-info"></span>
        </div>

        <!-- Point Selection Mode -->
        <div class="form-group">
          <div class="instruction-box">
            <h4>🎯 Hướng dẫn:</h4>
            <p>1. Chọn model mẫu hoặc upload file mới</p>
            <p>2. Click "Bắt đầu chọn điểm"</p>
            <p>3. Click trên bản đồ để đặt model</p>
          </div>

          <button id="btnStartPointSelection" class="btn-submit btn-full-width">
            🎯 Bắt đầu chọn điểm
          </button>
          
          <button id="btnStopPointSelection" class="btn-cancel btn-full-width" style="display: none;">
            ⏸️ Dừng chọn điểm
          </button>
        </div>

        <!-- Selected Points List -->
        <div id="selectedPointsSection" class="selected-points-section" style="display: none;">
          <h4>📍 Các điểm đã chọn (<span id="pointCount">0</span>):</h4>
          <div id="selectedPointsList"></div>

          <div class="points-action-buttons">
            <button id="btnClearLastPoint" class="btn-cancel">
              ↶ Xóa điểm cuối
            </button>
            <button id="btnClearAllPoints" class="btn-delete-inst">
              🗑️ Xóa tất cả
            </button>
          </div>
        </div>

        <!-- Instance Settings -->
        <div class="form-group">
          <label>Scale:</label>
          <input type="number" id="instanceScale" value="1" min="0.1" max="10" step="0.1">
          <div class="slider-container">
            <input type="range" id="instanceScaleSlider" min="0.1" max="5" value="1" step="0.1">
            <span id="instanceScaleDisplay">1.0x</span>
          </div>
        </div>

        <!-- Random Variation -->
        <div class="form-group">
          <label>
            <input type="checkbox" id="enableRandomVariation">
            Random Variation (Tạo sự đa dạng)
          </label>
          <div id="randomVariationOptions" class="variation-options" style="display: none;">
            <div class="variation-item">
              <label>Scale Variation (±%):</label>
              <input type="number" id="scaleVariation" value="20" min="0" max="100" step="5">
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="button-group">
          <button id="btnCreateInstances" class="btn-submit" disabled>
            ✓ Tạo Instances (<span id="createPointCount">0</span> điểm)
          </button>
        </div>

        <!-- Instance Management -->
        <div id="instancesList" class="instances-list-section" style="display: none;">
          <h4>📋 Instances Đã Tạo:</h4>
          <div id="instancesListContent" class="instances-list"></div>
        </div>

        <div id="instancingStatus" class="upload-status"></div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML("beforeend", panelHtml);
  }

  setupInstancingEvents() {
    document
      .getElementById("btnBackFromInstancing")
      .addEventListener("click", () => {
        this.stopPointSelection();
        this.hide();
      });

    document
      .getElementById("btnCloseInstancing")
      .addEventListener("click", () => {
        this.stopPointSelection();
        this.hide();
      });

    document
      .getElementById("instanceUploadMode")
      .addEventListener("change", (e) => {
        const isUploadMode = e.target.checked;
        document.getElementById("existingModelSection").style.display =
          isUploadMode ? "none" : "block";
        document.getElementById("uploadModelSection").style.display =
          isUploadMode ? "block" : "none";

        if (isUploadMode) {
          document.getElementById("instanceModelSelect").value = "";
        } else {
          document.getElementById("instanceGlbFile").value = "";
          document.querySelector("#uploadModelSection .file-info").textContent =
            "";
        }
      });

    document
      .getElementById("instanceGlbFile")
      .addEventListener("change", (e) => {
        const fileName = e.target.files[0]?.name || "";
        const fileInfo = document.querySelector(
          "#uploadModelSection .file-info"
        );
        if (fileName) {
          fileInfo.textContent = `✓ ${fileName}`;
          fileInfo.style.color = "#4caf50";
        } else {
          fileInfo.textContent = "";
        }
      });

    document
      .getElementById("btnStartPointSelection")
      .addEventListener("click", () => {
        this.startPointSelection();
      });

    document
      .getElementById("btnStopPointSelection")
      .addEventListener("click", () => {
        this.stopPointSelection();
      });

    document
      .getElementById("btnClearLastPoint")
      .addEventListener("click", () => {
        this.removeLastPoint();
      });

    document
      .getElementById("btnClearAllPoints")
      .addEventListener("click", () => {
        this.clearAllPoints();
      });

    const scaleSlider = document.getElementById("instanceScaleSlider");
    const scaleInput = document.getElementById("instanceScale");
    const scaleDisplay = document.getElementById("instanceScaleDisplay");

    scaleSlider.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      scaleInput.value = value;
      scaleDisplay.textContent = `${value.toFixed(1)}x`;
    });

    scaleInput.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      scaleDisplay.textContent = `${value.toFixed(1)}x`;
      if (value <= 5) {
        scaleSlider.value = value;
      }
    });

    document
      .getElementById("enableRandomVariation")
      .addEventListener("change", (e) => {
        document.getElementById("randomVariationOptions").style.display = e
          .target.checked
          ? "block"
          : "none";
      });

    document
      .getElementById("btnCreateInstances")
      .addEventListener("click", () => {
        this.createInstances();
      });
  }

  show() {
    const panel = document.getElementById("instancingPanel");
    this.populateModelSelect();
    this.clearAllPoints();
    this.stopPointSelection();

    panel.style.display = "flex";
    setTimeout(() => {
      panel.classList.add("active");
    }, 10);
  }

  hide() {
    const panel = document.getElementById("instancingPanel");
    this.stopPointSelection();
    this.clearAllPoints();

    panel.classList.remove("active");
    setTimeout(() => {
      panel.style.display = "none";
    }, 300);
  }

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

  startPointSelection() {
    const isUploadMode = document.getElementById("instanceUploadMode").checked;
    const modelSelect = document.getElementById("instanceModelSelect");
    const fileInput = document.getElementById("instanceGlbFile");

    if (isUploadMode) {
      if (!fileInput.files[0]) {
        alert("⚠️ Vui lòng chọn file GLB trước!");
        return;
      }
    } else {
      if (!modelSelect.value) {
        alert("⚠️ Vui lòng chọn model trước!");
        return;
      }
    }

    this.isSelectingPoints = true;

    document.getElementById("btnStartPointSelection").style.display = "none";
    document.getElementById("btnStopPointSelection").style.display = "block";
    document.getElementById("selectedPointsSection").style.display = "block";

    this.pointSelectionHandler = new ScreenSpaceEventHandler(
      this.viewer.canvas
    );

    this.pointSelectionHandler.setInputAction((click) => {
      const cartesian = this.viewer.scene.pickPosition(click.position);
      if (!cartesian) {
        console.warn("⚠️ Không lấy được vị trí, thử click lại");
        return;
      }

      const cartographic = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      const height = cartographic.height;

      this.addPoint(lon, lat, height, cartesian);
    }, ScreenSpaceEventType.LEFT_CLICK);

    console.log("✅ Point selection mode started");
  }

  stopPointSelection() {
    this.isSelectingPoints = false;

    if (this.pointSelectionHandler) {
      this.pointSelectionHandler.removeInputAction(
        ScreenSpaceEventType.LEFT_CLICK
      );
      this.pointSelectionHandler = null;
    }

    document.getElementById("btnStartPointSelection").style.display = "block";
    document.getElementById("btnStopPointSelection").style.display = "none";

    console.log("⏸️ Point selection stopped");
  }

  addPoint(lon, lat, height, cartesian) {
    const pointIndex = this.selectedPoints.length + 1;

    this.selectedPoints.push({
      lon,
      lat,
      height,
      index: pointIndex,
    });

    const entity = this.viewer.entities.add({
      position: cartesian,
      point: {
        pixelSize: 12,
        color: Color.LIME,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${pointIndex}`,
        font: "bold 14px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cartesian2(0, -20),
        showBackground: true,
        backgroundColor: Color.LIME.withAlpha(0.7),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    this.pointEntities.push(entity);
    this.updatePointsList();

    console.log(
      `🎯 Point ${pointIndex} added: ${lon.toFixed(6)}, ${lat.toFixed(
        6
      )}, ${height.toFixed(2)}m`
    );
  }

  updatePointsList() {
    const pointsList = document.getElementById("selectedPointsList");
    const pointCount = document.getElementById("pointCount");
    const createPointCount = document.getElementById("createPointCount");
    const createBtn = document.getElementById("btnCreateInstances");

    pointCount.textContent = this.selectedPoints.length;
    createPointCount.textContent = this.selectedPoints.length;

    if (this.selectedPoints.length > 0) {
      createBtn.disabled = false;

      pointsList.innerHTML = this.selectedPoints
        .map(
          (p) => `
        <div class="point-item">
          <strong>#${p.index}</strong> - 
          Lon: ${p.lon.toFixed(6)}, 
          Lat: ${p.lat.toFixed(6)}, 
          H: ${p.height.toFixed(2)}m
        </div>
      `
        )
        .join("");
    } else {
      createBtn.disabled = true;
      pointsList.innerHTML = '<p class="empty-message">Chưa có điểm nào</p>';
    }
  }

  removeLastPoint() {
    if (this.selectedPoints.length === 0) return;

    this.selectedPoints.pop();

    const lastEntity = this.pointEntities.pop();
    if (lastEntity) {
      this.viewer.entities.remove(lastEntity);
    }

    this.updatePointsList();
    console.log("↶ Removed last point");
  }

  clearAllPoints() {
    this.selectedPoints = [];

    this.pointEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.pointEntities = [];

    this.updatePointsList();
    console.log("🗑️ Cleared all points");
  }

  async createInstances() {
    if (this.selectedPoints.length === 0) {
      alert("⚠️ Chưa chọn điểm nào!");
      return;
    }

    const isUploadMode = document.getElementById("instanceUploadMode").checked;
    const statusDiv = document.getElementById("instancingStatus");

    let modelId = null;
    let uploadedFile = null;

    if (isUploadMode) {
      uploadedFile = document.getElementById("instanceGlbFile").files[0];
      if (!uploadedFile) {
        alert("⚠️ Chưa chọn file GLB!");
        return;
      }
    } else {
      modelId = document.getElementById("instanceModelSelect").value;
      if (!modelId) {
        alert("⚠️ Chưa chọn model!");
        return;
      }
    }

    const scale = parseFloat(document.getElementById("instanceScale").value);
    const enableVariation = document.getElementById(
      "enableRandomVariation"
    ).checked;
    const scaleVariation =
      parseFloat(document.getElementById("scaleVariation").value) / 100;

    statusDiv.innerHTML = `<p class="loading">⏳ Đang tạo ${this.selectedPoints.length} instances...</p>`;

    try {
      const instances = this.selectedPoints.map((point) => {
        let finalScale = scale;

        if (enableVariation) {
          const variation = (Math.random() * 2 - 1) * scaleVariation;
          finalScale = scale * (1 + variation);
        }

        return {
          lon: point.lon,
          lat: point.lat,
          height: point.height,
          scale: finalScale,
        };
      });

      console.log("📤 Sending instances data:", instances);

      if (isUploadMode) {
        statusDiv.innerHTML = `<p class="loading">⏳ Đang upload model...</p>`;

        const formData = new FormData();
        formData.append("glb_file", uploadedFile);
        formData.append("instances", JSON.stringify(instances));

        const uploadRes = await fetch(
          "http://localhost:8000/api/i3dm/generate-from-upload/",
          {
            method: "POST",
            headers: {
              "X-CSRFToken": this.csrfToken,
            },
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          console.error("Server response:", text);
          throw new Error(`Server error: ${uploadRes.status}`);
        }

        const data = await uploadRes.json();
        const tilesetUrl = `http://localhost:8000${data.tileset_url}`;

        console.log("📥 Loading tileset from:", tilesetUrl);

        const tileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
          maximumScreenSpaceError: 16,
          skipLevelOfDetail: false,
          debugShowBoundingVolume: false,
        });

        this.viewer.scene.primitives.add(tileset);
        await tileset.readyPromise;

        this.instanceCollections.push({
          tileset: tileset,
          id: data.id,
          name: uploadedFile.name,
          count: data.count,
        });

        this.viewer.scene.globe.depthTestAgainstTerrain = true;
        this.viewer.zoomTo(tileset);

        statusDiv.innerHTML = `<p class="success">✅ Đã tạo ${data.count} instances từ file upload!</p>`;
      } else {
        statusDiv.innerHTML = `<p class="loading">⏳ Đang tạo instances...</p>`;

        const res = await fetch(
          "http://localhost:8000/api/i3dm/generate-from-points/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": this.csrfToken,
            },
            body: JSON.stringify({
              model_id: modelId,
              instances: instances,
            }),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("Server response:", text);
          throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        const tilesetUrl = `http://localhost:8000${data.tileset_url}`;

        console.log("📥 Loading tileset from:", tilesetUrl);

        const tileset = await Cesium3DTileset.fromUrl(tilesetUrl, {
          maximumScreenSpaceError: 16,
        });

        this.viewer.scene.primitives.add(tileset);
        await tileset.readyPromise;

        this.instanceCollections.push({
          tileset: tileset,
          id: data.id,
          name: data.model_name,
          count: data.count,
        });

        this.viewer.scene.globe.depthTestAgainstTerrain = true;
        this.viewer.zoomTo(tileset);

        statusDiv.innerHTML = `<p class="success">✅ Đã tạo ${data.count} instances!</p>`;
      }

      this.updateInstancesList();

      setTimeout(() => {
        this.clearAllPoints();
      }, 1000);
    } catch (err) {
      console.error("Full error:", err);
      console.error("Error stack:", err.stack);
      statusDiv.innerHTML = `<p class="error">❌ ${err.message}</p>`;
    }
  }

  updateInstancesList() {
    if (this.instanceCollections.length === 0) {
      document.getElementById("instancesList").style.display = "none";
      return;
    }

    document.getElementById("instancesList").style.display = "block";
    const listContent = document.getElementById("instancesListContent");

    listContent.innerHTML = this.instanceCollections
      .map(
        (item, index) => `
      <div class="instance-item">
        <span>${item.name || "Instance"} (${item.count} models)</span>
        <button class="btn-remove-instance" onclick="window.uploadI3DM.removeInstance(${index})">
          🗑️
        </button>
      </div>
    `
      )
      .join("");
  }

  removeInstance(index) {
    if (index < 0 || index >= this.instanceCollections.length) return;

    const item = this.instanceCollections[index];
    this.viewer.scene.primitives.remove(item.tileset);
    this.instanceCollections.splice(index, 1);

    this.updateInstancesList();
  }
}

export default UploadI3DM;
