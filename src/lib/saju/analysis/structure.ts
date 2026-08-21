import {
  BRANCH_INFO,
  HIDDEN_STEMS,
  STEM_INFO,
  findBranchClash,
  type Branch,
  type HiddenStemRole,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, PILLAR_POSITION_KO, type PillarPosition } from '../position';
import type { ElementDistribution } from './fiveElements';
import { TEN_GOD_GROUP, TEN_GOD_KO, tenGodOf, type TenGod, type TenGodGroup } from './tenGods';
import { elementRolesOf, type ElementRole } from './yongsin';

/**
 * 격국(格局) — **월령에서 무엇을 쓰는가.**
 *
 * 억부가 「일간이 버틸 힘이 있는가」를 재는 데 비해 격국은 「이 명식이 무엇으로
 * 서 있는가」를 본다. 자평(子平) 계열은 격국을 먼저 잡고 그 격을 이루는 글자
 * (상신, 相神)를 용신으로 삼으므로, 억부와 답이 다를 수 있다.
 *
 * 그래서 **격국은 억부를 뒤집지 않는다.** 종격과 같은 자리다 — 판정은 내되
 * 상위에 서지 않는다. 다른 점은 하나뿐이고 그것을 숨기지 않는다: 종격에는
 * 서른다섯 건짜리 외부 대조가 있고 **격국에는 아직 없다.** 대조 없는 판정이
 * 대조 있는 판정보다 세게 말할 수는 없다.
 *
 * ## 격을 잡는 법
 *
 * 월지의 지장간 중 **천간에 투출한 것**으로 잡는다. 정기가 투출했으면 정기,
 * 정기는 안 나오고 중기·여기가 나왔으면 그것, 아무것도 안 나왔으면 정기로
 * 잡는다. 辰戌丑未월의 잡기격(雜氣格)이 이 규칙에서 그대로 나온다.
 *
 * 월령이 일간 편(비겁)이면 격으로 쓸 수 없다 — 자기 자신을 쓸 수는 없기
 * 때문이다. 그 자리를 고전은 건록(建祿)·양인(陽刃)·월겁(月劫)이라 따로 부른다.
 *
 * ## 성패(成敗)를 판정하는 방식
 *
 * **참·거짓 하나로 내지 않는다.** 고전의 성패는 「무엇이 있으면 이루고 무엇이
 * 있으면 깨진다」는 조건의 목록이고, 한 명식에서 이루는 조건과 깨는 조건이
 * 함께 나오는 일이 흔하다(구응救應이 그 이야기다). 그것을 boolean 으로 접으면
 * 판정이 아니라 반올림이 된다.
 *
 * 그래서 확인된 조건을 하나씩 낸다. 이루는 것만 있으면 성격, 깨는 것만 있으면
 * 파격, **섞이거나 둘 다 없으면 `unresolved`** 다.
 */

export const STRUCTURE_POLICY = {
  ruleSet: 'wolryeong-structure-v1',
  /** 고전 규칙을 옮겼으나 외부 대조가 아직 0건이다 */
  status: 'experimental',
  /** 격은 월령에서 잡는다 */
  basis: 'month-branch',
  /** 투출한 지장간으로 잡되, 없으면 정기로 잡는다 */
  selection: 'revealed-hidden-stem-then-principal',
  /**
   * 월령이 일간 편이면 격이 아니라 건록·양인·월겁이다.
   *
   * 셋을 가르는 것은 **녹(祿)과 인(刃)의 표**지 월지 정기의 십성이 아니다.
   * 戊土의 巳월은 정기가 丙(인성)이지만 戊의 녹이라 건록격으로 본다 —
   * 월령을 십성으로만 읽으면 이 자리가 편인격이 되어 버린다.
   */
  selfSeat: 'lu-blade-table-then-month-rob',
  /** 녹·인 표에서 戊는 丙과, 己는 丁과 같은 자리를 쓴다 — 계통 갈림이다 */
  fireEarthSameCourse: true,
  /** 성패는 조건 목록으로 낸다 — 참·거짓 하나로 접지 않는다 */
  outcome: 'conditions-listed',
  /**
   * **억부도 조후도 뒤집지 않는다.**
   *
   * 종격의 `eokbuOverride` 와 같은 스위치이고, 같은 이유로 꺼져 있다. 다만
   * 종격보다 근거가 더 얕다 — 종격에는 외부 명조 서른다섯 건의 대조가 있고
   * 이쪽은 0 건이다.
   */
  yongsinOverride: 'disabled',
  /** 외부 대조 — 아직 없다. 없다는 것을 값으로 남긴다 */
  externalCheck: { dataset: null, cases: 0, passed: false },
  sources: {
    selection: 'https://zh.wikisource.org/wiki/子平真詮',
    successAndFailure: 'https://zh.wikisource.org/wiki/子平真詮/論用神成敗救應',
  },
} as const;

