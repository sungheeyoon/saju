import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { readAccount } from './account';
import { unreadCount } from './requests/inbox';
import { chartOf } from '@/src/lib/input/chart';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { UNREADABLE_REVISION_NOTE, UnreadableRevisionError, queryFromRevision } from '@/src/lib/input/revision';
import { DiscoveryBoard } from './discovery/board';
import { AccountNotice } from './account-notice';
import { Onboarding } from './onboarding';
import { PillarCard } from './pillar-card';
import { ReviseChart } from './revise';
import { ReadingTabs } from './reading-tabs';
import { isBlocked } from '@/src/lib/account';
import { CALENDAR_KO, GENDER_KO } from '@/src/lib/saju';

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
  const { state } = await readAccount(supabase);
  const selfPersonId = state.kind === 'active' ? state.selfPersonId : null;

  return (
    <main className="app-shell flex flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.04em]">나의 명식과 인연</h1>
            <p className="mt-1 text-sm text-secondary">저장한 명식을 확인하고 오늘의 인연을 만나보세요.</p>
          </div>
        </div>
      </header>

      {isBlocked(state) ? (
        <AccountNotice state={state} />
      ) : selfPersonId === null ? (
        <Onboarding />
      ) : (
        <>
          <Unread />
          <SelfChart personId={selfPersonId} />
          {/*
            **추천은 홈에 선다**(PRD §2.0). 목록이 스냅샷이 된 뒤로 여는 값이 싸졌다 —
            전에는 방문마다 풀 전체를 줄 세우는 셈이라 이 자리에 둘 수 없었다.
          */}
          <DiscoveryBoard />
        </>
      )}
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

  if (!current) return <p className="text-sm text-muted">저장된 출생 정보를 찾지 못했습니다.</p>;

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
        <section className="flex flex-col gap-2 rounded-[1.75rem] border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm">{error.message}</p>
          <p className="text-xs text-muted">{UNREADABLE_REVISION_NOTE}</p>
        </section>
      );
    }
    throw error;
  }

  const saju = chartOf(query);

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <ReadingTabs
        current="chart"
        chartHref="/me"
        readingHref="/me/readings/self"
        label="내 사주"
      />
      <PillarCard
        label={edge.local_label}
        saju={saju}
        /* 고치는 손잡이는 카드 모서리에 뜬다 — 저장한 사람 카드의 관리 메뉴와 같은 자리다 */
        corner={<ReviseChart personId={personId} current={query} variant="corner" />}
        details={
          <section className="mt-5 rounded-2xl border border-border bg-surface-soft/60 px-4 py-3">
            <h3 className="text-xs font-semibold tracking-[0.08em] text-muted">저장된 출생 정보</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
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
                {current.birth_time === null ? ` · ${HOUR_UNKNOWN_LABEL}` : ` ${query.time}`}
              </dd>
              <dt className="text-muted">성별</dt>
              <dd>{GENDER_KO[query.gender]}</dd>
              <dt className="text-muted">출생지</dt>
              <dd>{query.city}</dd>
              <dt className="text-muted">자시 규칙</dt>
              <dd>{query.rule === 'jo' ? '조자시 (23:00 경계)' : '야자시 (자정 경계)'}</dd>
            </dl>
          </section>
        }
        footer={
          /*
            전체 명식은 저장한 사람의 `명식 보기`와 같은 상세 화면이 그린다. 내 입력을
            공개 계산 화면의 「모르는 사람」으로 다시 만들지 않고, 이미 저장된 Person 을
            그대로 연다.

            **이 화면에 남은 유일한 길이다.** 사람·궁합·인연 찾기·소식으로 가는 목록이
            여기 따로 서 있었는데, 그 넷은 이미 머리글의 메뉴가 든다 — 같은 길을 두 자리에
            세우면 하나를 고칠 때 다른 하나가 낡는다. 이 링크만 남는 것은 저쪽이 **이
            명식의 이어 보기**라서다. 메뉴에는 그런 자리가 없다.

            떠 있던 버튼을 카드 아래 띠로 들인다 — 저장한 사람 카드가 그 자리에 풀이를
            들고 서는 것과 같은 층이다.
          */
          <div className="flex flex-col gap-3 rounded-b-[1.75rem] border-t border-border bg-surface-soft/70 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">명식 전체</p>
              <p className="mt-0.5 text-sm text-secondary">
                지장간 · 공망 · 신살과 운의 흐름까지 이어서 봅니다.
              </p>
            </div>
            <Link
              href={`/me/people/${personId}`}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent sm:self-auto"
            >
              전체 명식 자세히 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

    </section>
  );
}

/**
 * 안 읽은 알림 — **있을 때만 선다.**
 *
 * 알림은 앱 안에서만 온다(용어집). 그러니 들어왔을 때 **여기서** 눈에 띄어야 한다 —
 * 요청 화면까지 들어가야 알 수 있으면 앱 내 알림은 아무에게도 닿지 않는다. 로그인한
 * 사람이 도착하는 자리가 이 화면이라 더 그렇다.
 *
 * 전에는 옆의 빠른 메뉴 안에 「새 소식 →」 한 줄로 늘 서 있었다. 그 목록을 걷어 내면서
 * 배지까지 같이 사라질 뻔했다 — **목록에서 숨긴 것을 배지에서도 숨기면** 알림이 닿는
 * 길이 없어진다. 그래서 길은 메뉴에 두고, **띠는 알림이 실제로 있을 때만** 세운다.
 * 늘 서 있는 줄은 곧 안 읽히고, 그때 정작 무언가 왔을 때도 안 읽힌다.
 *
 * 목록 전체를 읽지 않고 개수만 묻는다. 이 화면은 알림의 내용을 그리지 않는다.
 */
async function Unread() {
  const unread = await unreadCount();
  if (unread === 0) return null;

  return (
    <Link
      href="/me/requests"
      className="flex items-center justify-between gap-3 rounded-2xl border border-accent bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-strong hover:border-accent-strong"
    >
      <span>아직 확인하지 않은 새 소식이 있습니다.</span>
      <span className="flex shrink-0 items-center gap-2">
        {/*
          수만 그리면 화면 밖에서는 **아무 뜻이 없다.** 「1」을 읽어 주는 것으로는 그것이
          무엇의 1인지 알 수 없어서, 보이지 않는 말을 붙여 배지가 스스로 무엇인지 말하게
          한다. 밖에서 이 배지를 재는 검사도 같은 말을 짚는다(`scripts/check-match.mjs`).
        */}
        <span className="grid size-5 place-items-center rounded-full bg-fire text-[10px] font-bold text-white">
          {unread}
          <span className="sr-only">건 안 읽음</span>
        </span>
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
