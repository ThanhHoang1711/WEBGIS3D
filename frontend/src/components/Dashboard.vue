<template>
  <div class="dashboard">
    <h1>📊 Dashboard</h1>
    <p>Đây là trang Dashboard</p>

    <div class="placeholder-content">
      <div class="box">Box 1</div>
      <div class="box">Box 2</div>
      <div class="box">Box 3</div>
      <div class="box">Box 4</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Dashboard",
};
</script>

<style scoped>
.dashboard {
  width: 98.3%;
  height: 97%;
  padding: 10px;
}

.dashboard h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.placeholder-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.box {
  background: white;
  padding: 40px;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 18px;
  color: #7f8c8d;
}
</style>
