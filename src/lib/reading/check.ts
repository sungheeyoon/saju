import { BRANCHES, STEMS } from '../saju/constants';

import { readingBody } from './display';
import { READING_POLICY, isScored, type ReadingKind, type ReadingOutput } from './policy';

/**
 * 나온 글을 **저장하기 전에** 검사한다.
 *
 * PRD 의 hard fail 넷이 여기 있다. 검사가 하는 일은 「좋은 글인가」가 아니라 **「이
 * 글을 사용자에게 보여도 되는가」**다 — 품질은 사람이 재고(품질 게이트), 여기서 막는
 * 것은 밖으로 나가면 안 되는 것들이다.
 *
 * ## 검사가 기계로 될 수 있는 까닭
 *
 * 셋 다 **우리가 답을 알고 있다.**
 *
 * - 자료에 어떤 글자가 있는지 안다 → 없는 글자가 나오면 지어낸 것이다.
 * - 출생 원문이 무엇인지 안다 → 그 값이 글에 있으면 샌 것이다. 「날짜처럼 생긴 것」을
 *   찾는 것과 다르다. 절기 날짜는 자료에 있는 값이라 나와도 되고, **이 사람의 생일**만
 *   안 된다.
 * - Match 자료에 무엇이 없는지 안다 → 없는 근거로만 할 수 있는 판정이 나오면 범위 밖이다.
 *
 * 짐작으로 막지 않는다. 짐작으로 막으면 멀쩡한 글이 걸리고, 그러면 검사를 끄게 된다.
 *
 * ## 여기서 **못 막는 것** — 있다고 적지 않는다
 *
 * PRD 의 hard fail 에는 「근거에 없는 **관계**」도 있다. 그건 여기서 못 잡는다. 자료에
 * 실제로 있는 두 글자로 없는 합·충·형을 지어내면 글자 검사도 낱말 검사도 지나간다 —
 * 문장이 자유 서술인 한 「이 조합이 자료의 어느 관계인가」를 기계가 짚을 방법이 없다.
 * 근거 인용을 출력 계약에 넣어 대조하는 길도 생각했는데, **인용을 지어내면 같은 문제가
 * 한 겹 위로 올라갈 뿐**이다.
 *
 * 그래서 그 항목은 사람 쪽에 남는다 — audit 프롬프트와 제품 담당자의 blind review
 * (PRD 「AI 품질 게이트」). 못 막는 것을 막는 척하지 않는 것이 「짐작으로 막지 않는다」의
 * 반대편이다.
 */

export const READING_FAILURES = {
  /** 자료에 없는 간지를 썼다 — 조심성이 아니라 참·거짓의 문제다 */
  'invented-characters': '자료에 없는 간지가 글에 나왔습니다',
  /** 출생 원문·출생지가 글에 나왔다. 모델에 넣지도 않은 값이다 */
  'birth-input-leaked': '출생 원문이나 출생지가 글에 나왔습니다',
  /** Match 동의 범위 밖의 원국 판정을 만들었다(ADR 0012) */
  'out-of-scope-judgment': '동의 범위 밖의 원국 판정이 글에 나왔습니다',
  /** 점수의 모양이나 범위가 계약과 다르다 */
  'score-out-of-contract': '점수가 계약한 모양이나 범위를 벗어났습니다',
  /** 본문이 계약한 길이 밖이다 — 빈 글도 실패다 */
  'length-out-of-contract': '본문 길이가 계약을 벗어났습니다',
  /** 개인 풀이 화면에 생한자나 외국 문자가 섞였다 */
  'non-korean-self-body': '개인 풀이 본문에 한글이 아닌 문자가 섞였습니다',
} as const;

export type ReadingFailureCode = keyof typeof READING_FAILURES;

export type ReadingFailure = {
  code: ReadingFailureCode;
  /** 무엇이 걸렸는가 — 운영 로그에 남는다. 원문은 여기 적지 않는다 */
  detail: string;
};

