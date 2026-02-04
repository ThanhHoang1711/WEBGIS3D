<template>
  <div class="reports">
    <h1>📈 Báo cáo</h1>
    <p>Đây là trang Báo cáo</p>

    <div class="placeholder-content">
      <div class="report-item">Báo cáo 1</div>
      <div class="report-item">Báo cáo 2</div>
      <div class="report-item">Báo cáo 3</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Reports",
};
</script>

<style scoped>
.reports {
  width: 98.3%;
  height: 97%;
  padding: 10px;
}

.reports h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 30px;
}

.report-item {
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 18px;
  color: #7f8c8d;
}
</style>