/** 여덟 정격과 월령이 일간 편일 때의 세 자리 */
export type StructureKind =
  | '正官格'
  | '偏官格'
  | '正財格'
  | '偏財格'
  | '食神格'
  | '傷官格'
  | '正印格'
  | '偏印格'
  /** 월지 정기가 일간과 같은 글자 */
  | '建祿格'
  /** 양간이 왕지를 월령으로 얻었다 */
  | '陽刃格'
  /** 월령이 비겁인데 건록도 양인도 아닌 자리 */
  | '月劫格';

/**
 * 월령이 일간 편이라 **격으로 쓸 수 없는 세 자리.**
 *
 * `selfSeatOf` 가 내는 값의 목록이고 타입이 둘을 맞물려 둔다. 격 이름 여덟과
 * 이 셋은 같은 유니온에 있지만 종류가 다르다 — 앞은 「무엇으로 서 있는가」이고
 * 뒤는 「월령을 격으로 쓰지 못한다」라서, 문장도 그 자리에서 갈린다.
 */
export const SELF_SEAT_KINDS = ['建祿格', '陽刃格', '月劫格'] as const;

export type SelfSeatKind = (typeof SELF_SEAT_KINDS)[number];

/** 격으로 쓸 수 있는 십성 — 비겁은 빠진다 */
export type UsableTenGod = Exclude<TenGod, '比肩' | '劫財'>;

/**
 * 십성 하나에서 격 이름 하나 — **표로 적어 캐스트를 없앤다.**
 *
 * 여기는 한동안 `` `${tenGod}格` as StructureKind `` 였고, 그 캐스트가 거짓말을
 * 하고 있었다. 비겁이 새어 들어오면 유니온에 없는 `比肩格` 이 만들어지고
 * `STRUCTURE_KIND_KO` 조회가 `undefined` 를 낸다. **아무도 `ko` 를 읽지 않아서
 * 아무도 못 봤다** — 격국 문장을 세우자 슬롯이 안 채워지며 드러났다.
 */
const KIND_OF_TEN_GOD: Record<UsableTenGod, StructureKind> = {
  正官: '正官格',
  偏官: '偏官格',
  正財: '正財格',
  偏財: '偏財格',
  食神: '食神格',
  傷官: '傷官格',
  正印: '正印格',
  偏印: '偏印格',
};

export const STRUCTURE_KIND_KO: Record<StructureKind, string> = {
  正官格: '정관격',
  偏官格: '편관격',
  正財格: '정재격',
  偏財格: '편재격',
  食神格: '식신격',
  傷官格: '상관격',
  正印格: '정인격',
  偏印格: '편인격',
  建祿格: '건록격',
  陽刃格: '양인격',
  月劫格: '월겁격',
};

/**
 * 녹(祿) — 일간이 임관하는 지지. 월령이 여기면 건록격이다.
 *
 * 표를 12운성 모듈에서 끌어오지 않고 여기 적는다. 두 값이 같은 자리를 가리키는
 * 것은 맞지만, 강약이 「12운성을 점수에 넣지 않는다」고 못박은 것과 같은 이유로
 * 계산법을 섞지 않는다 — 저쪽은 생애 단계표이고 이쪽은 격을 잡는 표다.
 *
 * 火土同法을 따랐다(戊는 丙과, 己는 丁과 같은 자리). 이것이 계통 갈림이라
 * `STRUCTURE_POLICY.fireEarthSameCourse` 에 값으로 적는다.
 */
