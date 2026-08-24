import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DISCOVERY_POLICY_V0 } from '@/src/lib/discovery';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { candidatesForViewer, type CandidateBoard } from '../candidates';
import { selfElementSummary } from '../summary';
import { HideButton, ParticipationToggle, ProfileForm, UnhideAll } from './manage';
import { PREFER_GENDERS, type DiscoveryProfileInput, type PreferGender } from './profile';

export const metadata = {
  title: '후보 — 만세력',
  description: '매칭에 참여한 사람들 사이에서 오행 보완으로 줄 세운 후보를 봅니다.',
};

/**
 * 후보 화면 — **정렬만 하고 아무도 지우지 않는다.**
 *
 * 하드 제외는 전부 DB 가 한다(`discovery_candidates`): 미참여·중지된 계정·다시 보지
 * 않기·양쪽이 직접 설정한 성별 조건·낡은 요약. 사주 값으로 자르는 자리는 어디에도
 * 없다(ADR 0003) — 안 보여준 사람은 사용자가 존재조차 모르므로 틀렸다는 피드백이
 * 영영 오지 않는다.
 *
 * 이 화면이 후보에 대해 아는 것은 별명·소개·한 줄 설명뿐이다. 오행 요약도, 두 축의
 * 값도, 점수도 서버에 오지 않거나 서버에서 멈춘다(`candidatesForViewer`).
 */
export default async function DiscoveryPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const [{ data: account }, { data: profile }, { data: hidden }] = await Promise.all([
    supabase.from('app_user').select('status, self_person_id').maybeSingle(),
    supabase
      .from('discovery_profile')
      .select('nickname, intro, prefer_gender, opted_in_at, element_revision_id')
      .maybeSingle(),
    supabase.from('discovery_hidden').select('hidden_user_id'),
  ]);

  const optedIn = profile?.opted_in_at != null;
  const board = optedIn ? await openBoard(user.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">후보</h1>
        <p className="max-w-2xl text-sm text-secondary">
          매칭에 참여한 사람들 사이에서 <strong className="font-medium">오행 보완</strong>과
          함께 놓은 균형 두 축으로 줄을 세웁니다({DISCOVERY_POLICY_V0.version}). 기존
          데이팅 서비스와 다른 발견 가설이고, 검증된 정답이 아닙니다.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/me" className="text-accent underline underline-offset-2">
            내 사주
          </Link>
          <Link href="/me/people" className="text-accent underline underline-offset-2">
            등록한 사람
          </Link>
        </p>
      </header>

      {account === null ? (
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      ) : account.status !== 'active' ? (
        <p className="text-sm text-muted">중지된 계정입니다.</p>
      ) : account.self_person_id === null ? (
        <section className={`${CARD} bg-surface-sunken`}>
          <h2 className="text-base font-semibold">먼저 내 사주를 등록해 주세요</h2>
          <p className="mt-1.5 text-sm text-secondary">
            후보 순서는 오행으로 정해지므로 내 사주가 있어야 참여할 수 있습니다.{' '}
            <Link href="/me" className="text-accent underline underline-offset-2">
              내 사주 등록하기
            </Link>
          </p>
        </section>
      ) : (
        <>
          <ProfileForm current={profileInput(profile)} />

          {/*
            **켜기 전에 무엇이 나가는지부터 읽힌다.** 별명이 없으면 아직 켤 수 없지만,
            그렇다고 이 설명을 감추면 사용자는 무엇을 켜는 것인지 모른 채 별명부터 짓게 된다.
            버튼은 잠그고 이유를 옆에 적는다.
          */}
          <ParticipationToggle optedIn={optedIn} needsNickname={profile === null} />

          {board !== null && (
            <Candidates board={board} hiddenCount={(hidden ?? []).length} />
          )}
        </>
      )}
    </main>
  );
}

