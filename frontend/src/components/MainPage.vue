<template>
  <div class="main-page">
    <!-- MapView chiếm toàn màn hình -->
    <div class="map-container">
      <MapView />
    </div>

    <!-- Sidebar đè lên map ở góc trái -->
    <aside 
      :class="['sidebar-overlay', { 'collapsed': isSidebarCollapsed }]"
      :style="{ width: isSidebarCollapsed ? '60px' : '200px' }"
    >
      <Sidebar
        :is-collapsed="isSidebarCollapsed"
        @menu-selected="handleMenuSelect"
        @toggle-sidebar="toggleSidebar"
        :class="{ 'collapsed': isSidebarCollapsed }" 
      />
    </aside>
  </div>
</template>

<script>
import MapView from "./MapView.vue";
import Sidebar from "./Sidebar.vue";

export default {
  name: "MainPage",
  components: {
    MapView,
    Sidebar
  },
  props: {
    title: {
      type: String,
      default: "Ứng dụng Bản đồ"
    },
    showHeader: {
      type: Boolean,
      default: false // Mặc định không hiện header
    },
    showFooter: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isSidebarCollapsed: false,
      showContentPanel: false,
      selectedMenuItem: null
    };
  },
  methods: {
    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    },
    handleMenuSelect(menuItem) {
      this.selectedMenuItem = menuItem;
      this.showContentPanel = true;
      
      switch(menuItem.id) {
        case 'maps':
          this.showContentPanel = false;
          break;
        case 'layers':
          break;
        case 'analysis':
          break;
      }
    }
  }
};
</script>

<style scoped>
.main-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative; /* Quan trọng: tạo context cho absolute */
}

/* Map chiếm toàn màn hình */
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* Map ở dưới */
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
  z-index: 10; /* Sidebar ở trên map */
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3); /* Đổ bóng cho đẹp */
}

.sidebar-overlay.collapsed {
  width: 60px;
}

/* Header (nếu muốn hiện) */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(248, 249, 250, 0.9); /* Trong suốt */
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
  min-height: 60px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 5; /* Dưới sidebar nhưng trên map */
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
  z-index: 8; /* Dưới sidebar nhưng trên map */
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
    position: fixed; /* Trên mobile dùng fixed */
  }
  
  .sidebar-overlay.collapsed {
    transform: translateX(-100%);
    width: 200px; /* Giữ nguyên width khi ẩn */
  }
  
  .content-panel {
    width: 100%;
  }
}
</style>