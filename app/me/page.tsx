import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { chartOf } from '../chart';
import { toSearchParams } from '../query';
import { UnreadableRevisionError, queryFromRevision } from '../revision';
import { Onboarding } from './onboarding';
import { ReviseChart } from './revise';
import { CALENDAR_KO, GENDER_KO, STEM_INFO, ELEMENT_KO } from '@/src/lib/saju';

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

  const [{ data: person }, { data: edge }, { data: revisions }] = await Promise.all([
    supabase.from('person').select('current_revision_id').eq('id', personId).maybeSingle(),
    supabase.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
    /**
     * 판본을 **전부** 가져온다. 한 줄만 가져오면 이력이 있다는 사실이 화면에서
     * 사라지고, 「고친 기록은 덮어쓰지 않고 쌓입니다」는 아무도 확인할 수 없는 말이 된다.
     */
    supabase
      .from('person_chart_revision')
      .select(
        'id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis, created_at, fingerprint',
      )
      .eq('person_id', personId)
      .order('created_at', { ascending: false }),
  ]);

  if (!person?.current_revision_id || !edge || !revisions) {
    return <p className="text-sm text-muted">저장된 사주를 읽지 못했습니다.</p>;
  }

  const current = revisions.find((revision) => revision.id === person.current_revision_id);
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

      <ReviseChart personId={personId} current={query} />

      <RevisionHistory revisions={revisions} currentId={current.id} />

      {/*
        전체 명식은 익명 화면이 그린다. 입력은 `#` 뒤에 실리므로 서버로 가지 않는다.
        같은 엔진·같은 함수를 쓰므로 여기 여덟 글자와 저쪽 여덟 글자는 같은 값이다.
      */}
      <p className="text-sm">
        <Link
          href={`/#${toSearchParams(query).toString()}`}
          className="text-accent underline underline-offset-2"
        >
          전체 명식 보기
        </Link>
      </p>
    </section>
  );
}

/**
 * 판본 이력 — **지워지지 않았다는 것을 보이는 자리.**
 *
 * 지문 앞자리를 함께 적는다. 「무엇이 달라졌는가」를 문장으로 만들려면 두 판본을
 * 비교해 말을 지어내야 하는데, 지어낸 말은 틀릴 수 있다. 지문은 다르면 다르다고만
 * 말하고 그 이상을 주장하지 않는다.
 */
function RevisionHistory({
  revisions,
  currentId,
}: {
  revisions: { id: string; created_at: string; fingerprint: string }[];
  currentId: string;
}) {
  if (revisions.length < 2) return null;

  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm">판본 {revisions.length}개</summary>
      <ul className="mt-3 flex flex-col gap-1.5 text-xs">
        {revisions.map((revision) => (
          <li key={revision.id} className="flex items-center gap-2">
            <span className="text-muted">
              {new Date(revision.created_at).toLocaleString('ko-KR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            <span className="font-mono text-muted">{revision.fingerprint.slice(0, 12)}</span>
            {revision.id === currentId && <span className="text-accent">지금 보는 것</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        옛 판본은 지우지 않습니다. 어떤 기록이 어느 사주를 대상으로 만들어졌는지 되짚기
        위해서입니다.
      </p>
    </details>
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
