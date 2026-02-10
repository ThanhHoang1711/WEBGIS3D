<template>
  <div class="main-page" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <!-- MapView - v-show để giữ alive khi sang tab khác -->
    <div
      class="content-container full-height"
      v-show="currentView === 'maps' || pickingPosition"
    >
      <MapView ref="mapView" />
    </div>

    <!-- MODEL TYPE MANAGER -->
    <div
      class="content-container full-height"
      v-if="currentView === 'model-manager'"
    >
      <ModelTypeManager />
    </div>

    <!-- ✅ CÁC OBJECT MANAGER RIÊNG BIỆT -->
    <!-- Công Trình Manager -->
    <div
      class="content-container full-height"
      v-show="currentView === 'cong-trinh-manager' && !pickingPosition"
    >
      <CongTrinhManager
        ref="congTrinhManager"
        @request-position-pick="handleRequestPositionPick"
        @navigate-to="handleNavigateTo"
        @object-created="handleObjectCreated"
      />
    </div>

    <!-- Cây Manager -->
    <div
      class="content-container full-height"
      v-show="currentView === 'cay-manager' && !pickingPosition"
    >
      <CayManager
        ref="cayManager"
        @request-position-pick="handleRequestPositionPick"
        @navigate-to="handleNavigateTo"
        @object-created="handleObjectCreated"
      />
    </div>

    <!-- Chuyển Động Manager -->
    <div
      class="content-container full-height"
      v-show="currentView === 'chuyen-dong-manager' && !pickingPosition"
    >
      <ChuyenDongManager
        ref="chuyenDongManager"
        @request-position-pick="handleRequestPositionPick"
        @navigate-to="handleNavigateTo"
        @object-created="handleObjectCreated"
      />
    </div>

    <!-- CÁC VIEW KHÁC -->
    <div
      class="content-container full-height"
      v-if="currentView === 'dashboard'"
    >
      <Dashboard />
    </div>
    <div class="content-container full-height" v-if="currentView === 'reports'">
      <Reports />
    </div>
    <div
      class="content-container full-height"
      v-if="currentView === 'settings'"
    >
      <Settings />
    </div>

    <!-- ✅ OVERLAY: Báo user đang chọn vị trí -->
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
import CongTrinhManager from "./CongTrinhManager.vue";
import CayManager from "./CayManager.vue";
import ChuyenDongManager from "./ChuyenDongManager.vue";
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
    CongTrinhManager,
    CayManager,
    ChuyenDongManager,
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
      pickingPosition: false,
      pickPositionCallback: null,
      pickHandler: null,
      previousView: null, // Lưu view trước khi chọn vị trí
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
        case "cong-trinh-manager":
        case "cay-manager":
        case "chuyen-dong-manager":
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
    // FLOW: Manager yêu cầu chọn vị trí trên bản đồ
    // =========================================================
    handleRequestPositionPick(callback) {
      this.pickPositionCallback = callback;
      this.previousView = this.currentView; // Lưu view hiện tại
      this.pickingPosition = true;
      this.currentView = "maps";

      this.$nextTick(() => {
        this.startPickingOnMap();
      });
    },

    startPickingOnMap() {
      const mapView = this.$refs.mapView;
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

        if (this.pickPositionCallback) {
          this.pickPositionCallback(position);
        }

        this.finishPickPosition();
      }, ScreenSpaceEventType.LEFT_CLICK);

      console.log("📍 Đang chờ click chọn vị trí trên bản đồ...");
    },

    cancelPickPosition() {
      this.finishPickPosition();
      console.log("🚫 Hủy chọn vị trí");
    },

    finishPickPosition() {
      if (this.pickHandler) {
        this.pickHandler.destroy();
        this.pickHandler = null;
      }
      this.pickingPosition = false;
      this.pickPositionCallback = null;

      // Quay về view trước đó
      if (this.previousView) {
        this.currentView = this.previousView;
        this.previousView = null;
      }
    },

    // =========================================================
    // Sau khi Manager tạo model mới → reload map
    // =========================================================
    async handleObjectCreated(maCanh) {
      console.log("📡 Manager created object in scene:", maCanh);
      const mapView = this.$refs.mapView;
      if (mapView && typeof mapView.reloadCurrentScene === "function") {
        await mapView.reloadCurrentScene();
      } else {
        console.warn("⚠️ mapView.reloadCurrentScene không tìm thấy");
      }
    },
  },

  beforeUnmount() {
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

.content-container {
  position: absolute;
  top: 0;
  left: 200px;
  width: calc(100% - 200px);
  height: 100%;
  background-color: #ecf0f1;
  z-index: 1;
  overflow-y: auto;
  padding: 40px;
  transition: left 0.3s ease, width 0.3s ease;
}

.content-container.full-height {
  padding: 0;
  overflow: hidden;
  z-index: 2;
}

.main-page.sidebar-collapsed .content-container {
  left: 60px;
  width: calc(100% - 60px);
}

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

@media (max-width: 768px) {
  .sidebar-overlay {
    position: fixed;
  }

  .sidebar-overlay.collapsed {
    transform: translateX(-100%);
    width: 200px;
  }

  .content-container {
    left: 0;
    width: 100%;
    padding: 20px;
  }

  .content-container.full-height {
    left: 0;
    width: 100%;
  }
}
</style>
