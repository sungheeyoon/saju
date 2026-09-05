/**
 * 검사 계정이 **가입을 끝내게 한다.**
 *
 * 첫 입력 앞의 관문이 하나다(ADR 0042). 실제 사람은 `/signup` 에서 코드·이름·안내
 * 확인을 한 번에 남기고 오므로, 「가입한 사람」을 흉내 내는 검사도 같은 문을 지난다.
 *
 * **판본을 손으로 안 적는다.** 적으면 코드가 판본을 올리는 날 검사만 옛 글자를 들고
 * 조용히 지나가거나, 더 나쁘게는 관문에 걸려 「무엇이 깨졌는지 안 보이는」 빨간불이 된다.
 * 한 자를 두 언어에 적어야 하는 자리라 **원본에서 읽어 온다** — 모양이 바뀌면 여기서
 * 그 자리에 멈춘다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/consent/notice.ts', import.meta.url), 'utf8');

/**
 * 판본은 이제 **이름·시행일과 한 덩어리**에서 나온다(`NOTICE_EDITION`). 사용자 화면에
 * 서는 것은 「제3판 · 2026년 9월 4일 시행」이고, `notice-v3` 은 기록에만 남는 열쇠다.
 */
const found = /version: '([^']+)'/.exec(source);

if (found === null) {
  throw new Error('`NOTICE_EDITION.version` 을 읽지 못했습니다 — notice.ts 의 모양이 바뀌었습니다.');
}

export const NOTICE_VERSION = found[1];

/** 검사가 쓰는 종료일 — 한 자리에 두어 손잡이와 검사가 같은 값을 본다 */
export const CHECK_ENDS_ON = '2026-10-31';

/** 검사가 쓰는 테스트 코드 — 오늘 하루, 넉넉한 정원 */
export const CHECK_CODE = 'CHECKCODE';

const psql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq',
    '-c', statement], { encoding: 'utf8' });

/**
 * 오늘 쓸 수 있는 코드를 세운다 — **운영자가 SQL 로 넣는 그 길로.**
 *
 * `signup_code` 는 `service_role` 에도 닫혀 있다. 그 키가 새면 살아 있는 코드가 통째로
 * 열리기 때문이다(`invite` 가 그랬던 것과 같은 까닭). 그래서 이 검사도 앱이 쓰는 길이
 * 아니라 운영자가 쓰는 길로 넣는다.
 *
 * **날짜가 서울 자정으로 넘어가면 어제 코드가 된다.** 그래서 부를 때마다 `valid_on` 을
 * 오늘로 밀어 둔다 — 자정을 걸친 검사가 이유 없이 빨간불이 되지 않게.
 */
export function seedSignupCode(code = CHECK_CODE, maxUses = 100) {
  psql(`insert into public.signup_code (code, note, valid_on, max_uses)
        values ('${code}', '검사', (now() at time zone 'Asia/Seoul')::date, ${maxUses})
        on conflict (code) do update
          set valid_on = excluded.valid_on, max_uses = excluded.max_uses`);
}

/**
 * 일정을 세운다 — **없으면 확인이 안 남는다.**
 *
 * 일정은 표에 있고 언제든 옮길 수 있다. 그래서 검사도 자기 몫을 스스로 세운다 —
 * 앞선 검사가 무엇을 남겼는지 기대하지 않는다.
 */
export function scheduleBeta(endsOn = CHECK_ENDS_ON) {
  // **지우고 넣지 않는다** — 이미 그 값이면 아무것도 안 한다(`e2e/session.ts` 와 같은 까닭).
  psql(`insert into public.beta_schedule
             (ends_on, note, operator_name, operator_officer, operator_contact)
           select '${endsOn}', '검사', '만세력 운영자', '검사 담당', 'ops@example.com'
           where coalesce((select s.ends_on from public.current_beta_schedule() s),
                          '1900-01-01') <> '${endsOn}'
              or (select s.operator_contact from public.current_beta_schedule() s) is null`);
}

/**
 * 가입을 끝낸다 — **코드·이름·안내 확인이 한 번에 나간다**(ADR 0042).
 *
 * 전에는 `acknowledge_notice` 와 `save_my_profile` 을 잇달아 불렀다. 문이 하나가 되면서
 * 손잡이도 하나가 됐다 — 실제 사람이 지나는 길과 같은 문을 지나야 이 손잡이가 무엇을
 * 흉내 내는지 말할 수 있다.
 *
 * 이름은 **유일해야 한다.** 부딪히면 검사가 재려던 것과 상관없는 자리에서 넘어지므로,
 * 부르는 쪽이 이름을 안 정하면 무작위로 짓는다.
 *
 * 선택 동의는 **꺼 둔다** — 켜 두면 「동의한 사람에게만」을 재는 검사가 우연히 통과한다.
 */
export async function passNotice(client, nickname) {
  scheduleBeta();
  seedSignupCode();

  const current = await client.rpc('current_beta_schedule');
  const { error } = await client.rpc('complete_signup', {
    p_code: CHECK_CODE,
    p_nickname: nickname ?? `벗${Math.random().toString(36).slice(2, 8)}`,
    p_version: NOTICE_VERSION,
    p_schedule_id: current.data?.[0]?.schedule_id,
    p_improvement: false,
    p_contact: false,
  });
  if (error) throw new Error(`가입을 끝내지 못했습니다 — ${error.message}`);
}
