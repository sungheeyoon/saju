const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 저장소 뿌리는 npm workspace 가 아니라 Expo 가 자동으로 못 찾는다 — 웹과 함께 쓰는 순수 로직을 들여다본다. `app/` 은 DB 거절을 옮기는 `db-error.ts` 때문이다
config.watchFolders = [path.resolve(__dirname, '../src/lib'), path.resolve(__dirname, '../app')];
// 그 코드의 패키지(astronomy-engine)도 앱의 것을 쓴다 — 웹의 node_modules 를 안 탄다
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