const LU_BRANCH: Record<Stem, Branch> = {
  甲: '寅', 乙: '卯',
  丙: '巳', 丁: '午',
  戊: '巳', 己: '午',
  庚: '申', 辛: '酉',
  壬: '亥', 癸: '子',
};

/** 인(刃) — 녹의 다음 자리. 양간에만 세운다 */
const BLADE_BRANCH: Partial<Record<Stem, Branch>> = {
  甲: '卯',
  丙: '午',
  戊: '午',
  庚: '酉',
  壬: '子',
};

/** 성패의 근거가 되는 조건 하나 */
export type StructureFactor = {
  /** 고전이 부르는 이름 */
  name: string;
  /** 왜 그렇게 보았는가 — 화면에 그대로 쓸 수 있는 한 줄 */
  detail: string;
};

/** 성패의 세 자리 */
export type StructureOutcome =
  /** 이루는 조건만 확인됐다 */
  | 'formed'
  /** 깨는 조건만 확인됐다 */
  | 'broken'
  /** 둘이 섞였거나 둘 다 없다 — 억지로 한쪽에 밀어 넣지 않는다 */
  | 'unresolved';

export const STRUCTURE_OUTCOME_KO: Record<StructureOutcome, string> = {
  formed: '성격',
  broken: '파격',
  unresolved: '미정',
};

export type Structure = {
  /** 외부 대조 0건이라는 것을 값으로 못박는다 */
  status: 'experimental';
  kind: StructureKind;
  ko: string;
  /** 격이 된 지장간 */
  source: {
    stem: Stem;
    role: HiddenStemRole;
    days: number;
    tenGod: TenGod;
    /** 그 글자가 드러난 천간의 자리들. 비어 있으면 투출하지 않았다 */
    revealedAt: readonly PillarPosition[];
  };
  /** 월지 지장간 셋(또는 둘)이 각각 무엇이고 투출했는가 — 격을 고른 근거다 */
  candidates: readonly {
    stem: Stem;
    role: HiddenStemRole;
    days: number;
    tenGod: TenGod;
    revealed: boolean;
  }[];
  /** 투출한 글자로 잡았는가, 아무것도 안 나와 정기로 잡았는가 */
  revealed: boolean;
  /**
   * 정기로 물러난 이유 — **「없었다」와 「있었지만 못 쓴다」는 다르다.**
   *
   * 투출한 것이 비겁뿐이면 격으로 쓸 수 없어 정기로 잡는데(`selectSource`),
   * 그것을 「천간에 드러난 것이 없다」와 한 값으로 묶으면 화면이 거짓을 말한다 —
   * 무작위 3000건에서 3.8% 가 이 자리다. 투출로 잡았으면 `null` 이다.
   */
  principalFallback: 'none-revealed' | 'revealed-unusable' | null;
  /** 월지가 충을 맞고 있는가 — 「月令冲破」 */
  monthClashed: boolean;
  formingFactors: readonly StructureFactor[];
  breakingFactors: readonly StructureFactor[];
  outcome: StructureOutcome;
};

type StructureInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

/** 일간에서 본 다섯 자리가 천간에 얼마나 드러나 있는가 */
type Revealed = Record<ElementRole, { position: PillarPosition; stem: Stem; tenGod: TenGod }[]>;

const GROUP_OF_ROLE: Record<TenGodGroup, ElementRole> = {
  比劫: '比劫',
  印星: '印星',
  食傷: '食傷',
  財星: '財星',
  官星: '官星',
};

function revealedRoles(pillars: StructureInput): Revealed {
  const found: Revealed = { 比劫: [], 印星: [], 食傷: [], 財星: [], 官星: [] };

  for (const position of PILLAR_POSITIONS) {
    // 일간 자신은 십성의 대상이 아니다.
    const pillar = position === 'day' ? null : pillars[position];
    if (pillar === null) continue;

    const tenGod = tenGodOf(pillars.dayMaster, pillar.stem);
    found[GROUP_OF_ROLE[TEN_GOD_GROUP[tenGod]]].push({ position, stem: pillar.stem, tenGod });
  }

  return found;
}

