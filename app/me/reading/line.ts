import type { ReadingEntry } from './current';
import { readingHrefOf, type ReadingTarget } from './target';

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
      return `${called(entry.labelA)} 님과의 궁합풀이`;
  }
}

/**
 * 목록의 한 줄을 **대상으로 되읽는다.**
 *
 * 목록 행은 네 갈래를 열 넷(`personA`·`personB`·`matchId`)에 평평하게 펴 둔 모양이라,
 * 어느 열이 그 갈래에서 실제로 차 있는지는 `kind` 만 안다. 그 지식이 화면마다 흩어지지
 * 않도록 여기서 한 번 세운 대상을 `target.ts` 에 넘긴다.
 *
 * `my_readings()` 는 갈래마다 제 열을 채워 내므로 여기까지 `null` 이 오지 않는다.
 * 그래도 타입이 `null` 을 허용하는 한 그릴 수 있어야 해서 빈 문자열로 받아 둔다 —
 * `called` 가 이름에 대해 하는 것과 같은 이유다.
 */
const targetOf = (entry: ReadingEntry): ReadingTarget => {
  switch (entry.kind) {
    case 'self':
      return { kind: 'self' };
    case 'person':
      return { kind: 'person', personId: entry.personA ?? '' };
    case 'private':
      return { kind: 'private', personA: entry.personA ?? '', personB: entry.personB ?? '' };
    case 'match':
      return { kind: 'match', matchId: entry.matchId ?? '' };
  }
};

/**
 * 누르면 가는 곳 — **주소를 짓는 자리는 `target.ts` 하나다.**
 *
 * 앞서는 목록과 파이프라인이 같은 네 주소를 따로 적었고, 그 둘이 갈리면 목록이 결과
 * 화면과 **다른 곳으로 보낸다.** 여기는 이제 행을 대상으로 옮기는 일만 한다.
 */
export const readingHref = (entry: ReadingEntry): string => readingHrefOf(targetOf(entry));

/**
 * 날짜만 — 목록에서 분 단위는 읽는 데 방해만 된다.
 *
 * **한 사실에는 한 표기**(CONTEXT.md). 「본 궁합」과 이 목록이 같은 날짜를 다르게 적으면
 * 사용자는 같은 글인지 확인하는 데 눈을 쓴다.
 *
 * **시간대는 한국이다.** 책장과 운영 설문 화면은 서버(UTC)가 그리므로, 적지 않으면 한국 시각 0~9시에 만든
 * 글이 전날 날짜로 섰다. 채팅 목록의 시각(`src/lib/chat` 의 `messageTimeLabel`)과 같은 규율이다.
 */
export const readingDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/**
 * 이름이 비어 있을 때 — **빈 자리를 남기지 않는다.**
 *
 * `my_readings()` 는 엣지가 있는 줄만 내주므로 여기까지 `null` 이 오지 않는다. 그래도
 * 「 사주」로 서는 줄을 만들 수는 없어서 받아 둔다 — 타입이 `null` 을 허용하는 한
 * 화면 어딘가는 그 값을 그릴 수 있어야 한다.
 */
const called = (label: string | null): string => label ?? '이름 없음';
