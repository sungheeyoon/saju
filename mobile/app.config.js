/**
 * `app.json` 위에 환경마다 다른 값만 얹는다. iOS 의 URL 스킴은 Google iOS 클라이언트가 생긴 뒤에 넣는다 — 값이 없으면 안드로이드만 빌드한다.
 */
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    plugins: [
      ...config.plugins.filter(
        (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== '@react-native-google-signin/google-signin',
      ),
      iosUrlScheme
        ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
        : '@react-native-google-signin/google-signin',
    ],
  };
};
