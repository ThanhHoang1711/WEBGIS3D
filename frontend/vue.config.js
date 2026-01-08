const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  transpileDependencies: true,
  lintOnSave: false,

  configureWebpack: {
    resolve: {
      alias: {
        cesium: path.resolve(__dirname, "node_modules/cesium"),
      },
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "node_modules/cesium/Build/Cesium/Workers",
            to: "Workers",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Assets",
            to: "Assets",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Widgets",
            to: "Widgets",
          },
        ],
      }),
    ],
  },

  publicPath: "./",
};
