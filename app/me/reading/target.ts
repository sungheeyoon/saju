import type { ReadingKind } from '@/src/lib/reading';

/**
 * **kind 가 무엇을 뜻하는지 푸는 자리 — 하나다.**
 *
 * ADR 0033 이 이미 적어 두었다: 「가르는 자리는 `readingTitle`·`readingHref` 하나이고,
 * 갈래가 하나 늘면 그 짝이 함께 는다」. 그런데 지켜지는 자리가 제목과 주소뿐이었고,
 * **같은 네 갈래가 네 자리에서 따로 풀리고 있었다.** 실측이다.
 *
 * | 자리 | 하던 일 |
 * | --- | --- |
 * | `current.ts` | `argsOf(target)` → `p_kind`/`p_person_a`/`p_person_b`/`p_match_id` |
 * | `pipeline.ts` | 같은 삼항 사슬을 `start_reading_run` 호출에 **인라인** |
 * | `share.ts` | 또 한 벌 — **`p_match_id` 가 없다**(ADR 0063) |
 * | `actions.ts` | `revalidatePath` 네 줄이 **바이트가 같다**, 그것도 두 벌 |
 *
 * 세 벌 중 하나만 모양이 달라서 **조용히 썩는다.** 한 벌이 되면 갈래가 늘 때 고칠
 * 자리가 하나다.
 *
 * `revalidatePath` 네 줄은 이제 `refreshPaths` 로 한 문을 지나고, 나머지 액션 스무
 * 곳도 같은 문을 지나게 됐다(ADR 0076). 여기 남는 것은 **대상이 어느 화면을 뜻하나**뿐이다.
 *
 * ## 왜 `src/lib/reading` 이 아닌가
 *
 * 저기는 DB 도 네트워크도 모르는 순수한 절반이다(`policy.ts` 가 그 규율을 적어 뒀다).
 * 여기 있는 것은 **RPC 인자 이름**과 **앱 주소**이고, 둘 다 바깥 세계의 계약이다.
 * `ReadingKind` 는 저기 그대로 두고, 그 낱말이 **무엇을 가리키는가**만 여기서 푼다.
 *
 * 쓰는 모듈(`pipeline.ts`)에서 꺼내 오는 것이 요점이다 — 읽기·화면 여덟이 그리로
 * import 하고 있었고, 그러면 화면 하나가 만드는 쪽 모듈에 매인다.
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
const _kindsAgree: ReadingKind = null as unknown as ReadingTarget['kind'];
void _kindsAgree;

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

/** 네 kind 가 대상을 대는 한 벌 — `my_reading` 계열이 그대로 받는다 */
type ReadingTargetArgs = {
  readonly p_kind: ReadingTarget['kind'];
  readonly p_person_a: string | null;
  readonly p_person_b: string | null;
  readonly p_match_id: string | null;
};

/**
 * 대상을 RPC 인자로 — **`self` 는 아무것도 안 싣는다.**
 *
 * DB 가 스스로 내 selfPerson 을 찾는다(`reading_scope_for`). 앱이 그 id 를 대기
 * 시작하면 「남의 것을 `self` 로 물을 수 있는가」가 생긴다.
 */
export function readingTargetArgs(target: ReadingTarget): ReadingTargetArgs {
  return {
    p_kind: target.kind,
    p_person_a:
      target.kind === 'private'
        ? target.personA
        : target.kind === 'person'
          ? target.personId
          : null,
    p_person_b: target.kind === 'private' ? target.personB : null,
    p_match_id: target.kind === 'match' ? target.matchId : null,
  };
}

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

/**
 * 누르면 가는 곳 — **그 풀이의 화면**이다.
 *
 * 한 사람의 명식과 풀이가 갈라졌으므로 자기·저장한 사람은 풀이 전용 주소로 간다
 * (ADR 0055). 궁합은 이미 결과 화면이 독립되어 있어 그 주소를 그대로 쓴다.
 */
export function readingHrefOf(target: ReadingTarget): string {
  switch (target.kind) {
    case 'self':
      return '/me/readings/self';
    case 'person':
      return `/me/readings/${target.personId}`;
    case 'private':
      return `/me/compat?a=${target.personA}&b=${target.personB}`;
    case 'match':
      return `/me/match/${target.matchId}`;
  }
}

/**
 * 끝난 것을 확인한 자리에서 **무를 곳** (ADR 0016).
 *
 * 화면이 스스로 `router.refresh()` 를 부르지만, 그 왕복이 캐시된 화면을 받으면 **끝난
 * 줄 알면서 옛 글을 세운다.** 무르는 자리와 끝난 것을 확인하는 자리는 하나다.
 *
 * 목록으로 내주는 것이 요점이다 — 부르는 쪽이 네 줄을 손으로 적으면 그 네 줄이 두
 * 자리에 생기고(실제로 그랬다), 갈래가 늘 때 한 자리만 고쳐진다.
 */
export function readingPathsOf(target: ReadingTarget): readonly string[] {
  switch (target.kind) {
    case 'self':
      return ['/me/readings/self'];
    case 'person':
      return [`/me/readings/${target.personId}`];
    /**
     * 비공개 궁합은 **목록 주소를 무른다.** 그 화면은 `?a=…&b=…` 로 열리는데
     * `revalidatePath` 는 질의 문자열을 안 보므로, 경로만 적는 것이 그 화면을 무르는
     * 유일한 길이다.
     */
    case 'private':
      return ['/me/compat'];
    case 'match':
      return [`/me/match/${target.matchId}`];
  }
}
