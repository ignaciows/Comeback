module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already injects `react-native-worklets/plugin` when the
    // package is installed (babel-preset-expo/build/index.js), so listing it
    // again here is redundant. Verified: both configs emit identical output.
    presets: ['babel-preset-expo'],
  };
};
