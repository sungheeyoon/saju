import { accountNoticeOf, type AccountState } from '@/src/lib/account';

/**
 * 계정이 막혀 있을 때 화면 대신 보는 것.
 *
 * **문구도 판정도 화면이 쓰지 않는다.** 문구는 `src/lib/account` 가 들고(다섯 화면이
 * 저마다 「중지된 계정입니다」를 적고 있었다), 어느 상태인가는 `accountStateOf` 가
 * 답한다(아홉 화면이 저마다 갈랐고 서로 다른 답을 냈다 — ADR 0048).
 *
 * `active` 와 `onboarding` 에는 아무것도 안 그린다. 온보딩은 막힌 것이 아니라 아직 안
 * 한 것이라, 회색 안내문이 아니라 자기 카드를 편다(`Onboarding`).
 */
export function AccountNotice({ state }: { state: AccountState }) {
  const text = accountNoticeOf(state);
  if (text === null) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{text.title}</p>
      <p className="text-sm text-muted">{text.detail}</p>
    </div>
  );
}
