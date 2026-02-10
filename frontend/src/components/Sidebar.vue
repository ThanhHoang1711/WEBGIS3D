<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Logo hoặc tiêu đề -->
    <div class="sidebar-header">
      <div id="left-header">
        <img id="logo" :src="require('@/assets/img/mainLogo.png')" />
        <h3>3D Map</h3>
      </div>
      <button id="btnZoom" @click="toggleSidebar">
        <img
          :id="'sidebarZoom'"
          :src="require('@/assets/img/sidebar.png')"
          :alt="isCollapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'"
          class="zoom-icon"
        />
      </button>
    </div>

    <!-- Danh sách menu -->
    <nav class="sidebar-menu">
      <ul>
        <li
          v-for="item in menuItems"
          :key="item.id"
          :class="{
            active: activeItem === item.id || isParentActive(item),
            'has-submenu': item.children && item.children.length > 0,
          }"
        >
          <!-- Menu Item chính -->
          <div class="menu-item" @click="selectItem(item)">
            <div class="menu-item-content">
              <img
                v-if="item.icon"
                :src="getIconPath(item.icon)"
                :alt="item.title"
                class="menu-icon"
              />
              <span class="menu-title">{{ item.title }}</span>
            </div>
            <!-- Icon mũi tên dropdown nếu có submenu -->
            <span
              v-if="item.children && item.children.length > 0"
              class="dropdown-arrow"
              :class="{ expanded: expandedMenus.includes(item.id) }"
            >
              ▼
            </span>
          </div>

          <!-- Submenu (nếu có) -->
          <transition name="submenu">
            <ul
              v-if="
                item.children &&
                item.children.length > 0 &&
                expandedMenus.includes(item.id)
              "
              class="submenu"
            >
              <li
                v-for="child in item.children"
                :key="child.id"
                :class="{ active: activeItem === child.id }"
                @click.stop="selectItem(child)"
              >
                <div class="submenu-item">
                  <img
                    v-if="child.icon"
                    :src="getIconPath(child.icon)"
                    :alt="child.title"
                    class="menu-icon"
                  />
                  <span class="menu-title">{{ child.title }}</span>
                </div>
              </li>
            </ul>
          </transition>
        </li>
      </ul>
    </nav>

    <!-- Footer của sidebar (tuỳ chọn) -->
    <div class="sidebar-footer"></div>
  </div>
</template>

<script>
export default {
  name: "Sidebar",
  props: {
    isCollapsed: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      activeItem: "maps",
      expandedMenus: [], // Danh sách các menu đang được mở rộng
      menuItems: [
        {
          id: "maps",
          title: "Bản đồ",
          icon: "map.png",
        },
        {
          id: "model-manager",
          title: "Quản lý MH",
          icon: "dashboard.png",
        },
        {
          id: "object-manager",
          title: "Quản lý ĐT",
          icon: "dashboard.png",
          children: [
            {
              id: "cong-trinh-manager",
              title: "Công trình",
              icon: "reports.png",
            },
            {
              id: "cay-manager",
              title: "Cây",
              icon: "reports.png",
            },
            {
              id: "chuyen-dong-manager",
              title: "Chuyển động",
              icon: "reports.png",
            },
          ],
        },
        {
          id: "dashboard",
          title: "Dashboard",
          icon: "dashboard.png",
        },
        {
          id: "reports",
          title: "Báo cáo",
          icon: "reports.png",
        },
        {
          id: "settings",
          title: "Cài đặt",
          icon: "settings.png",
        },
      ],
    };
  },
  methods: {
    // Hàm chọn Item
    selectItem(item) {
      // Nếu item có submenu
      if (item.children && item.children.length > 0) {
        // Toggle mở/đóng submenu
        const index = this.expandedMenus.indexOf(item.id);
        if (index > -1) {
          this.expandedMenus.splice(index, 1);
        } else {
          this.expandedMenus.push(item.id);
        }
        // Không emit menu-selected cho parent menu
        return;
      }

      // Nếu là item bình thường (không có submenu)
      this.activeItem = item.id;
      this.$emit("menu-selected", item);
    },

    // Kiểm tra xem menu cha có đang active không (khi con của nó active)
    isParentActive(item) {
      if (!item.children || item.children.length === 0) return false;
      return item.children.some((child) => child.id === this.activeItem);
    },

    // Hàm thu nhỏ/phóng to sidebar
    toggleSidebar() {
      this.$emit("toggle-sidebar");
    },

    // Hàm lấy đường dẫn icon
    getIconPath(iconName) {
      return require(`@/assets/img/${iconName}`);
    },
  },
  watch: {
    // Khi sidebar collapse, đóng tất cả submenu
    isCollapsed(newVal) {
      if (newVal) {
        this.expandedMenus = [];
      }
    },
  },
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
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
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
#left-header {
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
  filter: brightness(0) invert(1);
}

/* ============ KHI SIDEBAR COLLAPSED ============ */
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

.sidebar.collapsed .sidebar-header {
  padding: 15px 0;
  justify-content: center;
}

.sidebar.collapsed #btnZoom {
  margin: 0 auto;
}

/* MENU ITEMS */
.sidebar-menu {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.sidebar-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar-menu > ul > li {
  position: relative;
}

/* Menu Item Container */
.menu-item {
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.3s;
}

.menu-item:hover {
  background-color: #34495e;
}

.menu-item-content {
  display: flex;
  align-items: center;
  flex: 1;
}

/* Active state */
.sidebar-menu > ul > li.active > .menu-item {
  background-color: #3498db;
  border-left: 4px solid #2980b9;
}

/* Icon menu */
.menu-icon {
  height: 20px;
  width: 20px;
  margin-right: 12px;
  object-fit: contain;
  flex-shrink: 0;
  transition: margin 0.3s ease;
}

.menu-title {
  transition: opacity 0.3s ease;
}

/* Dropdown arrow */
.dropdown-arrow {
  font-size: 10px;
  transition: transform 0.3s ease;
  margin-left: auto;
}

.dropdown-arrow.expanded {
  transform: rotate(-180deg);
}

/* ============ SUBMENU STYLES ============ */
.submenu {
  list-style: none;
  padding: 0;
  margin: 0;
  background-color: #1a252f;
  overflow: hidden;
}

.submenu-item {
  padding: 10px 20px 10px 45px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background-color 0.3s;
  font-size: 14px;
}

.submenu-item:hover {
  background-color: #273746;
}

.submenu li.active .submenu-item {
  background-color: #2980b9;
  border-left: 3px solid #3498db;
}

.submenu .menu-icon {
  height: 16px;
  width: 16px;
  margin-right: 10px;
}

/* Submenu transition */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
}

.submenu-enter-from,
.submenu-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ============ KHI SIDEBAR COLLAPSED - ẨN TEXT ============ */
.sidebar.collapsed .menu-title {
  opacity: 0;
  visibility: hidden;
  width: 0;
  height: 0;
  position: absolute;
}

.sidebar.collapsed .dropdown-arrow {
  display: none;
}

.sidebar.collapsed .menu-icon {
  margin-right: 0;
  margin: 0 auto;
}

.sidebar.collapsed .menu-item {
  justify-content: center;
  padding: 12px 0;
}

.sidebar.collapsed .submenu {
  display: none;
}

/* FOOTER */
.sidebar-footer {
  padding: 10px;
  text-align: center;
  border-top: 1px solid #34495e;
  min-height: 40px;
}

.sidebar.collapsed .sidebar-footer {
  display: none;
}

/* Scrollbar styling */
.sidebar-menu::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background: #1a252f;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background: #34495e;
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-thumb:hover {
  background: #4a5f7f;
}
</style>
