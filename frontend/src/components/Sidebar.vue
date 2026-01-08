<template>
  <div class="sidebar">
    <!-- Logo hoặc tiêu đề -->
    <div class="sidebar-header">
      <div id="left-header">
        <img id="logo" :src="require('@/assets/img/mainLogo.png')"/>
        <h3>3D Map</h3>
      </div>      
      <button id="btnZoom" @click="toggleSidebar">
        <img :id="'sidebarZoom'" :src="require('@/assets/img/sidebar.png')" 
             :alt="isCollapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'"
             class="zoom-icon" />
      </button>
    </div>
    
    <!-- Danh sách menu -->
    <nav class="sidebar-menu">
      <ul>
        <li 
          v-for="item in menuItems" 
          :key="item.id"
          :class="{ 'active': activeItem === item.id }"
          @click="selectItem(item)"
        >
          <img 
            v-if="item.icon" 
            :src="getIconPath(item.icon)" 
            :alt="item.title"
            class="menu-icon"
          />
          <span>{{ item.title }}</span>
        </li>
      </ul>
    </nav>
    
    <!-- Footer của sidebar (tuỳ chọn) -->
    <div class="sidebar-footer">
    </div>
  </div>
</template>

<script>
export default {
  name: "Sidebar",
  props: {
    isCollapsed: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      activeItem: 'maps',
      menuItems: [
        { id: 'maps', title: 'Bản đồ', icon: 'map.png' },
        { id: 'dashboard', title: 'Dashboard', icon: 'dashboard.png' },
        { id: 'reports', title: 'Báo cáo', icon: 'reports.png' },
        { id: 'settings', title: 'Cài đặt', icon: 'settings.png' }
      ]
    };
  },
  methods: {
    //Hàm chọn Item
    selectItem(item) {
      this.activeItem = item.id;
      this.$emit('menu-selected', item);
    },

    //Hàm chọn thu nhỏ phòng to sidebar
    toggleSidebar() {
      // Chỉ cần gửi event, CSS sẽ tự động xử lý ẩn/hiện
      this.$emit('toggle-sidebar');
    },

    // Hàm lấy đường dẫn icon
    getIconPath(iconName) {
      return require(`@/assets/img/${iconName}`);
    }
  }
};
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background-color: #2c3e50;
  color: white;
  height: 100%;
  transition: width 0.3s ease;
  width: 200px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.sidebar.collapsed {
  width: 60px;
}

/* SIDEBAR HEADER */
.sidebar-header {
  padding: 15px 20px;
  text-align: center;
  border-bottom: 1px solid #34495e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}

/* Logo và tiêu đề */
#left-header{
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Logo */
#logo {
  height: 35px;
  width: 35px;
  margin-right: 10px;
  flex-shrink: 0;
  transition: opacity 0.3s ease;
}

/* Tiêu đề */
.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
  flex-grow: 1;
  text-align: center;
  transition: opacity 0.3s ease;
}

/* Nút zoom */
#btnZoom {
  height: 24px;
  width: 24px;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

#btnZoom:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.zoom-icon {
  height: 20px;
  width: 20px;
  transition: transform 0.3s ease;
  filter: brightness(0) invert(1); /* Đổi màu trắng */
}

/* ============ QUAN TRỌNG: KHI SIDEBAR COLLAPSED ============ */
/* Khi sidebar còn 60px - Ẩn logo và tiêu đề */
.sidebar.collapsed #logo,
.sidebar.collapsed .sidebar-header h3 {
  opacity: 0;
  visibility: hidden;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: absolute;
}

/* Chỉ hiện nút btnZoom */
.sidebar.collapsed .sidebar-header {
  padding: 15px 0;
  justify-content: center; /* Căn giữa */
}

.sidebar.collapsed #btnZoom {
  margin: 0 auto; /* Căn giữa hoàn toàn */
}

/* MENU ITEMS */
.sidebar-menu {
  flex: 1;
  padding: 20px 0;
}

.sidebar-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-menu li {
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.3s;
}

.sidebar-menu li:hover {
  background-color: #34495e;
}

.sidebar-menu li.active {
  background-color: #3498db;
  border-left: 4px solid #2980b9;
}

/* Khi sidebar collapsed - ẩn text menu */
.sidebar.collapsed .sidebar-menu li span {
  opacity: 0;
  visibility: hidden;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: absolute;
}

/* Icon menu */
.menu-icon {
  height: 20px;
  width: 20px;
  margin-right: 20px;
  object-fit: contain;
  flex-shrink: 0;
  transition: margin 0.3s ease;
}

/* Khi sidebar collapsed - căn giữa icon menu */
.sidebar.collapsed .menu-icon {
  margin-right: 0;
  margin: 0 auto;
}

/* FOOTER */
.sidebar-footer {
  padding: 10px;
  text-align: center;
  border-top: 1px solid #34495e;
  min-height: 40px;
}

/* Ẩn footer khi collapsed để tiết kiệm không gian */
.sidebar.collapsed .sidebar-footer {
  display: none;
}
</style>