/**
 * 화면을 그리기 전에 후보를 다 읽는다 — **`Date.now()` 도 여기서 부른다.**
 *
 * 씨앗이 오늘 날짜에서 나므로 그리는 도중에 시각을 물으면 같은 요청 안에서도 목록이
 * 달라질 수 있다. 엔진이 지금을 넘겨받는 것과 같은 규율이다.
 *
 * **낡은 요약을 여기서 고친다.** 판본을 고친 뒤 `refresh_discovery_summary` 가 실패한
 * 채로 남아 있으면 나는 참여 중인데 아무에게도 안 보인다. 그 상태를 스스로 벗어나게 한다.
 */
async function openBoard(viewerUserId: string): Promise<CandidateBoard | null> {
  const self = await selfElementSummary();
  if (self === null) return null;

  const supabase = await supabaseOnServer();
  await supabase.rpc('refresh_discovery_summary', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });

  return candidatesForViewer(viewerUserId, self.summary, Date.now());
}

function profileInput(
  profile: { nickname: string; intro: string | null; prefer_gender: string } | null,
): DiscoveryProfileInput {
  return {
    nickname: profile?.nickname ?? '',
    intro: profile?.intro ?? '',
    preferGender: (PREFER_GENDERS as readonly string[]).includes(profile?.prefer_gender ?? '')
      ? (profile?.prefer_gender as PreferGender)
      : 'any',
  };
}

function Candidates({ board, hiddenCount }: { board: CandidateBoard; hiddenCount: number }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-base font-semibold">지금 볼 수 있는 후보</h2>
        <p className="text-sm text-secondary">
          {board.cards.length === 0 ? '아직 없습니다' : `${board.cards.length}명`}
        </p>
      </div>

      {/*
        여기서 멈추는 이유와 다음을 먼저 말한다 — **상세 궁합은 서로 동의한 뒤**다.
        문장은 정책이 든다.
      */}
      <p className="rounded-md border border-border bg-surface-sunken p-3 text-sm">
        {board.teaser}
      </p>

      {board.notice !== null && <p className="text-sm text-secondary">{board.notice}</p>}

      {/* 순서가 정답이 아니라는 말은 **목록이 든다** — 정책이 낸 문장 그대로다 */}
      <p className="text-xs text-muted">{board.caveat}</p>

      {board.cards.length === 0 ? (
        <p className="text-sm text-muted">
          매칭에 참여한 다른 사람이 아직 없습니다. 참여자가 생기면 여기에 섭니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {board.cards.map((card) => (
            <li key={card.candidateUserId} className={`${CARD} flex flex-col gap-2`}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-xs text-muted">{card.position + 1}</span>
                <h3 className="text-base font-semibold">{card.nickname}</h3>
                {card.exploration && (
                  <span className="rounded-full bg-accent-wash px-2 py-0.5 text-xs text-accent">
                    탐색 후보
                  </span>
                )}
              </div>

              {card.intro !== null && <p className="text-sm text-secondary">{card.intro}</p>}

              {/*
                **추천 이유는 적극적으로 말한다.** 어느 오행이 무엇을 채우는지까지 —
                감추면 「왜 이 사람인가」에 답하지 못한다. 문장은 정책이 지어 오고
                (`ELEMENT_MEANING`), 화면은 글자를 앞에 세우기만 한다.
              */}
              {card.highlights.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {card.highlights.map((highlight) => (
                    <li key={highlight.element} className="flex items-baseline gap-2 text-sm">
                      <span className="glyph rounded-md bg-accent-wash px-1.5 py-0.5 text-accent">
                        {highlight.element}
                      </span>
                      <span>{highlight.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-sm text-secondary">{card.balanceLabel}</p>

              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-2">
                <HideButton candidateUserId={card.candidateUserId} />
                {/*
                  상세 궁합 요청은 아직 없다. 없는 버튼을 회색으로 세워 두지 않는다 —
                  누를 수 없는 버튼은 무엇이 곧 되는지 말해 주지 않는다.
                */}
                <span className="text-xs text-muted">
                  상세 궁합 요청은 아직 열리지 않았습니다.
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 없는 것을 설명하지 않는다 — 탐색 후보가 실제로 섰을 때만 이 말이 붙는다 */}
      {board.explorationNote !== null && (
        <p className="text-xs text-muted">{board.explorationNote}</p>
      )}

      <UnhideAll count={hiddenCount} />
    </section>
  );
}
