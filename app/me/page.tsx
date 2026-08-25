import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { unreadCount } from './requests/inbox';
import { chartOf } from '../chart';
import { toSearchParams } from '../query';
import { UnreadableRevisionError, queryFromRevision } from '../revision';
import { Onboarding } from './onboarding';
import { ReadingSection } from './reading/section';
import { ReviseChart } from './revise';
import { CALENDAR_KO, GENDER_KO, STEM_INFO, ELEMENT_KO } from '@/src/lib/saju';

/** 모델 240초 상한이 먼저 끝나 실패를 기록하고, DB 600초 만료보다는 먼저 닫는다. */
export const maxDuration = 300;

/**
 * 로그인한 사람이 도착하는 자리.
 *
 * 저장된 판본으로 **서버에서 계산한다.** 익명 화면은 브라우저에서 계산하지만 부르는
 * 함수는 같다(`chartOf`) — 엔진이 순수 TypeScript 라 양쪽에서 그대로 돈다. 저장하기
 * 전에 본 사주와 저장한 뒤에 보는 사주가 다를 자리를 만들지 않으려는 것이다.
 */
export default async function MePage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  const { data: account } = await supabase
    .from('app_user')
    .select('status, self_person_id')
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">내 사주</h1>
        <p className="text-sm text-secondary">{user.email}</p>
      </header>

      {account === null ? (
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      ) : account.status !== 'active' ? (
        <p className="text-sm text-muted">중지된 계정입니다.</p>
      ) : account.self_person_id === null ? (
        <Onboarding />
      ) : (
        <SelfChart personId={account.self_person_id} />
      )}

      <Footer />
    </main>
  );
}

