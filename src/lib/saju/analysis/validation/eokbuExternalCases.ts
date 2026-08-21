import type { Element } from '../../constants';
import type { ElementRole } from '../yongsin';

export type ExternalStrengthClaim =
  | 'strong'
  | 'weak'
  | 'borderline'
  /** 출처가 강약을 말하지 않은 경우 — 용신만 대조한다 */
  | 'unstated';

/**
 * 자료의 계통. **호스트 이름으로는 계통을 셀 수 없다** — 서로 다른 시대의 책이
 * 같은 사이트에 올라 있기도 하다(《적천수천미》와 《천리명고》가 그렇다). 계통이
 * 갈리는 자리에서 성적이 갈리는 것이 이 데이터셋의 요점이므로 손으로 적어 둔다.
 */
export type EokbuLineage =
  /** 현대 한국 상담·강의 글 */
  | 'korean-modern'
  /** 청대 고전 주석 (《적천수천미》 임철초) */
  | 'classical-chinese'
  /** 민국 시대 실전 명리 (《천리명고》 위천리) */
  | 'republican-chinese';

export type ExternalEokbuCase = {
  id: string;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  lineage: EokbuLineage;
  source: {
    title: string;
    url: string;
    locator: string;
    retrievedAt: '2026-08-16' | '2026-08-21';
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
  /**
   * 출처가 용신을 고른 **논리**.
   *
   * 이 필드가 없던 동안 데이터셋은 한 가지를 전제하고 있었다 — 실려 있는 용신은
   * 다 억부로 고른 것이라고. 《적천수천미》 衰旺편을 열넷 실으면서 그 전제가
   * 깨졌다. 그 장은 「旺之極者不可損，衰之極者不可益」이라는 **다른 규칙**으로
   * 용신을 고르고, 실제로 극왕·극쇠 자리에서 억부와 정반대 답을 낸다.
   *
   * 다른 논리로 고른 답을 억부의 정답으로 쓰면 규칙이 아니라 **계통을 채점하게**
   * 된다. 그래서 오행 일치는 이 값으로 나눠 세고, 강약은 나누지 않는다 — 「신강인가
   * 신약인가」는 어느 논리로 보든 같은 물음이기 때문이다.
   *
   * 적지 않으면 억부다. 앞서 실은 스물은 대부분 억부 절차를 따르고, 그렇지 않은
   * 자리는 `caveats` 가 적어 왔다.
   */
  yongsinDoctrine?: 'eokbu' | 'strength-extremity';
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
 * 실재 가능한 사례는 서른넷이고 계통은 셋이다 — **계통이 다른 자료를 섞어야**
 * 한쪽 계통에만 맞는 규칙을 만들지 않는다.
 * - `8ja-*` 여섯: 현대 한국 상담 사례(`korean-modern`)
 * - `dtsm-8gyeok-*` 셋: 《적천수천미》 八格편(`classical-chinese`)
 * - `dtsm-shuaiwang-*` 열넷: 《적천수천미》 衰旺편(`classical-chinese`)
 * - `qlmg-*` 열하나: 《천리명고》 위천리(`republican-chinese`)
 *
 * **衰旺편 열넷은 강약을 대조하려고 실었다.** 그 장은 열다섯 명조를 오행 다섯 ×
 * 旺·旺極·衰·衰極 으로 짜 놓고 각각에 旺/衰를 못박는다 — 강약 판정을 정면으로
 * 겨눈 자료가 이 데이터셋에 처음 들어온 것이다. 앞서 강약을 비교할 수 있는
 * 사례는 열둘뿐이었다.
 *
 * 대신 그 장의 **용신은 억부가 아니다.** 「旺之極者不可損，衰之極者不可益」이라
 * 극왕에는 印을, 극쇠에는 食傷을 쓴다 — 억부와 정반대다. 그래서
 * `yongsinDoctrine: 'strength-extremity'` 로 표시하고 오행 일치를 셀 때 나눈다.
 *
 * 열다섯 중 하나(木衰 자리)는 옮긴 간지가 서로 어긋나 뺐다. 같은 장을 두 번
 * 읽었는데 시주가 丙寅과 丁亥로 갈렸고, 丁亥는 甲 일간에서 나올 수 없는 시주다.
 * 어느 쪽이 원문인지 가릴 수 없으면 싣지 않는다 — 지어내는 것보다 비는 편이 낫다.
 *
 * 계통을 셀 때 호스트 이름을 쓰면 안 된다 — 《적천수천미》와 《천리명고》가 같은
 * 사이트에 올라 있어 셋이 둘로 줄어든다. `lineage` 를 직접 적고 그것으로 센다.
 */
export const EOKBU_EXTERNAL_CASES: readonly ExternalEokbuCase[] = [
  {
    id: 'tasko-strong-gapja',
    pillars: { year: '甲寅', month: '甲寅', day: '甲子', hour: '丙寅' },
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
    lineage: 'korean-modern',
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
  {
    id: 'dtsm-8gyeok-inbu-1',
    pillars: { year: '辛卯', month: '丙申', day: '癸卯', hour: '壬戌' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 八格 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/12',
      locator: '八格 — 此印綬格，以申金為用，以丙火為病，以壬水為藥',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '金',
      role: '印星',
      summary: '인수격으로 보아 申金을 용신, 丙火를 병, 壬水를 약이라 한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: ['원문이 신강·신약을 따로 말하지 않아 강약은 대조하지 않는다.'],
  },
  {
    id: 'dtsm-8gyeok-inbu-2',
    pillars: { year: '辛卯', month: '丙申', day: '癸卯', hour: '甲寅' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 八格 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/12',
      locator: '八格 — 此亦以申金為用，以丙火為病 (앞 명조와 시주 한 글자만 다르다)',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '金',
      role: '印星',
      summary: '앞 명조와 시주만 다른데 병은 있고 약이 없어 결과가 갈린다며 같은 申金을 용신으로 든다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [
      '원문이 신강·신약을 따로 말하지 않아 강약은 대조하지 않는다.',
      '앞 명조와 한 글자만 다른 짝이라 같은 용신이 나오는지 보는 데 쓴다.',
    ],
  },
  {
    id: 'dtsm-8gyeok-sanggwan',
    pillars: { year: '己巳', month: '庚午', day: '丙午', hour: '甲午' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 八格 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/12',
      locator: '八格 — 真火土傷官生財格, 土金喜用皆傷',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '土',
      role: '食傷',
      summary: '화토상관생재격으로 보고 土金을 희용으로 든다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '원문이 희용을 土金 두 오행으로 말한다 — 앞의 土 만 대조 대상으로 둔다.',
      '원문이 신강·신약을 따로 말하지 않아 강약은 대조하지 않는다.',
    ],
  },
  // ── 《千里命稿》 위천리 (민국) — 세 번째 계통 ──────────────────────────────
  // 이 책의 「評斷篇」은 명조마다 强弱·格局·用神·喜忌를 항목으로 나눠 적는다.
  // 강약을 먼저 정하고 그 반대편을 용신으로 고르는 절차가 이 엔진과 같은 순서라
  // 대조에 가장 적합한 자료다. 뒤쪽 인물 명조는 항목이 아니라 산문이라 주장을
  // 읽어 옮겼고 그만큼 caveats 가 길다.
  {
    id: 'qlmg-lu-weak-byeonghwa',
    pillars: { year: '癸未', month: '甲子', day: '丙戌', hour: '己亥' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷之舉例 (一) 陸姓乾命 — 抑者太多，扶者太少，故丙干以弱論',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '印星',
      summary: '겨울 丙火가 亥子癸 水에 눌린 신약이라 월간 甲木 인성을 용신으로 삼는다(官格用印).',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
  {
    id: 'qlmg-pan-weak-geumgeum',
    pillars: { year: '壬子', month: '癸丑', day: '庚子', hour: '丁亥' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷之舉例 (二) 潘姓坤命 — 是誠弱不堪言矣 … 不如亥中甲木以為用',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '財星',
      summary: '한겨울 庚金이 水에 설기되어 극도로 약한데, 己土로 막으면 물을 성나게 하므로 亥 중 甲木으로 설기를 돌린다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [
      '신약에 재성을 쓰는 드문 처방이다 — 억부의 정석이 아니라 "財能救官" 이라는 흐름 논리로 고른 자리다.',
      '출처 스스로 "身弱無助之弊在所不免" 이라며 이 선택의 약점을 적는다.',
    ],
  },
  {
    id: 'qlmg-wang-borderline-gapmok',
    pillars: { year: '己亥', month: '癸酉', day: '甲辰', hour: '丙寅' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷之舉例 (三) 王姓坤命 — 本當以弱論 … 尚非至弱者也',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'borderline',
      suggestedElement: '金',
      role: '官星',
      summary: '甲木이 酉월에 실령했으나 亥에 장생·寅에 득록해 지지에 기가 있다며, 酉 중 辛金 정관을 용신으로 삼는다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 "약하다고 봐야 하나 지극히 약하지는 않다"로 적어 강약을 이분으로 못박지 않았다.',
    ],
  },
  {
    id: 'qlmg-zhan-borderline-gapmok',
    pillars: { year: '庚子', month: '庚辰', day: '甲子', hour: '戊辰' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷之舉例 (四) 詹姓乾命 — 子辰成水局 … 故轉弱為強矣',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'borderline',
      suggestedElement: '水',
      role: '印星',
      summary: '재살이 태왕하나 子辰 수국이 살을 인성으로 돌려 일간을 살리므로 약함이 강함으로 바뀌었다며, 년지 子 인성을 용신으로 삼는다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 "轉弱為強"이라 적어 경계에 놓인 명식이므로 강약은 대조하지 않는다 — 강해졌다면서 처방은 생부(印)라 출처 안에서도 방향이 갈린다.',
    ],
  },
  {
    id: 'qlmg-chen-weak-gyesu',
    pillars: { year: '壬子', month: '丙午', day: '癸亥', hour: '戊午' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷之舉例 (五) 陳姓乾命 — 日元稍弱，宜取壬水，劫財幫身為用',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '水',
      role: '比劫',
      summary: '한여름 癸水가 三火一土에 눌렸으나 亥 제왕지와 년간 壬水가 도와 조금 약한 정도라며, 壬水 겁재로 방신한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: ['출처가 "弱而有助，得中和之妙" 라고도 적어 신약의 정도를 약하게 말한다.'],
  },
  {
    id: 'qlmg-yu-weak-geumgeum',
    pillars: { year: '丁卯', month: '丙午', day: '庚午', hour: '己卯' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (虞洽卿 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 弱中有氣，全得力於時上正印',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '土',
      role: '印星',
      summary: '木火가 성한 가운데 己土가 화를 설하고 일간을 생해 약한 중에 기가 있다며, 시상 정인을 힘의 근거로 든다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [],
  },
  {
    id: 'qlmg-xian-weak-geumgeum',
    pillars: { year: '戊子', month: '癸亥', day: '庚寅', hour: '戊寅' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (冼冠生 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 財重身輕，得力於時上戊土之偏印，制水幫身',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '土',
      role: '印星',
      summary: '초겨울 庚金이 지지의 水木에 눌린 재중신경이라 시상 戊土 편인으로 물을 막고 몸을 돕는다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: ['출처가 "四十九歲交進戊運。幫助用神" 이라 적어 戊土가 용신임을 다시 확인한다.'],
  },
  {
    id: 'qlmg-yan-weak-eulmok',
    pillars: { year: '癸未', month: '辛酉', day: '乙酉', hour: '丁亥' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (閻錫山 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 殺重身輕 … 幸有癸印生身，並化殺，又有丁火食神以制殺',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '水',
      role: '印星',
      summary: '가을 乙木이 득시·득록한 金 칠살에 눌린 살중신경이라 癸水 인성으로 살을 돌리고 丁火 식신으로 제한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 화살(癸水)과 제살(丁火)을 함께 들어 용신이 하나로 못박히지 않는다 — 앞의 水만 대조한다.',
    ],
  },
  {
    id: 'qlmg-song-weak-geumgeum',
    pillars: { year: '甲午', month: '乙亥', day: '庚申', hour: '己卯' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (宋子文 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 財旺身弱，幸日主坐祿 … 戊寅己三運。偏重於幫身之故',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '土',
      role: '印星',
      summary: '재왕신약이나 일지 록에 앉아 버틴다며, 방신하는 戊己 土 운에서 발복했다고 설명한다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 용신을 항목으로 못박지 않고 "幫身" 하는 운으로만 말한다 — 庚金에게 戊己는 인성이라 그 오행만 대조한다.',
    ],
  },
  {
    id: 'qlmg-jiang-unstated-gito',
    pillars: { year: '丁亥', month: '庚戌', day: '己巳', hour: '庚午' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (蔣介石 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 妙有火印制傷 … 夫以傷官佩印為用。運喜逢印',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '火',
      role: '印星',
      summary: '두 庚金 상관이 투간했으나 火 인성이 그것을 제어한다며 상관패인을 용신으로 든다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    caveats: [
      '출처가 "天生康壯之體" 라고만 적고 신강·신약을 못박지 않아 강약은 대조하지 않는다.',
      '상관패인은 강약이 아니라 상관을 다스리는 구조를 보고 고르는 격국 논리다.',
    ],
  },
  {
    id: 'qlmg-ma-unstated-gito',
    pillars: { year: '乙酉', month: '丁亥', day: '己丑', hour: '甲子' },
    lineage: 'republican-chinese',
    source: {
      title: '《千里命稿》 評斷篇 — 韋千里 (馬占山 명조)',
      url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
      locator: '評斷篇 — 己見亥子丑。病於水盛，助成寒濕。妙有丁火煦融',
      retrievedAt: '2026-08-16',
    },
    claim: {
      strength: 'unstated',
      suggestedElement: '火',
      role: '印星',
      summary: '己土가 亥子丑 水에 둘러싸여 한습한 것이 병이라며 丁火로 데우는 것을 용신으로 든다.',
    },
    comparisonLevel: 'element-only',
    chartConstruction: 'consistent',
    caveats: [
      '한습을 병으로 보는 조후 논리다 — 억부와 답이 같아도 근거가 다르다.',
      '출처가 신강·신약을 못박지 않아 강약은 대조하지 않는다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-mok-wang',
    pillars: { year: '甲辰', month: '丁卯', day: '甲子', hour: '戊辰' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 木太旺者似金也，以丁火為用',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '火',
      role: '食傷',
      summary: '甲子 일간이 卯월에 나고 지지의 두 辰이 木의 여기라 木이 태왕하니 丁火로 단련한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-mok-wang-geuk',
    pillars: { year: '癸卯', month: '乙卯', day: '甲寅', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 木旺極者，似火也',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '水',
      role: '印星',
      summary: '여섯 木에 두 水뿐이라 木이 극왕하니 덜지 않고 印인 水의 기세를 따른다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-mok-soe-geuk',
    pillars: { year: '己巳', month: '己巳', day: '乙酉', hour: '丙戌' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 木衰極者，似土也，宜火生',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '火',
      role: '食傷',
      summary: '木이 극쇠해 土에 가까우니 보태지 않고 火로 그 土를 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-hwa-wang',
    pillars: { year: '乙丑', month: '壬午', day: '丙戌', hour: '甲午' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 火旺者似水也，喜土止之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '土',
      role: '食傷',
      summary: '火가 왕해 水에 가까우니 土로 멈춘다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-hwa-wang-geuk',
    pillars: { year: '戊寅', month: '丁巳', day: '丙寅', hour: '甲午' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 火旺極者，似土也，喜木克之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '木',
      role: '印星',
      summary: '火가 극왕해 土에 가까우니 印인 木으로 그 土를 극한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-hwa-soe',
    pillars: { year: '辛巳', month: '丁酉', day: '丁酉', hour: '辛丑' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 火衰者似木也，宜水生之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '水',
      role: '官星',
      summary: '火가 쇠해 木에 가까우니 水로 그 木을 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-hwa-soe-geuk',
    pillars: { year: '辛亥', month: '壬辰', day: '丙申', hour: '己亥' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 火衰極者，似金也，宜土生之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '土',
      role: '食傷',
      summary: '火가 극쇠해 金에 가까우니 보태지 않고 土로 그 金을 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-to-wang',
    pillars: { year: '戊辰', month: '戊午', day: '戊申', hour: '己未' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 土旺者似木也，喜金克之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '金',
      role: '食傷',
      summary: '土가 왕해 木에 가까우니 金으로 극한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-to-wang-geuk',
    pillars: { year: '戊戌', month: '丙辰', day: '己巳', hour: '己巳' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 土旺極者，似金也，宜火煉之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '火',
      role: '印星',
      summary: '土가 극왕해 金에 가까우니 印인 火로 단련한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-to-soe',
    pillars: { year: '壬辰', month: '辛亥', day: '戊子', hour: '癸丑' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 土衰者似火也，宜木生之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '木',
      role: '官星',
      summary: '土가 쇠해 火에 가까우니 木으로 그 火를 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-geum-wang',
    pillars: { year: '壬申', month: '己酉', day: '庚子', hour: '庚辰' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 金旺者似火也，喜水濟之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '水',
      role: '食傷',
      summary: '金이 왕해 火에 가까우니 水로 건넨다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-geum-wang-geuk',
    pillars: { year: '庚申', month: '乙酉', day: '庚戌', hour: '庚辰' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 金旺極者，似水也，宜土止之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'strong',
      suggestedElement: '土',
      role: '印星',
      summary: '金이 극왕해 水에 가까우니 印인 土로 멈춘다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-geum-soe',
    pillars: { year: '己卯', month: '庚午', day: '辛卯', hour: '甲午' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 金衰者似土也，宜火生之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '火',
      role: '官星',
      summary: '金이 쇠해 土에 가까우니 火로 그 土를 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
    ],
  },
  {
    id: 'dtsm-shuaiwang-geum-soe-geuk',
    pillars: { year: '己亥', month: '丁卯', day: '庚寅', hour: '丙子' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 衰旺 — 任鐵樵 주석',
      url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
      locator: '十七、衰旺 — 金衰極者，似木也，宜水生之',
      retrievedAt: '2026-08-21',
    },
    claim: {
      strength: 'weak',
      suggestedElement: '水',
      role: '食傷',
      summary: '金이 극쇠해 木에 가까우니 보태지 않고 水로 그 木을 생한다.',
    },
    comparisonLevel: 'exact',
    chartConstruction: 'consistent',
    yongsinDoctrine: 'strength-extremity',
    caveats: [
      '衰旺편은 억부가 아니라 「旺之極者不可損，衰之極者不可益」으로 용신을 고른다.',
      '극단 자리라 억부와 정반대로 간다 — 극왕에 印, 극쇠에 食傷을 쓴다.',
    ],
  },
] as const;
