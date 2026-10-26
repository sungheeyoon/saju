/**
 * 선택 동의를 **끄기 전에 묻는가** — 끄는 것이 곧 남긴 것을 지우는 동의만 묻는다(ADR 0022 「2026-10-25 덧」).
 *
 * 「풀이 개선에 답변 활용」은 끄면 `set_improvement_consent` 가 같은 트랜잭션에서 남긴 설문 답변(풀이 의견 · 서비스 설문)을 지운다.
 * 스위치는 누르면 곧 적용되는 손잡이라, 묻지 않으면 손이 스친 한 번에 되돌릴 수 없는 삭제가 났다(운영자 2026-10-24).
 * 「다음 테스트 소식 받기」는 끄면 앞으로 안 보낼 뿐 지우는 것이 없어 묻지 않는다. 켜는 쪽은 잃을 것이 없어 묻지 않는다.
 */
export function asksBeforeTurningOff(key: 'improvement' | 'contact', next: boolean): boolean {
  return key === 'improvement' && next === false;
}

/**
 * 묻는 창의 글자 — 대장 `docs/product/copy-ledger/settings.md` settings-08(확인 전).
 *
 * 본문 첫 줄은 줄 아래 글(`OPTIONAL_CONSENTS` 의 `erasure`)을 그대로 쓴다 — 같은 사실은 상수 하나. 되돌릴 수 없다는 줄은 다른 확인 창과
 * 같은 해요체 · 같은 자리(`ConfirmDialog` 의 `irreversible`)다 — 「삭제한 사진은 되돌릴 수 없어요.」와 같은 꼴(대장 all-04, #852).
 */
export const IMPROVEMENT_OFF_TITLE = '풀이 개선에 답변 활용을 끌까요?';
export const IMPROVEMENT_OFF_IRREVERSIBLE = '삭제한 답변은 되돌릴 수 없어요.';
export const IMPROVEMENT_OFF_CONFIRM = '끄고 삭제하기';
export const IMPROVEMENT_OFF_PENDING = '삭제하는 중…';
