import {
  CLAIM_STRENGTH_KO,
  FRAGMENT_TOPICS,
  type ClaimStrength,
  type CompatWarning,
  type CompatWarningKind,
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

/**
 * L3 발화 중 **표가 이미 든 것.**
 *
 * 조립기는 고르지 않는다(`ASSEMBLE_POLICY.selection: 'all-facts-speak'`). 줄이는
 * 것은 화면의 몫인데, 계약이 "줄인다면 그것도 정책 값으로 적는다"고 못박아 두었다.
 * 여기가 그 값이다 — 관계는 종류·글자·자리를 열로 가르는 표가 원국·궁합 양쪽에 이미
 * 있고, 같은 값을 문장 목록에 한 번 더 내면 읽는 사람은 다른 값인 줄 알고 두 번 읽는다.
 *
 * `relation.coverage` 는 버리지 않는다. 두 표의 각주가 각각 손으로 "시주를 몰라
 * 시주가 걸린 관계는 빠져 있습니다"라고 적고 있었는데, 궁합 쪽은 **누구인지를 못
 * 적었다.** 그 자리에 발화를 그대로 놓는다.
 */
export const TOPICS_THE_TABLE_HOLDS: readonly string[] = [
  'relation.present',
  'relation.coverage',
];

/**
 * 그중 표의 **각주 자리**에 놓는 것.
 *
 * 목록에서 빼는 것과 아예 버리는 것은 다르다. 이 한 줄을 목록에도 두면 같은 문장이
 * 화면에 두 번 찍히는데, 테스트는 그것을 못 본다 — 조립기는 발화를 한 번만 내고
 * 두 번 놓는 것은 화면의 일이라서다. 브라우저로 눌러 보고 잡았다.
 */
export const TOPIC_TABLE_FOOTNOTE = 'relation.coverage';

/**
 * 현재운 발화를 카드 안에서 어디에 놓을지 — **나눠 갖되 겹칠 수는 없다.**
 *
 * 세 자리로 나누는 이유가 각각 다르다.
 *
 * - `header` 기준 시각. 나머지 발화가 '지금'·'이번'을 쓰므로 그 좌표가 맨 위에 없으면
 *   전부 기준점 없는 문장이 된다. **빼면 나머지가 거짓이 되고 테스트는 그것을 못
 *   본다**(`ASSEMBLE_POLICY.viewingInstant`).
 * - `relations` 지금이 원국과 맺는 관계. **버리지 않고 갈라 세운다** — 아홉 줄까지 나오는데
 *   섞어 두면 본론인 세 칸(대운·세운·월운)이 그 아래 묻힌다. 원국 화면에서는 이 주제를
 *   표가 들어서 빼지만(`TOPICS_THE_TABLE_HOLDS`) 여기서는 들어 줄 표가 없다 — 월운 표는
 *   `wolun.year` 가 가리키는 해를 보이므로 이번 달이 그 안에 없을 수 있다.
 * - `footnote` 목록의 한계 둘. 대운 관계를 못 센 것과 시주를 빼고 센 것 — 둘 다 항목이
 *   아니라 목록에 대한 말이라 항목들 사이에 끼면 한 줄로 읽힌다.
 * - 나머지가 본문.
 *
 * **본문을 빼기로 세운다.** `body` 를 따로 열거하면 새 주제가 생긴 날 네 목록 어디에도
 * 없어 조용히 사라지거나, 손이 미끄러져 두 목록에 들어 같은 문장이 화면에 두 번 찍힌다.
 * 뒤쪽은 실제로 한 번 당했다 — 조립기는 한 번 내고 **두 번 놓는 것은 화면의 일이라
 * 테스트가 못 본다**(`TOPIC_TABLE_FOOTNOTE`). 여기서는 그 실수가 표현 불가능하다.
 */
export const NOW_TOPIC_PLACEMENT = {
  header: ['now.asOf'] as readonly string[],
  relations: ['relation.present'] as readonly string[],
  footnote: ['now.coverage', 'relation.coverage'] as readonly string[],
} as const;

const NOW_PLACED_TOPICS: readonly string[] = Object.values(NOW_TOPIC_PLACEMENT).flat();

export type NowPlacement = {
  header: Utterance[];
  body: Utterance[];
  relations: Utterance[];
  footnote: Utterance[];
};

/** 현재운 발화를 네 자리로 가른다 — 어디에도 없거나 두 곳에 있는 발화는 만들 수 없다 */
export const placeNowUtterances = (utterances: readonly Utterance[]): NowPlacement => {
  const at = (topics: readonly string[]) =>
    utterances.filter((utterance) => topics.includes(utterance.request.topic));

  return {
    header: at(NOW_TOPIC_PLACEMENT.header),
    relations: at(NOW_TOPIC_PLACEMENT.relations),
    footnote: at(NOW_TOPIC_PLACEMENT.footnote),
    body: utterances.filter(
      (utterance) => !NOW_PLACED_TOPICS.includes(utterance.request.topic),
    ),
  };
};

/**
 * 발화가 **이미, 그리고 더 낫게** 말하는 궁합 경고.
 *
 * 엔진 경고는 사람을 이름으로 못 부른다 — 이름이 계산에 안 들어가기로 했으므로
 * '두 번째 사람의' 까지다. L3 는 `CompatPerson.label` 을 받아 '지영의' 라고 부르고,
 * 관계 표 각주와 문장 옆이라는 **제자리**에서 말한다.
 *
 * - `hour-unknown-relations` → `relation.coverage` 가 표 각주에서 이름을 부른다.
 * - `hour-unknown-elements` → 없는 오행을 **아예 말하지 않는다**(`absence` 가 잠근다).
 *   경고의 전제("없는 오행이 부풀어 보인다")가 성립하려면 화면이 그것을 보여 주고
 *   있어야 하는데, 이제 보여 주지 않는다.
 *
 * **지우지 않고 걸러 낸다.** 카드째 걷어내면 나중에 생길 다른 경고까지 조용히
 * 사라진다 — 아는 종류만 빼고 모르는 것은 그대로 선다.
 */
export const WARNINGS_SAID_BY_UTTERANCES: readonly CompatWarningKind[] = [
  'hour-unknown-relations',
  'hour-unknown-elements',
];

/** 발화가 대신 말하지 않는 경고만 — 화면이 그대로 든다 */
export const warningsToShow = (warnings: readonly CompatWarning[]): CompatWarning[] =>
  warnings.filter((warning) => !WARNINGS_SAID_BY_UTTERANCES.includes(warning.kind));

/** 어느 주제의 발화인가 — 표가 든 것은 빼고 목록에 넘긴다 */
export const said = (
  utterances: readonly Utterance[],
  pick: (topic: string) => boolean,
): Utterance[] => utterances.filter((utterance) => pick(utterance.request.topic));

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

/**
 * 딱지가 무슨 뜻인가 — **한 벌만 있다.**
 *
 * 원국 화면과 궁합 화면이 이 문단을 각자 손으로 들고 있었고, 그래서 이미 갈려 있었다:
 * 궁합 쪽에는 **「참고」가 빠져** 있었다. 같은 딱지 체계를 화면마다 다르게 설명하면
 * 사용자는 자기가 본 딱지가 무엇인지 화면에 따라 다르게 배운다.
 *
 * **낱말은 엔진에서 온다**(`CLAIM_STRENGTH_KO`). 여기서 '사실'·'유도'를 손으로 적으면
 * 딱지에 찍히는 글자와 그 뜻을 적은 글자가 갈릴 수 있고, 그건 눈에 안 띈다.
 *
 * `silent` 는 뜻을 적지 않는다 — 말하지 않기로 한 것은 딱지로 서지 않으므로,
 * 여기 적으면 본 적 없는 딱지를 설명하는 줄이 된다.
 */
const CLAIM_STRENGTH_MEANING: Record<Exclude<ClaimStrength, 'silent'>, string> = {
  // 조사를 문장에 붙여 둔다 — '표' 뒤에는 「은」이 아니라 「는」이 붙어서,
  // 밖에서 한 글자를 이어 붙이면 넷 중 하나가 틀린 말이 된다.
  fact: '여덟 글자에서 곧장 세어진 것은',
  derived: '우리가 고른 문턱을 거친 것은',
  candidate: '아직 시험 중인 규칙은',
  reference: '조건을 자동 판정하지 않고 옮겨 적은 표는',
};

const MEANING_ORDER: readonly Exclude<ClaimStrength, 'silent'>[] = [
  'fact',
  'derived',
  'candidate',
  'reference',
];

export function ClaimStrengthLegend({ tail }: { tail?: React.ReactNode }) {
  return (
    <p>
      왼쪽 딱지는 <strong className="font-medium">얼마나 세게 말할 수 있는가</strong>입니다.{' '}
      {MEANING_ORDER.map((strength, index) => (
        <span key={strength}>
          {CLAIM_STRENGTH_MEANING[strength]} {CLAIM_STRENGTH_KO[strength]}
          {index < MEANING_ORDER.length - 1 ? ', ' : '입니다. '}
        </span>
      ))}
      근거보다 세게 말하지 않는지는 계약이 검사합니다.{tail}
    </p>
  );
}
