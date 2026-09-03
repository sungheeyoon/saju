'use client';

/**
 * 「이미 저장된 그 사람인가요?」 — **저장 입구 셋이 나눠 쓰는 한 칸.**
 *
 * 막으려는 것은 중복 행이 아니라 **풀이권이 두 번 나가는 것**이다(ADR 0034). 어머니를
 * 「엄마」로 한 번, 나중에 「어머니」로 또 한 번 저장하면 대상이 둘이 되고, 대상이 둘이면
 * 풀이도 둘이고 풀이권도 둘이다.
 *
 * ## 「아니다」가 있어야 한다
 *
 * 쌍둥이가 있고, 생년월일시가 겹치는 남남이 있다. 강제로 합치면 **우리가 모르는 것을
 * 아는 척하는 것**이고, 그건 이 저장소가 계속 안 해 온 일이다(ADR 0005: 생년월일은
 * 신원이 아니다). 그래서 이것은 거절이 아니라 물음이고, 두 답이 나란히 선다.
 *
 * ## 한 자리에서 난다
 *
 * 입구가 셋이다(사람 탭 · 사주 결과 아래 · 궁합 결과 아래). 말을 각자 지으면 한 자리는
 * 「같은 분인가요」라 하고 다른 자리는 「이미 있습니다」라 한다 — `noRoomToSave` 를 한
 * 자리에 둔 것과 같은 이유다.
 */

/** 이어서 할 일 — 답이 무엇이든 다시 결과 하나다(궁합은 두 번 물을 수 있다) */
export type SameChartQuestion = {
  /** 이미 저장돼 있는 그 사람을 부르는 이름 */
  readonly label: string;
  readonly answer: (sameperson: boolean) => Promise<SaveOutcome>;
};

export type SaveOutcome =
  | { done: true }
  | { failed: string }
  | { ask: SameChartQuestion };

const CHOICE =
  'h-11 flex-1 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 sm:h-10';

export function SameChartAsk({
  question,
  busy,
  onAnswer,
}: {
  question: SameChartQuestion;
  busy: boolean;
  onAnswer: (sameperson: boolean) => void;
}) {
  return (
    <section
      role="group"
      aria-label="같은 사람인지 확인"
      className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-wash px-4 py-4"
    >
      <div>
        <p className="text-sm font-semibold">
          저장된 {question.label} 님과 같은 사람인가요?
        </p>
        {/*
          왜 묻는지 적는다. 「이미 있습니다」로만 끝내면 사용자는 우리가 막는 줄 알고,
          막는 것이 아니라 **한 번 더 값을 쓰지 않게** 하려는 것이다.
        */}
        <p className="mt-1 text-xs leading-5 text-secondary">
          여덟 글자와 태어난 시각이 같습니다. 같은 분이면 저장하지 않고 그분의 화면으로
          갑니다 — 따로 저장하면 풀이권을 한 번 더 쓰게 됩니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer(true)}
          className={`${CHOICE} border-transparent bg-accent text-on-accent`}
        >
          네, 같은 사람입니다
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer(false)}
          className={`${CHOICE} border-border-strong bg-surface`}
        >
          아니요, 다른 사람입니다
        </button>
      </div>
    </section>
  );
}
