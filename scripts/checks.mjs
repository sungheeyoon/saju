/**
 * 흐름 검사 일곱 벌이 함께 쓰는 **재는 도구 한 벌.**
 *
 * 리포터가 일곱 벌로 복사돼 있었다 — 바이트까지 같았다(md5 `0815851d…`). `sql()` 은 네 벌.
 * 같은 것이 일곱 자리에 있으면 고칠 일이 생겼을 때 여섯 자리가 안 고쳐지고, 그 여섯은
 * **안 고쳐진 줄도 모르는 채로** 돈다.
 *
 * ## 끝내는 일이 여기 있는 까닭
 *
 * 앞서는 스크립트마다 끝에서 `process.exit()` 를 불렀다. 그러면 러너가 이 파일들을
 * `import` 하는 순간 첫 스크립트가 **러너까지 함께 죽인다.** 그래서 두 가지를 바꿨다 —
 * 러너는 자식 프로세스로 돌리고(`run-checks.mjs`), 여기서는 `process.exitCode` 만 적는다.
 * 그러면 출력과 뒷정리가 끝날 기회가 남는다.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/**
 * 재는 자리 하나를 연다.
 *
 * `finish()` 를 부르면 사람이 읽는 요약 한 줄을 찍고, **러너가 읽을 값**을 따로 남긴다
 * (`CHECK_RESULT_FILE`). 사람이 보는 줄과 러너가 세는 수가 같은 자리에서 나므로
 * 둘이 갈라질 수 없다.
 */
export function createChecks(name) {
  const checks = [];

  const check = (label, pass, detail = '') => {
    checks.push({ label, pass, detail });
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  const finish = () => {
    const failed = checks.filter((one) => !one.pass);
    console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);

    const to = process.env.CHECK_RESULT_FILE;
    if (to) {
      writeFileSync(to, JSON.stringify({
        name,
        total: checks.length,
        passed: checks.length - failed.length,
        failed: failed.map((one) => one.label),
      }));
    }

    /** **`process.exit` 가 아니다** — 뒷정리가 끝날 기회를 남긴다 */
    if (failed.length > 0) process.exitCode = 1;
  };

  return { check, finish };
}

/** 운영자만 읽는 표를 SQL 로 본다 — 앱이 아니라 그게 그 표의 유일한 읽는 길이다 */
export const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();
