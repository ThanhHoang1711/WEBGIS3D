/* eslint-disable */
<template>
  <div class="map-wrapper">
    <!-- Cesium container -->
    <div id="cesiumContainer"></div>

    <!-- Các nút thao tác -->
    <div id="btnContainer">
      <button id="btnMeasure">
        <img id="imgMeasure" :src="require('@/assets/img/measure.png')"/>
      </button>
    </div>

    <!-- Panel hiện nút đo chiều cao và nút lấy tọa độ điểm -->
    <div id="panelMeasure">
      <div class="divMeasure">
        <button id="btnHeight" @click="toggleHeightMeasure">
          <img :src="require('@/assets/img/measure.png')"/>
          {{ measureActive ? "Tắt Đo chiều cao" : "Đo chiều cao" }}
        </button>
        <label class="labelMeasure">Đo chiều cao</label>
      </div>

      <div class="divMeasure">
        <button id="btnLocate" @click="toggleLocatePoint">
          <img :src="require('@/assets/img/measure.png')"/>
          {{ locateActive ? "Tắt Lấy tọa độ" : "Lấy tọa độ" }}
        </button>
        <label class="labelMeasure">Lấy tọa độ</label>
      </div>
      
      <div class="divMeasure">
        <button id="btnStopMeasure" @click="clearAllMeasurements">
          <img :src="require('@/assets/img/measure.png')"/>
        </button>
        <label class="labelMeasure">Xóa phép đo</label>
      </div>
    </div>

    <!-- Các nút thao tác -->
    <button id="openAttr" @click="toggleAttr">
      {{ attrActive ? "Tắt Thuộc tính" : "Thuộc tính" }}
    </button>

    <button id="btnBasemap">🗺️</button>
    <button id="btnSeaRise">🌊</button>
    <button id="btnModel">📦</button>

    <!-- Bảng thuộc tính -->
    <div id="attributeTable" v-show="attrVisible">
      <div class="attr-header">
        <span id="attr-title">BẢNG THUỘC TÍNH</span>
        <button id="closeAttr" @click="attrVisible = false">×</button>
      </div>
      <table id="attr-content">
        <tbody v-html="attrContent"></tbody>
      </table>
    </div>

    <button id="openViewshed" @click="toggleViewshed">
      {{ viewshedActive ? "Tắt Viewshed" : "Viewshed" }}
    </button>

    <!-- Viewshed bằng VcAnalyses -->
    <vc-analyses v-if="viewshedActive" ref="vcViewshed" analysis-type="viewshed" />
  </div>
</template>


<script>
import "./css/MapView.css";
import "./css/ModelManager.css";
import "./css/UpLoadModel.css";
import MapLogic from "./js/Map.js";
export default MapLogic;
</script>

<style scoped>
</style>
