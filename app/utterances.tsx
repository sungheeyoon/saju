import {
  CLAIM_STRENGTH_KO,
  type ClaimStrength,
  type Utterance,
} from '@/src/lib/saju';
import {
  NOTHING_TO_SAY,
  isRowUtterance,
  silentNoteOf,
  spokenOf,
} from '@/src/lib/saju/view';
import { CLAIM_STRENGTH_LEGEND } from '@/src/lib/saju/view/notes';

import { Rich } from './saju/rich';

/**
 * L3 발화를 화면에 놓는다 — **강도가 옆 칸으로 선다.**
 *
 * 계약이 행을 완충 표현에서 면제하면서 "대신 강도가 행 옆의 칸으로 선다"고 적어
 * 두었는데(`ClaimForm`), 그 칸이 있던 곳은 문장 골든뿐이었다. 여기가 그 칸이
 * 처음 사람 눈에 서는 자리다.
 *
 * **문구를 여기서 쓰지 않는다.** 화면이 문장을 조금이라도 손보면 계약이 검사한
 * 문자열과 사람이 읽는 문자열이 갈라지고, 그 순간 검사기는 아무것도 지키지 않는
 * 것이 된다. 이 파일이 아는 것은 **어디에 놓을지**뿐이다.
 */

/** 강도 칸의 모양 — 사다리가 위에서 아래로 옅어진다 */
const STRENGTH_TONE: Record<Exclude<ClaimStrength, 'silent'>, string> = {
  fact: 'border-border text-secondary',
  derived: 'border-border text-secondary',
  candidate: 'border-border text-muted',
  reference: 'border-dashed border-border text-muted',
};

export function UtteranceList({ utterances }: { utterances: readonly Utterance[] }) {
  const spoken = spokenOf(utterances);
  const silentNote = silentNoteOf(utterances);

  if (spoken.length === 0) {
    return (
      <p className="text-sm text-muted">
        {silentNote ?? NOTHING_TO_SAY}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {spoken.map((utterance, index) => {
          const isRow = isRowUtterance(utterance);
          const strength = utterance.strength as Exclude<ClaimStrength, 'silent'>;

          return (
            // 같은 좌표가 두 번 설 수 있다 — 양방향 십성은 값이 같으면 키가 같다.
            // 좌표만으로 키를 세우면 React 가 한 줄을 지운다.
            <li
              key={`${utterance.key}:${index}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span
                className={`shrink-0 rounded-cell border px-1.5 py-0.5 text-xs ${STRENGTH_TONE[strength]}`}
              >
                {CLAIM_STRENGTH_KO[strength]}
              </span>
              <span className={`text-sm ${isRow ? 'text-foreground' : 'text-secondary'}`}>
                {utterance.text}
              </span>
            </li>
          );
        })}
      </ul>

      {silentNote && (
        <p className="border-t border-border pt-3 text-xs text-muted">{silentNote}</p>
      )}
    </div>
  );
}

/** 딱지가 무슨 뜻인가 — 글자는 `CLAIM_STRENGTH_LEGEND` 한 벌이다 */
export function ClaimStrengthLegend() {
  return (
    <p>
      <Rich parts={CLAIM_STRENGTH_LEGEND} />
    </p>
  );
}
