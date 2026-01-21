<template>
  <div class="main-page">
    <!-- MapView - CHỈ HIỆN KHI CHỌN "Bản đồ" -->
    <div class="map-container" v-if="currentView === 'maps'">
      <MapView />
    </div>

    <!-- ✅ DIV MỚI - HIỆN KHI CHỌN Dashboard/Reports/Settings -->
    <div class="content-container" v-else>
      <Dashboard v-if="currentView === 'dashboard'" />
      <Reports v-if="currentView === 'reports'" />
      <Settings v-if="currentView === 'settings'" />
    </div>

    <!-- Sidebar đè lên map ở góc trái - GIỮ NGUYÊN CODE CŨ -->
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

// Import các component mới
import Dashboard from "./Dashboard.vue";
import Reports from "./Reports.vue";
import Settings from "./Settings.vue";

export default {
  name: "MainPage",
  components: {
    MapView,
    Sidebar,
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
      currentView: "maps", // ✅ THÊM: Quản lý view hiện tại
    };
  },
  methods: {
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    },
    handleMenuSelect(menuItem) {
      this.selectedMenuItem = menuItem;

      // ✅ THÊM: Chuyển đổi view dựa trên menu
      this.currentView = menuItem.id;

      // Giữ lại logic cũ nếu cần
      switch (menuItem.id) {
        case "maps":
          this.showContentPanel = false;
          break;
        case "dashboard":
        case "reports":
        case "settings":
          this.showContentPanel = true;
          break;
        default:
          this.showContentPanel = false;
      }
    },
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

/* ✅ THÊM: Content container cho Dashboard/Reports/Settings */
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
  padding-left: 240px; /* 200px sidebar + 40px margin */
  transition: padding-left 0.3s ease;
}

/* Khi sidebar collapsed */
.sidebar-overlay.collapsed ~ .content-container {
  padding-left: 100px; /* 60px sidebar + 40px margin */
}

/* Sidebar đè lên map - GIỮ NGUYÊN */
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

/* Header (nếu muốn hiện) */
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

/* Responsive design */
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
}
</style>