async function SelfChart({ personId }: { personId: string }) {
  const supabase = await supabaseOnServer();

  const [{ data: person }, { data: edge }] = await Promise.all([
    supabase.from('person').select('current_revision_id').eq('id', personId).maybeSingle(),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);

  if (!person?.current_revision_id || !edge) {
    return <p className="text-sm text-muted">저장된 사주를 읽지 못했습니다.</p>;
  }

  /**
   * **현재 입력 하나만 읽는다**(ADR 0011).
   *
   * 전에는 이 자리가 판본을 전부 가져와 이력을 그렸다. 그것이 「고친 기록은 쌓입니다」의
   * 증거라고 여겼는데, 판본을 남기는 이유는 이력을 보여주기 위해서가 아니라 이미
   * 동의하고 이미 본 결과의 근거를 지키기 위해서다. 목록을 세워 두면 이제 정리되는
   * 입력이 화면에서 하나씩 사라지고, 그때 화면은 자기가 한 약속을 어긴 것처럼 보인다.
   *
   * 가리키는 id 로 묻는다. 「가장 최근 것이 현재일 것」이라고 짐작하면 현재를 정하는
   * 자리가 둘이 된다.
   */
  const { data: current } = await supabase
    .from('person_chart_revision')
    .select(
      'id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis',
    )
    .eq('id', person.current_revision_id)
    .maybeSingle();

  if (!current) return <p className="text-sm text-muted">현재 판본을 찾지 못했습니다.</p>;

  /**
   * 못 읽는 판본은 **메우지 않는다.**
   *
   * 모르는 출생지를 서울로 치면 저장할 때 본 사주와 다른 사주가 이 화면에 나온다.
   * 판본은 남아 있고 읽는 쪽이 못 읽는 것이므로, 그렇게 말하고 멈춘다.
   */
  let query;
  try {
    query = queryFromRevision(current, edge.local_label);
  } catch (error) {
    if (error instanceof UnreadableRevisionError) {
      return (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm">{error.message}</p>
          <p className="text-xs text-muted">
            저장된 값은 그대로 있습니다. 지금 화면이 그 값을 읽지 못하는 것입니다.
          </p>
        </section>
      );
    }
    throw error;
  }

  const { pillars } = chartOf(query);
  const columns = [
    ['시', pillars.hour],
    ['일', pillars.day],
    ['월', pillars.month],
    ['년', pillars.year],
  ] as const;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">{edge.local_label}</h2>
          <span className="text-xs text-muted">
            일간 <span className="glyph">{pillars.dayMaster}</span>{' '}
            {STEM_INFO[pillars.dayMaster].ko} · {ELEMENT_KO[STEM_INFO[pillars.dayMaster].element]}
          </span>
        </div>

        <table className="w-full table-fixed text-center">
          <thead>
            <tr className="text-xs text-muted">
              {columns.map(([label]) => (
                <th key={label} className="pb-1 font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.map(([label, pillar]) => (
                <td key={label} className="text-2xl">
                  {/* 시각을 모르면 시주가 아예 없다. 정오로 메워 午시를 내지 않는다 */}
                  {pillar === null ? <span className="text-sm text-muted">시각 모름</span> : pillar.name}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface-sunken p-4 text-sm">
        <dt className="text-muted">생년월일</dt>
        {/*
          음력으로 넣었으면 **적은 그대로와 바뀐 양력을 함께** 보여준다. 양력만
          보이면 사용자가 자기 입력을 못 알아보고, 원본만 보이면 우리가 무엇으로
          계산했는지 모른다(ADR 0002).
        */}
        <dd>
          {query.calendar === 'solar'
            ? current.solar_date
            : `${CALENDAR_KO[query.calendar]} ${current.original_date} · 양력 ${current.solar_date}`}
          {current.birth_time === null ? ' · 시각 모름' : ` ${query.time}`}
        </dd>
        <dt className="text-muted">성별</dt>
        <dd>{GENDER_KO[query.gender]}</dd>
        <dt className="text-muted">출생지</dt>
        <dd>{query.city}</dd>
        <dt className="text-muted">자시 규칙</dt>
        <dd>{query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'}</dd>
      </dl>

      {/*
        **자기 풀이** — 저장된 근거를 사용자가 직접 읽지 않아도 무엇이 보이는지
        알게 하는 자리다(US 23-1). 여는 것만으로는 만들지 않는다.
      */}
      <ReadingSection target={{ kind: 'self' }} />

      <ReviseChart personId={personId} current={query} />

      {/*
        전체 명식은 익명 화면이 그린다. 입력은 `#` 뒤에 실리므로 서버로 가지 않는다.
        같은 엔진·같은 함수를 쓰므로 여기 여덟 글자와 저쪽 여덟 글자는 같은 값이다.
      */}
      <p className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/#${toSearchParams(query).toString()}`}
          className="text-accent underline underline-offset-2"
        >
          전체 명식 보기
        </Link>
        {/*
          가족·친구는 이 화면에 없다. 여기는 「나」의 자리이고, 스무 명 한도가 세는
          것도 저쪽 목록이다.
        */}
        <Link href="/me/people" className="text-accent underline underline-offset-2">
          등록한 사람
        </Link>
        <Link href="/me/compat" className="text-accent underline underline-offset-2">
          저장된 사람끼리 궁합
        </Link>
        <Link href="/me/discovery" className="text-accent underline underline-offset-2">
          후보
        </Link>
        <Requests />
      </p>
    </section>
  );
}

/**
 * 요청함으로 가는 자리 — **안 읽은 것이 있으면 수를 함께 든다.**
 *
 * 알림은 앱 안에서만 온다(용어집). 그러니 들어왔을 때 **여기서** 눈에 띄어야 한다 —
 * 요청 화면까지 들어가야 알 수 있으면 앱 내 알림은 아무에게도 닿지 않는다.
 *
 * 목록 전체를 읽지 않고 개수만 묻는다. 이 화면은 알림의 내용을 그리지 않는다.
 */
async function Requests() {
  const unread = await unreadCount();

  return (
    <Link href="/me/requests" className="text-accent underline underline-offset-2">
      요청과 알림
      {unread > 0 && <span className="ml-1 font-medium">{unread}</span>}
    </Link>
  );
}

function Footer() {
  const signOut = async () => {
    'use server';
    const client = await supabaseOnServer();
    await client.auth.signOut();
    redirect('/');
  };

  return (
    <div className="flex items-center gap-4 border-t border-border pt-4 text-sm">
      <Link href="/" className="text-accent underline underline-offset-2">
        로그인 없이 계산하기
      </Link>
      <form action={signOut}>
        <button type="submit" className="text-accent underline underline-offset-2">
          로그아웃
        </button>
      </form>
    </div>
  );
}