/**
 * 검사가 알아야 하는 **비밀** — 우리는 알고 모델은 모르는 값.
 *
 * 이 값들이 검사기로 들어오지만 프롬프트로는 가지 않는다(`redactEvidence`). 검사기가
 * 이것을 아는 것이 요점이다 — 「날짜 모양」을 정규식으로 막으면 절기 날짜까지 걸리고,
 * 그러면 멀쩡한 글이 막힌다.
 */
export type BirthSecret = {
  /** 사용자가 넣은 그대로 — 음력일 수 있다 */
  originalDate: string;
  /** 변환된 양력 */
  solarDate: string;
  /** `HH:MM[:SS]`. 시간 미상이면 `null` */
  birthTime: string | null;
  city: string;
};

/**
 * 공유 결과에서 **나올 수 없는** 판정 낱말들.
 *
 * `shareEvidence` 가 통째로 뺀 것들이다(`WITHHELD_PATHS`). 자료에 값이 없으므로 이
 * 낱말이 글에 있다면 모델이 여덟 글자를 보고 **새 판정을 만든 것**이고, 그것이
 * ADR 0012 가 여덟 글자 나열보다 더 중하게 본 hard fail 이다.
 *
 * ## 「자료에 있으면 통과」로 두지 않는 이유 — 재어 봤다
 *
 * 한 번 그렇게 고쳤다가 되돌렸다. **엔진이 쓰는 이름과 사람이 쓰는 말이 다르기**
 * 때문이다: 십성은 한자로 실리고(`正官`) 신강·용신·격국은 영어 키로 실린다. 그러면
 * 「자료에 없으면 실패」는 **정상적인 한국어 해석을 거의 다 잡는다** — 자기 풀이
 * 자료에서 이 목록의 스물여덟 낱말이 없는 것으로 나왔다.
 *
 * 그래서 kind 로 좁힌다. 잘라 낸 것이 무엇인지는 `WITHHELD_PATHS` 가 값으로 알고 있고,
 * 이 목록은 그 값들을 **사람이 부르는 이름**이다.
 *
 * ## 여기 **없는** 것 둘 — 넣으면 멀쩡한 글이 걸린다
 *
 * - **십성 이름**(정관·편재 …). 공유 자료에는 서로를 무엇으로 보는가가 들어 있고
 *   (`compatibility.tenGods`) 프롬프트가 그것을 쓰라고 절을 하나 배정한다. 막으면
 *   시키는 대로 쓴 글이 hard fail 난다.
 * - **관계 이름**(원진·귀문·형·충·파·해 …). 두 원국 **사이의** 관계는 동의 범위 안이고
 *   자료에 실제로 있다 — 재어 봤다: 공유 자료에 「사술원진」·「사술귀문」이 그대로 있다.
 */
export const OUT_OF_SCOPE_TERMS: readonly string[] = [
  // 신강·신약과 그 근거
  '신강',
  '신약',
  '통근',
  '득령',
  '득지',
  '득세',
  // 용신 갈래
  '용신',
  '기신',
  '희신',
  '구신',
  '한신',
  '억부',
  '조후',
  '격국',
  '종격',
  // 원국 하나에서만 나오는 신살
  '신살',
  '공망',
  '역마',
  '화개',
  '도화',
  '천을귀인',
  '문창귀인',
  '학당귀인',
  '백호',
  '괴강',
  '양인',
  '고신',
  '과숙',
  // 12운성
  '12운성',
  '십이운성',
  '장생',
  '제왕',
  // 운 — 동의 범위 밖이다
  '대운',
  '세운',
  '월운',
];

/**
 * 사주 말과 일상어가 겹치는 둘은 **낱말 하나만으로 판정하지 않는다.**
 *
 * - `통근` — 「통근 거리」는 두 사람의 생활을 말하는 정상적인 궁합 문장이다. 원국의
 *   뿌리를 말할 때 함께 나오는 자리·동사만 잡는다.
 * - `세운` — 「함께 세운 규칙」의 동사와 해마다 도는 운의 이름이 같다. 조사나 운 문맥을
 *   가진 명사만 잡는다.
 *
 * 나머지는 이 중의성이 없으므로 값 자체를 찾는다. 모두 정규식으로 바꾸면 무엇을 놓치는지
 * 읽을 수 없고, 처음 막으려던 판정까지 조용히 빠진다.
 */
