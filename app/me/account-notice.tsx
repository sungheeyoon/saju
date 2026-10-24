import { accountFailureOf, accountNoticeOf, type AccountState } from '@/src/lib/account';
import { SUPPORT_EMAIL } from '@/src/lib/brand';

import { FailureLine } from '../ui/failure-line';

/**
 * 계정이 막혀 있을 때 화면 대신 보는 것.
 *
 * **문구도 판정도 화면이 쓰지 않는다.** 문구는 `src/lib/account` 가 들고(다섯 화면이
 * 저마다 「이용이 정지된 계정입니다」를 적고 있었다), 어느 상태인가는 `accountStateOf` 가
 * 답한다(아홉 화면이 저마다 갈랐고 서로 다른 답을 냈다 — ADR 0048).
 *
 * **못 읽었으면 실패 줄이다**(ADR 0164, G-100) — 회색 상자는 다른 안내와 구별이 안 됐고 다시 읽을 길이 없었다. 행이 없으면
 * 「다시 로그인」, 못 닿았으면 「다시 시도하기」. 정지 · 탈퇴 대기는 실패가 아니라 상태라 상자 그대로다.
 *
 * `active` 와 `onboarding` 에는 아무것도 안 그린다. 온보딩은 막힌 것이 아니라 아직 안
 * 한 것이라, 회색 안내문이 아니라 자기 카드를 편다(`Onboarding`).
 */
export function AccountNotice({ state }: { state: AccountState }) {
  const failure = accountFailureOf(state);
  if (failure !== null) {
    return (
      <FailureLine retry={failure.next === 'retry'} signIn={failure.next === 'signIn'}>
        {failure.line}
      </FailureLine>
    );
  }

  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  if (text === null) return null;

  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface px-5 py-4">
      <p className="text-body font-semibold text-foreground">{text.title}</p>
      <p className="text-sm text-secondary">{text.detail}</p>
    </div>
  );
}
