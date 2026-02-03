<template>
  <div class="main-page">
    <!-- MapView - v-show để giữ alive khi sang tab khác -->
    <div
      class="map-container"
      v-show="currentView === 'maps' || pickingPosition"
    >
      <MapView ref="mapView" />
    </div>

    <!-- MODEL TYPE MANAGER -->
    <div class="map-container" v-if="currentView === 'model-manager'">
      <ModelTypeManager />
    </div>

    <!-- OBJECT MANAGER - v-show để giữ alive khi nhảy về map chọn vị trí -->
    <div
      class="content-container full-height"
      v-show="currentView === 'object-manager' && !pickingPosition"
    >
      <ObjectManager
        ref="objectManager"
        @request-position-pick="handleRequestPositionPick"
        @navigate-to="handleNavigateTo"
        @object-created="handleObjectCreated"
      />
    </div>

    <!-- CÁC VIEW KHÁC — v-if độc lập, không dùng v-else -->
    <div class="content-container" v-if="currentView === 'dashboard'">
      <Dashboard />
    </div>
    <div class="content-container" v-if="currentView === 'reports'">
      <Reports />
    </div>
    <div class="content-container" v-if="currentView === 'settings'">
      <Settings />
    </div>

    <!-- ✅ OVERLAY: Báo user đang chọn vị trí cho ObjectManager -->
    <div v-if="pickingPosition" class="pick-position-overlay">
      <div class="pick-position-banner">
        <span class="pick-icon">📍</span>
        <span class="pick-text">Click lên bản đồ để chọn vị trí đối tượng</span>
        <button class="pick-cancel" @click="cancelPickPosition">✕ Hủy</button>
      </div>
    </div>

    <!-- Sidebar -->
    <aside
      :class="['sidebar-overlay', { collapsed: isSidebarCollapsed }]"
      :style="{ width: isSidebarCollapsed ? '60px' : '200px' }"
    >
      <Sidebar
        :is-collapsed="isSidebarCollapsed"
        @menu-selected="handleMenuSelect"
        @toggle-sidebar="toggleSidebar"
        :class="{ collapsed: isSidebarCollapsed }"
      />
    </aside>
  </div>
</template>

<script>
import MapView from "./MapView.vue";
import Sidebar from "./Sidebar.vue";
import ModelTypeManager from "./ModelTypeManager.vue";
import ObjectManager from "./ObjectManager.vue";
import Dashboard from "./Dashboard.vue";
import Reports from "./Reports.vue";
import Settings from "./Settings.vue";

// ✅ Import Cesium classes cần để lắng nghe click trên map
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
} from "cesium";

