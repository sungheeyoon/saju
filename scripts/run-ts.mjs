/**
 * 저장소의 TS 를 그대로 실행한다 — **`@/` 별칭까지 풀어서.**
 *
 * `npx jiti` 를 바로 부르면 `app/` 아래 코드가 못 돈다. 화면 코드는 `@/src/...` 로
 * 적는 것이 이 저장소의 관례인데 jiti 는 tsconfig 의 paths 를 모르기 때문이다.
 * 그것 때문에 A/B 하네스가 **모델을 부르기 직전에** 죽었다 — dry-run 은 그 경로를
 * 건드리지 않아 한 번도 안 걸렸다.
 *
 *   node scripts/run-ts.mjs scripts/ab-overlaps.ts --execute ...
 */
import { createJiti } from 'jiti';
import { resolve } from 'node:path';

const [entry] = process.argv.slice(2);
if (entry === undefined) {
  console.error('실행할 파일이 없다: node scripts/run-ts.mjs <파일.ts> [인자…]');
  process.exit(1);
}

/**
 * **`process.argv` 를 정상 모양으로 되돌린다.**
 *
 * 이 래퍼를 거치면 `argv[1]` 이 실행기 자신이고 대상 스크립트는 `argv[2]` 로 밀린다.
 * 그 한 칸 때문에 두 군데가 조용히 틀렸다 — 진입 가드가 안 걸려 dry-run 이 아무 일도
 * 안 하고 끝났고, 재채점기가 자기 경로를 자료 디렉터리로 읽었다. 부르는 스크립트마다
 * 「래퍼를 거쳤나」를 따지게 하는 대신 여기서 한 번 맞춘다.
 */
const target = resolve(process.cwd(), entry);
process.argv = [process.argv[0], target, ...process.argv.slice(3)];

const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  interopDefault: true,
});

await jiti.import(target);
