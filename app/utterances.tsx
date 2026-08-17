import {
  CLAIM_STRENGTH_KO,
  FRAGMENT_TOPICS,
  type ClaimStrength,
  type Utterance,
} from '@/src/lib/saju';

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

/**
 * 침묵은 **세어서 한 줄로** 알린다.
 *
 * 골든은 침묵을 `×` 한 줄씩 찍는다 — 그래야 "사실이 없다"와 "말하지 않기로 했다"가
 * 따로 보인다. 화면은 그 구분을 읽는 사람에게 물을 일이 아니라서 항목으로 세우지
 * 않지만, **조용히 사라지게 두지도 않는다.** 시각을 아는 사람은 다섯 줄을 보고
 * 모르는 사람은 세 줄을 보는데 왜 둘인지 아무 데도 안 적히면, 그것이야말로 모르는
 * 것을 모른다고 말하지 않는 것이다.
 */
const silentNoteOf = (utterances: readonly Utterance[]): string | null => {
  const silent = utterances.filter((utterance) => utterance.strength === 'silent');
  if (silent.length === 0) return null;

  return `시각을 몰라 말하지 않은 것 ${silent.length}가지가 있습니다.`;
};

/**
 * 조각이 아직 없어 비어 있는 자리는 **화면에 내지 않는다.**
 *
 * 침묵과 다르다. 침묵은 우리가 말하지 않기로 한 것이라 읽는 사람에게 알릴 값이
 * 있지만, 조각 없음은 우리 작업 목록이다(`missingFragmentsOf`). 그것을 사용자에게
 * 보이면 "여기 뭔가 있는데 안 보여준다"로 읽힌다.
 */
const spokenOf = (utterances: readonly Utterance[]) =>
  utterances.filter((utterance) => utterance.text !== null);

export function UtteranceList({ utterances }: { utterances: readonly Utterance[] }) {
  const spoken = spokenOf(utterances);
  const silentNote = silentNoteOf(utterances);

  if (spoken.length === 0) {
    return (
      <p className="text-sm text-muted">
        {silentNote ?? '이 자리에서 말할 수 있는 것이 없습니다.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {spoken.map((utterance, index) => {
          const isRow = FRAGMENT_TOPICS[utterance.request.topic].form === 'row';
          const strength = utterance.strength as Exclude<ClaimStrength, 'silent'>;

          return (
            // 같은 좌표가 두 번 설 수 있다 — 양방향 십성은 값이 같으면 키가 같다.
            // 좌표만으로 키를 세우면 React 가 한 줄을 지운다.
            <li
              key={`${utterance.key}:${index}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span
                className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] ${STRENGTH_TONE[strength]}`}
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
