import { TEN_GOD_GROUP_KO, TEN_GOD_KO } from '../saju/analysis';
import {
  BRANCHES,
  BRANCH_CLASHES,
  BRANCH_DESTRUCTIONS,
  BRANCH_GHOST_GATES,
  BRANCH_HARMS,
  BRANCH_INFO,
  BRANCH_PUNISHMENTS,
  BRANCH_RESENTMENTS,
  BRANCH_SIX_COMBINATIONS,
  STEMS,
  STEM_CLASHES,
  STEM_COMBINATIONS,
  STEM_INFO,
  type Branch,
  type Stem,
} from '../saju/constants';

import { readingBody } from './display';
import {
  READING_POLICY,
  isScored,
  isSolo,
  type ReadingKind,
  type ReadingOutput,
} from './policy';

/**
 * 나온 글을 **저장하기 전에** 검사한다.
 *
 * `prd-archive` 의 hard fail 넷이 여기 있다. 검사가 하는 일은 「좋은 글인가」가 아니라 **「이
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
 * `prd-archive` 의 hard fail 에는 「근거에 없는 **관계**」도 있다. 그건 여기서 못 잡는다. 자료에
 * 실제로 있는 두 글자로 없는 합·충·형을 지어내면 글자 검사도 낱말 검사도 지나간다 —
 * 문장이 자유 서술인 한 「이 조합이 자료의 어느 관계인가」를 기계가 짚을 방법이 없다.
 * 근거 인용을 출력 계약에 넣어 대조하는 길도 생각했는데, **인용을 지어내면 같은 문제가
 * 한 겹 위로 올라갈 뿐**이다.
 *
 * 그래서 그 항목은 사람 쪽에 남는다 — audit 프롬프트와 제품 담당자의 blind review
 * (`prd-archive` 「AI 품질 게이트」). 못 막는 것을 막는 척하지 않는 것이 「짐작으로 막지 않는다」의
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
 * - **`억부`**. 같은 까닭인데 **처음 실호출에서야 드러났다.** `shareEvidence` 는
 *   `compatibility` 를 통째로 남기고 그 안에 `eokbuMatch` 가 있다(그 파일이 「오행 보완과
 *   억부 후보를 사실상 드러내지만 궁합 그 자체라 뺄 수 없다」고 적어 두었다). 게다가
 *   궁합 6절이 **`eokbuMatch` 를 읽으라고 시킨다.** 시키는 대로 쓴 글이 hard fail 났다.
 *
 *   `조후` 는 남는다 — 그 값은 `analysis` 에 있고 공유 자료에서 통째로 빠진다. 자료에
 *   없는 판정이므로 글에 있으면 지어낸 것이다. **둘을 가른 것은 낱말의 인상이 아니라
 *   `WITHHELD_PATHS` 가 실제로 무엇을 잘라 냈는가다.**
 */
