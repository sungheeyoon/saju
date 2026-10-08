import { refresh as redrawThisScreen, revalidatePath } from 'next/cache';

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
 * 이미 전부를 무르게 한다.**
 *
 * ## 그래서 왜 안 지우고 표로 세우나
 *
 * 남은 일이 둘 있기 때문이다.
 *
 * 1. **지금 보고 있는 화면**은 이 호출이 응답에 실어 주는 RSC 페이로드로 그 자리에서
 *    갱신된다 — 누른 쪽이 `router.refresh()` 를 또 부르지 않는 까닭이 이것이다(아래 「브라우저는 다시 읽지 않는다」).
 *    표에 그 화면의 경로가 없으면 **지금 화면**(`THIS_SCREEN`)을 적는다. 아래.
 * 2. `/` 하나는 **정말로 미리 그려져 있다.** 계정이 닫히면 그 화면도 갈려야 한다.
 *
 * 그리고 문서가 「이 동작은 임시이고 앞으로 그 경로에만 적용되도록 바뀐다」고 적어 두었다.
 * 그날이 오면 **고칠 자리가 여기 하나**여야 한다. 스무 곳에 흩어져 있으면 그때 아무도
 * 전부를 못 찾는다.
 *
 * ## 브라우저는 다시 읽지 않는다 (ADR 0076)
 *
 * 액션 응답이 이미 지금 화면을 실어 오므로, 누른 쪽이 그 위에 `router.refresh()` 를 부르면 서버가 같은 화면을 한 번 더
 * 그린다 — 누름 하나에 액션 POST 하나와 `_rsc` GET 하나가 나가고, 화면은 둘째가 끝나야 선다. 그래서 액션을 부른 자리는
 * `router.refresh()` 를 부르지 않고, **누른 화면이 이 표의 경로에 없으면 표에 `THIS_SCREEN` 을 더한다** — 「어느 경로든
 * 무르면 지금 화면이 다시 그려진다」는 위 「임시」 동작에 기대지 않는다. 브라우저가 따로 다시 읽는 자리는 액션이 아닌 갱신
 * (로그아웃 · 라이브 층)과 서버가 무르지 않는 갈래뿐이고, 그 목록과 까닭은 `app/refresh.boundary.test.ts` 가 든다.
 *
 * ## 지금 화면을 다시 그리는 것은 경로가 아니다 (2026-09-30)
 *
 * 덱은 `/me/matching` 에 서는데 표에는 `/me` 가 적혀 있었다. 덱을 다시 그린 것은 그 경로가 아니라 위 「임시」 동작 —
 * 경로를 하나라도 무르면 액션 처리기가 지금 화면을 다시 그려 싣는다 — 이었다(2026-09-28 밤샘 감사). 문서대로 그
 * 동작이 「그 경로에만」으로 좁혀지는 날, `/me` 를 적은 덱은 조용히 옛 목록을 들고 선다. 이 판(16.3)의
 * `next/cache` 에는 그 일만 하는 문 `refresh()` 가 있다 — 서버 액션 안에서만 부를 수 있고, 캐시는 안 건드리며
 * 응답이 지금 화면을 다시 그려 싣게 한다(Next 문서 `api-reference/functions/refresh`, 구현은 `pathWasRevalidated` 를
 * 「동적만」으로 세운다). 그래서 덱은 그 문을 부른다.
 *
 * ## 이름이 경로가 아니라 **바뀐 것**인 까닭
 *
 * 경로를 인자로 받으면 호출부가 다시 경로를 짓고, 그러면 표가 아니라 별명이 된다.
 * 그리고 지금 적혀 있던 경로들은 「누가 이 자료를 읽나」가 아니라 **「지금 화면이 다시
 * 그려지면 안 된다」**를 적고 있었다 — 덱 셋이 `/me` 를 적은 까닭이 그것이고(주석도 그렇게
 * 말한다), 정작 `/me` 는 후보를 안 세운다. 바꾼 것의 이름을 적으면 그 사정이 표 안에 선다.
 */

/** 무를 화면 하나 — `scope` 가 `'layout'` 이면 그 아래가 전부 따라간다 */
type Path = { readonly path: string; readonly scope?: 'layout' };

/**
 * **누른 사람이 지금 보고 있는 화면** — 주소를 모른다. 서버 액션의 응답이 그 화면을 다시 그려 싣는다(`refresh()`).
 */
export const THIS_SCREEN = 'this-screen';

type Screen = Path | typeof THIS_SCREEN;

/**
 * 이 누름이 바꾼 것.
 *
 * **누름마다 하나씩 고른다.** 한 액션이 둘을 부르기 시작하면 목록을 다시 호출부가 드는
 * 셈이 되고, 그러면 표는 있는데 아무것도 안 잠근다.
 */
