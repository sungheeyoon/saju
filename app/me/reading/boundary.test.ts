import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **사용자 화면에 근거 절이 새지 않는가.**
 *
 * 저장된 원문 뒤에는 절마다 한 줄씩 「어디서 온 말인가」가 붙는다. 그것은 되짚으려고
 * 만든 값이지 상품이 아니다 — 경로 이름과 `[사실]` 딱지는 읽는 사람에게 기계 부스러기다.
 *
 * 지금 그것을 막는 것은 **한 줄**이다. `currentReading` 이 서버 경계에서 `readingBody`
 * 로 잘라 내고, 그 함수가 사용자 화면에 결과를 먹이는 유일한 자리다. 그래서 근거 절은
 * 브라우저까지 내려가지도 않는다.
 *
 * 그런데 그 옆에 **안 자른 것을 주는 함수**가 나란히 선다(`readingGroundingOf`).
 * 되짚는 화면이 읽어야 해서 있는 것인데, 나란히 있는 한 나중에 화면을 만드는 사람이
 * 옆의 것을 집어 갈 수 있다. 파일 주석에 「한 함수가 두 벌을 다 내주면 언젠가 사용자
 * 화면이 그 값을 세운다」고 적어 두었지만, **주석이 잠그는 것은 아무것도 잠그지 않는다.**
 *
 * 그래서 원본을 읽어서 잠근다. 이 시험이 재는 것은 계산이 아니라 **배선**이다 —
 * 안 자른 쪽을 부르는 파일이 되짚는 화면 하나뿐인가.
 */

const ROOTS = ['app', 'src'];
const CODE = /\.tsx?$/;

/** 되짚는 화면 하나만 안 자른 쪽을 읽는다 */
const ALLOWED = 'app/me/reading/inspect/page.tsx';

/** 함수가 사는 곳 — 정의는 당연히 자기 이름을 들고 있다 */
const DEFINITION = 'app/me/reading/current.ts';

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

