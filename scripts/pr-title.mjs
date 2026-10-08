/**
 * **PR 제목의 꼴을 잰다** — `type(scope): 한국어 문장`(`docs/agents/code-rules/locks.md` 「커밋과 PR」). squash 가 PR 제목을 main 의
 * 커밋 제목으로 쓰므로 머지 전에 여기서 잰다. `verify` 의 `plan` 이 PR 에서 부른다 — `gate` 가 `plan` 을 기다리므로 꼴이 틀리면 머지가 선다.
 *
 * 목록에 없는 type(`perf`)이 아무 검사 없이 들어오던 것을 2026-10-08 에 셌다 — 최근 400 커밋에 문서 목록 밖의 `ui` 7 · `perf` 5 ·
 * `ops` 1. 운영자가 `perf` · `ui` 를 목록에 더했다(같은 날).
 *
 * 제목을 고친 뒤에는 PR 의 `verify` 를 다시 돌린다 — 제목만 고치는 것은 실행을 안 깨운다.
 */

/** 허용하는 type — 순서는 `locks.md` 의 목록과 같다(시험이 견준다) */
export const TYPES = ['feat', 'fix', 'perf', 'refactor', 'ui', 'test', 'docs', 'chore', 'ci'];

const SHAPE = new RegExp(`^(${TYPES.join('|')})(\\([^()\\s]+\\))?: \\S`);

/**
 * 제목이 꼴에 맞으면 `null`, 아니면 사람에게 할 한 문장.
 *
 * @param {string} title
 * @returns {string | null}
 */
export function titleProblem(title) {
  if (SHAPE.test(title)) return null;
  const type = /^([A-Za-z]+)[(:]/.exec(title)?.[1];
  if (type !== undefined && !TYPES.includes(type)) {
    return `PR 제목의 type \`${type}\` 은 목록에 없다 — ${TYPES.join(' · ')} 중 하나`;
  }
  return 'PR 제목은 `type(scope): 문장` 꼴이다 — 예: `fix(matching): 꽉 찬 보관함에서 지나침이 실패해도 한 사람이 남는다`';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problem = titleProblem(process.env.PR_TITLE ?? '');
  if (problem !== null) {
    console.error(`::error::${problem} (docs/agents/code-rules/locks.md 「커밋과 PR」)`);
    process.exit(1);
  }
  console.log('PR 제목의 꼴이 맞다');
}
