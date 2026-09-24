import { WarningNotice } from './warning/warning-notice';

/**
 * `/me` 아래 화면 전부의 머리 — **경고 안내 하나만 든다** (ADR 0108).
 *
 * 관문은 여기 두지 않는다(ADR 0041 — 레이아웃은 자기 아래 화면끼리 옮겨 다닐 때 다시 안 돈다). 안내는 그 성질이 맞다:
 * 앱에 들어온 첫 문서 적재에서 서고, 화면을 옮겨도 그대로 남으며, 「확인했습니다」가 레이아웃째 무르면(`refresh`) 내려간다.
 * 무엇을 볼 수 있는가는 여기서 안 정한다 — 이용이 정지된 계정에 안 서는 것도 문(`my_warning_notice`)이 정한다.
 */
export default function MeLayout({ children }: LayoutProps<'/me'>) {
  return (
    <>
      <WarningNotice />
      {children}
    </>
  );
}
