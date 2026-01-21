<template>
  <div class="settings">
    <h1>⚙️ Cài đặt</h1>
    <p>Đây là trang Cài đặt</p>

    <div class="placeholder-content">
      <div class="setting-box">Cài đặt chung</div>
      <div class="setting-box">Cài đặt bảo mật</div>
      <div class="setting-box">Cài đặt hiển thị</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Settings",
};
</script>

<style scoped>
.settings {
  width: 100%;
  height: 100%;
}

.settings h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 30px;
}

.setting-box {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 18px;
  color: #7f8c8d;
}
</style>
