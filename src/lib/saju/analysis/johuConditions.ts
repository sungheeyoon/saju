import type { Branch, Element, Stem } from '../constants';

/**
 * 조후표 120칸의 **조건을 값으로 옮긴 표** — `JOHU_TABLE[..].note` 를 조건절 단위로 갈랐다(ADR 0111).
 *
 * `note` 는 사람이 읽는 요약이라 계산기가 「丙이 없으면 庚」의 앞쪽(丙이 있는가)조차 볼 수
 * 없었다. 여기서는 각 조건절을 종류(`JohuConditionKind`)와 판정에 쓸 글자로 적고, 원문은
 * `text` 에 그대로 남긴다. **새 문턱을 짓지 않는다** — 「수가 왕하면」 · 「토가 많으면」은
 * `force-threshold`, 「원국에 따라 참작」 · 「조건을 본다」는 `unspecified` 로 적기만 하고
 * 판정은 `johuJudgement.ts` 가 `not-evaluated` 로 남긴다.
 *
 * 2026-09-25 에 손으로 가른 분류(`docs/notes/2026-09-25-need-profile-baseline.md` 4)와 견준
 * 수는 `johuConditions.test.ts` 가 든다. 칸 단위로 조건 없음 44 · 이미 가진 사실로 정해짐 24 ·
 * 국까지 쓰면 정해짐 8 · 세력 문턱 34 · 적히지 않음 10 이다 — 측정 노트는 43 · 24 · 8 · 34 · 11
 * 이었다. 「戊巳 · 辛巳 · 壬巳 · 辛丑」처럼 목록 안의 글자를 「참작한다」고만 한 칸 넷을 여기서는
 * 모두 조건 없음으로 두었다(조건이 아니라 검토 순서의 말이다). 노트는 그중 하나를 적히지
 * 않음으로 셌는데 어느 칸인지 남지 않아 한 규칙으로 맞췄다.
 *
 * 몇 가지 읽는 법:
 *
 * - 「없으면」은 여덟 글자 어디에도 없다는 뜻으로 읽는다 — `johuAssessmentOf` 의
 *   `presence: 'absent'` 와 같은 선이다. 「나오면」 · 「투출」은 천간에 드러났다는 뜻이다.
 * - **꺼림은 모두 천간에 드러났을 때로 본다.** 乙子의 癸 · 丙巳의 戊 · 辛午의 丁은 월지의
 *   지장간에 늘 있어 「있다」로 읽으면 언제나 걸린다 — 월령에 든 글자를 꺼린다는 말일 수는 없다.
 * - 「丁이 午戌未에 통근해야」처럼 뿌리 자리가 적힌 칸은 그 지지만, 「화가 지지에 통근해야」처럼
 *   안 적힌 칸은 어느 지지든 본다. 뿌리의 뜻은 `rootedness.ts`(같은 오행의 지장간)를 그대로 쓴다.
 * - 대체(`substitute`)는 **앞 글자가 없을 때 같은 오행의 다른 글자를 쓰라고 적은 칸**만 참이다
 *   (「壬이 없으면 癸」 · 「辛이 없으면 庚」 · 「戊가 없으면 己」 · 「丁이 없으면 丙」 · 「庚이 없으면 辛」).
 *   다른 오행으로 넘어가는 말(「庚이 없으면 丙丁」 · 「수가 없으면 戊己」)은 대체가 아니라 다른 처방이다.
 * - 癸辰의 「丁은 쓰지 않는다」는 꺼림으로 적지 않았다 — 원국의 丁을 꺼린다는 말이 아니라 丁을
 *   처방하지 않는다는 말이고, 측정 노트의 꺼림 넷(乙子 · 丙巳 · 辛卯 · 辛午)에도 없다.
 */

/** 앞 글자가 원국에 어떻게 있을 때 조건이 서는가 */
export type StemPresenceWhen =
  /** 여덟 글자 어디에도 없다 */
  | 'absent'
  /** 천간이든 지장간이든 있다 */
  | 'present'
  /** 천간에 드러났다 */
  | 'revealed'
  /** 지지(지장간)에 있다 */
  | 'in-branch';

