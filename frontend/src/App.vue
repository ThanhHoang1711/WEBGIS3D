<template>
  <div id="app">
    <MainPage 
      title="Bản đồ của tôi"
      :show-header="true"
      :show-footer="false"
    />
  </div>
</template>

<script>
import MainPage from "./components/MainPage.vue";

export default {
  name: "App",
  components: {
    MainPage,
  },
};
</script>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