/** 격을 잡는다 — 월지 지장간 중 투출한 것, 없으면 정기 */
function selectSource(pillars: StructureInput) {
  const monthBranch = pillars.month.branch;
  const hiddens = HIDDEN_STEMS[monthBranch];

  const stemsInChart = PILLAR_POSITIONS.flatMap((position) => {
    const pillar = position === 'day' ? null : pillars[position];
    return pillar === null ? [] : [{ position, stem: pillar.stem }];
  });

  const candidates = hiddens.map((hidden) => ({
    stem: hidden.stem,
    role: hidden.role,
    days: hidden.days,
    tenGod: tenGodOf(pillars.dayMaster, hidden.stem),
    revealedAt: stemsInChart
      .filter((slot) => slot.stem === hidden.stem)
      .map((slot) => slot.position),
  }));

  // 정기가 투출했으면 정기, 아니면 다른 투출, 그것도 없으면 정기.
  //
  // **비겁은 투출했어도 격으로 잡지 않는다.** 「월령이 일간 편이면 격으로 쓸 수
  // 없다」가 이 모듈의 규칙인데(`selfSeatOf`), 그 규칙이 월령에만 걸려 있고
  // 투출한 글자에는 안 걸려 있었다. 巳월 庚 일간이 그 구멍이다 — 정기 丙은 내
  // 편이 아니라 건록도 월겁도 아닌데 중기 庚이 나 자신이라, 그 자리가 격으로
  // 잡히면 「나로 나를 쓴다」가 된다.
  //
  // 정기가 비겁인 경우는 여기 오지 않는다. 그것은 `selfSeatOf` 가 건록·양인·
  // 월겁으로 먼저 집어 간다.
  const usable = (candidate: (typeof candidates)[number]) =>
    TEN_GOD_GROUP[candidate.tenGod] !== '比劫';

  const principal = candidates.find((candidate) => candidate.role === '正氣')!;
  const chosen =
    principal.revealedAt.length > 0
      ? principal
      : (candidates.find((candidate) => candidate.revealedAt.length > 0 && usable(candidate)) ??
        principal);

  return { candidates, chosen };
}

/**
 * 월령이 일간 편인가 — 그렇다면 격이 아니라 건록·양인·월겁이다.
 *
 * 이 판정이 투출보다 **먼저**다. 월령이 내 편이면 그것을 격으로 쓸 수 없어
 * 천간에서 쓸 것을 찾는데, 그 순서를 뒤집으면 건록격 명식이 투출한 글자를 따라
 * 정관격·재격으로 잡혀 버린다.
 */
function selfSeatOf(pillars: StructureInput): SelfSeatKind | null {
  const dayMaster = pillars.dayMaster;
  const monthBranch = pillars.month.branch;

  if (LU_BRANCH[dayMaster] === monthBranch) return '建祿格';
  if (BLADE_BRANCH[dayMaster] === monthBranch) return '陽刃格';

  // 녹도 인도 아닌데 월지 정기가 비겁이면 월겁이다 — 辰戌丑未를 월령으로 얻은
  // 土 일간이나, 음간이 제 왕지를 얻은 자리가 여기 온다.
  const principal = HIDDEN_STEMS[monthBranch].find((hidden) => hidden.role === '正氣')!;
  return TEN_GOD_GROUP[tenGodOf(dayMaster, principal.stem)] === '比劫' ? '月劫格' : null;
}

/**
 * 투출한 십성에서 격 이름 하나.
 *
 * 비겁은 `selectSource` 가 걸러 냈고, 정기가 비겁인 자리는 `selfSeatOf` 가
 * 건록·양인·월겁으로 먼저 집어 갔다. 그래서 여기 남는 십성은 여덟 중 하나이고,
 * 아니라면 두 함수 중 하나가 규칙을 어긴 것이라 **조용히 `undefined` 를 흘리는
 * 대신 멈춘다.** 한동안 흘리고 있었고 아무도 못 봤다.
 */
