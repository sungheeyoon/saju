/**
 * 검사 계정이 **안내를 지나게 한다.**
 *
 * 첫 입력 앞에 관문이 하나 생겼다(`create_self_person`). 실제 사람은 `/welcome` 에서
 * 그 값을 남기고 오므로, 「가입한 사람」을 흉내 내는 검사도 같은 자리를 지난다.
 *
 * **판본을 손으로 안 적는다.** 적으면 코드가 판본을 올리는 날 검사만 옛 글자를 들고
 * 조용히 지나가거나, 더 나쁘게는 관문에 걸려 「무엇이 깨졌는지 안 보이는」 빨간불이 된다.
 * 한 자를 두 언어에 적어야 하는 자리라 **원본에서 읽어 온다** — 모양이 바뀌면 여기서
 * 그 자리에 멈춘다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/consent/notice.ts', import.meta.url), 'utf8');
const found = /export const NOTICE_VERSION = '([^']+)'/.exec(source);

if (found === null) {
  throw new Error('`NOTICE_VERSION` 을 읽지 못했습니다 — notice.ts 의 모양이 바뀌었습니다.');
}

export const NOTICE_VERSION = found[1];

/** 검사가 쓰는 종료일 — 한 자리에 두어 손잡이와 검사가 같은 값을 본다 */
export const CHECK_ENDS_ON = '2026-10-31';

/**
 * 일정을 세운다 — **없으면 확인이 안 남는다.**
 *
 * 일정은 표에 있고 언제든 옮길 수 있다. 그래서 검사도 자기 몫을 스스로 세운다 —
 * 앞선 검사가 무엇을 남겼는지 기대하지 않는다.
 */
export function scheduleBeta(endsOn = CHECK_ENDS_ON) {
  // **지우고 넣지 않는다** — 이미 그 값이면 아무것도 안 한다(`e2e/session.ts` 와 같은 까닭).
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq',
    '-c', `insert into public.beta_schedule (ends_on, note)
           select '${endsOn}', '검사'
           where coalesce((select s.ends_on from public.current_beta_schedule() s),
                          '1900-01-01') <> '${endsOn}'`]);
}

/** 선택 동의는 **꺼 둔다** — 켜 두면 「동의한 사람에게만」을 재는 검사가 우연히 통과한다 */
export async function passNotice(client) {
  scheduleBeta();

  const { error } = await client.rpc('acknowledge_notice', {
    p_version: NOTICE_VERSION,
    p_ends_on: CHECK_ENDS_ON,
    p_improvement: false,
    p_contact: false,
  });
  if (error) throw new Error(`안내를 지나지 못했습니다 — ${error.message}`);
}
