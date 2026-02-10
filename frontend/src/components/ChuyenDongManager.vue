<template>
  <div class="chuyen-dong-manager">
    <div class="manager-container">
      <div class="manager-header">
        <h2>🚗 Quản Lý Đối Tượng Chuyển Động</h2>
        <p>Trang quản lý các đối tượng chuyển động trên bản đồ</p>
      </div>

      <div class="manager-content">
        <div class="placeholder-message">
          <div class="placeholder-icon">🚀</div>
          <h3>Chức năng đang được phát triển</h3>
          <p>Nội dung chi tiết sẽ được bổ sung sau</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ChuyenDongManager",
  data() {
    return {
      // Dữ liệu sẽ được thêm sau
    };
  },
  mounted() {
    console.log("✅ ChuyenDongManager mounted");
  },
  methods: {
    // Các phương thức sẽ được thêm sau
  },
};
</script>

<style scoped>
.chuyen-dong-manager {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manager-container {
  width: 90%;
  max-width: 800px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 40px;
}

.manager-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e8ecef;
}

.manager-header h2 {
  margin: 0 0 10px 0;
  font-size: 32px;
  color: #2c3e50;
}

.manager-header p {
  margin: 0;
  font-size: 16px;
  color: #7f8c8d;
}

.manager-content {
  padding: 40px 0;
}

.placeholder-message {
  text-align: center;
}

.placeholder-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.placeholder-message h3 {
  font-size: 24px;
  color: #34495e;
  margin: 0 0 10px 0;
}

.placeholder-message p {
  font-size: 16px;
  color: #95a5a6;
  margin: 0;
}
</style>