export type Changed =
  /** 내 사주를 처음 저장했다 */
  | 'self-person-saved'
  /** 저장된 출생 정보를 고쳐 덮어썼다 — 홈의 명식과 목록의 줄이 함께 갈린다 */
  | 'person-input-edited'
  /** 저장한 사람이 늘거나 줄거나, 그 사람에 적은 메모가 바뀌었다 */
  | 'person-list-changed'
  /** 이름·사진 — **거의 모든 화면에 선다**, 그래서 레이아웃째 무른다 */
  | 'account-changed'
  /** 계정이 닫혔다 — 상태 하나가 모든 화면의 답을 바꾸고, 여기에만 정적 라우트가 걸린다 */
  | 'account-closed'
  /**
   * 선택 동의를 켜거나 껐다 — 계정 관리 화면 밖에서도 켠다(설문의 「동의하고 설문 열기」, `app/me/survey/consent-switch.tsx`).
   * 누른 화면은 `THIS_SCREEN` 이 다시 그린다 — 경로 표에 그 화면이 없어도 브라우저가 따로 다시 읽지 않는다.
   */
  | 'consent-changed'
  /** 만나볼 상대의 조건, 참여를 켜고 끄기 */
  | 'discovery-settings-changed'
  /**
   * 덱에서 지나치거나 되돌렸다 — **덱이 선 지금 화면을 다시 그린다.** 경로는 적지 않는다.
   *
   * 응답이 **지금 화면**을 다시 그려 싣고(`THIS_SCREEN` — `refresh()`), 덱은 그 새 목록을 사람 id 로 합친다
   * (`app/me/matching/deck-state.ts` 의 `sync`) — 떠난 자리를 채운 사람이 뒤에 붙어 오는 길이 이것이다(ADR 0115). 옛 덱은
   * 자리를 순번(`index`)으로 들어 새 목록에 계산이 어긋났다(`74349b6`). 전에는 `/me` 를 적어 경로 무르기의 「임시」
   * 부수효과로 같은 일을 했다(위 머리말).
   */
  | 'deck-moved'
  /** 상세 궁합을 청했다 — 인연 탭의 보낸 요청이 는다(ADR 0130) */
  | 'match-requested'
  /**
   * 받은 요청에 답했거나, 거뒀거나, 차단했거나, 소식을 읽었다 — 요청은 인연 탭, 소식은 종(ADR 0130).
   * 차단은 궁합 화면(`/me/match/<id>`) · 채팅 방 · 지난 요청(`/me/matching/history`)에서도 누른다 — 누른 화면은
   * `THIS_SCREEN` 이 다시 그린다.
   */
  | 'requests-changed'
  /** 신고했다 — 소식은 안 바뀐다(운영자가 볼 기록이다) */
  | 'report-filed'
  /** 설문을 제출했다 — 초안 저장은 무르지 않는다(쓰던 칸이 흔들린다) */
  | 'survey-submitted'
  /** 두 사람으로 궁합 화면을 열었다 */
  | 'pair-opened'
  /** 가입을 끝냈다 */
  | 'signed-up'
  /** 경고 안내를 확인했다 — 안내는 `/me` 의 레이아웃에 서므로 그 아래가 전부 따라간다(ADR 0108) */
  | 'warning-acknowledged';

/**
 * 바뀐 것 → 무를 화면.
 *
 * **지금 적혀 있던 경로를 그대로 옮겼다.** 이 표는 동작을 바꾸지 않는다 — 옮기면서
 * 고치면 무엇이 옮겨서 난 일이고 무엇이 고쳐서 난 일인지 갈라 볼 수 없다.
 */
const SCREENS: Readonly<Record<Changed, readonly Screen[]>> = {
  'self-person-saved': [{ path: '/me' }],
  'person-input-edited': [{ path: '/me' }, { path: '/me/people' }],
  'person-list-changed': [{ path: '/me/people' }],
  'account-changed': [{ path: '/me', scope: 'layout' }],
  'account-closed': [{ path: '/', scope: 'layout' }],
  'consent-changed': [{ path: '/me/settings' }, { path: '/me' }, THIS_SCREEN],
  'discovery-settings-changed': [{ path: '/me/settings' }],
  'deck-moved': [THIS_SCREEN],
  'match-requested': [{ path: '/me' }, { path: '/me/matching' }],
  'requests-changed': [{ path: '/me/matching' }, { path: '/me/requests' }, { path: '/me' }, THIS_SCREEN],
  'report-filed': [{ path: '/me/matching' }],
  'survey-submitted': [{ path: '/me/survey' }],
  'pair-opened': [{ path: '/me/compat' }],
  'signed-up': [{ path: '/me', scope: 'layout' }],
  'warning-acknowledged': [{ path: '/me', scope: 'layout' }],
};

/** 표를 시험이 읽는다 — 적힌 경로가 실재하는 라우트인가를 거기서 잰다 */
export const REFRESH_SCREENS = SCREENS;

/** 이 누름이 바꾼 것을 말하면, 무를 화면은 표가 안다 */
export function refresh(changed: Changed): void {
  const screens = SCREENS[changed];
  /*
    **지금 화면이 먼저다 — 표의 차례와 상관없이.** `refresh()` 는 액션의 표지를 「동적만」으로 덮어쓰고
    (`node_modules/next/dist/server/web/spec-extension/revalidate.js` 의 `refresh` — 83행), `revalidatePath` 는 「정적과 동적」으로
    세운다(같은 파일 222행). 뒤에 부른 쪽이 이기므로 경로를 먼저 무르면 표지가 「동적만」으로 남고, 브라우저는 미리 받아 둔
    다른 화면을 버리지 않는다(`router-reducer/reducers/server-action-reducer.js` 의 `invalidateEntirePrefetchCache`).
  */
  if (screens.includes(THIS_SCREEN)) redrawThisScreen();
  for (const screen of screens) {
    if (screen !== THIS_SCREEN) revalidatePath(screen.path, screen.scope);
  }
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
