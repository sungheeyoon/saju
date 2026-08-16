import type { Element } from '../../constants';
import type { ElementRole } from '../yongsin';

export type ExternalStrengthClaim =
  | 'strong'
  | 'weak'
  | 'borderline'
  /** 출처가 강약을 말하지 않은 경우 — 용신만 대조한다 */
  | 'unstated';

export type ExternalEokbuCase = {
  id: string;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  source: {
    title: string;
    url: string;
    locator: string;
    retrievedAt: '2026-08-16';
  };
  claim: {
    strength: ExternalStrengthClaim;
    suggestedElement: Element;
    role?: ElementRole;
    summary: string;
  };
  /**
   * `element-only`: 출처의 오행 주장은 비교하되, 잘못 적힌 십성명은 정답으로 쓰지 않는다.
   * `exact`: 출처가 강약·오행·십성의 관계를 일관되게 설명한다.
   */
  comparisonLevel: 'exact' | 'element-only';
  /**
   * 네 기둥이 오호둔·오자둔과 맞는지.
   *
   * `unrealizable` 은 출처가 적은 간지 조합 자체가 어떤 생년월일시로도 나올 수
   * 없다는 뜻이다 — 월간은 연간에서, 시간은 일간에서 정해지므로 아무 여덟 글자나
   * 명조가 되지는 않는다. 그런 칸은 설명용으로 지어낸 조합이라 실제 명주가 없고,
   * 엔진과 어긋나도 엔진이 틀렸다는 근거가 되지 못한다. 지우지 않고 남기되
   * 일치율을 셀 때는 빼야 한다. 판정은 `eokbu.external.test.ts` 가 이 저장소의
   * `monthPillarOf`·`hourPillarOf` 로 직접 다시 센다.
   */
  chartConstruction: 'consistent' | 'unrealizable';
  caveats: readonly string[];
};

/**
 * 공개된 완전한 사주 네 기둥과 억부 주장을 옮긴 외부 대조 사례.
 *
 * 외부 글도 서로 다른 계통과 오기가 있으므로 이 배열은 정답표가 아니다. 테스트는
 * 현재 엔진과의 일치/불일치를 함께 고정해, 규칙 변경이 어떤 사례를 움직였는지
 * 드러내는 용도로 쓴다.
 *
 * **`tasko-*` 셋은 실재할 수 없는 명조다**(`chartConstruction: 'unrealizable'`).
 * 글에 적힌 간지를 그대로 옮겼지만 월간이 연간과, 시간이 일간과 어긋나 어떤
 * 생년월일시로도 나오지 않는다. 설명하려고 지은 조합이므로 남겨는 두되 엔진의
 * 일치율을 셀 때는 빼야 한다 — 그러지 않으면 있지도 않은 사주로 엔진을 채점하게
 * 된다.
 *
 * 실재 가능한 사례는 `8ja-*` 여섯이다(2026-08-16 에 넷을 더했다). 같은 출처의 같은
 * 상담 목록이라 **출처가 하나뿐이라는 사실은 그대로다** — 여섯 건으로도 억부를
 * `experimental` 에서 올릴 수는 없고, 서로 다른 계통의 자료가 더 필요하다.
 */
