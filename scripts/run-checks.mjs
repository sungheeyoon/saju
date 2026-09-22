/**
 * 흐름 검사 일곱 벌을 **전부 돌리고 끝에 한 번 답한다.**
 *
 * 앞서는 `npm run test:flow` 가 `&&` 사슬이었다. 그래서 `check-reading` 이 하나 틀리자
 * **`check-share` 65건이 아예 안 돌았다** — 그리고 그 상태가 화면에 「실패 1건」으로만
 * 보였다. 같은 사고가 `docs/product/prd-changelog.md`(2026-09-12)에 이미 적혀 있다: 「첫 스크립트에서 멈춰
 * 나머지 다섯이 한 번도 안 돌던 상태」. 사슬을 쓰는 한 되풀이된다.
 *
 * ## 자식 프로세스로 돌린다
 *
 * `import` 로는 못 한다 — 검사들은 제 안에서 Next 서버를 띄우고 포트를 잡고 끝에
 * 프로세스를 끝낸다. 한 프로세스에 모으면 첫 검사의 뒷정리가 다음 검사의 서버를 끄고,
 * 무엇보다 하나가 죽으면 러너가 함께 죽는다.
 *
 * ## 차례로 돈다
 *
 * 같은 로컬 DB 한 벌을 나눠 쓰고, 전역으로 세는 검사가 여럿이다(「후보가 몇인가」).
 * 나란히 돌리면 서로가 남긴 행에 걸려 **재려던 것과 상관없는 자리에서** 빨개진다.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** 도는 차례 — 가벼운 것부터, 서버를 띄우는 것은 뒤로 */
export const SCRIPTS = [
  'check-onboarding.mjs',
  'check-managed.mjs',
  'check-discovery.mjs',
  'check-match.mjs',
  'check-result.mjs',
  'check-reading.mjs',
  'check-share.mjs',
];

/**
 * 결과를 사람이 읽는 줄로 맞춘다 — **러너의 유일한 판단**이라 따로 잰다.
 *
 * 여기서 재는 것은 「전부 돌았는가」다. 첫 검사가 실패해도 **마지막 검사의 이름이 결과에
 * 서야** 한다 — 그 한 줄이 없으면 사슬로 돌아간 것을 아무도 못 본다.
 */
/**
 * 검사가 **단언과 별개로** 비정상 종료했는가.
 *
 * `finish()` 는 실패가 있으면 `exitCode = 1` 을 적으므로 단언 실패는 여기 안 걸린다.
 * 여기 걸리는 것은 **단언은 다 통과했는데 프로세스가 성치 않게 끝난** 경우다 —
 * 신호로 끊겼거나, 요약을 쓴 뒤 종료 훅이 던졌거나.
 */
const brokeAfterwards = (one) =>
  one.ran && one.failed.length === 0 && (one.signal != null || (one.status ?? 0) !== 0);

export function summarize(results) {
  const ran = results.filter((one) => one.ran);
  const total = ran.reduce((sum, one) => sum + one.total, 0);
  const passed = ran.reduce((sum, one) => sum + one.passed, 0);
  const failedScripts = results.filter(
    (one) => !one.ran || one.failed.length > 0 || brokeAfterwards(one));

  const lines = results.map((one) => {
    if (!one.ran) return `  FAIL ${one.name} — 돌지 못했다 (${one.reason ?? '이유 없음'})`;
    if (brokeAfterwards(one)) {
      return `  FAIL ${one.name} — ${one.passed}/${one.total} 은 통과했지만 비정상 종료했다`
        + ` (${one.signal ?? `종료 코드 ${one.status}`})`;
    }
    return `  ${one.failed.length === 0 ? 'ok  ' : 'FAIL'} ${one.name} — ${one.passed}/${one.total}`;
  });

  lines.push('');
  lines.push(`${ran.length}/${results.length} 스크립트 완주`);
  lines.push(`검사 ${total}건: ${passed}건 통과${total - passed > 0 ? ` · ${total - passed}건 실패` : ''}`);

  for (const one of results) {
    for (const label of one.failed ?? []) lines.push(`  FAIL ${one.name} › ${label}`);
  }

  return { text: lines.join('\n'), ok: failedScripts.length === 0 };
}

function run() {
  const dir = mkdtempSync(join(tmpdir(), 'saju-flow-'));
  const results = [];

  try {
    for (const name of SCRIPTS) {
      console.log(`\n── ${name} ──────────────────────────────────────────────`);
      const to = join(dir, `${name}.json`);
      const child = spawnSync('node', [join('scripts', name)], {
        stdio: 'inherit',
        env: { ...process.env, CHECK_RESULT_FILE: to },
      });

      /**
       * **값이 없으면 「돌지 못했다」다.** 검사가 요약을 적기 전에 죽으면(스택이 안 떠
       * 있거나 서버가 안 붙거나) 그 자리는 0건 통과가 아니라 **안 잰 것**이다. 둘을
       * 같은 얼굴로 두면 스택이 죽은 날 「전부 통과」가 나온다.
       *
       * **요약이 있어도 종료 코드를 함께 본다.** 요약은 `finish()` 가 쓰고 그 뒤에도
       * 프로세스는 더 산다 — 종료 훅이 던지거나 신호로 끊기면 **단언은 전부 통과한
       * 채로 프로세스가 비정상 종료한다.** 그 자리를 성공으로 접으면 러너가 「전부
       * 통과」라고 말하면서 실제로는 뒷정리가 깨진 것을 숨긴다.
       */
      try {
        results.push({ ran: true, status: child.status, signal: child.signal,
          ...JSON.parse(readFileSync(to, 'utf8')) });
      } catch {
        results.push({
          ran: false, name, total: 0, passed: 0, failed: [],
          reason: `종료 코드 ${child.status ?? child.signal}`,
        });
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const { text, ok } = summarize(results);
  console.log(`\n${'─'.repeat(60)}\n${text}`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