describe('되짚기용 값이 사용자 화면으로 새지 않는다', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
    path: asPosix(path),
    text: readFileSync(path, 'utf8'),
  }));

  it('안 자른 근거를 읽는 곳은 되짚는 화면 하나뿐이다', () => {
    const callers = files
      .filter(({ path }) => path !== DEFINITION && !path.endsWith('boundary.test.ts'))
      .filter(({ text }) => text.includes('readingGroundingOf'))
      .map(({ path }) => path);

    expect(callers).toEqual([ALLOWED]);
  });

  /**
   * **자르지 않은 원문을 그대로 내주는 자리가 생기면 여기서 걸린다.**
   *
   * 위의 시험은 지금 있는 함수 하나를 잡는다. 이것은 그 함수를 안 거치고 RPC 의
   * `output` 을 통째로 들고 나가는 새 길을 잡는다 — 이름을 바꿔 우회하는 쪽이
   * 실제로는 더 흔하다.
   */
  it('사용자 화면용 값은 반드시 자르는 함수를 거친다', () => {
    const current = files.find(({ path }) => path === DEFINITION);
    expect(current, `${DEFINITION} 를 찾지 못했다`).toBeDefined();

    /*
      **무늬가 캐스팅 글자에 매여 있었다.** 앞서는 `row.output as string` 을 셌는데,
      생성 타입이 그 칸을 `string` 으로 말하게 되면서 캐스팅이 없어지자 **세던 것이
      0건이 됐다** — 잠금이 조용히 풀린 것이다(ADR 0078 작업에서 실제로 그랬다).
      이제 읽기 자체를 센다. 캐스팅이 있든 없든 같은 것을 잠근다.
    */
    const raw = current!.text.match(/row\.output/g) ?? [];
    const cut = current!.text.match(/reading(?:Body|Grounding)\(row\.output\)/g) ?? [];

    // 원문을 읽는 자리마다 자르는 함수가 하나씩 감싸고 있어야 한다
    expect(cut.length).toBe(raw.length);
    expect(raw.length).toBeGreaterThan(0);
  });

  /**
   * 사용자에게 나가는 화면이 근거 절의 머리말을 **문자열로 들고 있지 않은가.**
   *
   * 들고 있다면 그 화면은 근거 절을 알아보려 하고 있다는 뜻이고, 알아보려 한다는 것은
   * 언젠가 세우려 한다는 뜻이다. 자르는 규칙은 한 자리에만 있어야 한다.
   */
  /*
    **「아무것도 시작하지 않은 성공」은 이제 여기서 안 센다.**

    그 갈래를 글자로 재던 자리였다 — `panel.tsx` 가 `result.started` 와
    `READING_ALREADY_RUNNING_NOTE` 를 들고 있는가. 재던 것이 배선이 아니라 판단이라
    글자로밖에 못 쟀고, 그래서 **그 갈래에서 어떤 문장이 서는지는 한 번도 안 쟀다.**

    판단이 `reading-state.ts` 로 내려가면서 `reading-state.test.ts` 가 그것을 직접
    부른다. 남이 연 시도에 얹혔을 때 무엇이 서고, 그것이 끝나면 무엇이 걷히는지까지
    잰다 — 글자를 세는 줄이 할 수 없던 일이다.
  */

  /**
   * **누름이 모델을 기다리지 않는가.**
   *
   * 만드는 일이 누름의 요청 안에 있으면 새로고침·탭 닫기가 그것을 끊고, 열린 시도가
   * 남아 그 대상이 10분간 잠긴다. 응답 뒤로 옮기는 것이 그 값을 없앤다.
   *
   * 되돌리기는 쉽다 — 액션이 만드는 일을 그냥 `await` 하면 코드가 짧아지고
   * 화면도 돌아간다. 느려지는 것은 사용자 쪽이라 시험이 안 잡는다. 그래서 잡는다.
   */
  it('누름의 액션이 만드는 일을 응답 뒤로 넘긴다', () => {
    const actions = files.find(({ path }) => path === 'app/me/reading/actions.ts');
    const pipeline = files.find(({ path }) => path === 'app/me/reading/pipeline.ts');

    expect(actions!.text).toContain('beginReading');
    expect(pipeline!.text, '응답 뒤로 넘기는 자리가 없다').toContain('after(');
  });

  /**
   * **기다림의 길이를 화면이 손으로 적지 않는다.**
   *
   * 앞 문구는 「보통 1분 안에 완성됩니다」였고 우리는 그 값을 잰 적이 없다. 상한이
   * 바뀌는 날 손으로 적은 숫자는 조용히 거짓이 된다.
   */
  it('기다림 문구를 상한에서 지어 온다', () => {
    const panel = files.find(({ path }) => path === 'app/me/reading/panel.tsx');

    expect(panel!.text).toContain('readingWaitNote(GENERATION.settings.timeout)');
    expect(panel!.text).not.toContain('보통 1분');
  });

  /**
   * **결과 칸이 서는 화면은 다 상한을 든다.**
   *
   * 생성은 응답 뒤에 돌고(`after`), 그 콜백이 사는 시간은 **그것을 부른 라우트의
   * 상한**이다. 선언이 없으면 플랫폼 기본값에서 잘리고, 그러면 시도가 열린 채 남아
   * 그 대상이 10분간 잠긴다 — 화면에는 「만드는 중」만 돌고 아무것도 안 온다.
   *
   * `/me/compat` 이 실제로 그랬다. 결과 칸을 붙이면서 상한을 안 붙였고, 붙은 뒤에도
   * 아무 시험도 그것을 안 봤다.
   */
  it('결과 칸이 서는 화면은 모델 상한만큼 살 수 있다', () => {
    const hosts = files
      .filter(({ path }) => path.endsWith('page.tsx'))
      .filter(({ text }) => text.includes('<ReadingSection'));

    expect(hosts.length, '결과 칸을 세우는 화면을 못 찾았다').toBeGreaterThan(0);

    for (const { path, text } of hosts) {
      expect(text, `${path} 에 maxDuration 이 없다`).toMatch(/export const maxDuration = \d+/);
    }
  });

  /**
   * **모델을 부르는 자리가 하나다.**
   *
   * `model.ts` 는 스스로를 「모델을 부르는 유일한 자리」라고 적어 두었는데 그것을 세는
   * 곳이 없었다. 만드는 일이 요청을 떠나면서(ADR 0020) 그 자리에 제출·회수가 더 붙었고,
   * provider SDK 를 두 개 물게 됐다 — 번지기 딱 좋은 모양이다.
   *
   * 번지면 무엇이 나쁜가. 프롬프트를 짓는 코드나 화면이 provider 를 직접 부르기 시작하면
   * **자르기와 검사를 지나지 않는 길**이 생긴다. 그것이 ADR 0008 이 막은 바로 그 길이다.
   */
  it('provider SDK 를 아는 파일은 model.ts 하나다', () => {
    const knowing = files
      .filter(({ text }) => /from '(openai|@ai-sdk\/[^']+)'/.test(text))
      .map(({ path }) => path);

    expect(knowing).toEqual(['app/me/reading/model.ts']);
  });

  /**
   * **provider 가 두드리는 문은 로그인 관문 밖에 선다.**
   *
   * `proxy.ts` 의 matcher 안에 들어가면 provider 가 로그인 화면을 받는다 — 그리고 그건
   * 2xx 라서, 우리는 사건을 잃고도 잃은 줄 모른다.
   */
  it('webhook 은 로그인 관문을 지나지 않는다', () => {
    const proxy = readFileSync('proxy.ts', 'utf8');
    const matcher = /matcher: \[([^\]]*)\]/.exec(proxy)?.[1] ?? '';

    expect(matcher, 'matcher 를 못 찾았다').not.toBe('');
    expect(matcher).not.toContain('/api');
  });

  /**
   * **응답을 먼저 보낸다.** 회수·검사·저장을 2xx 앞에 두면 그 시간이 길어질수록
   * 재전송이 늘고, 늘어난 재전송이 다시 같은 일을 시킨다.
   */
  it('webhook 은 무거운 일을 응답 뒤로 미룬다', () => {
    const route = files.find(({ path }) => path === 'app/api/openai/webhook/route.ts');

    expect(route, 'webhook 라우트를 못 찾았다').toBeDefined();
    expect(route!.text, '응답 뒤로 넘기는 자리가 없다').toContain('after(');
    // 회수는 `after` 안에서만 불린다 — 그 밖에서 부르면 응답이 늦어진다.
    // import 줄은 빼고 본다. 쓰는 자리를 재려는 것이지 들여오는 자리가 아니다.
    const body = route!.text
      .split('\n')
      .filter((line) => !line.startsWith('import'))
      .join('\n');

    expect(body.split('after(')[0]).not.toContain('collectReadingResult');
  });

  /**
   * **관문 밖의 주소는 스스로 자격을 물어야 한다.**
   *
   * `/api` 는 `proxy.ts` 를 지나지 않는다. 그래서 아무나 두드릴 수 있고, 복구기는
   * 두드리면 남의 시도를 닫는다. webhook 은 서명이, 복구기는 `CRON_SECRET` 이 든다 —
   * 둘 중 하나라도 빠지면 그 문은 열린 문이다. 결제 알림(G-23 ⑥)은 `settleWebhook` 이 무엇보다 먼저
   * 서명을 본다 — 서명이 틀리면 아무것도 안 부르는 것은 `app/api/portone/webhook/settle.test.ts` 가 잰다.
   */
  it('관문 밖 주소는 저마다 자격을 묻는다', () => {
    const routes = files.filter(({ path }) => path.startsWith('app/api/') && path.endsWith('route.ts'));

    expect(routes.length, 'api 라우트를 못 찾았다').toBeGreaterThan(0);

    for (const { path, text } of routes) {
      const asks = /verifyReadingWebhook|CRON_SECRET|settleWebhook/.test(text);
      expect(asks, `${path} 이 자격을 묻지 않는다`).toBe(true);
    }
  });

  /**
   * **만든 열을 채우는 자리가 있는가.**
   *
   * `processed_at` 을 만들고 인덱스까지 걸어 놓고 쓰는 코드를 안 썼다. 첫 실호출에서야
   * 드러났고, 그때까지 네 층이 다 초록이었다 — 시험이 열의 존재만 재고 있었다.
   *
   * 「받았는데 못 집은 사건」을 세는 것이 그 열의 존재 이유이므로, 아무도 안 적으면
   * 그 수는 언제나 전부다.
   */
  it('영수증을 집었다고 적는 자리가 있다', () => {
    /**
     * **시험 자신은 빼고 센다.** 처음에 안 뺐더니 이 시험이 자기 본문에 적힌 이름을
     * 세어 언제나 초록이었다 — 호출을 지워도 통과했다. 위 `DEFINITION` 이 같은 함정을
     * 위해 서 있는 자리다.
     */
    const marking = files
      .filter(({ path }) => !path.endsWith('.test.ts'))
      .filter(({ text }) => text.includes('mark_reading_webhook_processed'))
      .map(({ path }) => path);

    expect(marking, '적는 자리가 없다').not.toEqual([]);
  });

  it('사용자 화면이 근거 절 머리말을 직접 알지 않는다', () => {
    const knowing = files
      .filter(({ path }) => path.startsWith('app/'))
      .filter(({ path }) => !path.startsWith('app/me/reading/'))
      .filter(({ text }) => text.includes('### 근거'))
      .map(({ path }) => path);

    expect(knowing).toEqual([]);
  });
});