export type JohuConditionSpec =
  | { kind: 'half-month'; text: string }
  | {
      kind: 'stem-presence-fallback';
      text: string;
      /** 실재를 볼 앞 글자들 */
      trigger: readonly Stem[];
      /** 앞 글자가 여럿이면 모두인가(「수가 없으면」 → 壬癸 모두 없음) 하나라도인가 */
      match: 'all' | 'any';
      when: StemPresenceWhen;
      /** 조건이 서면 권하는 글자 — 목록 밖일 수 있다(癸寅 · 癸巳 · 庚午) */
      use: readonly Stem[];
      /**
       * `gate` 면 `use` 는 조건이 설 때만 권해진다(「없으면 庚」). `fact` 면 조건은 사실로만 남고
       * 권하는 목록을 바꾸지 않는다 — 다른 판정(국 · 세력)과 얽혀 혼자 가르면 안 되는 칸이거나
       * 「나오면 甲으로 제한다」처럼 권함이 아니라 쓰임을 말한 칸이다.
       */
      effect: 'gate' | 'fact';
      /** 표가 같은 오행의 다른 글자로 대신하라고 말했는가 */
      substitute: boolean;
    }
  | {
      kind: 'stem-rooting';
      text: string;
      /** 뿌리를 볼 글자 — 여럿이면 하나라도 */
      stems: readonly Stem[];
      /** 뿌리 자리. `null` 이면 어느 지지든 */
      branches: readonly Branch[] | null;
    }
  | { kind: 'avoidance'; text: string; stem: Stem; when: 'revealed' }
  | {
      kind: 'bureau';
      text: string;
      element: Element;
      form: 'bureau' | 'combination';
    }
  | { kind: 'force-threshold'; text: string }
  | { kind: 'unspecified'; text: string };

// ─── 짓는 손 ────────────────────────────────────────────────────────────────

const half = (text: string): JohuConditionSpec => ({
  kind: 'half-month',
  text,
});

/** 「A가 없으면 B」 — 기본은 목록을 가르는 처방이다 */
const ifAbsent = (
  text: string,
  trigger: readonly Stem[],
  use: readonly Stem[],
  options: { substitute?: boolean; effect?: 'gate' | 'fact' } = {},
): JohuConditionSpec => ({
  kind: 'stem-presence-fallback',
  text,
  trigger,
  match: 'all',
  when: 'absent',
  use,
  effect: options.effect ?? 'gate',
  substitute: options.substitute ?? false,
});

/** 「A가 있으면(나오면) B」 — 사실로만 남긴다 */
const ifSeen = (
  text: string,
  trigger: readonly Stem[],
  when: Exclude<StemPresenceWhen, 'absent'>,
  use: readonly Stem[],
  match: 'all' | 'any' = 'all',
): JohuConditionSpec => ({
  kind: 'stem-presence-fallback',
  text,
  trigger,
  match,
  when,
  use,
  effect: 'fact',
  substitute: false,
});

const rooting = (
  text: string,
  stems: readonly Stem[],
  branches: readonly Branch[] | null,
): JohuConditionSpec => ({ kind: 'stem-rooting', text, stems, branches });

const avoid = (text: string, stem: Stem): JohuConditionSpec => ({
  kind: 'avoidance',
  text,
  stem,
  when: 'revealed',
});

const bureau = (
  text: string,
  element: Element,
  form: 'bureau' | 'combination' = 'bureau',
): JohuConditionSpec => ({ kind: 'bureau', text, element, form });

const force = (text: string): JohuConditionSpec => ({
  kind: 'force-threshold',
  text,
});

const unspecified = (text: string): JohuConditionSpec => ({
  kind: 'unspecified',
  text,
});

// ─── 표 ─────────────────────────────────────────────────────────────────────