export default {
  name: "MainPage",
  components: {
    MapView,
    Sidebar,
    ModelTypeManager,
    ObjectManager,
    Dashboard,
    Reports,
    Settings,
  },
  props: {
    title: {
      type: String,
      default: "Ứng dụng Bản đồ",
    },
    showHeader: {
      type: Boolean,
      default: false,
    },
    showFooter: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isSidebarCollapsed: false,
      showContentPanel: false,
      selectedMenuItem: null,
      currentView: "maps",

      // ✅ State cho flow chọn vị trí
      pickingPosition: false, // đang ở mode chọn điểm trên map
      pickPositionCallback: null, // callback để trả kết quả về ObjectManager
      pickHandler: null, // ScreenSpaceEventHandler
    };
  },
  methods: {
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    },

    handleMenuSelect(menuItem) {
      this.selectedMenuItem = menuItem;
      this.currentView = menuItem.id;
      console.log(`✅ Switched to view: ${menuItem.id}`);

      switch (menuItem.id) {
        case "maps":
          this.showContentPanel = false;
          break;
        case "model-manager":
        case "object-manager":
        case "dashboard":
        case "reports":
        case "settings":
          this.showContentPanel = true;
          break;
        default:
          this.showContentPanel = false;
      }
    },

    handleNavigateTo(viewId) {
      this.currentView = viewId;
    },

    // =========================================================
    // FLOW: ObjectManager yêu cầu chọn vị trí trên bản đồ
    // =========================================================

    // 1. ObjectManager emit 'request-position-pick' kèm callback
    handleRequestPositionPick(callback) {
      this.pickPositionCallback = callback;
      this.pickingPosition = true; // hiện map, ẩn ObjectManager
      this.currentView = "maps"; // đảm bảo map container hiện

      // Chờ một tick để MapView render, rồi gắn handler
      this.$nextTick(() => {
        this.startPickingOnMap();
      });
    },

    // 2. Gắn click handler lên Cesium viewer
    startPickingOnMap() {
      const mapView = this.$refs.mapView;
      // Truy vào viewer từ MapView component
      // Map.js export default có this.viewer -> truy bằng $data hoặc direct
      const viewer = mapView?.viewer;

      if (!viewer) {
        console.warn("⚠️ Viewer chưa sẵn sàng, thử lại sau 500ms");
        setTimeout(() => this.startPickingOnMap(), 500);
        return;
      }

      this.pickHandler = new ScreenSpaceEventHandler(viewer.canvas);

      this.pickHandler.setInputAction((click) => {
        const cartesian = viewer.scene.pickPosition(click.position);
        if (!cartesian) {
          console.warn("Không xác định được vị trí");
          return;
        }

        const carto = Cartographic.fromCartesian(cartesian);
        const position = {
          lat: parseFloat(CesiumMath.toDegrees(carto.latitude).toFixed(6)),
          lon: parseFloat(CesiumMath.toDegrees(carto.longitude).toFixed(6)),
          height: parseFloat(carto.height.toFixed(2)),
        };

        console.log("✅ Đã chọn vị trí:", position);

        // 3. Trả kết quả về ObjectManager qua callback
        if (this.pickPositionCallback) {
          this.pickPositionCallback(position);
        }

        // 4. Cleanup và quay về ObjectManager
        this.finishPickPosition();
      }, ScreenSpaceEventType.LEFT_CLICK);

      console.log("📍 Đang chờ click chọn vị trí trên bản đồ...");
    },

    // 3. Hủy chọn vị trí (click nút Hủy trên overlay)
    cancelPickPosition() {
      this.finishPickPosition();
      this.currentView = "object-manager"; // quay về ObjectManager
      console.log("🚫 Hủy chọn vị trí");
    },

    // 4. Cleanup chung
    finishPickPosition() {
      if (this.pickHandler) {
        this.pickHandler.destroy();
        this.pickHandler = null;
      }
      this.pickingPosition = false;
      this.pickPositionCallback = null;

      // Quay về object-manager
      this.currentView = "object-manager";
    },
    // =========================================================
    // Sau khi ObjectManager tạo model mới → reload map
    // =========================================================
    async handleObjectCreated(maCanh) {
      console.log("📡 ObjectManager created object in scene:", maCanh);
      const mapView = this.$refs.mapView;
      if (mapView && typeof mapView.reloadCurrentScene === "function") {
        await mapView.reloadCurrentScene();
      } else {
        console.warn("⚠️ mapView.reloadCurrentScene không tìm thấy");
      }
    },
  },

  beforeUnmount() {
    // Dọn dẹp handler nếu còn
    if (this.pickHandler) {
      this.pickHandler.destroy();
      this.pickHandler = null;
    }
  },
};
</script>

<style scoped>
.main-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* Map chiếm toàn màn hình */
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Content container cho Dashboard/Reports/Settings */
.content-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #ecf0f1;
  z-index: 1;
  overflow-y: auto;
  padding: 40px;
  padding-left: 240px;
  transition: padding-left 0.3s ease;
}

/* Full height cho Object Manager */
.content-container.full-height {
  padding: 0;
  padding-left: 200px;
  overflow: hidden;
  z-index: 2; /* đè lên map khi hiện */
}

/* Khi sidebar collapsed */
.sidebar-overlay.collapsed ~ .content-container {
  padding-left: 100px;
}

.sidebar-overlay.collapsed ~ .content-container.full-height {
  padding-left: 60px;
}

/* Sidebar đè lên map */
.sidebar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #2c3e50;
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
}

.sidebar-overlay.collapsed {
  width: 60px;
}

/* ✅ Overlay báo chọn vị trí */
.pick-position-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: none;
}

.pick-position-banner {
  background: #1e2a3a;
  color: #fff;
  padding: 14px 28px;
  border-radius: 12px 12px 0 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
}

.pick-icon {
  font-size: 22px;
}

.pick-cancel {
  margin-left: auto;
  background: #e53935;
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pick-cancel:hover {
  background: #c62828;
}

/* Header */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(248, 249, 250, 0.9);
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
  min-height: 60px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 5;
}

.main-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

/* Panel nội dung phụ */
.content-panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 350px;
  height: 100%;
  background-color: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  z-index: 8;
  overflow-y: auto;
  padding: 20px;
}

/* Footer */
.main-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: rgba(248, 249, 250, 0.9);
  padding: 0.5rem;
  border-top: 1px solid #dee2e6;
  min-height: 40px;
  z-index: 5;
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar-overlay {
    position: fixed;
  }

  .sidebar-overlay.collapsed {
    transform: translateX(-100%);
    width: 200px;
  }

  .content-panel {
    width: 100%;
  }

  .content-container {
    padding: 20px;
    padding-left: 20px;
  }

  .content-container.full-height {
    padding-left: 0;
  }
}
</style>
