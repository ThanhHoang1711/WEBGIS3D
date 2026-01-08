import { createApp } from "vue";
import App from "./App.vue";
window.CESIUM_BASE_URL = "/";
import "cesium/Build/Cesium/Widgets/widgets.css";

import * as Cesium from "cesium";

createApp(App).mount("#app");
