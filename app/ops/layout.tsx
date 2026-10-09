import { OpsHeader } from './ops-header';

/**
 * `/ops` 아래 화면 전부의 머리 — 회원 머리글 대신 **운영 머리**(`OpsHeader`)가 선다.
 *
 * 관문은 여기 두지 않는다 — 운영자인가는 각 화면이 자료를 청해 거절당하는 것으로 안다(ADR 0103). 레이아웃은 화면끼리
 * 옮겨 다닐 때 다시 안 돌므로(ADR 0041) 여기서 판정하면 그 판정이 낡는다.
 */
export default function OpsLayout({ children }: LayoutProps<'/ops'>) {
  return (
    <>
      <OpsHeader />
      {children}
    </>
  );
}
