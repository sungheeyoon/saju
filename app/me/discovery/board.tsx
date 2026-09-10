import Link from 'next/link';

import { DISCOVERY_EMPTY } from '@/src/lib/discovery';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { boardStamp, candidatesForViewer, type CandidateBoard } from '../candidates';
import { selfElementSummary } from '../summary';
import { Avatar } from '../avatar';
import { HideButton, PreviewScorePanel, RefreshBoard, UnhideAll } from './manage';

/**
 * 추천 목록 — **홈에 선다**(PRD §2.0, ADR 0037).
 *
 * 전에는 이 목록이 `/me/discovery` 안에만 있었고, 그 화면을 열 때마다 풀 전체를 줄
 * 세웠다. 이제 뽑는 일은 스냅샷이 하고 여기는 **만들어 둔 열 명을 읽기만 한다** —
 * 그래서 방문마다 도는 셈 없이 홈에 세울 수 있다.
 *
 * 설정(조건·참여 켜고 끄기)은 `/me/settings` 에 둔다. 목록과 설정은
 * 보는 빈도가 다르다 — 매번 보는 것을 매번 안 보는 것 아래에 두면 목록이 안 읽힌다.
 */
export async function DiscoveryBoard() {
  const supabase = await supabaseOnServer();

  /*
    **묻는 것이 「켰는가」에서 「껐는가」로 바뀌었다**(PRD §4.1).

    참여가 기본으로 켜지면서 안 켠 사람이라는 상태가 없어졌다. 남은 것은 직접 끈
    사람이고, 그 하나만 목록을 안 받는다.
  */
  const { data: profile } = await supabase
    .from('discovery_profile')
    .select('opted_out_at')
    .maybeSingle();

  if (profile?.opted_out_at != null) return <Resting />;

  const self = await selfElementSummary();
  if (self === null) return null;

  /**
   * **자동 참여가 열리는 자리가 여기다.**
   *
   * 요약은 DB 가 못 만든다 — 절기·자시·경도 판정이 엔진에 있다. 그러니 참여를 여는 일은
   * 앱이 요약을 넣는 자리에서만 일어날 수 있고, 그 자리가 이미 여기였다(낡은 요약을
   * 고치려고 부르던 자리). 호출부를 늘리는 대신 이 한 자리의 뜻을 넓혔다 — 저장한
   * 사람도, 방금 이름을 지은 사람도, 판본을 고친 사람도 홈을 열면서 같은 문을 지난다.
   *
   * 거짓이 오면 조용히 아무것도 안 세운다. 참여가 열릴 자리가 아니라는 뜻이고(이름이
   * 아직 없다), 그 사람은 이름을 짓는 화면으로 이미 보내지는 중이다.
   */
  const { data: joined } = await supabase.rpc('ensure_discovery_participation', {
    p_person_id: self.personId,
    p_summary: self.summary,
  });
  if (joined !== true) return null;

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
 * 쉬기로 한 사람에게 서는 자리.
 *
 * **목록이 있을 자리에 목록이 없는 이유를 적는다.** 아무것도 안 세우면 어제 있던 것이
 * 오늘 없어진 것으로 읽히고, 그것은 고장으로 보인다.
 *
 * 「참여하면 …을 보여드립니다」라고 권하지 않는다. 이 사람은 그 문장을 이미 읽고 끈
 * 사람이라, 다시 세우면 끈 결정을 우리가 안 받아들이는 것으로 읽힌다.
 */
function Resting() {
  return (
    <section className={`${CARD} flex flex-col gap-2`}>
      <h2 className="text-base font-semibold">인연 찾기를 쉬고 있습니다</h2>
      <p className="text-sm text-secondary">
        지금은 다른 참여자에게 내 프로필이 공개되지 않으며, 새로운 사람도 소개받지 않습니다.
        내 사주와 저장한 사람은 그대로 남아 있습니다.
      </p>
      <Link
        href="/me/settings"
        className="self-start text-sm font-semibold text-accent underline underline-offset-4"
      >
        계정 관리 열기
      </Link>
    </section>
  );
}

/**
 * 목록이 비었을 때 — **없는 것을 설명하는 문장으로 없는 목록을 둘러싸지 않는다.**
 *
 * 맛보기 안내·순서 유의·「하루가 지나면 저절로 새로 만들어집니다」는 **목록이 있을 때**
 * 하는 말이다. 빈 자리에 그대로 두면 다섯 문장이 아무것도 없는 자리를 감싸고, 그중
 * 하나는 거짓에 가깝다 — 하루가 지나도 참여자가 없으면 그대로다.
 *
 * 설명 문단은 두지 않고 빈 상태만 한 문장으로 말한다.
 *
 * **새로 받기는 남긴다.** 오늘 들어온 사람은 내 스냅샷에 없고, 그 사람을 지금 보는 길이
 * 이 버튼 하나다.
 *
 * **되돌리는 길도 남긴다.** 목록이 빈 이유가 다 숨겼기 때문일 수 있고, 그때 이 줄이
 * 없으면 사용자는 자기가 만든 상태에서 나올 수 없다.
 */
function Empty({ hiddenCount, waitSeconds }: { hiddenCount: number; waitSeconds: number }) {
  return (
    <section className={`${CARD} flex flex-col gap-2`}>
      <h2 className="text-base font-semibold">{DISCOVERY_EMPTY.title}</h2>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <RefreshBoard waitSeconds={waitSeconds} />
        <UnhideAll count={hiddenCount} />
      </div>
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
  if (board.cards.length === 0) {
    return <Empty hiddenCount={hiddenCount} waitSeconds={waitSeconds} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-semibold">오늘의 인연</h2>
          <p className="text-sm text-secondary">{board.cards.length}명을 소개해 드려요</p>
        </div>
        <RefreshBoard waitSeconds={waitSeconds} />
      </div>

      {/*
        여기서 멈추는 이유와 다음을 먼저 말한다 — **상세 궁합은 서로 동의한 뒤**다.
        문장은 정책이 든다.
      */}
      <p className="rounded-md border border-border bg-surface-sunken p-3 text-sm">
        {board.teaser}
      </p>

      {board.notice !== null && <p className="text-sm text-secondary">{board.notice}</p>}

      <ul className="flex flex-col gap-3">
        {board.cards.map((card) => (
          /*
            **카드는 격자다.** 점수와 그 아래 버튼이 한 칸에 세로로 서야 하는데, 눌러서
            펴지는 안내는 카드 폭을 다 써야 한다 — 같은 자리에서 두 폭이 필요하다.
            세로 묶음으로는 안 되고(안쪽 폭에 갇힌다), 격자라면 접힌 버튼은 오른쪽 칸에,
            펴진 안내는 두 칸에 걸쳐 설 수 있다.

            좁은 화면에서는 한 칸으로 접힌다. 오른쪽 칸을 10rem 으로 잡으면 360px 짜리
            화면에서 글이 설 자리가 열 글자로 줄어든다.
          */
          <li
            key={card.candidateUserId}
            className={`${CARD} grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_10rem]`}
          >
            {/*
              **자리 번호는 안 적는다.** 스냅샷을 읽을 때 자격을 잃은 사람이 빠지면
              번호에 구멍이 남는다 — 1·2·4 로 적히면 화면이 무언가 잃어버린 것처럼
              보이고, 다시 매기면 노출 기록이 든 자리와 갈린다.
            */}
            <div className="col-span-full flex items-start gap-3">
              {/*
                **얼굴과 이름은 서로 가운데를 맞춘다.** 이 줄이 통째로 `items-start` 인
                것은 오른쪽 끝의 「다시 보지 않기」를 모서리에 붙이기 위해서인데, 그
                맞춤이 얼굴과 이름에까지 걸리면 40px 짜리 원 옆에서 이름만 천장에 붙는다.
                그 둘만 따로 묶어 가운데로 맞춘다.
              */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  userId={card.candidateUserId}
                  nickname={card.nickname}
                  hasPhoto={card.hasPhoto}
                />
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                  <h3 className="text-base font-semibold">{card.nickname}</h3>
                  {card.exploration && (
                    <span className="rounded-full bg-accent-wash px-2 py-0.5 text-xs text-accent">
                      색다른 인연
                    </span>
                  )}
                </div>
              </div>

              {/*
                **카드의 오른쪽 위 끝.** 되돌릴 수 있는 정리 하나이고 이 카드의 목적이
                아니다 — 목적은 점수 아래 버튼이 든다. 카드를 닫는 누름이 모서리에 서는
                것은 이 앱 밖에서도 같은 자리라, 찾으라고 안 적어도 찾는다.
              */}
              <HideButton candidateUserId={card.candidateUserId} />
            </div>

            {card.intro !== null && (
              <p className="col-span-full text-sm text-secondary">{card.intro}</p>
            )}

            {/*
              **추천 이유는 적극적으로 말한다.** 어느 오행이 무엇을 채우는지까지 —
              감추면 「왜 이 사람인가」에 답하지 못한다. 문장은 정책이 지어 오고
              (`ELEMENT_MEANING`), 화면은 글자를 앞에 세우기만 한다.

              **판정·오행·이유는 한 덩이다.** 셋이 따로 서 있었을 때는 균형 문장이 점수
              카드 아래까지 가로로 흘러서, 바로 위 줄과의 사이가 카드 높이만큼 벌어졌다.
              셋 다 같은 것을 말한다 — 왜 이 사람인가.
            */}
            <div className="flex min-w-0 flex-col justify-center gap-1.5">
              {/*
                **점수를 말로 한 번 더 적는다.** 34라는 수는 그 자체로는 높은지 낮은지
                말하지 않는다 — 만점이 몇인지, 보통이 몇인지를 사용자가 모르기 때문이다.
              */}
              <p className="text-sm font-semibold">{card.verdict}</p>

              {/*
                **채우는 오행은 이름과 뜻까지 말한다**(`discloses`). 없으면 이 줄이
                통째로 빠지고 — 아래 이유가 그 사정을 「채워 주지 않고」로 든다. 비는
                자리가 없다.
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

              {/*
                **판정 바로 아래에 이유가 선다.** 전에 여기 있던 균형 문장은 점수를 만든
                두 축 중 하나만 말했다 — 그래서 34점 옆에 「균형이 고른 편이에요」가 서는
                일이 났다. 이 줄은 두 축을 다 든다.
              */}
              <p className="text-sm text-secondary">{card.reason}</p>
            </div>

            {/*
              **점수와 그 아래 누름은 한 장이다.** 그래서 화면이 두 조각으로 그리지 않고
              한 컴포넌트에 맡긴다 — 나눠 그리면 「한 장으로 보이게」가 두 파일의 클래스
              문자열이 맞아떨어질 때만 참인 약속이 된다.

              요청은 **후보를 본 데서** 난다. 이 카드가 스냅샷에 실렸다는 것이 노출
              기록으로 남아 있고, `request_match` 는 그 기록이 있는 사람에게만 요청을
              만든다.

              펴진 뒤의 동의 안내는 격자의 두 칸에 걸친다 — 그 자리도 저쪽이 잡는다.
            */}
            <PreviewScorePanel
              candidateUserId={card.candidateUserId}
              previewScore={card.previewScore}
            />
          </li>
        ))}
      </ul>

      {/* 없는 것을 설명하지 않는다 — 탐색 후보가 실제로 섰을 때만 이 말이 붙는다 */}
      {board.explorationNote !== null && (
        <p className="text-xs text-muted">{board.explorationNote}</p>
      )}

      <UnhideAll count={hiddenCount} />
    </section>
  );
}