export const EOKBU_EXTERNAL_CASES: readonly ExternalEokbuCase[] = [
  {
    id: 'tasko-strong-gapja',
    pillars: { year: '甲寅', month: '甲寅', day: '甲子', hour: '丙寅' },
    source: {
      title: '억부용신 찾는 법 — 실전 3케이스',
      url: 'https://saju.tasko.kr/saju-eokbu-yongsin/',
      locator: '케이스 1: 신강 사주',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '金',
      role: '官星',
      summary: '목 기운이 과다한 신강 甲木을 金 관성으로 제어한다고 설명한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'unrealizable',
    caveats: [
      '본문이 土를 식상이라고 적지만 甲木의 식상은 火이므로 그 명칭은 비교에서 제외한다.',
      '甲년의 寅월은 오호둔으로 丙寅이라 甲寅월이 될 수 없다 — 설명용으로 지은 조합이다.',
    ],
  },
  {
    id: 'tasko-weak-byeonghwa',
    pillars: { year: '庚辰', month: '辛酉', day: '丙申', hour: '壬子' },
    source: {
      title: '억부용신 찾는 법 — 실전 3케이스',
      url: 'https://saju.tasko.kr/saju-eokbu-yongsin/',
      locator: '케이스 2: 신약 사주',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '印星',
      summary: '금·수 기운에 눌린 신약 丙火를 木 인성으로 생조한다고 설명한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'unrealizable',
    caveats: [
      '본문 후반의 金·水 십성 설명이 뒤바뀌어 있어 주장한 木 오행만 대조한다.',
      '庚년의 酉월은 乙酉, 丙일의 子시는 戊子다 — 월주·시주 둘 다 성립하지 않는다.',
    ],
  },
  {
    id: 'tasko-borderline-muto',
    pillars: { year: '甲子', month: '丙午', day: '戊午', hour: '己丑' },
    source: {
      title: '억부용신 찾는 법 — 실전 3케이스',
      url: 'https://saju.tasko.kr/saju-eokbu-yongsin/',
      locator: '케이스 3: 중강 사주',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'borderline',
      suggestedElement: '金',
      role: '食傷',
      summary: '중강한 戊土의 기운을 金 식상으로 설기한다고 설명한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'unrealizable',
    caveats: [
      '출처의 중강은 이 엔진의 strong/weak 이분 판정과 직접 같은 등급이 아니다.',
      '甲년의 午월은 庚午, 戊일의 丑시는 癸丑이다 — 월주·시주 둘 다 성립하지 않는다.',
    ],
  },
  {
    id: '8ja-145-weak-muto',
    pillars: { year: '癸卯', month: '丙辰', day: '戊申', hour: '甲寅' },
    source: {
      title: '팔자연구소 용신분석상담 사례 145',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '145번 명조',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '火',
      role: '印星',
      summary: '약한 戊土를 火 인성으로 돕는 억부용신으로 설명한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
  {
    id: '8ja-146-wealth-heavy-byeonghwa',
    pillars: { year: '庚申', month: '乙酉', day: '丙申', hour: '丁酉' },
    source: {
      title: '팔자연구소 용신분석상담 사례 146',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '146번 명조',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '印星',
      summary: '재다신약한 丙火를 木 인성으로 생조한다고 설명한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
  {
    id: '8ja-136-wealth-heavy-gapmok',
    pillars: { year: '戊辰', month: '壬戌', day: '甲辰', hour: '庚午' },
    source: {
      title: '팔자연구소 용신분석상담 사례 136',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '136번 명조 (1988-10-16 午시 여명)',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '水',
      role: '印星',
      summary: '늦가을 甲木이 4土에 둘러싸인 재다신약이라 월간 壬水를 용신으로 삼는다고 설명한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
  {
    id: '8ja-149-stagnant-muto',
    pillars: { year: '己未', month: '丙子', day: '戊辰', hour: '丙辰' },
    source: {
      title: '팔자연구소 용신분석상담 사례 149',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '149번 명조',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '水',
      role: '財星',
      summary: '5土로 울체되어 발산이 필요한데 金이 없으므로 월지 子水를 차선으로 용신 삼는다고 설명한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 신강·신약을 밝히지 않아 강약은 대조하지 않는다.',
      '金이 사실상의 용신이나 원국에 없어 水를 차선으로 골랐다고 밝힌 자리다.',
    ],
  },
  {
    id: '8ja-157-drain-muto',
    pillars: { year: '壬子', month: '庚戌', day: '戊寅', hour: '丙辰' },
    source: {
      title: '팔자연구소 용신분석상담 사례 157',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '157번 명조 (남)',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '金',
      role: '食傷',
      summary: '적어도 약하지는 않으므로 극보다 설이 순리라며 식신생재의 흐름을 택한다고 설명한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 "신약일 가능성은 희박하다"로 에둘러 말해 강약 주장이 단정적이지 않다.',
      '용신을 한 오행으로 못박지 않고 火土金水의 흐름으로 설명해 방향만 대조한다.',
    ],
  },
  {
    id: '8ja-160-weak-jeonghwa',
    pillars: { year: '己未', month: '乙亥', day: '丁酉', hour: '甲辰' },
    source: {
      title: '팔자연구소 용신분석상담 사례 160',
      url: 'https://8ja.co.kr/sub1_08_6.html',
      locator: '160번 명조',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '印星',
      summary: '실령·실지·실세로 신약이라 일간 좌우의 2木을 용신으로 삼는다고 설명한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
] as const;
