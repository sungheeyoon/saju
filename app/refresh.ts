import { revalidatePath } from 'next/cache';

/**
 * 누름 하나가 **무엇을 바꿨나** — 그리고 그래서 무를 화면.
 *
 * ## 왜 표인가 — 재어 보고 적는다
 *
 * 서버 액션 스무 곳이 `revalidatePath` 를 **마흔 번** 손으로 적고 있었다. 같은 사실을
 * 적는 자리가 스무 곳이면 갈리고, 갈린 쪽은 언제나 조용하다.
 *
 * 그런데 재어 보니 더 이상했다. **마흔 중 서른아홉은 아무 캐시도 안 건드린다.**
 *
 * | 잰 것 | 값 |
 * | --- | --- |
 * | 액션이 무르는 라우트 | `/me/*` 전부 — 빌드 표에서 `ƒ`(요청마다 그린다). **서버 캐시 항목이 없다** |
 * | 정적인 라우트 | `/` · `/auth/denied` · `/me/discovery`(리디렉트) 셋뿐 |
 * | 그중 액션이 건드리는 것 | `requestAccountDeletion` 의 `/` 하나 |
 * | 클라이언트 캐시 | `staleTimes.dynamic` 기본값이 **0**(v15부터) — 동적 화면은 애초에 안 담긴다 |
 *
 * 그리고 Next 문서가 이렇게 적는다 — *"Server Functions: … it also causes **all
 * previously visited pages** to refresh when navigated to again."* **어느 경로를 적든
 * 이미 전부를 무르게 한다.** 호출부 서른 자리는 그 위에 `router.refresh()` 까지 부른다.
 *
 * ## 그래서 왜 안 지우고 표로 세우나
 *
 * 남은 일이 둘 있기 때문이다.
 *
 * 1. **지금 보고 있는 화면**은 이 호출이 응답에 실어 주는 RSC 페이로드로 그 자리에서
 *    갱신된다. `router.refresh()` 를 안 부르는 자리가 실제로 있다(덱).
 * 2. `/` 하나는 **정말로 미리 그려져 있다.** 계정이 닫히면 그 화면도 갈려야 한다.
 *
 * 그리고 문서가 「이 동작은 임시이고 앞으로 그 경로에만 적용되도록 바뀐다」고 적어 두었다.
 * 그날이 오면 **고칠 자리가 여기 하나**여야 한다. 스무 곳에 흩어져 있으면 그때 아무도
 * 전부를 못 찾는다.
 *
 * ## 이름이 경로가 아니라 **바뀐 것**인 까닭
 *
 * 경로를 인자로 받으면 호출부가 다시 경로를 짓고, 그러면 표가 아니라 별명이 된다.
 * 그리고 지금 적혀 있던 경로들은 「누가 이 자료를 읽나」가 아니라 **「지금 화면이 다시
 * 그려지면 안 된다」**를 적고 있었다 — 덱 셋이 `/me` 를 적은 까닭이 그것이고(주석도 그렇게
 * 말한다), 정작 `/me` 는 후보를 안 세운다. 바꾼 것의 이름을 적으면 그 사정이 표 안에 선다.
 */

/** 무를 화면 하나 — `scope` 가 `'layout'` 이면 그 아래가 전부 따라간다 */
type Screen = { readonly path: string; readonly scope?: 'layout' };

/**
 * 이 누름이 바꾼 것.
 *
 * **누름마다 하나씩 고른다.** 한 액션이 둘을 부르기 시작하면 목록을 다시 호출부가 드는
 * 셈이 되고, 그러면 표는 있는데 아무것도 안 잠근다.
 */