const AMBIGUOUS_OUT_OF_SCOPE: Readonly<Record<string, readonly RegExp[]>> = {
  통근: [
    /(?:일간|천간|지지|지장간|월지|일지|뿌리).{0,16}통근/,
    /통근.{0,16}(?:일간|천간|지지|지장간|월지|일지|뿌리)/,
    /통근(?:력| 여부|한다|합니다|한|하지|했다|되어|됐다|이 있다|이 없다)/,
  ],
  세운: [
    /세운(?:은|이|을|의|에서|으로|과|도|만|에는|:)/,
    /세운\s+(?:흐름|기운|영향|간지|운세|해석)/,
    /(?:올해|금년|연도|대운|월운).{0,12}세운/,
    /세운.{0,12}(?:올해|금년|연도|대운|월운)/,
  ],
};

const hasOutOfScopeTerm = (markdown: string, term: string): boolean => {
  const contextual = AMBIGUOUS_OUT_OF_SCOPE[term];
  return contextual === undefined
    ? markdown.includes(term)
    : contextual.some((pattern) => pattern.test(markdown));
};

const STEM_CHARS: readonly string[] = STEMS;
const BRANCH_CHARS: readonly string[] = BRANCHES;

/** 글에 쓰인 간지 한자 — 한 글자씩 본다. 이름(`甲子`)은 두 글자로 갈린다 */
const charactersIn = (text: string): string[] =>
  [...new Set([...text])].filter(
    (char) => STEM_CHARS.includes(char) || BRANCH_CHARS.includes(char),
  );

/** 한글이 아닌 글자. 숫자·문장부호·기호는 글자가 아니므로 이 검사 대상이 아니다. */
const nonKoreanLettersIn = (text: string): string[] =>
  [...new Set(text.match(/\p{L}/gu) ?? [])].filter(
    (char) => !/\p{Script=Hangul}/u.test(char),
  );

const pad = (value: string): string => value.padStart(2, '0');
const bare = (value: string): string => String(Number(value));

/**
 * 한 날짜가 글에 나타날 수 있는 꼴들.
 *
 * 손으로 적는다. 「숫자만 남기고 견준다」로 하면 짧고 영리하지만, 무엇을 잡고 무엇을
 * 놓치는지 읽어서 알 수 없게 된다.
 */
function dateForms(date: string): string[] {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return [date];

  const [m, d] = [pad(month), pad(day)];
  const [mb, db] = [bare(month), bare(day)];

  return [
    `${year}-${m}-${d}`,
    `${year}-${mb}-${db}`,
    `${year}.${m}.${d}`,
    `${year}. ${mb}. ${db}`,
    `${year}/${m}/${d}`,
    `${year}년 ${mb}월 ${db}일`,
    `${year}년 ${m}월 ${d}일`,
    `${year}${m}${d}`,
    `${year.slice(2)}${m}${d}`,
  ];
}

/** 한 시각이 글에 나타날 수 있는 꼴들 */
function timeForms(time: string): string[] {
  const [hour, minute] = time.split(':');
  if (!hour || !minute) return [time];

  const [h, mi] = [pad(hour), pad(minute)];
  const [hb, mib] = [bare(hour), bare(minute)];
  const noon = Number(hour) >= 12;
  const twelve = Number(hour) % 12 === 0 ? 12 : Number(hour) % 12;

  return [
    `${h}:${mi}`,
    `${hb}시 ${mib}분`,
    `${hb}시${mib}분`,
    `${h}시 ${mi}분`,
    `${noon ? '오후' : '오전'} ${twelve}시 ${mib}분`,
    `${noon ? '오후' : '오전'} ${twelve}시 ${mi}분`,
  ];
}