export const JOHU_CONDITIONS: Record<Stem, Record<Branch, readonly JohuConditionSpec[]>> = {
  甲: {
    寅: [],
    卯: [ifAbsent('庚이 없으면 丙丁으로 설기한다', ['庚'], ['丙', '丁'])],
    辰: [
      ifSeen('庚을 쓰면 丁으로 제련한다', ['庚'], 'present', ['丁']),
      ifAbsent('庚이 없으면 壬을 본다', ['庚'], ['壬']),
    ],
    巳: [force('이미 윤택하면 庚丁을 본다')],
    午: [force('목이 많으면 庚, 庚이 많으면 丁을 본다')],
    未: [half('상반월은 癸, 하반월은 庚丁')],
    申: [unspecified('壬은 조건부로 쓴다')],
    酉: [],
    戌: [force('토가 많으면 甲, 목이 많으면 庚')],
    亥: [force('수가 왕하면 戊가 필요하다')],
    子: [],
    丑: [],
  },
  乙: {
    寅: [force('화가 많으면 癸를 쓴다')],
    卯: [force('강한 금을 꺼린다')],
    辰: [bureau('수국이면 戊로 물을 제어한다', '水')],
    巳: [],
    午: [half('상반월은 癸, 하반월은 丙癸')],
    未: [force('금수가 많으면 丙을 먼저 본다')],
    申: [],
    酉: [half('상반월은 癸先, 하반월은 丙先'), bureau('금국이면 丁도 필요하다', '金')],
    戌: [ifSeen('甲이 있으면 등라계갑으로 본다', ['甲'], 'present', [])],
    亥: [force('물이 많으면 戊로 돕는다')],
    子: [avoid('癸가 丙을 가리는 것을 꺼린다', '癸')],
    丑: [],
  },
  丙: {
    寅: [],
    卯: [force('물이 많으면 戊, 신약하면 인성을 본다')],
    辰: [force('토가 두꺼우면 甲으로 소토한다')],
    巳: [
      avoid('戊가 壬을 막는 것을 꺼린다', '戊'),
      ifAbsent('壬이 없으면 癸다', ['壬'], ['癸'], { substitute: true }),
    ],
    午: [rooting('庚이 申에 통근하면 좋다', ['庚'], ['申'])],
    未: [],
    申: [force('壬이 많으면 戊로 제어한다')],
    酉: [
      force('丙이 많을수록 壬 하나가 중요하다'),
      ifAbsent('壬이 없으면 癸를 본다', ['壬'], ['癸'], { substitute: true }),
    ],
    戌: [],
    亥: [force('수가 많으면 甲, 살이 왕하면 戊, 화가 왕하면 壬, 목이 왕하면 庚')],
    子: [
      force('수가 많으면 戊로 제어한다'),
      ifAbsent('戊가 없으면 己로 제어한다', ['戊'], ['己'], {
        substitute: true,
      }),
    ],
    丑: [force('토가 많으면 甲이 빠질 수 없다')],
  },
  丁: {
    寅: [],
    卯: [],
    辰: [],
    巳: [force('목이 많으면 庚을 먼저 본다')],
    午: [
      bureau('화국이면 壬庚이 함께 투출해야 한다', '火'),
      ifAbsent('壬이 없으면 癸를 본다', ['壬'], ['癸'], { substitute: true }),
    ],
    未: [],
    申: [force('수가 왕하면 戊, 한습하면 丙을 살핀다')],
    酉: [force('수가 왕하면 戊, 한습하면 丙을 살핀다')],
    戌: [force('戊土 일색이면'), unspecified('상관상진 조건을 따로 살핀다')],
    亥: [unspecified('戊癸는 원국에 따라 참작한다')],
    子: [],
    丑: [],
  },
  戊: {
    寅: [],
    卯: [],
    辰: [],
    巳: [],
    午: [],
    未: [force('토가 무거우면 甲도 필요하다')],
    申: [force('물이 많으면 癸보다 甲으로 설한다')],
    酉: [],
    戌: [bureau('금국이면 癸를 丙보다 앞세운다', '金')],
    亥: [],
    子: [],
    丑: [],
  },
  己: {
    寅: [force('토가 많으면 甲, 甲이 많으면 庚을 본다')],
    卯: [bureau('甲己 합화를 경계한다', '土', 'combination')],
    辰: [],
    巳: [],
    午: [],
    未: [],
    申: [],
    酉: [unspecified('辛으로 癸를 돕는 조건을 살핀다')],
    戌: [],
    亥: [force('壬이 왕하면 戊, 토가 많으면 甲을 본다')],
    子: [force('수·토의 많고 적음에 戊甲을 쓴다')],
    丑: [force('수·토의 많고 적음에 戊甲을 쓴다')],
  },
  庚: {
    寅: [force('토가 두꺼우면 甲, 화가 많으면 戊를 본다'), bureau('화국이면 壬을 본다', '火')],
    卯: [ifAbsent('丁이 없으면 丙을 본다', ['丁'], ['丙'], { substitute: true })],
    辰: [
      force('완금에는 丁, 왕토에는 甲'),
      ifSeen('천간 화는 壬으로 조절한다', ['丙', '丁'], 'revealed', ['壬'], 'any'),
      ifSeen('지지 화는 癸로 조절한다', ['丙', '丁'], 'in-branch', ['癸'], 'any'),
    ],
    巳: [bureau('금국이면 강해지므로 丁을 쓴다', '金')],
    午: [ifAbsent('수가 없으면 戊己로 화기를 설한다', ['壬', '癸'], ['戊', '己'])],
    未: [bureau('토국이면 甲을 먼저, 丁을 뒤에 둔다', '土')],
    申: [],
    酉: [],
    戌: [force('토가 두꺼우면 甲으로 소토한다')],
    亥: [unspecified('甲이 丁을 돕는지 살핀다')],
    子: [rooting('화가 지지에 통근해야 힘이 있다', ['丙', '丁'], null)],
    丑: [],
  },
  辛: {
    寅: [],
    卯: [avoid('丁의 투출을 꺼린다', '丁')],
    辰: [
      bureau('丙辛 합수가 있으면', '水', 'combination'),
      unspecified('丙을 제할 조건을 따로 본다'),
    ],
    巳: [],
    午: [
      ifAbsent('壬이 없으면 癸를 쓴다', ['壬'], ['癸'], { substitute: true }),
      avoid('丁을 꺼린다', '丁'),
    ],
    未: [ifSeen('戊가 나오면 甲으로 제한다', ['戊'], 'revealed', ['甲'])],
    申: [unspecified('甲戊는 원국에 따라 참작한다')],
    酉: [
      force('토가 많으면 甲'),
      bureau('금국에 壬이 없으면 丁을 본다', '金'),
      // 「금국에 壬이 없으면 丁」 — 국과 얽혀 있어 앞 글자만으로 목록을 가르지 않는다.
      ifAbsent('금국에 壬이 없으면 丁을 본다', ['壬'], ['丁'], {
        effect: 'fact',
      }),
    ],
    戌: [],
    亥: [unspecified('금백수청의 조건을 본다')],
    子: [unspecified('戊壬甲은 원국에 따라 참작한다')],
    丑: [],
  },
  壬: {
    寅: [force('비겁이 적으면 庚과 丙, 비겁이 많으면 戊로 제어한다')],
    卯: [force('물이 많으면 戊를 먼저 쓴다')],
    辰: [force('금이 많으면 丙을 본다')],
    巳: [],
    午: [ifAbsent('庚이 없으면 辛을 본다', ['庚'], ['辛'], { substitute: true })],
    未: [],
    申: [
      rooting('戊는 辰戌에 통근해야 쓸 힘이 있다', ['戊'], ['辰', '戌']),
      rooting('丁은 午戌에 통근해야 쓸 힘이 있다', ['丁'], ['午', '戌']),
    ],
    酉: [force('甲이 부족하면 庚辛으로 수원을 돕는다')],
    戌: [],
    亥: [ifSeen('甲이 戊를 제하면 庚으로 구한다', ['甲'], 'revealed', ['庚'])],
    子: [],
    丑: [half('상반월은 丙, 하반월은 丁甲')],
  },
  癸: {
    寅: [
      ifAbsent('辛이 없으면 庚을 참작한다', ['辛'], ['庚'], {
        substitute: true,
      }),
    ],
    卯: [],
    辰: [half('상반월은 丙, 하반월은 辛甲')],
    巳: [
      ifAbsent('辛이 없으면 庚을 대신 본다', ['辛'], ['庚'], {
        substitute: true,
      }),
    ],
    午: [unspecified('壬癸 비겁이 금을 돕는지 본다')],
    未: [half('상반월은 午월과 같고 하반월은 비겁 없이도 금을 쓸 수 있다')],
    申: [rooting('丁이 午戌未에 통근해야 좋다', ['丁'], ['午', '戌', '未'])],
    酉: [ifSeen('辛과 丙을 떨어져 투출시킨다', ['辛', '丙'], 'revealed', [])],
    戌: [unspecified('비겁으로 甲을 도와 戊를 제하는 조건을 본다')],
    亥: [force('물이 많으면 戊, 금이 많으면 丁을 쓴다')],
    子: [],
    丑: [
      bureau('화국이면 庚辛을 본다', '火'),
      rooting('야생·통근 조건이면 丁을 따로 본다', ['丁'], null),
    ],
  },
};
