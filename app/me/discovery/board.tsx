import Link from 'next/link';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { boardStamp, candidatesForViewer, type CandidateBoard } from '../candidates';
import { selfElementSummary } from '../summary';
import { HideButton, RefreshBoard, RequestButton, UnhideAll } from './manage';

/**
 * 추천 목록 — **홈에 선다**(PRD §2.0, ADR 0037).
 *
 * 전에는 이 목록이 `/me/discovery` 안에만 있었고, 그 화면을 열 때마다 풀 전체를 줄
 * 세웠다. 이제 뽑는 일은 스냅샷이 하고 여기는 **만들어 둔 열 명을 읽기만 한다** —
 * 그래서 방문마다 도는 셈 없이 홈에 세울 수 있다.
 *
 * 설정(별명·소개·조건·참여 켜고 끄기)은 `/me/discovery` 에 남는다. 목록과 설정은
 * 보는 빈도가 다르다 — 매번 보는 것을 매번 안 보는 것 아래에 두면 목록이 안 읽힌다.
 */
export async function DiscoveryBoard() {
  const supabase = await supabaseOnServer();

  const { data: profile } = await supabase
    .from('discovery_profile')
    .select('opted_in_at')
    .maybeSingle();

  if (profile?.opted_in_at == null) return <Invitation />;

  /**
   * **낡은 요약을 여기서 고친다.**
   *
   * 판본을 고친 뒤 `refresh_discovery_summary` 가 실패한 채로 남아 있으면 나는 참여
   * 중인데 아무에게도 안 보인다. 그 상태를 스스로 벗어나게 한다.
   */
  const self = await selfElementSummary();
  if (self === null) return null;

  await supabase.rpc('refresh_discovery_summary', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });

  // 목록을 **먼저** 읽는다 — 그 호출이 하루 지난 스냅샷을 새로 만들 수 있고, 시각은
  // 그다음에 물어야 방금 만들어진 것의 시각이 된다.
  const board = await candidatesForViewer(self.summary);
  const stamp = await boardStamp();
  const { data: hidden } = await supabase.from('discovery_hidden').select('hidden_user_id');

  return (
    <Candidates
      board={board}
      hiddenCount={(hidden ?? []).length}
      /*
        **버튼은 스냅샷마다 새로 선다.** 남은 초를 세는 것은 브라우저인데, 새로 받은
        뒤에도 같은 버튼이 서 있으면 그 세기가 이어져 버린다. 목록이 만들어진 시각을
        key 로 두면 새 목록이 곧 새 버튼이다.
      */
      key={stamp?.generatedAt ?? 'none'}
      waitSeconds={stamp?.waitSeconds ?? 0}
    />
  );
}

/**
 * 참여하지 않은 사람에게 서는 자리.
 *
 * **목록이 있을 자리에 목록이 없는 이유를 적는다.** 아무것도 안 세우면 이 사람은
 * 추천이라는 것이 있는 줄도 모른다.
 */
function Invitation() {
  return (
    <section className={`${CARD} flex flex-col gap-2`}>
      <h2 className="text-base font-semibold">인연 찾기</h2>
      <p className="text-sm text-secondary">
        참여하면 서로 부족한 오행을 채우는 사람을 여기에 보여드립니다. 무엇이 공개되고
        무엇이 공개되지 않는지는 켜기 전에 읽으실 수 있습니다.
      </p>
      <Link
        href="/me/discovery"
        className="self-start text-sm font-semibold text-accent underline underline-offset-4"
      >
        인연 찾기 설정 열기
      </Link>
    </section>
  );
}

function Candidates({
  board,
  hiddenCount,
  waitSeconds,
}: {
  board: CandidateBoard;
  hiddenCount: number;
  waitSeconds: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-semibold">지금 만날 수 있는 인연</h2>
          <p className="text-sm text-secondary">
            {board.cards.length === 0 ? '아직 없습니다' : `${board.cards.length}명`}
          </p>
        </div>
        <RefreshBoard waitSeconds={waitSeconds} />
      </div>

      {/*
        **목록이 고정된 것이라는 말을 여기서 한다.** 안 적으면 「왜 어제와 같은 사람들인가」에
        답하지 못하고, 사용자는 추천이 멈춘 줄 안다.
      */}
      <p className="text-xs text-muted">
        이 목록은 만들어 둔 것입니다. 하루가 지나면 저절로 새로 만들어지고, 지금 바꾸고
        싶으면 새로 받으시면 됩니다.
      </p>

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
              {/*
                **자리 번호는 안 적는다.** 스냅샷을 읽을 때 자격을 잃은 사람이 빠지면
                번호에 구멍이 남는다 — 1·2·4 로 적히면 화면이 무언가 잃어버린 것처럼
                보이고, 다시 매기면 노출 기록이 든 자리와 갈린다.
              */}
              <div className="flex flex-wrap items-baseline gap-x-3">
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
                요청은 **후보를 본 데서** 난다. 이 카드가 스냅샷에 실렸다는 것이 노출
                기록으로 남아 있고, `request_match` 는 그 기록이 있는 사람에게만 요청을
                만든다.
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