function regularKindOf(tenGod: TenGod): StructureKind {
  const kind = KIND_OF_TEN_GOD[tenGod as UsableTenGod];
  if (kind === undefined) throw new Error(`격으로 쓸 수 없는 십성이 격에 왔다: ${tenGod}`);

  return kind;
}

/**
 * 격국을 잡고 성패의 조건을 센다.
 *
 * 세력은 실효 분포(`effectiveElements`)를 받는다 — 강약·억부·종격이 다 같은
 * 분포에서 세력을 재는데 격국만 다른 것을 보면 어긋난다.
 */
export function structureOf(
  pillars: StructureInput,
  elements: ElementDistribution,
): Structure {
  const { candidates, chosen: revealedChoice } = selectSource(pillars);

  const fallbackReason =
    revealedChoice.revealedAt.length > 0
      ? null
      : candidates.some((candidate) => candidate.revealedAt.length > 0)
        ? ('revealed-unusable' as const)
        : ('none-revealed' as const);
  const selfSeat = selfSeatOf(pillars);
  const kind = selfSeat ?? regularKindOf(revealedChoice.tenGod);

  // 건록·양인·월겁은 격이 월령 그 자체다. 투출한 글자는 격이 아니라 쓸 것이라
  // `candidates` 에 남고, `source` 는 월령의 정기를 가리킨다.
  const chosen = selfSeat
    ? candidates.find((candidate) => candidate.role === '正氣')!
    : revealedChoice;
  const revealed = revealedRoles(pillars);
  const roles = elementRolesOf(STEM_INFO[pillars.dayMaster].element);
  const ratio = (role: ElementRole) => elements.ratios[roles[role]];

  const monthBranch = pillars.month.branch;
  const monthClashed = PILLAR_POSITIONS.some((position) => {
    const pillar = pillars[position];
    return (
      pillar !== null &&
      position !== 'month' &&
      findBranchClash(pillar.branch, monthBranch) !== null
    );
  });

  const forming: StructureFactor[] = [];
  const breaking: StructureFactor[] = [];

  const names = (role: ElementRole) =>
    revealed[role]
      .map((slot) => `${PILLAR_POSITION_KO[slot.position]} ${slot.stem}(${TEN_GOD_KO[slot.tenGod]})`)
      .join(' · ');
  const has = (role: ElementRole) => revealed[role].length > 0;
  const hasTenGod = (tenGod: TenGod) =>
    revealed[GROUP_OF_ROLE[TEN_GOD_GROUP[tenGod]]].some((slot) => slot.tenGod === tenGod);

  // 어느 격이든 월령이 충을 맞으면 깨진 쪽으로 본다 — 「月令冲破」.
  if (monthClashed) {
    breaking.push({
      name: '월령충파',
      detail: `격을 잡은 월지 ${monthBranch}(${BRANCH_INFO[monthBranch].ko})가 충을 맞고 있습니다.`,
    });
  }

  switch (kind) {
    case '正官格':
      if (has('財星') || has('印星')) {
        forming.push({
          name: '관봉재인',
          detail: `정관을 ${has('財星') ? '재성' : '인성'}이 받칩니다 — ${names(has('財星') ? '財星' : '印星')}.`,
        });
      }
      if (hasTenGod('傷官')) {
        breaking.push({ name: '상관견관', detail: `상관이 정관을 극합니다 — ${names('食傷')}.` });
      }
      if (hasTenGod('偏官')) {
        breaking.push({ name: '관살혼잡', detail: `편관이 함께 투출해 섞였습니다 — ${names('官星')}.` });
      }
      break;

    case '偏官格':
      if (hasTenGod('食神')) {
        forming.push({ name: '식신제살', detail: `식신이 칠살을 제복합니다 — ${names('食傷')}.` });
      }
      if (has('印星')) {
        forming.push({ name: '살인상생', detail: `인성이 살의 기운을 돌립니다 — ${names('印星')}.` });
      }
      if (has('財星') && !hasTenGod('食神') && !has('印星')) {
        breaking.push({
          name: '재생살무제',
          detail: `재성이 칠살을 키우는데 제복할 식신도 인성도 없습니다 — ${names('財星')}.`,
        });
      }
      break;

    case '正財格':
    case '偏財格':
      if (has('食傷')) {
        forming.push({ name: '식상생재', detail: `식상이 재성을 낳습니다 — ${names('食傷')}.` });
      }
      if (hasTenGod('正官')) {
        forming.push({ name: '재생관', detail: `재성이 정관을 낳습니다 — ${names('官星')}.` });
      }
      if (has('比劫') && ratio('比劫') > ratio('財星')) {
        breaking.push({
          name: '비겁탈재',
          detail: `비겁이 투출한 데다 재성보다 무거워 재를 나눕니다 — ${names('比劫')}.`,
        });
      }
      break;

    case '食神格':
      if (has('財星')) {
        forming.push({ name: '식신생재', detail: `식신이 재성을 낳습니다 — ${names('財星')}.` });
      }
      if (hasTenGod('偏官')) {
        forming.push({ name: '식신제살', detail: `식신이 칠살을 제복합니다 — ${names('官星')}.` });
      }
      if (hasTenGod('偏印')) {
        breaking.push({ name: '효신탈식', detail: `편인이 식신을 빼앗습니다 — ${names('印星')}.` });
      }
      break;

    case '傷官格':
      if (has('財星')) {
        forming.push({ name: '상관생재', detail: `상관이 재성을 낳습니다 — ${names('財星')}.` });
      }
      if (has('印星')) {
        forming.push({ name: '상관패인', detail: `인성이 상관을 다스립니다 — ${names('印星')}.` });
      }
      if (hasTenGod('正官')) {
        breaking.push({ name: '상관견관', detail: `상관격에 정관이 드러났습니다 — ${names('官星')}.` });
      }
      break;

    case '正印格':
    case '偏印格':
      if (has('官星')) {
        forming.push({ name: '관인상생', detail: `관성이 인성을 낳습니다 — ${names('官星')}.` });
      }
      if (has('財星') && ratio('財星') > ratio('印星')) {
        breaking.push({
          name: '탐재괴인',
          detail: `재성이 인성보다 무거워 인성을 깹니다 — ${names('財星')}.`,
        });
      }
      break;

    case '建祿格':
    case '月劫格':
      // 월령이 일간 편이라 격으로 쓸 것이 없다. 천간에서 쓸 것을 찾는다.
      if (has('財星') || has('官星')) {
        forming.push({
          name: '녹겁용재관',
          detail: `월령을 쓸 수 없으므로 천간의 ${has('財星') ? '재성' : '관성'}을 씁니다 — ${names(has('財星') ? '財星' : '官星')}.`,
        });
      } else {
        breaking.push({
          name: '녹겁무용',
          detail: '월령이 일간 편인데 천간에 재성도 관성도 드러나지 않아 쓸 것이 없습니다.',
        });
      }
      break;

    case '陽刃格':
      if (has('官星')) {
        forming.push({ name: '양인가살', detail: `관살이 양인을 제복합니다 — ${names('官星')}.` });
      } else {
        breaking.push({ name: '양인무제', detail: '양인을 제복할 관살이 천간에 드러나지 않았습니다.' });
      }
      break;
  }

  const outcome: StructureOutcome =
    forming.length > 0 && breaking.length === 0
      ? 'formed'
      : breaking.length > 0 && forming.length === 0
        ? 'broken'
        : 'unresolved';

  return {
    status: 'experimental',
    kind,
    ko: STRUCTURE_KIND_KO[kind],
    source: {
      stem: chosen.stem,
      role: chosen.role,
      days: chosen.days,
      tenGod: chosen.tenGod,
      revealedAt: chosen.revealedAt,
    },
    candidates: candidates.map((candidate) => ({
      stem: candidate.stem,
      role: candidate.role,
      days: candidate.days,
      tenGod: candidate.tenGod,
      revealed: candidate.revealedAt.length > 0,
    })),
    revealed: chosen.revealedAt.length > 0,
    principalFallback: fallbackReason,
    monthClashed,
    formingFactors: forming,
    breakingFactors: breaking,
    outcome,
  };
}