export const OUT_OF_SCOPE_TERMS: readonly string[] = [
  // 신강·신약과 그 근거
  '신강',
  '신약',
  '통근',
  '득령',
  '득지',
  '득세',
  // 용신 갈래 — **`억부` 는 여기 없다.** 아래 「여기 없는 것」이 왜인지 든다
  '용신',
  '기신',
  '희신',
  '구신',
  '한신',
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
 * 사주 말과 일상어가 **소리가 같은 것들** — 낱말 하나만으로 판정하지 않는다.
 *
 * - `통근` — 「통근 거리」는 두 사람의 생활을 말하는 정상적인 궁합 문장이다. 원국의
 *   뿌리를 말할 때 함께 나오는 자리·동사만 잡는다.
 * - `세운` — 「함께 세운 규칙」의 동사와 해마다 도는 운의 이름이 같다. 조사나 운 문맥을
 *   가진 명사만 잡는다.
 * - `상관`·`인성` — 「상관없어요」·「인성이 좋은 사람」이 그대로 걸린다.
 * - `도화`·`인사해` — 도화지·도화선은 그림이고, 「먼저 인사해 보세요」는 조언이다.
 *
 * **한 표를 두 검사가 나눠 쓴다.** 동의 범위 밖 판정을 찾는 일과 쉬운 말 판을 재는 일이
 * 같은 낱말을 서로 다르게 읽으면, 한쪽에서 통과한 것이 다른 쪽에서 걸린다.
 *
 * 나머지는 이 중의성이 없으므로 값 자체를 찾는다. 모두 정규식으로 바꾸면 무엇을 놓치는지
 * 읽을 수 없고, 처음 막으려던 판정까지 조용히 빠진다.
 */
const AMBIGUOUS_SAJU_TERMS: Readonly<Record<string, readonly RegExp[]>> = {
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
  /** 곁에 다른 사주 말이 서 있을 때만 십성으로 읽는다 */
  상관: [
    /(?:식신|편관|정관|비견|겁재|재성|관성|인성|십성|일간)[^\n]{0,24}상관/,
    /상관[^\n]{0,24}(?:식신|편관|정관|비견|겁재|재성|관성|인성|십성|일간)/,
    /상관(?:격|이 강|이 세|이 많|이 약|이 발달|의 기운)/,
  ],
  인성: [
    /(?:비겁|식상|재성|관성|비견|겁재|식신|편재|정재|편관|정관|편인|정인|십성|일간)[^\n]{0,24}인성/,
    /인성[^\n]{0,24}(?:비겁|식상|재성|관성|비견|겁재|식신|편재|정재|편관|정관|편인|정인|십성|일간)/,
    /인성(?:격|이 강|이 세|이 많|이 두텁|의 기운)/,
  ],
  /** 도화지·도화선은 그림이고 종이다 */
  도화: [/도화(?!지|선)/],
  /** 지지해 하나가 하필 인사하는 말과 같다 — 뒤에 동사가 이어지면 관계 이름이 아니다 */
  인사해: [/인사해(?!\s*(?:보|주|줘|요|서|야|드리|봐|준))/],
};

const hasSajuTerm = (markdown: string, term: string): boolean => {
  const contextual = AMBIGUOUS_SAJU_TERMS[term];
  return contextual === undefined
    ? markdown.includes(term)
    : contextual.some((pattern) => pattern.test(markdown));
};

/**
 * **쉬운 말 판이 본문에 내면 안 되는 분류명들.**
 *
 * `OUT_OF_SCOPE_TERMS` 와 겨누는 것이 다르다. 저쪽은 **동의 범위 밖의 판정**을 찾는
 * 일이라 나오면 저장을 막고, 이쪽은 **그 판이 시킨 대로 나왔는가**를 재는 자다
 * (`outputDeviations`). 그래서 하나가 나왔다고 글을 버리지 않는다 — 목표는 「단 하나도
 * 안 나오게」가 아니라 **읽는 사람 앞에 분류명이 튀어나오는 일이 얼마나 남았는가**다.
 *
 * ## 오행은 여기 없다
 *
 * 목·화·토·금·수는 막지 않는다. 「금이 셋이에요」는 한국어에서 자연스러운 말이고, 그것을
 * 세는 것이 이 제품이 하는 일의 절반이다. 이름을 안 부르기로 한 것은 **읽는 사람이
 * 멈추는 말**이지 셀 수 있는 사실이 아니다.
 *
 * ## 이름은 표에서 짓는다
 *
 * 십성과 관계 이름을 손으로 옮겨 적지 않는다. 십성 이름이 늘거나 관계 표가 바뀌면 이
 * 목록이 저절로 따라온다 — 손으로 적으면 그날 한쪽만 고쳐진다.
 */
const ko = {
  branch: (char: Branch): string => BRANCH_INFO[char].ko,
  stem: (char: Stem): string => STEM_INFO[char].ko,
};

/**
 * 관계 이름 — **표가 든 `ko` 를 그대로 쓰지 않는다.**
 *
 * 표의 `ko` 에는 합화한 오행이 붙어 있고(`자축합토`), 사람이 쓰는 글에는 대개 그 앞토막만
 * 나온다(`자축합`). 삼형도 표는 `인사신 삼형` 인데 글은 `인사신형` 이라 적는다. 그래서
 * 짝만 표에서 가져오고 **뒤에 붙는 한 글자는 여기서 짓는다.**
 */
const RELATION_NAMES: readonly string[] = [
  ...BRANCH_CLASHES.map(({ branches: [a, b] }) => `${ko.branch(a)}${ko.branch(b)}충`),
  ...BRANCH_HARMS.map(({ branches: [a, b] }) => `${ko.branch(a)}${ko.branch(b)}해`),
  ...BRANCH_DESTRUCTIONS.map(({ branches: [a, b] }) => `${ko.branch(a)}${ko.branch(b)}파`),
  ...BRANCH_SIX_COMBINATIONS.map(({ branches: [a, b] }) => `${ko.branch(a)}${ko.branch(b)}합`),
  ...BRANCH_RESENTMENTS.map(({ ko: name }) => name),
  ...BRANCH_GHOST_GATES.map(({ ko: name }) => name),
  ...BRANCH_PUNISHMENTS.map((punishment) =>
    punishment.kind === 'self'
      ? `${ko.branch(punishment.branch).repeat(2)}형`
      : `${punishment.branches.map(ko.branch).join('')}형`,
  ),
  ...STEM_CLASHES.map(({ stems: [a, b] }) => `${ko.stem(a)}${ko.stem(b)}충`),
  ...STEM_COMBINATIONS.map(({ stems: [a, b] }) => `${ko.stem(a)}${ko.stem(b)}합`),
];

export const PLAIN_FORBIDDEN_TERMS: readonly string[] = [
  // 명식 자체를 부르는 말
  '원국',
  '명식',
  '일간',
  '십성',
  // 십성 — 계열 다섯과 낱낱 열
  ...Object.values(TEN_GOD_GROUP_KO),
  ...Object.values(TEN_GOD_KO),
  // 별도 체계
  '격국',
  '조후',
  '억부',
  '용신',
  '신강',
  '신약',
  // 때를 부르는 이름
  '대운',
  '세운',
  '월운',
  // 신살 — 이름이 아니라 하는 일로 쓰게 한다
  '신살',
  '천을귀인',
  '천덕귀인',
  '월덕귀인',
  '문창귀인',
  '학당귀인',
  '역마',
  '도화',
  '화개',
  '공망',
  '백호',
  '괴강',
  '양인',
  // 관계 — 이름은 표에서 짓는다
  ...RELATION_NAMES,
];

/**
 * 그 글에 남은 분류명들 — **본문만 본다.**
 *
 * 맨 끝 검사용 근거 절은 경로와 관계 이름을 대라고 시킨 자리다. 통째로 세면 **시킨 대로
 * 쓴 근거 칸이 어긴 것으로 잡히고**, 그러면 이 자는 판을 재는 대신 자기 자신을 잰다.
 */
export const plainTermsIn = (markdown: string): readonly string[] => {
  const body = readingBody(markdown);
  return PLAIN_FORBIDDEN_TERMS.filter((term) => hasSajuTerm(body, term));
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
  if (isSolo(kind)) {
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
     * 원문을 남기지 않는 것이 `prd-archive` 의 규율이다. 몇 건인지와 종류만 남긴다.
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
    /**
     * **본문만 본다.**
     *
     * 맨 끝 검사용 근거 절은 화면이 잘라 내므로(`readingBody`) 상대에게 가지 않는다.
     * 그리고 그 절은 **경로와 계약을 대라고 시킨 자리**인데, 공유 자료의
     * `contract.withheld` 가 「대운은 동의 범위 밖이다」·「12신살」처럼 그 낱말들을 산문으로
     * 들고 있다. 통째로 세면 **모델이 「그건 안 썼습니다」라고 적는 것까지 위반으로 잡힌다** —
     * 첫 실호출에서 그렇게 떨어졌다(「사운·월운과 대운은 contract.excluded·withheld라
     * 반영하지 않음」).
     *
     * 여기서 놓치는 것이 하나 는다: 본문에서는 이름을 안 대고 근거 칸에서만 댄 판정.
     * 그건 낱말 검사가 원래 못 잡는 것과 같은 종류다 — 못 막는 것을 막는 척하지 않는다.
     */
    const body = readingBody(markdown);
    const outOfScope = OUT_OF_SCOPE_TERMS.filter((term) => hasSajuTerm(body, term));
    if (outOfScope.length > 0) {
      failures.push({ code: 'out-of-scope-judgment', detail: outOfScope.join('·') });
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}