export type Changed =
  /** 내 사주를 처음 저장했다 */
  | 'self-person-saved'
  /** 저장된 출생 정보를 새 판본으로 쌓았다 — 홈의 명식과 목록의 줄이 함께 갈린다 */
  | 'person-revised'
  /** 저장한 사람이 늘거나 줄거나, 그 사람에 적은 메모가 바뀌었다 */
  | 'person-list-changed'
  /** 이름·사진 — **거의 모든 화면에 선다**, 그래서 레이아웃째 무른다 */
  | 'account-changed'
  /** 계정이 닫혔다 — 상태 하나가 모든 화면의 답을 바꾸고, 여기에만 정적 라우트가 걸린다 */
  | 'account-closed'
  /** 선택 동의를 켜거나 껐다 */
  | 'consent-changed'
  /** 만나볼 상대의 조건, 참여를 켜고 끄기 */
  | 'discovery-settings-changed'
  /** 목록을 새로 받았다 — 스냅샷 시각이 바뀌어 덱이 통째로 다시 선다 */
  | 'board-refreshed'
  /**
   * 덱에서 지나치거나 요청했다 — **덱이 선 화면은 일부러 안 든다.**
   *
   * 무르면 응답이 새 페이로드를 실어 라우트를 다시 그리고, 그러면 이 사람이 `cards` 에서
   * 빠지며 뒤 카드가 당겨지는데 덱이 든 자리(`index`)는 `key` 가 같아 살아남아 계산이
   * 어긋난다(느린 기계에서 먼저 드러났다, `74349b6`). 덱은 자기 자리를 스스로 옮긴다.
   */
  | 'deck-moved'
  /** 상세 궁합을 청했다 — 소식과 요청 목록이 함께 갈린다 */
  | 'match-requested'
  /** 받은 요청에 답했거나, 거뒀거나, 차단했거나, 소식을 읽었다 */
  | 'requests-changed'
  /** 신고했다 — 소식은 안 바뀐다(운영자가 볼 기록이다) */
  | 'report-filed'
  /** 설문을 제출했다 — 초안 저장은 무르지 않는다(쓰던 칸이 흔들린다) */
  | 'survey-submitted'
  /** 두 사람으로 궁합 화면을 열었다 */
  | 'pair-opened'
  /** 가입을 끝냈다 */
  | 'signed-up';

/**
 * 바뀐 것 → 무를 화면.
 *
 * **지금 적혀 있던 경로를 그대로 옮겼다.** 이 표는 동작을 바꾸지 않는다 — 옮기면서
 * 고치면 무엇이 옮겨서 난 일이고 무엇이 고쳐서 난 일인지 갈라 볼 수 없다.
 */
const SCREENS: Readonly<Record<Changed, readonly Screen[]>> = {
  'self-person-saved': [{ path: '/me' }],
  'person-revised': [{ path: '/me' }, { path: '/me/people' }],
  'person-list-changed': [{ path: '/me/people' }],
  'account-changed': [{ path: '/me', scope: 'layout' }],
  'account-closed': [{ path: '/', scope: 'layout' }],
  'consent-changed': [{ path: '/me/settings' }, { path: '/me' }],
  'discovery-settings-changed': [{ path: '/me/settings' }],
  'board-refreshed': [{ path: '/me' }, { path: '/me/matching' }],
  'deck-moved': [{ path: '/me' }],
  'match-requested': [{ path: '/me' }, { path: '/me/requests' }],
  'requests-changed': [{ path: '/me/requests' }, { path: '/me' }],
  'report-filed': [{ path: '/me/requests' }],
  'survey-submitted': [{ path: '/me/survey' }],
  'pair-opened': [{ path: '/me/compat' }],
  'signed-up': [{ path: '/me', scope: 'layout' }],
};

/** 표를 시험이 읽는다 — 적힌 경로가 실재하는 라우트인가를 거기서 잰다 */
export const REFRESH_SCREENS = SCREENS;

/** 이 누름이 바꾼 것을 말하면, 무를 화면은 표가 안다 */
export function refresh(changed: Changed): void {
  for (const screen of SCREENS[changed]) revalidatePath(screen.path, screen.scope);
}

/**
 * 대상이 정하는 화면을 무른다 — **풀이만 이 문을 쓴다.**
 *
 * 풀이의 화면은 대상마다 주소가 다르다(`/me/readings/<id>` · `/me/match/<id>`). 그
 * 갈래를 푸는 표는 이미 있고(`readingPathsOf`, ADR 0016·0033), 그 표가 내주는 것은
 * **값이 든 경로**라 위의 표에 미리 적을 수 없다.
 */
export function refreshPaths(paths: readonly string[]): void {
  for (const path of paths) revalidatePath(path);
}
