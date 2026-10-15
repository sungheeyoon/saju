import type { StoredScore } from '../discovery';
import type { Stem } from '../saju';

import type { ReadingAnswer } from './feedback';

/**
 * 지금 보는 글 하나 — **본문까지 든 결과다.** 근거와 프롬프트는 없다(ADR 0008).
 *
 * DB 의 줄을 이 모양으로 옮기는 문은 `app/me/reading/current.ts` 의 `currentReading` 이다.
 */
export type CurrentReading = {
  readonly id: string;
  /** 궁합만. 자기 풀이는 `null` */
  readonly score: number | null;
  /**
   * 점수 아래 서는 한 줄 요약 — **이 열이 생기기 전 글에는 없다(`null`).**
   *
   * 되짚어 지어 넣지 않았다. 그때 나온 글이 아니고, 지어 넣으면 어느 것이 모델이 쓴
   * 것인지 갈린다. 자기 풀이에는 점수가 없어도 이것은 있다.
   */
  readonly metaphor: string | null;
  /** 사용자용 Markdown — 저장된 원문의 내부 검토용 근거 절은 서버 경계에서 뺀다 */
  readonly output: string;
  readonly model: string;
  readonly viewedAt: string;
  readonly createdAt: string;
  /** 공유 결과의 글이 첫 자리(`charts.a`, 「첫번째님」)로 부르는 것이 나인가 */
  readonly viewerIsFirst: boolean;
  /**
   * 이 글의 **여덟 글자**가 아직 지금 명식인가 — `match` 는 언제나 참이다.
   *
   * **입력이 아니라 여덟 글자로 견준다**(ADR 0071). 출생지를 서울에서 부산으로 고치면
   * 입력은 바뀌지만 여덟 글자는 그대로일 수 있고, 그때 화면이 하려는 말은
   * 「여덟 글자가 달라졌다」이지 「입력이 달라졌다」가 아니다 — 앞서는 그 자리에서 한쪽으로 거짓말했다.
   *
   * 견주는 일은 계속 SQL 이 한다. 화면이 재면 판정하는 자리가 둘이 된다(ADR 0033).
   */
  readonly fromCurrentChart: boolean;
  /**
   * 이 글을 만든 시도 — **설문이 매달릴 자리.**
   *
   * `null` 인 글이 있다. 이 값이 생기기 전에 저장된 것들이고, 어느 시도가 만들었는지를
   * 되짚어 지어 넣지 않았다 — 그것은 기록이 아니라 추측이다. 그 글에는 설문이 안 붙는다.
   */
  readonly sourceRunId: string | null;
  /**
   * 그 시도에 **내가** 남긴 답 — 안 남겼으면 `null`.
   *
   * 「답했는가」가 아니라 답 자체를 든다. 고치는 화면이 이 값으로 열려야 하고, 안
   * 그러면 다시 보내는 것이 적어 두었던 글을 지운다. 공유 궁합은 두 사람이 따로 답하므로
   * 이것은 **보고 있는 사람의 답**이다.
   */
  readonly myFeedback: ReadingAnswer | null;
  /**
   * 표지의 일간 — **그 글을 만들 때의** 사본에서 난다(2026-09-25). 「수정 전」 글도 그때의 색이다.
   * `match` 는 `null` 이다 — 결과 화면이 동의 당시 사본으로 따로 칠한다.
   */
  readonly dayMasterA: Stem | null;
  readonly dayMasterB: Stem | null;
  /**
   * 이 글의 점수를 잰 **눈금** — 기준점 · 판 · 그때의 사이(ADR 0113). 궁합 지표는 이것으로 그린다.
   *
   * 셋 다 `null` 인 글은 이 칸이 생기기 전 것이고 옛 판(`discovery-v1`)으로 났다. 앱이 DB 보다 먼저 배포되어
   * 칸이 안 와도 `null` 이라 옛 판으로 읽힌다.
   */
  readonly scoreScale: StoredScore;
};
