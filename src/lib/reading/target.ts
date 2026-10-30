import type { ReadingKind } from './policy';

/**
 * **풀이의 대상** — 웹의 누름 · 앱의 문(`app/api/mobile`, ADR 0211) · 앱 화면이 같은 네 갈래를 쓴다.
 *
 * RPC 인자와 주소로 푸는 일은 `app/me/reading/target.ts` 가 든다. 여기는 낱말이 가리키는 것과, 문을 건너는 동안의 모양뿐이다.
 */
export type ReadingTarget =
  | { kind: 'self' }
  /** 내가 관리하는 저장된 사람 하나 — `self` 와 같은 자료를 쓰되 접근 판정이 다르다 */
  | { kind: 'person'; personId: string }
  | { kind: 'private'; personA: string; personB: string }
  | { kind: 'match'; matchId: string };

/**
 * **낱말이 갈리면 여기서 컴파일이 깨진다.**
 *
 * `ReadingKind` 는 계약이 드는 네 낱말이고(`policy.ts`), 이 타입은 그 낱말이 무엇을
 * 가리키는지를 든다. 둘이 갈리면 한쪽만 늘어난 채로 배포된다 — 그때 안 늘어난 쪽은
 * 언제나 조용하다.
 */
const _kindsAgree = (kind: ReadingTarget['kind']): ReadingKind => kind;
void _kindsAgree;

/** id 의 모양 — DB 가 uuid 로 거절하면 그 거절이 오류로 선다. 모양이 틀린 것은 문 앞에서 「대상이 아니다」다 */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

/** 문을 건넌 값을 대상으로 — 모르는 갈래 · 빠진 칸 · 모양이 틀린 id 는 `null`. 누구의 것인가는 여기서 안 묻는다(DB 가 묻는다) */
export function readingTargetOf(value: unknown): ReadingTarget | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, personId, personA, personB, matchId } = value as Record<string, unknown>;
  switch (kind) {
    case 'self':
      return { kind };
    case 'person':
      return isId(personId) ? { kind, personId } : null;
    case 'private':
      return isId(personA) && isId(personB) ? { kind, personA, personB } : null;
    case 'match':
      return isId(matchId) ? { kind, matchId } : null;
    default:
      return null;
  }
}

/** 대상을 주소의 쿼리로 — 읽는 문(GET)이 받는다. 되읽기는 `readingTargetOf(Object.fromEntries(params))` 다 */
export function readingTargetQuery(target: ReadingTarget): string {
  return Object.entries(target)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
}

/** 문을 건넌 id 의 모양 — 요청 id 처럼 대상이 아닌 값도 같은 모양이다 */
export const isDoorId = isId;

/** 누름 하나를 가리키는 값의 모양 — 앱이 짓는다(`app/me/reading/pipeline.ts` 의 「두 번 눌러도」) */
export const isRequestKey = isId;

/**
 * 공유할 수 있는 갈래 — **`match` 가 아예 없다.**
 *
 * 인연 궁합은 링크로 못 내보낸다(ADR 0063). 거기 있는 상대는 실재하는 계정이고, 그
 * 사람이 동의한 것은 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가
 * 아니다(ADR 0012).
 *
 * **규칙이지 누락이 아니므로 타입이 그것을 말한다.** 런타임 검사 하나로 두면 그 검사를
 * 잊은 호출부가 컴파일된다.
 */
type ShareableTarget = Exclude<ReadingTarget, { kind: 'match' }>;

export const isShareable = (target: ReadingTarget): target is ShareableTarget =>
  target.kind !== 'match';

/** 공유하는 문이 받는 한 벌 — **`p_match_id` 자리가 아예 없다** */
type ShareTargetArgs = {
  readonly p_kind: ShareableTarget['kind'];
  readonly p_person_a: string | null;
  readonly p_person_b: string | null;
};

/**
 * 공유할 대상을 RPC 인자로.
 *
 * 받는 타입이 `ShareableTarget` 이므로 `match` 는 **여기 올 수 없다.** 그래서 이 함수는
 * 「인연 궁합이면 어쩌지」를 안 묻는다 — 그 물음은 문 앞(`isShareable`)에서 한 번 끝난다.
 */
export function shareTargetArgs(target: ShareableTarget): ShareTargetArgs {
  return {
    p_kind: target.kind,
    p_person_a:
      target.kind === 'private'
        ? target.personA
        : target.kind === 'person'
          ? target.personId
          : null,
    p_person_b: target.kind === 'private' ? target.personB : null,
  };
}
