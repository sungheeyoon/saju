import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REFRESH_SCREENS, type Changed } from './refresh';

/**
 * **무르게 하는 일이 표 하나를 지나는가** (ADR 0076).
 *
 * `db-error.boundary.test.ts`(#67)와 같은 꼴의 장부다. 저기서 배운 것이 그대로 적용된다 —
 * 서버 액션을 새로 하나 쓰면서 `revalidatePath('/me')` 를 적거나 **아무것도 안 적는** 것이
 * 가장 짧은 길이고, 그 줄은 아무 시험에도 안 걸린다. 그래서 원본을 읽어서 잠근다.
 *
 * **표를 베껴 적지는 않는다.** 「이름 → 경로」를 통째로 다시 적으면 표를 고칠 때마다
 * 시험도 같이 고쳐야 하고, 그런 시험은 아무것도 안 문다 — 후보 6이 정확히 그 실수로
 * P1 을 냈다(ADR 0074). 여기서 잠그는 것은 **까닭이 있는 불변식**뿐이다.
 */

const ROOTS = ['app', 'src'];
const CODE = /\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);

    return CODE.test(entry) ? [path] : [];
  });
}

/** 저장소 어디서든 같은 이름으로 부르게 — 윈도우의 `\` 가 비교를 조용히 깨뜨린다 */
const asPosix = (path: string) => relative(process.cwd(), path).split(sep).join('/');

const sources = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
  path: asPosix(path),
  text: readFileSync(path, 'utf8'),
}));

/** 시험 파일은 안 센다 — 제가 찾는 낱말을 스스로 들고 있다 */
const shipped = sources.filter(({ path }) => !/\.test\.tsx?$/.test(path));

