import type { ReadingCredits } from '../credits/remaining';
import type { CurrentReading } from '@/src/lib/reading';
import type { ReadingTarget } from './target';
import { outOfCredits } from '../credits/buy-path';

/**
 * **글 둘레에 무엇이 서는가.**
 *
 * 결과 칸의 판단 여섯이 여기 모였다. 칸 안에 흩어져 있을 때 이 여섯은 「`.tsx` 라서
 * 시험이 못 닿는다」고 적혀 있었지만, 못 닿게 한 것은 확장자가 아니라 **뽑아내지 않은
 * 순수 함수**였다 — 뽑고 나니 시험이 그냥 부른다(`fitsCalendar` · `isNavigationActive`
 * 가 같은 자리에 먼저 서 있다).
 *
 * 부수효과도 JSX 도 안 든다. 들어오는 것은 이 화면이 이미 아는 값뿐이고, 나가는 것은
 * 「무엇이 서고 무엇이 닫히는가」뿐이다.
 */
export type PanelChrome = {
  /** 만드는 버튼이 닫혀 있는가 */
  readonly makeDisabled: boolean;
  /**
   * 풀이권이 0개라 **만드는 버튼이 풀이권 창을 여는가**(`outOfCredits`) — 누르면 확인 창 · 만들기 대신 `useBuyCredits` 의 창이다.
   * 만들기 요청은 나가지 않는다.
   */
  readonly buysCredits: boolean;
  /** 만드는 버튼이 아예 안 서는가 */
  readonly hideMake: boolean;
  /** 그 버튼이 칸 안이 아니라 머리에 서는가 */
  readonly makeInHeader: boolean;
  readonly makeLabel: string;
  readonly canShare: boolean;
  /** 다 읽은 글 아래에 설문이 붙는가 */
  readonly asksFeedback: boolean;
};

export function panelChrome({
  kind,
  noun,
  loading,
  reading,
  isMock,
  credits,
  automatic,
  consented,
}: {
  kind: ReadingTarget['kind'];
  /** 이 대상을 부르는 말 — 두 사람짜리 화면은 「궁합풀이」다 */
  noun: string;
  loading: boolean;
  reading: CurrentReading | null;
  isMock: boolean;
  credits: ReadingCredits | null;
  automatic: boolean;
  consented: boolean;
}): PanelChrome {
  /*
    **다 쓴 것과 기다리는 것을 가른다.** 도는 시도가 자리를 잡고 있는 동안에는 버튼이 만들기 그대로다 — 그 사람이 누르면 DB 가
    「끝나면 다시 눌러 주세요」로 답하고, 그것이 이 화면이 대신 말해 줄 수 없는 사실이다(다른 대상을 만들고 있을 수도 있다).
    다 썼으면 버튼은 닫히지 않고 누르면 풀이권 창(「보유 풀이권 0장」)이 열린다 — 닫힌 단추는 누른 사람에게 아무 말도 안 했다.
  */
  const spent = outOfCredits(credits);

  /**
   * **누를 것이 있는가.**
   *
   * **만드는 동안에는 아무 화면에도 버튼이 없다.** 닫힌 「받는 중…」 버튼과 「아직 받은 풀이가 없어요」 칸이 진행
   * 카드 위에 남아 있었다(화면 갤러리 감사 2026-10-09) — 기다리는 사람이 볼 것은 진행 카드 하나다.
   *
   * 동의가 만드는 글은 성공 경로에 버튼이 없다 — 이미 있는 글도 누를 일이 아니다. 남는 자리는 **아무것도 없는
   * 자리** 하나이고, 그때만 버튼이 선다.
   */
  const hideMake = loading || (automatic && reading !== null);

  return {
    makeDisabled: loading,
    buysCredits: spent && !loading,
    hideMake,

    /**
     * 글을 읽으러 온 화면에 **이미 글이 있으면** 만드는 버튼은 머리로 올라간다.
     *
     * 전에는 글 위에 칸 하나가 통째로 서 있었다 — 권하는 말·안 넘기는 것·버튼. 그런데
     * 글이 이미 있는 사람에게 그 칸이 하는 말은 버튼 하나뿐이고, 나머지 줄은 **읽을
     * 이유가 없는 자리**를 차지하고 있었다.
     */
    makeInHeader: reading !== null && !hideMake,

    makeLabel: reading === null ? `${noun} 받기` : `${noun} 다시 받기`,

    /**
     * **공유는 다 된 내 사주풀이에만 붙는다.**
     *
     * 없는 글과 지금 만들고 있는 글에는 보낼 것이 없다 — 그 자리에 버튼을 세우면 누른
     * 사람이 빈 링크를 받는다. 예시 결과에도 안 붙는다. 그것은 모델이 쓴 글이 아니라
     * 개발용으로 박아 둔 문자열이고, DB 의 문도 저장된 원문에 없는 글은 안 받는다 —
     * 화면에서 먼저 막지 않으면 사용자는 이유를 모르는 실패를 본다.
     *
     * **인연 궁합만 빠진다.** 거기 있는 상대는 실재하는 계정이고, 그 사람이 동의한
     * 것은 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가 아니다
     * (ADR 0012). 나머지 셋은 다 **내가 넣은 자료**라 내보낼지 말지를 넣은 사람이 정한다.
     */
    canShare: kind !== 'match' && reading !== null && !loading && !isMock,

    /**
     * **읽고 나서 곧바로 묻는다.** 시점이 값을 정한다 — 다 읽은 직후가 기억이 가장
     * 선명하고, 여기를 떠난 뒤에 묻는 설문은 「대체로 괜찮았다」를 받는다.
     *
     * **예시 결과에는 안 붙는다.** 그 글은 모델이 쓴 것이 아니라 개발용으로 박아 둔
     * 문자열이라, 그것에 대한 답을 세면 프롬프트 판본별 값이 조용히 오염된다.
     *
     * `sourceRunId` 가 없는 글에도 안 붙는다. 이 값이 생기기 전에 저장된 글들이고,
     * 어느 시도가 만들었는지 지어 넣지 않았다 — 매달 자리가 없으면 안 묻는다.
     *
     * 그리고 **동의하지 않았으면 통째로 안 선다.** 「동의하면 더 답할 수 있어요」
     * 같은 줄도 세우지 않는다 — 거절한 사람에게 거절을 다시 보여 주는 자리가 된다.
     */
    asksFeedback:
      consented
      && !loading
      && reading !== null
      && !isMock
      && reading.sourceRunId !== null,
  };
}
