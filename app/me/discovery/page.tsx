import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { candidatesForViewer, type CandidateBoard } from '../candidates';
import { Halted } from '../halted';
import { selfElementSummary } from '../summary';
import { HideButton, ParticipationToggle, ProfileForm, RequestButton, UnhideAll } from './manage';
import { PREFER_GENDERS, type DiscoveryProfileInput, type PreferGender } from './profile';

export const metadata = {
  title: '인연 찾기 — 만세력',
  description: '오행의 보완을 바탕으로 새로운 인연을 살펴봅니다.',
};

/**
 * 후보 화면 — **정렬만 하고 아무도 지우지 않는다.**
 *
 * 하드 제외는 전부 DB 가 한다(`discovery_board`): 미참여·중지된 계정·다시 보지
 * 않기·양쪽이 직접 설정한 성별 조건·낡은 요약. 사주 값으로 자르는 자리는 어디에도
 * 없다(ADR 0003) — 안 보여준 사람은 사용자가 존재조차 모르므로 틀렸다는 피드백이
 * 영영 오지 않는다.
 *
 * 이 화면이 후보에 대해 아는 것은 별명·소개·자리·탐색 여부·채우는 오행·균형 구간뿐이다.
 * 전체 오행 개수표와 두 축의 값·점수는 DB 에서 멈춘다(`candidatesForViewer`).
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
  const board = optedIn ? await openBoard() : null;

  return (
    <main className="app-shell flex w-full max-w-4xl flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow">인연</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">새로운 인연 찾기</h1>
        <p className="max-w-2xl text-sm text-secondary">
          서로 부족한 오행을 보완할 수 있는 사람을 먼저 보여드립니다. 추천 순서는
          궁합의 좋고 나쁨이나 운명적인 순위를 뜻하지 않습니다.
        </p>
      </header>

      {account === null ? (
        <p className="text-sm text-muted">계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
      ) : account.status !== 'active' ? (
        <Halted status={account.status} />
      ) : account.self_person_id === null ? (
        <section className={`${CARD} bg-surface-sunken`}>
          <h2 className="text-base font-semibold">먼저 내 사주를 등록해 주세요</h2>
          <p className="mt-1.5 text-sm text-secondary">
            오행의 보완을 살펴보려면 먼저 내 사주가 필요합니다.{' '}
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
 * 화면을 그리기 전에 후보를 다 읽는다.
 *
 * **씨앗은 DB 가 정한다** — 나와 오늘 날짜다. 여기서 넘겨주면 씨앗을 바꿔 가며 탐색
 * 자리를 다시 뽑을 수 있고, 그러면 노출 기록이 무엇을 잰 것인지 말할 수 없게 된다.
 *
 * **낡은 요약을 여기서 고친다.** 판본을 고친 뒤 `refresh_discovery_summary` 가 실패한
 * 채로 남아 있으면 나는 참여 중인데 아무에게도 안 보인다. 그 상태를 스스로 벗어나게 한다.
 */
async function openBoard(): Promise<CandidateBoard | null> {
  const self = await selfElementSummary();
  if (self === null) return null;

  const supabase = await supabaseOnServer();
  await supabase.rpc('refresh_discovery_summary', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });

  return candidatesForViewer(self.summary);
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
        <h2 className="text-base font-semibold">지금 만날 수 있는 인연</h2>
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
          아직 소개할 인연이 없습니다. 새로운 참여자가 생기면 여기에 보여드릴게요.
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
                    새로운 추천
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

              {/*
                요청은 **후보를 본 데서** 난다. 이 카드가 섰다는 것이 노출 기록으로 남아
                있고, `request_match` 는 그 기록이 있는 사람에게만 요청을 만든다.
              */}
              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-2">
                <RequestButton candidateUserId={card.candidateUserId} />
                <HideButton candidateUserId={card.candidateUserId} />
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