/** 그 비밀이 글에 나타날 수 있는 꼴 전부 */
export function secretForms(secret: BirthSecret): string[] {
  return [
    ...dateForms(secret.originalDate),
    ...dateForms(secret.solarDate),
    ...(secret.birthTime === null ? [] : timeForms(secret.birthTime.slice(0, 5))),
    secret.city,
  ];
}

export type ReadingCheck =
  | { ok: true }
  | { ok: false; failures: readonly ReadingFailure[] };

/**
 * 나온 글이 나가도 되는가.
 *
 * @param evidenceText 실제로 모델에 보낸 자료 그대로. 「자료에 있었나」를 이것에 묻는다.
 * @param secrets 이 결과에 걸린 사람들의 출생 원문. 모델은 못 본 값이다.
 */
export function checkReading({
  kind,
  output,
  evidenceText,
  secrets,
}: {
  kind: ReadingKind;
  output: ReadingOutput;
  evidenceText: string;
  secrets: readonly BirthSecret[];
}): ReadingCheck {
  const failures: ReadingFailure[] = [];
  const { markdown, score } = output;

  const { min, max } = READING_POLICY.markdownLength;
  if (markdown.trim().length < min || markdown.length > max) {
    failures.push({
      code: 'length-out-of-contract',
      detail: `${markdown.length}자 (${min}~${max})`,
    });
  }

  /**
   * 개인 풀이 화면은 한글 이름으로 읽힌다. 계산 근거에는 원문 한자가 필요하므로
   * `readingBody` 로 사용자에게 보이는 부분만 자르고 검사한다.
   */
  if (kind === 'self') {
    const nonKoreanLetters = nonKoreanLettersIn(readingBody(markdown));
    if (nonKoreanLetters.length > 0) {
      failures.push({
        code: 'non-korean-self-body',
        detail: `한글 아닌 글자 ${nonKoreanLetters.length}종`,
      });
    }
  }

  /**
   * 점수는 **있어야 할 때 있고 없어야 할 때 없어야** 한다. 자기 풀이에 숫자가 붙어
   * 나오면 화면이 궁합 점수가 아닌 것을 궁합 점수 자리에 세우게 된다.
   */
  if (isScored(kind)) {
    if (
      score === null ||
      !Number.isInteger(score) ||
      score < READING_POLICY.scoreRange.min ||
      score > READING_POLICY.scoreRange.max
    ) {
      failures.push({ code: 'score-out-of-contract', detail: `score=${String(score)}` });
    }
  } else if (score !== null) {
    failures.push({ code: 'score-out-of-contract', detail: '자기 풀이에 점수가 붙었습니다' });
  }

  const inventedCharacters = charactersIn(markdown).filter(
    (char) => !evidenceText.includes(char),
  );
  if (inventedCharacters.length > 0) {
    failures.push({ code: 'invented-characters', detail: inventedCharacters.join('·') });
  }

  const leaked = secrets
    .flatMap((secret) => secretForms(secret))
    .filter((form) => markdown.includes(form));
  if (leaked.length > 0) {
    /**
     * **샌 값 자체는 적지 않는다.** 실패 기록은 운영 로그로 나가고, 로그에 출생
     * 원문을 남기지 않는 것이 PRD 의 규율이다. 몇 건인지와 종류만 남긴다.
     */
    failures.push({ code: 'birth-input-leaked', detail: `${leaked.length}건` });
  }

  /**
   * **동의 범위 밖의 원국 판정을 만들었다.**
   *
   * 공유 결과에만 건다. 자기 풀이와 비공개 궁합에서는 그 판정들이 자료에 실제로 있고,
   * 거기서 막을 이유가 없다 — 한 kind 의 규칙을 다른 kind 에 그대로 옮기면 시키는 대로
   * 쓴 글이 걸린다.
  */
  if (kind === 'match') {
    const outOfScope = OUT_OF_SCOPE_TERMS.filter((term) => hasOutOfScopeTerm(markdown, term));
    if (outOfScope.length > 0) {
      failures.push({ code: 'out-of-scope-judgment', detail: outOfScope.join('·') });
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}