describe('무르게 하는 일은 한 문을 지난다', () => {
  /** `next/cache` 에서 무르는 문을 직접 집어 오는 모양 */
  const IMPORTS_CACHE = /from ['"]next\/cache['"]/;

  /**
   * **그대로 집어도 되는 자리와 그 까닭.**
   *
   * 목록이지 예외가 아니다 — 새 파일이 여기 들어오려면 까닭을 적어야 하고, 까닭을 적다
   * 보면 대개 「한 문을 지나면 된다」는 답이 나온다.
   */
  const ALLOWED: Readonly<Record<string, string>> = {
    'app/refresh.ts': '한 문 그 자체 — 여기서 무른다',
  };

  it('`next/cache` 를 직접 집는 파일은 까닭이 적힌 것들뿐이다', () => {
    const raw = sources
      .filter(({ text }) => IMPORTS_CACHE.test(text))
      .map(({ path }) => path)
      .sort();

    expect(raw).toEqual(Object.keys(ALLOWED).sort());
  });

  /**
   * **목록이 실물보다 오래 살지 않게.** 지워진 파일 이름이 남아 있으면 그 줄은 아무것도
   * 안 잠그면서 잠그는 것처럼 읽힌다.
   */
  it('까닭이 적힌 파일은 다 실재한다', () => {
    const present = new Set(sources.map(({ path }) => path));

    expect(Object.keys(ALLOWED).filter((path) => !present.has(path))).toEqual([]);
  });
});

/**
 * **누름마다 무엇을 바꿨는지, 그리고 무엇이라고 말하는가.**
 *
 * 이것이 이 장부의 본체다. 앞선 판은 「`refresh` 를 부르느냐」만 봤다 — 그래서
 * `editPersonInput` 이 `refresh('survey-submitted')` 로 바뀌어도 **초록이었다.** 부르는 것은
 * 배선이고 **고른 이름이 의미**인데, 의미 쪽이 안 잠겨 있었다.
 *
 * 그래서 기대값을 **시험이 소유한다.** 액션마다 어떤 이름을 골라야 하는지를 여기 적고,
 * 주석을 걷은 몸통에서 뽑은 `refresh('…')` 리터럴과 **정확히** 맞춘다. 새 액션을 쓰면
 * 이 표에 한 줄을 더해야 하고, 그 한 줄이 「이 누름은 무엇을 바꾸나」를 사람이 한 번
 * 생각하게 만든다(`db-error.boundary.test.ts` 의 `ALLOWED` 와 같은 규율).
 */
describe('내보낸 액션은 바뀐 것의 이름을 고른다', () => {
  /**
   * **산문이 아니라 코드를 읽는다.**
   *
   * 첫 판은 `\brefresh\(` 였고, 주석 속 `router.refresh()` 에 걸려 「이 액션은 무른다」로
   * 잘못 읽었다 — 그것도 **다음 함수의 주석**이었다(분할이 선언 줄에서 일어나므로 앞
   * 함수의 몸통에 딸려 온다). 주석을 걷고, 앞에 `.` 가 붙은 호출은 안 센다.
   */
  const NAME_IN_BODY = /(?<![.\w])refresh\('([a-z-]+)'\)/g;
  const CALLS_PATHS = /(?<![.\w])refreshPaths\(/;

  /** 블록 주석과 줄 주석을 걷는다 — `://` 는 주소라 건드리지 않는다 */
  const withoutProse = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

  /**
   * **액션이 골라야 하는 이름.** 타입이 `Changed` 라 오타는 컴파일에서 죽는다.
   *
   * 한 액션이 갈래마다 같은 이름을 여러 번 부를 수 있다(`saveSelfPerson` 은 「이미
   * 등록했다」 갈래에서도 같은 것을 부른다). 그래서 뽑은 것을 **집합으로** 견준다 —
   * 같은 이름을 두 번 부르는 것은 갈래가 둘이라는 뜻이지 다른 뜻이 아니다.
   */
  const CHOOSES: Readonly<Record<string, Changed>> = {
    'app/me/actions.ts::saveSelfPerson': 'self-person-saved',
    'app/me/actions.ts::addManagedPerson': 'person-list-changed',
    'app/me/actions.ts::updateNote': 'person-list-changed',
    'app/me/actions.ts::removeFromList': 'person-list-changed',
    'app/me/actions.ts::editPersonInput': 'person-input-edited',
    'app/me/actions.ts::setOptionalConsent': 'consent-changed',
    'app/me/compat/actions.ts::openPairScreen': 'pair-opened',
    'app/me/discovery/actions.ts::savePreferGender': 'discovery-settings-changed',
    'app/me/discovery/actions.ts::setDiscoveryParticipation': 'discovery-settings-changed',
    'app/me/discovery/actions.ts::refreshDiscoveryBoard': 'board-refreshed',
    'app/me/discovery/actions.ts::passCandidate': 'deck-moved',
    'app/me/discovery/actions.ts::restorePassed': 'deck-moved',
    'app/me/discovery/actions.ts::requestMatch': 'match-requested',
    'app/me/profile/actions.ts::saveProfile': 'account-changed',
    'app/me/profile/actions.ts::savePhoto': 'account-changed',
    'app/me/profile/actions.ts::clearPhoto': 'account-changed',
    'app/me/requests/actions.ts::respondToRequest': 'requests-changed',
    'app/me/requests/actions.ts::cancelRequest': 'requests-changed',
    'app/me/requests/actions.ts::blockUser': 'requests-changed',
    'app/me/requests/actions.ts::reportUser': 'report-filed',
    'app/me/requests/actions.ts::requestAccountDeletion': 'account-closed',
    'app/me/requests/actions.ts::markNotificationsRead': 'requests-changed',
    'app/me/survey/actions.ts::saveServiceSurvey': 'survey-submitted',
    'app/signup/actions.ts::completeSignup': 'signed-up',
  };

  /**
   * **대상이 화면을 정하는 액션과 그 까닭.**
   *
   * 풀이의 주소는 대상마다 다르다(`/me/readings/<id>` · `/me/match/<id>`). 값이 든 경로라
   * 표에 미리 못 적고, 그 갈래를 푸는 표는 따로 있다(`readingPathsOf`, ADR 0016·0033).
   */
  const CHOOSES_PATHS: Readonly<Record<string, string>> = {
    'app/me/reading/actions.ts::readingRunState':
      '끝난 것을 확인한 자리에서 그 대상의 화면을 무른다 — 주소가 대상마다 다르다',
    'app/me/reading/actions.ts::submitReadingFeedback':
      '답한 뒤 `feedback_given` 이 다시 읽혀야 한다 — 역시 대상이 주소를 정한다',
    'app/me/chat/actions.ts::sendChatMessage':
      '방 안의 주소가 방마다 다르다(`/me/chat/<matchId>`) — 목록과 그 방을 함께 무른다',
    'app/me/chat/actions.ts::markChatRead':
      '안 읽은 수가 목록과 그 방에 선다 — 같은 둘을 무른다',
  };

  /**
   * **안 무르는 액션과 그 까닭.**
   *
   * 읽기만 하거나, 무르는 일을 다른 문에 넘기거나, 서버가 그리는 화면을 안 건드리는
   * 것들이다. 새 액션이 여기 들어오려면 까닭을 적어야 한다.
   */
  const NO_REFRESH: Readonly<Record<string, string>> = {
    'app/me/actions.ts::savePersonForReading':
      '`addManagedPerson` 에 그대로 넘긴다 — 무르는 것도 그쪽이다',
    'app/me/compat/actions.ts::pairRelationFor': '읽기만 한다 — 적어 둔 사이를 화면에 세우려고',
    'app/me/reading/actions.ts::generateReading':
      '이 누름이 여는 것은 **시도**뿐이다. 글은 응답 뒤에 나고, 끝난 것을 확인한 자리가 무른다(ADR 0016)',
    'app/me/reading/share.ts::shareMyReading':
      '링크 하나를 내줄 뿐 서버가 그리는 화면은 안 바뀐다 — 주소는 브라우저가 세운다',
    'app/nickname.ts::checkNickname': '읽기만 한다 — 참·거짓 하나',
    'app/me/chat/actions.ts::reportChatMessage':
      '신고는 방을 닫지 않는다(PRD §7.1) — 서버가 그리는 화면이 안 바뀐다. 접수됐다는 말은 누른 자리가 든다',
  };

  /** `'use server'` 를 든 파일에서 내보낸 액션을 그 몸통과 함께 집어 온다 */
  const actions = shipped
    .filter(({ text }) => /^'use server';/m.test(text))
    .flatMap(({ path, text }) => {
      const parts = text.split(/^export async function (\w+)/m);
      return parts
        .slice(1)
        .filter((_, index) => index % 2 === 0)
        .map((name, index) => {
          const body = withoutProse(parts[index * 2 + 2] ?? '');
          return {
            id: `${path}::${name}`,
            names: [...body.matchAll(NAME_IN_BODY)].map((match) => match[1]).sort(),
            usesPaths: CALLS_PATHS.test(body),
          };
        });
    });

  /** 액션을 하나도 못 찾았으면 이 시험은 아무것도 안 잰 것이다 */
  it('액션을 실제로 읽어 왔다', () => {
    expect(actions.length).toBeGreaterThan(20);
  });

  /**
   * **세 갈래가 액션 전체를 빠짐없이 한 번씩 덮는다.** 새 액션이 늘면 어느 갈래에도
   * 안 들어 여기서 걸린다 — 「적는 것을 잊는 것」이 이 장부가 막으려는 바로 그 일이다.
   */
  it('모든 액션이 세 갈래 중 하나에 정확히 한 번 적혀 있다', () => {
    const ledger = [
      ...Object.keys(CHOOSES),
      ...Object.keys(CHOOSES_PATHS),
      ...Object.keys(NO_REFRESH),
    ].sort();

    expect(ledger).toEqual([...new Set(ledger)].sort());
    expect(actions.map(({ id }) => id).sort()).toEqual(ledger);
  });

  it.each(Object.entries(CHOOSES))('%s 는 「%s」를 고른다', (id, expected) => {
    const action = actions.find((one) => one.id === id);

    expect([...new Set(action?.names)]).toEqual([expected]);
    expect(action?.usesPaths).toBe(false);
  });

  it.each(Object.keys(CHOOSES_PATHS))('%s 는 대상이 정하는 화면을 무른다', (id) => {
    const action = actions.find((one) => one.id === id);

    expect(action?.usesPaths).toBe(true);
    expect(action?.names).toEqual([]);
  });

  it.each(Object.keys(NO_REFRESH))('%s 는 아무것도 안 무른다', (id) => {
    const action = actions.find((one) => one.id === id);

    expect(action?.names).toEqual([]);
    expect(action?.usesPaths).toBe(false);
  });

  /**
   * **아무도 안 고르는 이름은 표에 안 남긴다.** TypeScript 는 반대 방향만 잡는다 —
   * 없는 이름을 부르면 컴파일이 깨지지만, 아무도 안 부르는 이름은 조용하다.
   */
  it('표의 이름은 전부 어느 액션이 고른다', () => {
    const chosen = new Set(Object.values(CHOOSES));

    expect(Object.keys(REFRESH_SCREENS).filter((changed) => !chosen.has(changed as Changed))).toEqual([]);
  });
});

/**
 * **표가 적은 것이 실제로 무는가.**
 *
 * 경로는 손으로 적는 값이라 오타가 조용하다 — `revalidatePath` 는 없는 경로를 받아도
 * 아무 말도 안 한다. 그리고 `scope` 는 **적혀 있을 때만** 아래를 다 데려간다.
 */
describe('표가 가리키는 것', () => {
  const routes = new Set(
    sourceFiles('app')
      .map(asPosix)
      .filter((path) => /\/page\.tsx$/.test(path))
      .map((path) => {
        const route = path.replace(/^app/, '').replace(/\/page\.tsx$/, '');
        return route === '' ? '/' : route;
      }),
  );

  it.each(Object.entries(REFRESH_SCREENS))('%s 가 가리키는 화면이 다 있다', (_changed, screens) => {
    for (const screen of screens) {
      expect(routes.has(screen.path)).toBe(true);
    }
  });

  /**
   * **아무 화면도 안 무는 이름은 두지 않는다.** 빈 목록은 「무를 것이 없다」가 아니라
   * 「적다 말았다」로 읽히고, 그 둘을 화면에서 구별할 길이 없다.
   */
  it('이름마다 무를 화면이 적어도 하나다', () => {
    for (const [changed, screens] of Object.entries(REFRESH_SCREENS)) {
      expect(screens.length, changed).toBeGreaterThan(0);
    }
  });

  /**
   * **이름과 사진은 레이아웃째 무른다.** 그 둘은 후보 카드도 요청 목록도 소식도 들고
   * 있어서, 한 화면만 다시 그리면 나머지가 옛 이름을 든 채로 남는다. `scope` 하나가
   * 빠지면 그 침묵이 그대로 돌아온다.
   */
  it.each(['account-changed', 'signed-up'] as const)('%s 는 `/me` 아래를 다 데려간다', (changed) => {
    expect(REFRESH_SCREENS[changed].find((screen) => screen.path === '/me')?.scope).toBe('layout');
  });

  /**
   * **여기 하나가 진짜로 무는 줄이다.**
   *
   * 표의 나머지 경로는 전부 `ƒ`(요청마다 그린다)라 서버 캐시 항목이 없다. `/` 만
   * 미리 그려져 있고(빌드 표의 `○`), 계정이 닫히면 그 화면도 갈려야 한다. 이 줄이
   * 조용히 `/me` 로 좁혀지면 **닫힌 계정이 현관에서 계속 열려 보인다.**
   */
  it('계정이 닫히면 미리 그려진 현관까지 간다', () => {
    expect(REFRESH_SCREENS['account-closed'].find((screen) => screen.path === '/')?.scope).toBe(
      'layout',
    );
  });

  it('현관을 무르는 이름은 그 하나뿐이다', () => {
    const others = Object.entries(REFRESH_SCREENS)
      .filter(([changed]) => changed !== 'account-closed')
      .filter(([, screens]) => screens.some((screen) => screen.path === '/'))
      .map(([changed]) => changed);

    expect(others).toEqual([]);
  });

});

/**
 * **표의 값 전체를 시험이 한 벌 더 든다.**
 *
 * 이 저장소는 보통 표를 그대로 베낀 시험을 거절한다 — 고칠 때마다 두 벌을 같이 고쳐야
 * 하고, 그런 시험은 「누가 고쳤다」만 알릴 뿐 **옳고 그름을 모른다**(ADR 0074 의 P1).
 * 그래서 이 미러가 자리값을 하는 까닭을 적어 둔다.
 *
 * **오늘 이 값들은 거의 아무것도 안 한다.** 표가 가리키는 라우트는 빌드에서 전부 `ƒ` 라
 * 서버 캐시 항목이 없고, 클라이언트 쪽은 `staleTimes.dynamic` 이 0이며, 서버 액션의
 * `revalidatePath` 는 어느 경로를 적든 이미 「이전에 방문한 모든 화면」을 무르게 한다.
 *
 * **그런데 문서가 그 동작을 임시라고 적었다** — *"This behavior is temporary and will be
 * updated in the future to apply only to the specific path."* 그날이 오면 이 값들이
 * **그날부터 load-bearing 이 된다.** 경로 하나가 빠져 있어도 오늘은 아무도 못 느끼고,
 * 그날 조용히 낡은 화면이 선다. 값이 잠들어 있는 동안에 잠가 두는 편이 싸다.
 *
 * 순서까지 든다. `revalidatePath` 는 부른 차례대로 돌고, 차례가 바뀌는 것은 **누군가
 * 표를 건드렸다는 뜻**이라 그 자체로 볼 가치가 있다.
 *
 * 그러므로 이 표를 고치는 일은 **여기도 함께 고치는 일**이다. 그 두 번째 편집이 곧
 * 「이 화면이 정말 이 목록인가」를 한 번 더 묻는 자리다.
 */
describe('표의 값은 계약과 글자까지 같다', () => {
  const EXPECTED: Readonly<Record<Changed, readonly { path: string; scope?: 'layout' }[]>> = {
    'self-person-saved': [{ path: '/me' }],
    'person-input-edited': [{ path: '/me' }, { path: '/me/people' }],
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

  it('경로도 순서도 scope 도 계약 그대로다', () => {
    expect(REFRESH_SCREENS).toEqual(EXPECTED);
  });

  /** 이름이 늘거나 줄면 위의 `toEqual` 이 이미 잡지만, 무엇이 갈렸는지는 이쪽이 말한다 */
  it('이름 목록이 계약과 같다', () => {
    expect(Object.keys(REFRESH_SCREENS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});
