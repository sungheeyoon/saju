import type { ReadingEntry } from './current';

/**
 * 목록 한 줄이 **뭐라고 적히고 어디로 가는가.**
 *
 * ## 왜 DB 가 아니라 여기인가
 *
 * `my_readings()` 가 내주는 것은 **이름**이고 줄을 짓는 것은 화면의 일이다. 「사주」·
 * 「궁합」·「내 사주」는 사용자 앞에 서는 낱말이라 용어집이 정하고(CONTEXT.md), 그것을
 * DB 반환값에 섞어 두면 문구를 고칠 때마다 마이그레이션이 필요해진다.
 *
 * 반대로 **이름을 화면이 짓지는 않는다.** 이름이 나오는 표가 kind 마다 다르고
 * (`local_label` · `app_user.nickname`), 그것을 화면이 물으면 네 번 묻게 된다.
 *
 * ## 왜 페이지 밖에 있나
 *
 * 네 갈래를 두 번(제목·주소) 가르는 자리라, 갈래 하나가 늘면 두 곳을 고쳐야 한다.
 * 시험이 그 짝을 붙들 수 있게 화면 밖에 둔다.
 */

/** 목록에서 그 줄을 부르는 말 — 「내 사주」·「어머니 사주」·「어머니 × 철수 궁합」 */
export function readingTitle(entry: ReadingEntry): string {
  switch (entry.kind) {
    /**
     * **대상이 나면 이름을 안 쓴다.** `my_readings()` 도 이 줄에는 이름을 안 낸다 —
     * 내 엣지의 `local_label` 은 내가 나를 부르는 말이라, 목록에 「민수 사주」로 서면
     * 저장한 사람의 줄과 구별되지 않는다.
     */
    case 'self':
      return '내 사주';
    case 'person':
      return `${called(entry.labelA)} 사주`;
    case 'private':
      return `${called(entry.labelA)} × ${called(entry.labelB)} 궁합`;
    case 'match':
      return `${called(entry.labelA)} 궁합`;
  }
}

/**
 * 누르면 가는 곳 — **그 대상의 화면**이다.
 *
 * 목록은 결과로 가는 길이지 결과가 서는 자리가 아니다(ADR 0033). 그래서 여는 것은
 * 목록 안의 어떤 칸이 아니라 그 글이 원래 사는 화면이다 — 거기서만 다시 만들기·설문·
 * 「이전 입력」이 한 벌로 서 있다.
 */
export function readingHref(entry: ReadingEntry): string {
  switch (entry.kind) {
    case 'self':
      return '/me';
    case 'person':
      return `/me/people/${entry.personA}`;
    case 'private':
      return `/me/compat?a=${entry.personA}&b=${entry.personB}`;
    case 'match':
      return `/me/match/${entry.matchId}`;
  }
}

/**
 * 날짜만 — 목록에서 분 단위는 읽는 데 방해만 된다.
 *
 * **한 사실에는 한 표기**(CONTEXT.md). 「본 궁합」과 이 목록이 같은 날짜를 다르게 적으면
 * 사용자는 같은 글인지 확인하는 데 눈을 쓴다.
 */
export const readingDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * 이름이 비어 있을 때 — **빈 자리를 남기지 않는다.**
 *
 * `my_readings()` 는 엣지가 있는 줄만 내주므로 여기까지 `null` 이 오지 않는다. 그래도
 * 「 사주」로 서는 줄을 만들 수는 없어서 받아 둔다 — 타입이 `null` 을 허용하는 한
 * 화면 어딘가는 그 값을 그릴 수 있어야 한다.
 */
const called = (label: string | null): string => label ?? '이름 없음';
