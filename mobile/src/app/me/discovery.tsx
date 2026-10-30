import { Redirect } from 'expo-router';

/** 예전 주소로 들어와도 계정 관리의 새 자리로 이어 준다 — 웹의 `app/me/discovery/page.tsx` 와 같다. 스위치와 성별은 설정 화면의 몫이다 */
export default function DiscoveryScreen() {
  return <Redirect href={'/me/settings' as never} />;
}
