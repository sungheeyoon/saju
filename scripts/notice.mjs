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
 * 판본은 **상수 한 줄**이다(`NOTICE_VERSION`). 한동안 이름·시행일과 한 덩어리였고
 * (`NOTICE_EDITION`), 그 둘이 화면에서 걷히면서 다시 상수로 돌아왔다 — 화면에 안 서는
 * `notice-v3` 은 기록에만 남는 열쇠다.
 */
const found = /export const NOTICE_VERSION = '([^']+)'/.exec(source);

if (found === null) {
  throw new Error('`NOTICE_VERSION` 을 읽지 못했습니다 — notice.ts 의 모양이 바뀌었습니다.');
}

export const NOTICE_VERSION = found[1];

/** 검사가 쓰는 종료일 — 한 자리에 두어 손잡이와 검사가 같은 값을 본다 */
export const CHECK_ENDS_ON = '2026-10-31';

/**
 * 입력을 쓰는 문에 함께 가는 **여덟 글자** (ADR 0071).
 *
 * 저장하는 네 문이 스냅샷을 함께 받으면서 검사도 그 값을 대야 한다. 안 대면
 * `person.current_chart` 가 빈 채로 남고, 그러면 **수락이 베낄 것이 없어** 궁합 결과
 * 화면이 통째로 닫힌다 — 재어 봤다(`check-result` 7건).
 *
 * ## 왜 진짜로 안 세나
 *
 * 엔진은 TypeScript 에 있고 이 검사들은 `.mjs` 다. 그리고 **DB 는 「이 여덟 글자가 저
 * 입력에서 나왔나」를 끝내 못 본다** — 문이 보는 것은 셋뿐이다: 낱자가 천간 열·지지
 * 열둘 안인가, 일간이 일주의 천간인가, 시주의 유무가 입력과 맞는가.
 *
 * 그래서 여기서는 **그 셋을 만족하는 한 벌**을 댄다. 저장된 값이 엔진이 내는 값과 같은지는
 * **앱을 띄워 재는 자리**가 잰다(`e2e/signed-in.spec.ts` — 화면이 아니라 `person` 행을
 * 읽는다). 층마다 재는 것이 다르고, 이 층이 재는 것은 「화면과 문이 이어져 있는가」다.
 *
 * ## 사람마다 다른 글자를 준다
 *
 * 둘이 같은 여덟 글자를 들면 「누구 것을 베꼈나」를 가릴 수 없다. 씨앗에서 일간을
 * 골라, 부르는 쪽이 아무것도 안 정해도 사람마다 달라진다.
 */
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

export const chartFor = (seed = '', hasHour = true) => {
  const at = [...String(seed)].reduce((sum, one) => sum + one.codePointAt(0), 0) % STEMS.length;
  const dayStem = STEMS[at];

  return {
    year: { stem: '甲', branch: '子' },
    month: { stem: '乙', branch: '丑' },
    day: { stem: dayStem, branch: '寅' },
    /** 시각을 모르면 **없음**이다 — 정오로 메운 시주가 아니다 */
    hour: hasHour ? { stem: '丁', branch: '卯' } : null,
    dayMaster: dayStem,
  };
};

/** 그 여덟 글자를 낸 엔진 판 — 검사가 댄 값이라는 것이 이름에 드러나야 한다 */
export const CHECK_CHART_ENGINE = 'chart-for-checks';

/** 저장하는 문에 함께 가는 두 칸 — 부르는 쪽이 이름을 손으로 안 적게 */
export const chartArgs = (seed = '', hasHour = true) => ({
  p_chart: chartFor(seed, hasHour),
  p_chart_engine_version: CHECK_CHART_ENGINE,
});

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
  /*
    **정원은 쌓인다.** 「오늘 정원」이라고 말하지만 세는 것은 이 코드로 가입한 계정
    전부(`complete_signup`)다. 검사가 계정을 하나씩 만들고 지우지 않으므로, 백 번쯤
    돌면 그 뒤로는 **아무것도 안 고쳐도 빨간불**이 된다 — 재려던 것과 상관없는 자리에서.

    벽을 넓히지 않는다(정원 자체는 pgTAP 이 잰다). 검사가 만든 계정에서 **이 코드의
    표식만 뗀다** — 사람이 만든 계정에는 안 닿는다.
  */
  psql(`update public.app_user set signup_code = null where signup_code = '${code}'`);
  psql(`insert into public.signup_code (code, note, valid_on, max_uses)
        values ('${code}', '검사', (now() at time zone 'Asia/Seoul')::date, ${maxUses})
        on conflict (code) do update
          set valid_on = excluded.valid_on, valid_until = excluded.valid_on, max_uses = excluded.max_uses`);
  clearMachineRunsFromToday();
}

/**
 * 도구가 만든 시도를 **오늘에서 비켜 둔다.**
 *
 * 하루 전체 상한(`reading_daily_budget`)은 사람이 아니라 **서비스에 걸린 벽**이다.
 * 로컬은 모델을 부르지 않지만 그 벽이 세는 것은 돈이 아니라 `reading_run` 행이라,
 * 검사가 풀이를 심을 때마다 한 칸씩 쌓이고 100이 차면 도구가 제 벽에 갇힌다 —
 * 「오늘 만들 수 있는 풀이를 모두 썼습니다」로 씨앗부터 죽는다.
 *
 * **벽은 낮추지 않는다.** 낮추면 그 벽이 실제로 서는지를 영영 못 본다(프로덕션에서는
 * 이것이 돈을 막는 자리다). 대신 **도구가 심은 줄만** 어제로 미룬다 — 모델 이름이
 * 그 표식이고, 사람이 만든 줄에는 안 닿는다.
 *
 * `scripts/ui-seed.mjs` 와 `e2e/session.ts` 가 같은 일을 한다. 세 층이 각자 돌 수 있어야
 * 하므로 같은 규칙을 각자 들되, 표식의 목록은 여기 한 벌이다.
 */
export const MACHINE_MODELS = ['gpt-e2e', 'gpt-ui-walk', 'gpt-5.6-luna', 'x'];

/**
 * **표식은 모델 이름만으로 모자랐다.** 동의가 여는 시도(`match`)는 그 자리에서 모델을
 * 모르므로 `model` 이 비어 있다 — 이름으로만 고르면 그 줄들이 오늘에 남아 쌓인다.
 * 그래서 **계정으로도 본다**: 도구가 만드는 계정은 전부 `@example.com` 이고, 구글로
 * 로그인한 사람의 주소는 그럴 수 없다.
 */
export function clearMachineRunsFromToday() {
  const tags = MACHINE_MODELS.map((one) => `'${one}'`).join(', ');
  psql(`update public.reading_run r
          set created_at = r.created_at - interval '1 day'
        where r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul')
                               at time zone 'Asia/Seoul')
          and (r.model in (${tags})
               or exists (select 1 from auth.users u
                           where u.id = r.user_id and u.email like '%@example.com'))`);
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
