import type { Element } from '../../constants';

/**
 * 궁합 외부 사례 — 전문가가 **「이 사람이 저 사람의 용신 · 희신을 채워 준다」**고 판정한 공개 풀이를 옮긴다.
 *
 * 방향별 필요 보완(ADR 0112)은 주는 쪽 원국의 **자리**만 날것으로 내고, 어느 자리가 「센가」 · 몇 개가
 * 있어야 하나 · 계절과 맞아야 하나를 고르지 않았다. 그 판단은 우리가 짓지 않고 외부 자료에서 읽는다 —
 * 이 배열이 그 자료다. 2026-09-25 에 모았다(`docs/notes/2026-09-25-research-yongsin-complement.md`).
 *
 * **정답표가 아니다.** 한 쌍의 풀이는 한 사람의 관법이고, 같은 사람이 같은 글 안에서 용신을 두 번 다르게
 * 적기도 한다(`caveats` 에 적었다). 시험은 엔진과 맞추는 채점이 아니라 **관찰**을 잠근다 — 전문가의 판정과
 * 주는 쪽 자리(`ProviderPresence`)가 어떻게 겹치는가.
 *
 * 모은 것은 34 쌍이고 계통은 둘이다(31 쌍은 첫 조사, 3 쌍은 같은 날 CN-2 보충 —
 * `docs/notes/2026-09-25-research-cn-yongsin-supply.md`).
 * - 중국 현대 상담 글 31 쌍 — 剑桥易学文化 13 · 华人易 10 · 一德老师 2 · 刘老师 2 · 史老师 1 · 三生石 1 ·
 *   蒲云星命 1 · 吉言网 1.
 *   상담 의뢰에 답한 글이라 두 사람의 사주가 다 있고 방향마다 판정이 선다.
 * - 한국 현대 카페 글 3 쌍 — 조은(원리학당, 2003). 한국어 자료에서 두 명식과 방향별 판정이 함께 선 글은
 *   이것밖에 못 찾았다. 조은의 2017 년 글 하나는 남명의 연주가 한 글 안에서 甲寅 · 乙卯 로 갈리고, 그 판정이
 *   바로 연주(띠)를 가리켜 싣지 않았다.
 * - 고전(《적천수》 · 《자평진전》 · 《삼명통회》)과 민국 자료에는 두 명식을 나란히 놓고 용신 공급을 판정한
 *   예가 없었다. 억부 외부 사례(`eokbuExternalCases.ts`)와 달리 **고전 계통이 0** 이다.
 *
 * 개인정보: 출처가 공개한 간지만 옮긴다. 생년월일 · 이름 · 지역은 옮기지 않는다. 연예인 명식은 없다.
 */

/** 자료의 계통 — 호스트가 아니라 글쓴이의 관법으로 센다 */
export type CompatLineage =
  /** 중국 현대 상담 블로그 · 칼럼(2011~2026) */
  | 'chinese-modern-consult'
  /** 한국 현대 명리 카페 */
  | 'korean-modern-forum';

/**
 * 공신력 등급 — 자료가 **누구의 어떤 글인가**로 매긴다(판정이 맞는가가 아니다).
 *
 * - `S` — 고전 원문, 또는 이름난 대가의 출간 저서 · 주석(任鐵樵 · 徐樂吾 · 韋千里 · 梁湘润 같은)
 * - `A` — 저서 · 강의가 있는 식별 가능한 실무자, 학술 논문, 가중치를 읽을 수 있는 공개 코드
 * - `B` — 실무자의 블로그 · 포럼 글로 풀이 예가 있는 것, 앱 자신의 방법 페이지
 * - `C` — 익명 글 · 광고 문안 · 검색 요약으로만 본 것
 */
export type SourceCredibility = 'S' | 'A' | 'B' | 'C';

/** 한 방향의 판정 — 받는 쪽의 필요를 주는 쪽이 채우는가 */
export type CompatVerdict =
  /** 채운다(「能补」 · 「正是…需要的」 · 「득되는 글자」) */
  | 'supplies'
  /** 조금 채운다(「互补性一般」 · 「有一些助益，但不大」) */
  | 'partial'
  /** 채우지 못한다(「…比较弱，则没有互补性」) — 해치지는 않는다 */
  | 'does-not'
  /** 받는 쪽의 기신을 더하거나 용신을 친다(「加强…忌神」 · 「用神被冲」) */
  | 'harms'
  /** 채우면서 해친다 — 출처가 둘 다 말했다 */
  | 'mixed'
  /** 이 방향은 출처가 말하지 않았다 */
  | 'unstated';

/**
 * 출처가 판정의 근거로 **말로 든 것**. 옮긴이가 원국에서 찾아 덧붙이지 않는다.
 *
 * - `abundance` — 그 오행이 주는 쪽 원국 전체에서 많다 · 왕하다(「旺」 · 「很旺」 · 「林立」 · 「多余」 · 「重重」)
 * - `month-command` — 주는 쪽의 월령 · 태어난 계절(「当令」 · 「得令」 · 「生于春天」 · 「生于午月」)
 * - `day-master` — 주는 쪽의 일간 자체(「日主己土本身就是…」 · 「여명의 정화는」)
 * - `day-pillar` — 주는 쪽의 일주 두 글자(「임자 일주는 득되는 글자」)
 * - `stem` — 일간 밖의 이름 붙은 천간(「甲木伤官在月干」 · 「年上甲木」 · 「丁火」)
 * - `branch` — 이름 붙은 지지(「丑戌土旺极」 · 「卯木得令」)
 * - `hidden` — 지장간을 공급 근거로 들었다
 * - `not-revealed` — 「천간에 안 드러났다」를 **공급 부정**의 근거로 들었다(「木火星不现」)
 * - `combination` — 두 사람 사이 합화로 그 오행이 생긴다(「戊癸合化火」)
 * - `clash` — 주는 쪽 글자가 받는 쪽 용신 자리를 충한다(「亥冲巳」)
 */
export type CitedBasis =
  | 'abundance'
  | 'month-command'
  | 'day-master'
  | 'day-pillar'
  | 'stem'
  | 'branch'
  | 'hidden'
  | 'not-revealed'
  | 'combination'
  | 'clash';

export type CasePillars = {
  year: string;
  month: string;
  day: string;
  /** 출처가 시를 모른다고 적었으면 `null` */
  hour: string | null;
};

export type CasePerson = {
  /** 출처 안의 이름표 — `M` · `F` · `M2` 처럼. 실명이 아니다 */
  label: string;
  pillars: CasePillars;
  /**
   * 출처가 말한 이 사람의 용신 · 희신 오행. **말하지 않았으면 비운다**(`[]`). 출처가 순서를 두면 그 순서다.
   */
  needs: readonly Element[];
  /** 출처가 말한 기신 쪽 오행 — 말하지 않았으면 비운다 */
  avoids: readonly Element[];
  /** 출처가 필요를 말한 원문 한 토막 */
  needsAsStated: string;
};

export type CaseDirection = {
  /** 받는 쪽(필요를 가진 쪽)의 `label` */
  receiver: string;
  /** 주는 쪽의 `label` */
  provider: string;
  verdict: CompatVerdict;
  /**
   * `directional` — 출처가 이 방향을 따로 말했다. `pair` — 출처가 쌍 전체로 한 번 말했다(「男女二命互补性不错」)
   * 그 말을 두 방향에 같이 적었다.
   */
  scope: 'directional' | 'pair';
  cited: readonly CitedBasis[];
  /** 출처가 이름을 댄 주는 쪽 글자 — 없으면 비운다 */
  citedCharacters: readonly string[];
  /** 원문 그대로, 두 문장 이하 */
  quote: string;
};

export type ExternalCompatCase = {
  id: string;
  lineage: CompatLineage;
  /** 글쓴이 — 같은 사람의 글은 서로 독립이 아니므로 따로 센다 */
  practitioner: string;
  /** 공신력(`SourceCredibility`) — 2026-09-25 에 옮긴이가 매겼다 */
  credibility: SourceCredibility;
  source: {
    title: string;
    url: string;
    locator: string;
    published: string;
    retrievedAt: '2026-09-25';
  };
  people: readonly [CasePerson, CasePerson];
  directions: readonly CaseDirection[];
  /** 옮긴이가 원문에 없는 것을 추론해 적은 자리 — 없으면 비운다 */
  inferred: readonly string[];
  caveats: readonly string[];
};

const JIANQIAO = '剑桥易学文化';
const HUAREN = '华人易';

export const COMPAT_EXTERNAL_CASES: readonly ExternalCompatCase[] = [
  // ─── 剑桥易学文化 (新浪博客 1753226817) ───────────────────────────────────────
  {
    id: 'jq-vdnf',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '合婚实例分解',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100vdnf.html',
      locator: '一、双方八字五行互补性 · 二、十神配合方面',
      published: '2011-11-28',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '癸亥', month: '己未', day: '辛亥', hour: '己亥' },
        needs: ['水', '木'],
        avoids: [],
        needsAsStated: '喜食伤来生财制枭神，所以以水木为有神',
      },
      {
        label: 'F',
        pillars: { year: '甲子', month: '丁卯', day: '辛亥', hour: '辛卯' },
        needs: ['水', '木'],
        avoids: [],
        needsAsStated: '从财格日主不喜生扶、帮扶，所以以水木为用神',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance', 'month-command', 'stem'],
        citedCharacters: ['甲'],
        quote: '女命的旺木能补男命木的五行，能制偏印而护食神，有利于本人的运程。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '男命水旺，能生扶女命的财也能护财，财星有护卫财格成',
      },
    ],
    inferred: [],
    caveats: [
      '「有神」은 원문 그대로다 — 문맥상 「用神」의 오기다.',
      '같은 글이 「男命的土星能补女命的不足」라고도 쓰는데, 여명의 용신은 水木이라 土 공급은 용신 공급이 아니다 — 옮기지 않았다.',
      '「女命木星当令林立而旺」 · 「女命年上甲木旺」이 근거로 함께 선다.',
    ],
  },
  {
    id: 'jq-stju',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '命理分析与合婚',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100stju.html',
      locator: '3F 2、从五行配置看 · 3、从喜用的角度看',
      published: '2011-04-29',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '甲子', month: '丁卯', day: '戊辰', hour: '丙辰' },
        needs: ['火'],
        avoids: [],
        needsAsStated: '男命为七杀格，喜印配置，所以火的五行对男命好处比较大',
      },
      {
        label: 'F',
        pillars: { year: '丙寅', month: '庚子', day: '壬辰', hour: '丙午' },
        needs: ['木', '火'],
        avoids: [],
        needsAsStated: '女命为刃格喜食伤化泄生财……又生于冬月喜火调候',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['month-command', 'abundance'],
        citedCharacters: [],
        quote:
          '男命生于春天，木的五行比较旺，而女命生于冬月水旺，而喜木化泄来生财……因为男命的木能助女命',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'unstated',
        scope: 'directional',
        cited: [],
        citedCharacters: [],
        quote: '所以两人都喜火，这样你们有共同喜爱的东西，也是有缘分的象。',
      },
    ],
    inferred: [],
    caveats: [
      '여명→남명 방향은 「둘 다 火를 좋아한다」만 말하고 여명이 火를 주는지는 말하지 않았다.',
    ],
  },
  {
    id: 'jq-yn5g',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '合婚分析',
      url: 'https://blog.sina.com.cn/s/blog_68801e410102yn5g.html',
      locator: '三、合婚分析 — 二、从用神喜忌方面看',
      published: '2019-09-24',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '癸酉', month: '壬戌', day: '己丑', hour: '甲子' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '男命日主得令而旺，喜金水木，而忌火土',
      },
      {
        label: 'F',
        pillars: { year: '癸酉', month: '己未', day: '丙申', hour: '乙未' },
        needs: ['木'],
        avoids: ['土'],
        needsAsStated: '本命伤官旺，所以喜印星配置，也就是喜木，而忌火土',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从两人的命局看，男命土旺，加强女命的伤官星，不利婚姻，合婚不吉，姻缘难持久。',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '女命土的五行比较旺，加强男命比劫星，比劫是克父伤妻之神，所以不利婚，合婚不吉。',
      },
    ],
    inferred: [],
    caveats: [
      '여명의 필요를 같은 글이 두 번 다르게 적는다 — 「喜木，而忌火土」와 「喜木火，而忌土金」. 두 번 다 선 木만 적었다.',
    ],
  },
  {
    id: 'jq-gwav',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '合婚分析',
      url: 'https://blog.sina.com.cn/s/blog_68801e410101gwav.html',
      locator: '1F 合婚看 1 · 2',
      published: '2014-06-22',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '辛酉', month: '壬辰', day: '戊辰', hour: '戊午' },
        needs: ['金', '水'],
        avoids: [],
        needsAsStated: '本命财星比较旺，是喜金水的命局',
      },
      {
        label: 'F',
        pillars: { year: '庚申', month: '戊子', day: '癸酉', hour: '丙辰' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: '本命喜火土，说明婚配方面宜男命火土旺为佳',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '男命土星很旺，能补女命土的不足，增加女命夫缘，这是比较好的信息。',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '女命金水很旺，能补男命水的不足，增加男命妻缘，也是比较好的配置。',
      },
    ],
    inferred: [],
    caveats: [],
  },
  {
    id: 'jq-zld0',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '婚恋合婚：有姻缘吗？',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100zld0.html',
      locator: '1F 1 · 2 · 3',
      published: '2012-05-07',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '乙丑', month: '壬午', day: '癸巳', hour: '戊午' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: '本命从火土，那么就喜欢与男命火土旺的命局来婚配',
      },
      {
        label: 'M',
        pillars: { year: '己未', month: '壬申', day: '壬子', hour: '壬寅' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: '男命金水旺，缺火，土的五行相对弱，那么适合找女命火土旺的命局为佳',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '所以从命局五行配置看，女命的命局适合男命，对男命有互补的作用，有助于男命',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '而男命不适合于女命，因为男命水太旺，反而不利于女命，对女命的事业发展等方面不利。',
      },
    ],
    inferred: [],
    caveats: ['여명은 종재관격(从财官)으로 읽혔다 — 억부 계산과 다른 논리로 고른 필요다.'],
  },
  {
    id: 'jq-yfeh',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '与男朋友相处不和谐，我们会有姻缘吗',
      url: 'https://blog.sina.com.cn/s/blog_68801e410102yfeh.html',
      locator: '三、合婚分析 — 2）、日主旺衰喜忌方面看',
      published: '2017',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '甲戌', month: '辛未', day: '丁酉', hour: '癸卯' },
        needs: ['木', '火'],
        avoids: ['金', '水'],
        needsAsStated: '男命日主失令不旺，喜木火，而忌金水',
      },
      {
        label: 'F',
        pillars: { year: '癸酉', month: '己未', day: '庚戌', hour: '庚辰' },
        needs: ['金', '水'],
        avoids: ['火', '土'],
        needsAsStated: '女命日主得令而旺，喜金水，而忌火土',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance', 'not-revealed'],
        citedCharacters: [],
        quote:
          '男命忌金水，而女命金旺，则加强的男命的忌神，说明女命不能旺男命，而且男命喜木火，女命木火星不现比较弱，也与男命没有互补性',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['month-command', 'abundance'],
        citedCharacters: [],
        quote:
          '女命忌火土，而男命生于未月，火土旺之年，加强的女命的忌神……而且，女命喜金水，男命水的五行不旺，没有互补性',
      },
    ],
    inferred: [],
    caveats: [
      '여명 원국의 火는 未 · 戌 의 지장간(丁)에만, 木은 未 의 지장간(乙)에만 있다 — 출처는 이것을 「不现」이라 부르고 공급으로 치지 않았다.',
      '남명은 시간 癸水 하나가 드러나 있는데 출처는 「水的五行不旺」이라 공급으로 치지 않았다.',
    ],
  },
  {
    id: 'jq-v8i7',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '格局论命与合婚（印局与财局）',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100v8i7.html',
      locator: '2F 2， 从喜用方面来看',
      published: '2011-10-31',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '己未', month: '甲戌', day: '辛未', hour: '丙申' },
        needs: ['火', '木'],
        avoids: [],
        needsAsStated: '男命喜火，木的五行也不错',
      },
      {
        label: 'F',
        pillars: { year: '庚申', month: '己卯', day: '丁亥', hour: '庚戌' },
        needs: ['土'],
        avoids: [],
        needsAsStated: '女命格局食伤生财，是喜土来护财的',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从这点看，男命的旺土对女命的格局的稳定，有很好的作用，从这点看，合婚的话是吉利的。',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'unstated',
        scope: 'directional',
        cited: [],
        citedCharacters: [],
        quote:
          '女命各五行相对比较平衡，没有大的失衡，丁火日主相对弱点，那么从五行的互补性看，不是太强，合婚的话为一般。',
      },
    ],
    inferred: [],
    caveats: ['여명의 필요는 격국(食神生财)에서 고른 것이다.'],
  },
  {
    id: 'jq-v5zc-wife',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '婚姻感情如何选择',
      url: 'https://blog.sina.com.cn/s/blog_68801e410102v5zc.html',
      locator: '2F 再来分析妻子的命局 2',
      published: '2014-09-22',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '庚申', month: '戊子', day: '丙子', hour: '壬辰' },
        needs: ['土', '火'],
        avoids: ['金', '水', '木'],
        needsAsStated: '所以本命以土为用，以火为喜，而忌金水木',
      },
      {
        label: 'F',
        pillars: { year: '壬戌', month: '甲辰', day: '癸酉', hour: '壬子' },
        needs: [],
        avoids: [],
        needsAsStated: '（출처가 이 여명의 용신을 말하지 않았다）',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance', 'stem'],
        citedCharacters: ['甲'],
        quote:
          '你命局以戊土制水为护卫，最怕甲木克制，而妻子的命局正好甲木伤官在月干，两人的命局干支配置不好',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'unstated',
        scope: 'directional',
        cited: [],
        citedCharacters: [],
        quote: '（없음）',
      },
    ],
    inferred: [],
    caveats: ['「妻子的命局水很强旺」도 같은 자리의 근거다.'],
  },
  {
    id: 'jq-v5zc-f',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '婚姻感情如何选择',
      url: 'https://blog.sina.com.cn/s/blog_68801e410102v5zc.html',
      locator: '3F 再来分析你与这个女孩的命局情况 1 · 2 · 3',
      published: '2014-09-22',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '庚申', month: '戊子', day: '丙子', hour: '壬辰' },
        needs: ['火', '土'],
        avoids: ['金', '水', '木'],
        needsAsStated: '你命局是水旺为忌为病，以土克水为用为药，也就是喜火土的命局',
      },
      {
        label: 'F',
        pillars: { year: '庚午', month: '乙酉', day: '癸巳', hour: '庚申' },
        needs: ['木', '火'],
        avoids: ['土', '金'],
        needsAsStated: '金旺为病，火为用，是喜木火的命局，而忌土金',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['month-command'],
        citedCharacters: [],
        quote:
          '这样看来，你们命局互补性并不强，女命金当令而旺，而你的命局忌金的，依然不是完美的配合。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'does-not',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '女命喜木火，而你的命局木火比较弱，则没有互补性。',
      },
    ],
    inferred: [],
    caveats: [
      '남명의 일간이 丙火인데도 출처는 「木火比较弱」라 공급으로 치지 않았다 — 일간 하나는 공급이 아니었다.',
    ],
  },
  {
    id: 'jq-zk2i',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '婚恋感情合婚',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100zk2i.html',
      locator: '3F 3， 从五行配置来看 · 4， 从用神角度来看',
      published: '2012-04-15',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '戊辰', month: '乙丑', day: '丙戌', hour: '戊戌' },
        needs: ['木'],
        avoids: ['土'],
        needsAsStated: '男命是日主偏弱,喜木忌土',
      },
      {
        label: 'F',
        pillars: { year: '丙寅', month: '乙未', day: '乙卯', hour: '乙酉' },
        needs: ['火', '土'],
        avoids: ['水', '木'],
        needsAsStated: '女命局日主偏旺，喜火土忌水木',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男命局土的五行很旺，喜木流通；女命局木的五行旺，土的五行相对弱一些，从五行的角度看,两个命局五行互补性很强',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'pair',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男命局土的五行很旺，喜木流通；女命局木的五行旺，土的五行相对弱一些，从五行的角度看,两个命局五行互补性很强',
      },
    ],
    inferred: [],
    caveats: ['남명은 같은 글 앞쪽에서 「命局食神旺，有从儿格的象」으로도 읽힌다.'],
  },
  {
    id: 'jq-zlbm-f1',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '这两个女子，我与谁有姻缘？',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100zlbm.html',
      locator: '1F 2， 简评（年龄相仿的女命）',
      published: '2012-04-25',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '丁巳', month: '丙午', day: '戊戌', hour: '庚申' },
        needs: ['金', '水'],
        avoids: [],
        needsAsStated: '命局看，最好选金水旺的命局的女生为配偶为佳',
      },
      {
        label: 'F1',
        pillars: { year: '戊午', month: '丁巳', day: '丁丑', hour: '乙巳' },
        needs: ['土', '金'],
        avoids: [],
        needsAsStated: '喜年上伤官化泄……是喜土金的命局',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F1',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '因为女命火的五行太旺，对男命食神克制比较严重，没有互补性',
      },
      {
        receiver: 'F1',
        provider: 'M',
        verdict: 'unstated',
        scope: 'directional',
        cited: [],
        citedCharacters: [],
        quote: '（없음）',
      },
    ],
    inferred: [],
    caveats: [],
  },
  {
    id: 'jq-zlbm-f2',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '这两个女子，我与谁有姻缘？',
      url: 'https://blog.sina.com.cn/s/blog_68801e410100zlbm.html',
      locator: '1F 3 · 2F 2',
      published: '2012-05-11',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '丁巳', month: '丙午', day: '戊戌', hour: '庚申' },
        needs: ['金', '水'],
        avoids: ['火'],
        needsAsStated: '男命是特别忌火旺的命局',
      },
      {
        label: 'F2',
        pillars: { year: '壬戌', month: '丙午', day: '辛巳', hour: '丙申' },
        needs: ['土', '金'],
        avoids: ['火'],
        needsAsStated: '日主比较弱，是喜土金的命局，命局火太旺',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F2',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '如从婚配的角度看，其实与男命也不适合，因为男命是特别忌火旺的命局，火太旺对男命不利',
      },
      {
        receiver: 'F2',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['month-command', 'abundance'],
        citedCharacters: [],
        quote: '你的命局生于午月，年月火星重重，很强旺，所以你们的命局互补性不强，对女命克制性很大',
      },
    ],
    inferred: [],
    caveats: ['남명의 기신 火는 「特别忌火旺」에서 옮겼다.'],
  },
  {
    id: 'jq-agbu',
    lineage: 'chinese-modern-consult',
    practitioner: JIANQIAO,
    credibility: 'B',
    source: {
      title: '婚姻何去何从呢？',
      url: 'https://blog.sina.com.cn/s/blog_68801e410101agbu.html',
      locator: '3F 4 · 4F 1',
      published: '2013-06',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '壬戌', month: '癸卯', day: '乙巳', hour: '辛巳' },
        needs: ['火'],
        avoids: [],
        needsAsStated: '日主强旺，喜食伤化泄为用，所以日支巳火得用',
      },
      {
        label: 'M',
        pillars: { year: '辛酉', month: '庚寅', day: '癸亥', hour: '壬子' },
        needs: ['木', '火'],
        avoids: [],
        needsAsStated: '男命金水旺，喜木化泄，也喜火的五行……所以男命命局是喜木火的',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '而女命木火通明而旺，所以就合婚的角度看，女命是旺男命的，因为女命的五行能补男命木火的不足。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['clash'],
        citedCharacters: ['亥'],
        quote: '女命夫妻宫为巳，男命夫妻宫为亥水，两人夫妻宫相冲啊，亥冲巳，女命用神被冲不吉',
      },
    ],
    inferred: [],
    caveats: [
      '남명→여명 방향은 오행 공급이 아니라 「일지끼리 충해 여명의 용신 자리를 친다」로 판정했다.',
    ],
  },

  // ─── 华人易 (新浪博客 6223920379 「婚姻解析」) ─────────────────────────────────
  {
    id: 'hr-ye5z',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '两人具有互补性，会给彼此带来好运',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102ye5z.html',
      locator: '【合婚解析】 끝 문단',
      published: '2018-12-16',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '壬戌', month: '辛亥', day: '丙辰', hour: '庚寅' },
        needs: ['木', '火'],
        avoids: ['土', '金', '水'],
        needsAsStated: '丙火生于亥月……身弱，喜木火，忌土金水',
      },
      {
        label: 'F',
        pillars: { year: '乙丑', month: '辛巳', day: '己酉', hour: '丙寅' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '己土生于巳月……身旺，喜金水木，忌火土',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从五行上讲，女方多余的火，正是男方需要的，男方多余的金，正是女方所需的，具有互补性',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从五行上讲，女方多余的火，正是男方需要的，男方多余的金，正是女方所需的，具有互补性',
      },
    ],
    inferred: [],
    caveats: ['같은 글이 `blog_172f97cfb0102xrhz` 에도 실려 있다 — 한 쌍으로 센다.'],
  },
  {
    id: 'hr-wxtf-m1',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '天合地合，二人缘分不错的八字',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102wxtf.html',
      locator: '【与男1合婚分析】其二',
      published: '2017-09-18',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M1',
        pillars: { year: '甲子', month: '甲戌', day: '乙酉', hour: '丙子' },
        needs: ['水', '木'],
        avoids: ['火', '土', '金'],
        needsAsStated: '身弱，五行喜水、木，忌火、土、金',
      },
      {
        label: 'F',
        pillars: { year: '甲子', month: '丁丑', day: '戊辰', hour: '壬子' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '身强五行喜金、水、木，忌火、土',
      },
    ],
    directions: [
      {
        receiver: 'M1',
        provider: 'F',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '男命乙木偏弱，以水、木为喜用五行，女命戊土偏旺，以金、水、木为喜用五行，从五行上说，男女二命互补性一般，不是很好。',
      },
      {
        receiver: 'F',
        provider: 'M1',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '男命乙木偏弱，以水、木为喜用五行，女命戊土偏旺，以金、水、木为喜用五行，从五行上说，男女二命互补性一般，不是很好。',
      },
    ],
    inferred: [],
    caveats: [
      '두 사람의 필요가 水木으로 겹친다 — 출처는 필요가 겹치는 것을 「互补性一般」으로 읽었다.',
    ],
  },
  {
    id: 'hr-wxtf-m2',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '天合地合，二人缘分不错的八字',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102wxtf.html',
      locator: '【与男2合婚分析】其二',
      published: '2017-09-18',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M2',
        pillars: { year: '戊辰', month: '乙卯', day: '癸未', hour: '乙卯' },
        needs: ['木', '火', '土'],
        avoids: ['金', '水'],
        needsAsStated: '全局皆木、土泄克之物，从弱，五行喜木、火、土，忌金、水',
      },
      {
        label: 'F',
        pillars: { year: '甲子', month: '丁丑', day: '戊辰', hour: '壬子' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '身强五行喜金、水、木，忌火、土',
      },
    ],
    directions: [
      {
        receiver: 'M2',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '男命癸水从弱，以木、火、土为喜用五行，女命戊土偏旺，以金、水、木为喜用五行，从五行上说，男女二命互补性不错，双方在一起对彼此发展有利。',
      },
      {
        receiver: 'F',
        provider: 'M2',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '男命癸水从弱，以木、火、土为喜用五行，女命戊土偏旺，以金、水、木为喜用五行，从五行上说，男女二命互补性不错，双方在一起对彼此发展有利。',
      },
    ],
    inferred: [],
    caveats: ['남명은 종약(从弱)으로 읽혔다.'],
  },
  {
    id: 'hr-xkkn',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '两人在一起可以互补，感情根基稳',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102xkkn.html',
      locator: '从五行补救来看',
      published: '2018-08-15',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '戊午', month: '壬戌', day: '戊辰', hour: '癸丑' },
        needs: ['水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '命局综合分析为身旺，五行喜水木林，忌火土帮身',
      },
      {
        label: 'F',
        pillars: { year: '甲寅', month: '丁卯', day: '丁未', hour: '乙巳' },
        needs: ['土', '金', '水'],
        avoids: ['木', '火'],
        needsAsStated: '命局综合分析为身旺，五行喜土金水，忌木火帮身',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从五行补救来看，男命土旺喜木，女命木旺喜土，两人可以互补',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '从五行补救来看，男命土旺喜木，女命木旺喜土，两人可以互补',
      },
    ],
    inferred: [],
    caveats: ['「喜水木林」은 원문 그대로다(「林」은 오기로 보인다).'],
  },
  {
    id: 'hr-xld9',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '婚配不合，不会为对方带来好处',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102xld9.html',
      locator: '【合婚解答】 끝에서 셋째 문단',
      published: '2018-08-19',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '辛未', month: '乙未', day: '己酉', hour: '辛未' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '八字综合分析为身旺五行喜金水木忌火土帮身',
      },
      {
        label: 'M',
        pillars: { year: '辛酉', month: '壬辰', day: '庚申', hour: '丙戌' },
        needs: ['水', '木'],
        avoids: ['土', '金', '火'],
        needsAsStated: '日元太旺。喜水、木，忌讳土、金、火',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男女双方都是土、金旺的八字，双方五行一点都不互补，而且都是对方的忌神，说明长期相处，不会为对方带来好处',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男女双方都是土、金旺的八字，双方五行一点都不互补，而且都是对方的忌神，说明长期相处，不会为对方带来好处',
      },
    ],
    inferred: [],
    caveats: [
      '여명의 필요에는 金이 들고 남명은 金이 왕한데도 출처는 「都是对方的忌神」이라 했다 — 土가 金보다 앞섰다.',
    ],
  },
  {
    id: 'hr-ybds',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '这两人在一起，相合指数不高',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102ybds.html',
      locator: '合婚分析 其二',
      published: '2018',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '乙丑', month: '戊寅', day: '辛巳', hour: '丙申' },
        needs: ['土', '金'],
        avoids: ['火', '木', '水'],
        needsAsStated: '五行喜土金帮身，忌火木水耗身',
      },
      {
        label: 'F',
        pillars: { year: '丁卯', month: '壬寅', day: '甲午', hour: '戊辰' },
        needs: ['火', '土', '金'],
        avoids: ['水', '木'],
        needsAsStated: '五行喜火土金耗身，忌水木帮身',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上说，男女二命互补性一般，如果双方在一起对彼此有一些助益，但不大',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上说，男女二命互补性一般，如果双方在一起对彼此有一些助益，但不大',
      },
    ],
    inferred: [],
    caveats: [],
  },
  {
    id: 'hr-yfqi',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '夫妻在一起工作，是好还是坏',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102yfqi.html',
      locator: '从五行上看',
      published: '2019',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '己未', month: '丁丑', day: '己亥', hour: null },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '男己土生于丑月，亥水耗身，身旺，喜金水木，忌火土',
      },
      {
        label: 'F',
        pillars: { year: '壬戌', month: '丙午', day: '庚寅', hour: '辛巳' },
        needs: ['木', '火', '土'],
        avoids: ['金', '水'],
        needsAsStated: '女庚金生于午月，辛金无根，从弱，喜木火燥土，忌金水湿土',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上看，男女之间互补作用强，意味着两个人在一起能给彼此带来好运气',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上看，男女之间互补作用强，意味着两个人在一起能给彼此带来好运气',
      },
    ],
    inferred: [],
    caveats: [
      '남명의 시는 출처가 「时辰不详」으로 적었다.',
      '여명은 종약으로 읽혔고 土는 「燥土」만이다 — 오행으로는 土 하나로 적었다.',
    ],
  },
  {
    id: 'hr-ygrh',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '离婚后有望复婚',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102ygrh.html',
      locator: '【合婚分析】其二',
      published: '2019-02-15',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '戊辰', month: '甲寅', day: '庚子', hour: null },
        needs: ['土', '金'],
        avoids: ['水', '木', '火'],
        needsAsStated: '命主庚金偏弱。五行喜土、金，忌讳水、木、火',
      },
      {
        label: 'F',
        pillars: { year: '丁卯', month: '庚戌', day: '丙辰', hour: '乙未' },
        needs: ['木', '火', '土'],
        avoids: ['金', '水'],
        needsAsStated: '五行取木、火、燥土为喜用，忌讳金、水、湿土',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男命庚金偏弱，木旺。以土、金为喜用五行，女命丙火偏弱，土旺，以木、火、燥土为喜用五行，从五行上说，男女二命互补性还不错，双方在一起对彼此发展均为有利',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'pair',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '男命庚金偏弱，木旺。以土、金为喜用五行，女命丙火偏弱，土旺，以木、火、燥土为喜用五行，从五行上说，男女二命互补性还不错，双方在一起对彼此发展均为有利',
      },
    ],
    inferred: [],
    caveats: ['남명의 시는 출처가 「时辰不详」으로 적었다.'],
  },
  {
    id: 'hr-yr48',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '露水夫妻，以后难免分手',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102yr48.html',
      locator: '从五行上讲',
      published: '2019',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '辛酉', month: '戊戌', day: '丁亥', hour: '乙巳' },
        needs: ['木', '火'],
        avoids: ['土', '金', '水'],
        needsAsStated: '男丁火生于戌月，乙木巳火生扶，身弱，喜木火，忌土金水',
      },
      {
        label: 'F',
        pillars: { year: '甲子', month: '壬申', day: '庚子', hour: '壬午' },
        needs: ['土', '金'],
        avoids: ['水', '木', '火'],
        needsAsStated: '女庚金生于申月，其余都是克泄耗，身弱，喜土金，忌水木火',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上讲，二人较强的互补性，意味着在一起能够给彼此带来好运气，这一点是不错的',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote: '从五行上讲，二人较强的互补性，意味着在一起能够给彼此带来好运气，这一点是不错的',
      },
    ],
    inferred: [],
    caveats: [
      '여명 원국은 남명의 기신 水가 넷(壬 · 子 · 壬 · 子)이다 — 출처는 그것을 따로 말하지 않고 쌍을 「较强的互补性」으로 불렀다.',
    ],
  },
  {
    id: 'hr-yr6w',
    lineage: 'chinese-modern-consult',
    practitioner: HUAREN,
    credibility: 'B',
    source: {
      title: '二人以后的缘分很深，相伴到老的几率大',
      url: 'https://blog.sina.com.cn/s/blog_172f97cfb0102yr6w.html',
      locator: '五行上',
      published: '2019',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '壬申', month: '甲辰', day: '癸酉', hour: '戊午' },
        needs: ['木', '火', '土'],
        avoids: ['金', '水'],
        needsAsStated: '男癸水生于辰月，申酉金生扶，身偏旺，喜木火土，忌金水',
      },
      {
        label: 'F',
        pillars: { year: '丁卯', month: '庚戌', day: '辛卯', hour: '癸巳' },
        needs: ['土', '金'],
        avoids: ['水', '木', '火'],
        needsAsStated: '女辛金生于戌月，庚金帮身，身弱，喜土金，忌水木火',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '五行上，二人有一定的互补性，这一点还是不错的，意味着二人在一起能够互旺，给彼此带来好运气',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '五行上，二人有一定的互补性，这一点还是不错的，意味着二人在一起能够互旺，给彼此带来好运气',
      },
    ],
    inferred: [
      '「有一定的互补性」를 `partial` 이 아니라 `supplies` 로 적었다 — 출처가 「互旺」 · 「中等偏上」으로 이어 긍정으로 맺었다.',
    ],
    caveats: [],
  },

  // ─── 그 밖의 중국 현대 상담 글 ───────────────────────────────────────────────
  {
    id: 'shi-sohu-455050996',
    lineage: 'chinese-modern-consult',
    practitioner: '史老师(一玄堂)',
    credibility: 'B',
    source: {
      title: '现代八字合婚：最不般配的婚姻配对',
      url: 'https://m.sohu.com/n/455050996/',
      locator: '【解析】 五行喜忌 뒤 둘째 · 셋째 문단',
      published: '2016',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '壬戌', month: '癸丑', day: '辛丑', hour: '戊戌' },
        needs: ['木', '金', '水'],
        avoids: ['火', '土'],
        needsAsStated: '五行喜木疏松厚土，喜金帮身，忌讳火土，水有去除八字燥气的功效',
      },
      {
        label: 'M',
        pillars: { year: '己巳', month: '丙寅', day: '乙未', hour: '癸未' },
        needs: ['水', '木'],
        avoids: ['火', '土', '金'],
        needsAsStated: '八字火土过旺，导致身偏弱。五行喜水木生身，忌讳火土金',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'harms',
        scope: 'directional',
        cited: ['branch', 'abundance'],
        citedCharacters: ['丑', '戌'],
        quote:
          '男方八字五行喜水木，忌讳火土金，而女方八字四柱丑戌土旺极，说明女方五行中土对男方不利。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '女方八字五行喜金水木，忌讳火土，而男方八字火土两旺，说明男方五行中火土对女方也不利。',
      },
    ],
    inferred: [],
    caveats: [
      '여명의 필요를 같은 글이 「喜木……喜金」과 「喜金水木」 두 번 적는다 — 뒤의 것을 옮겼다.',
    ],
  },
  {
    id: 'sss-douban-104824127',
    lineage: 'chinese-modern-consult',
    practitioner: '三生石',
    credibility: 'B',
    source: {
      title: '什么是真正的旺夫命？',
      url: 'https://www.douban.com/group/topic/104824127/',
      locator: '「我们就拿这对夫妻为例吧」',
      published: '2017-07',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '戊申', month: '庚申', day: '乙卯', hour: '壬午' },
        needs: ['木', '火'],
        avoids: [],
        needsAsStated: '此造日主乙木生在秋天，正官庚金旺而合乙木，喜木、火为用',
      },
      {
        label: 'F',
        pillars: { year: '庚戌', month: '己卯', day: '丙午', hour: '癸巳' },
        needs: ['金', '水'],
        avoids: [],
        needsAsStated: '女命天干一气，癸水正官为用，喜用是金、水',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['month-command', 'branch', 'day-master'],
        citedCharacters: ['卯', '午', '丙'],
        quote: '女方日主丙火，有卯木得令旺而逢生，午火帝旺，丙火旺，正好能补救男方所喜欢的木火用神',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '而男人金旺，正好补救女人所喜欢用神。',
      },
    ],
    inferred: [],
    caveats: ['출처가 결혼 뒤 두 사람의 사회적 성취를 사후 근거로 든다 — 판정은 원국으로 섰다.'],
  },
  {
    id: 'yide-az',
    lineage: 'chinese-modern-consult',
    practitioner: '一德老师',
    credibility: 'B',
    source: {
      title: '八字看夫妻喜用神一致：什么样的两口子能一起走远',
      url: 'https://www.yidelaoshi.com/articles/bazi-fuqi-xiyongshen-yizhi.html',
      locator: '二 第二 · 三 第一层',
      published: '2026-05-21',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '癸卯', month: '甲寅', day: '乙酉', hour: '丁丑' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: 'A 总(夫)……乙木身强火、土',
      },
      {
        label: 'F',
        pillars: { year: '甲辰', month: '乙亥', day: '己巳', hour: '乙亥' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: 'Z 太(妻)……己土火、土',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['day-master'],
        citedCharacters: ['己'],
        quote: 'A 总命局缺火土,而 Z 太日主己土本身就是 A 总最需要的财星,所以 Z 太给 A 总"带财"',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['stem'],
        citedCharacters: ['丁'],
        quote: 'A 总的丁火又能温暖 Z 太的命局——A 总给 Z 太带温暖。',
      },
    ],
    inferred: [],
    caveats: [
      '필요가 같은 쌍(火土 · 火土)인데 출처는 이것을 「一致」이자 「双向互补」로 동시에 부른다.',
    ],
  },
  {
    id: 'yide-busan',
    lineage: 'chinese-modern-consult',
    practitioner: '一德老师',
    credibility: 'B',
    source: {
      title: '八字合婚:命局互补的"拆不散的姻缘"',
      url: 'https://www.yidelaoshi.com/articles/bazi-hehun-mingju-hubu-chai-busan-yinyuan.html',
      locator: '第三层 结论 · 第四层 具体的"互补机制"',
      published: '2026-05-25',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '丁巳', month: '丁未', day: '癸巳', hour: '丙辰' },
        needs: ['水'],
        avoids: [],
        needsAsStated: '男命缺水(自身水弱)',
      },
      {
        label: 'F',
        pillars: { year: '壬戌', month: '壬寅', day: '戊子', hour: '壬子' },
        needs: ['火'],
        avoids: [],
        needsAsStated: '身弱极、需印帮身……女命缺火(命局无印)',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance', 'stem'],
        citedCharacters: ['壬'],
        quote: '女命壬水强旺,能助男命孤弱的癸水。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance', 'combination'],
        citedCharacters: ['丁', '丙'],
        quote: '男命强火为女命的印星——印星生戊土。',
      },
    ],
    inferred: [],
    caveats: [
      '같은 글이 남명을 「从财格……以火为命局真主人」으로 먼저 읽고, 결론에서 「男命缺水」라 한다 — 결론의 것을 옮겼다.',
      '「戊癸合化火」(두 사람의 일간 합)도 여명에게 火를 준다고 든다.',
    ],
  },
  {
    id: 'liu-ksina-7453756075',
    lineage: 'chinese-modern-consult',
    practitioner: '奇门风水刘老师',
    credibility: 'B',
    source: {
      title: '彼此喜忌互补，在一起可以增旺对方的运势，利于事业提升',
      url: 'https://k.sina.cn/article_7453756075_1bc474aab0010121p1.html',
      locator: '解析回复 男友 문단 끝',
      published: '2022-05-05',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '乙亥', month: '癸未', day: '戊辰', hour: '戊午' },
        needs: ['金', '水', '木'],
        avoids: ['火', '土'],
        needsAsStated: '八字身旺，以克泄耗日主的金水木五行为用神……五行金为八字最重要的用神',
      },
      {
        label: 'M',
        pillars: { year: '壬申', month: '壬寅', day: '丙子', hour: '丙申' },
        needs: ['土'],
        avoids: ['木', '火'],
        needsAsStated: '你八字土旺，也是他八字的用神',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '男友水木较旺，是你八字的用神',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '你八字土旺，也是他八字的用神，喜忌可以互补，在一起对对方运势有一定帮助。',
      },
    ],
    inferred: ['남명의 필요를 판정 문장(「土……也是他八字的用神」)에서 옮겼다.'],
    caveats: [
      '출처의 남명 용신 문장은 「以泄耗日主的火土五行为用神，以生扶日主的木火五行为忌神」이다 — 火가 양쪽에 다 서서 오기로 보고, 필요는 土만 적었다.',
    ],
  },

  // ─── 한국 — 조은(원리학당), 다음 카페 「용신이 같으면 궁합이 좋다?」(2003) ─────────
  {
    id: 'joeun-2003-2',
    lineage: 'korean-modern-forum',
    practitioner: '조은(원리학당)',
    credibility: 'B',
    source: {
      title: '용신이 같으면 궁합이 좋다?',
      url: 'https://m.cafe.daum.net/jounsaju/NC7/77',
      locator: '2, 남명 · 여명 — 조은의 1) ~ 4)',
      published: '2003-06-19',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '丙申', month: '庚寅', day: '丙辰', hour: '癸巳' },
        needs: ['水'],
        avoids: [],
        needsAsStated:
          '남명은 화토가 강한 사주로.. 정관을 쓰는 사주로 수를 필요로 하는 것같습니다.',
      },
      {
        label: 'F',
        pillars: { year: '乙未', month: '戊寅', day: '壬子', hour: '癸卯' },
        needs: ['火', '土'],
        avoids: [],
        needsAsStated: '여명은 수목이 강해서 화토를 쓰는 사주같습니다.',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['day-pillar'],
        citedCharacters: ['壬', '子'],
        quote: '하면.. 임자 일주는 득되는 글자이니 싫어할 리가 없을 것으로 봅니다.',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['day-pillar'],
        citedCharacters: ['丙', '辰'],
        quote: '하면.. 화토 일주는 득되는 글자이니 싫어할 이유가 없을 것입니다.',
      },
    ],
    inferred: [],
    caveats: ['명식은 원문의 시 · 일 · 월 · 연 순 세로쓰기를 연 · 월 · 일 · 시로 옮겼다.'],
  },
  {
    id: 'joeun-2003-3',
    lineage: 'korean-modern-forum',
    practitioner: '조은(원리학당)',
    credibility: 'B',
    source: {
      title: '용신이 같으면 궁합이 좋다?',
      url: 'https://m.cafe.daum.net/jounsaju/NC7/77',
      locator: '3, 남명 · 여명 — 조은의 1) ~ 4)',
      published: '2003-06-19',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '壬寅', month: '癸丑', day: '癸丑', hour: '甲寅' },
        needs: ['木', '火'],
        avoids: [],
        needsAsStated: '남명은 토금이 강하여 목화를 쓰는 사주로 보입니다.',
      },
      {
        label: 'F',
        pillars: { year: '甲辰', month: '丁卯', day: '丁丑', hour: '壬寅' },
        needs: ['土', '金'],
        avoids: [],
        needsAsStated:
          '여명은 수를 쓰기 위해서 토생금 금생수를 하기 위해서 토금을 필요로 하는 것이니',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['day-master'],
        citedCharacters: ['丁'],
        quote: '여명의 정화는 남자가 좋아하는 목화이니 좋고',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['day-pillar'],
        citedCharacters: ['癸', '丑'],
        quote: '계축은 토금수가 강한 글자이니 싫어할 리가 없을 것입니다.',
      },
    ],
    inferred: [],
    caveats: [
      '남명을 「토금이 강하여」라 읽었는데 원국에 水가 셋(壬 · 癸 · 癸)이다 — 丑 둘을 土金으로 본 읽기로 보이며, 옮긴 대로 둔다.',
      '여명 쪽은 「수를 쓰기 위해서」 토금이 필요하다고 해 수도 함께 필요하다는 뜻이 섞였다 — 토금만 적었다.',
    ],
  },
  {
    id: 'joeun-2003-4',
    lineage: 'korean-modern-forum',
    practitioner: '조은(원리학당)',
    credibility: 'B',
    source: {
      title: '용신이 같으면 궁합이 좋다?',
      url: 'https://m.cafe.daum.net/jounsaju/NC7/77',
      locator: '「일간이 서로 상생해도 이혼하고 늘 싸우던 부부」 1) ~ 4)',
      published: '2003-06-19',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '丁酉', month: '丁未', day: '辛亥', hour: '己亥' },
        needs: ['金', '水'],
        avoids: [],
        needsAsStated: '남명은 목화가 강하여 금수를 쓰는 사주로 보입니다.',
      },
      {
        label: 'F',
        pillars: { year: '己亥', month: '丙子', day: '戊寅', hour: '癸亥' },
        needs: ['木', '火', '土'],
        avoids: ['水'],
        needsAsStated: '여명은 수왕하여 목화토를 쓰는 사주로 보입니다.',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'harms',
        scope: 'directional',
        cited: ['day-master', 'branch'],
        citedCharacters: ['辛', '亥'],
        quote:
          '남명의 신금은 생수하여 수왕하게 하니 여명이 싫어하는 글자이고.. 해수는 여명이 싫어하는 글자이나 다행이 해미 공합으로 화목하는 점이 좋습니다.',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'mixed',
        scope: 'directional',
        cited: ['day-master'],
        citedCharacters: ['戊'],
        quote:
          '여명의 무토는 남명 사주에 화왕하여 설기시켜주는 좋은 글자로 볼 수도 있으나 남명은 신강사주에 토를 좋아만 할 수는 없으며 보석 신금을 흙속에 묻어버리는 역할까지 하니 좋다고만 할 수는 없습니다.',
      },
    ],
    inferred: ['여명의 기신 水는 「수왕하여」에서 옮겼다.'],
    caveats: ['명식은 원문의 시 · 일 · 월 · 연 순 세로쓰기를 연 · 월 · 일 · 시로 옮겼다.'],
  },
  // ─── 2026-09-25 보충(CN-2) — 새 글쓴이 둘 · 기존 글쓴이의 다른 글 하나 ──────────────────
  // `docs/notes/2026-09-25-research-cn-yongsin-supply.md`. 출처의 생년월일 · 상담 사연은 옮기지 않았다.
  {
    id: 'puyun-sohu-224270400',
    lineage: 'chinese-modern-consult',
    practitioner: '蒲云星命',
    credibility: 'B',
    source: {
      title: '八字五行旺衰喜忌互补，及喜用神和谐属于好婚配',
      url: 'https://www.sohu.com/a/224270400_310486',
      locator: '综合两个八字合婚 二，喜用神五行对比互补方面',
      published: '2018-02-27',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'M',
        pillars: { year: '癸亥', month: '甲子', day: '戊寅', hour: '丙辰' },
        needs: ['火', '土'],
        avoids: ['水', '木'],
        needsAsStated: '八字身弱，五行喜火土；忌水木。……八字五行水木旺，火土弱。最喜火。',
      },
      {
        label: 'F',
        pillars: { year: '丁卯', month: '辛亥', day: '庚午', hour: '戊寅' },
        needs: ['火', '土', '金'],
        avoids: ['水'],
        needsAsStated: '五行喜火土金；忌金水。',
      },
    ],
    directions: [
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '女子火偏旺，正是男命所喜之神，女可助男而旺夫。',
      },
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'partial',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '女命喜土金火，而男命八字五行水木旺，在五行上男命对女命没有太大助力。',
      },
    ],
    inferred: [
      '「没有太大助力」를 `does-not` 이 아니라 `partial` 로 적었다 — 「큰 도움은 없다」이지 「없다」가 아니다.',
    ],
    caveats: [
      '여명의 기신을 원문이 「金水」라 적어 희신 金과 겹친다 — 水만 옮겼다.',
      '여명에게 「火偏旺」이라 했지만 드러난 火는 丁 · 午 둘뿐이다. 거꾸로 남명에는 여명이 바란 土 · 火가 일간 戊 · 시간 丙 · 辰(본기 戊)으로 셋 드러나 있는데 「水木旺」으로 덮였다 — 출처는 **개수보다 상대의 세력 전체**를 본다.',
      '같은 글이 「两个八字同时喜土」를 따로 좋게 든다(필요가 겹쳐도 깎지 않는다).',
    ],
  },
  {
    id: 'liu-ksina-r1uq',
    lineage: 'chinese-modern-consult',
    practitioner: '奇门风水刘老师',
    credibility: 'B',
    source: {
      title: '合婚：彼此互补性不强，婚姻中会磕磕绊绊',
      url: 'https://k.sina.cn/article_7453756075_1bc474aab00100r1uq.html',
      locator: '分析两人合婚',
      published: '2020-11-24',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '甲子', month: '乙亥', day: '丙寅', hour: '癸巳' },
        needs: ['木', '火'],
        avoids: ['金', '水'],
        needsAsStated: '以木火为用，且喜火最好，忌讳金水五行。',
      },
      {
        label: 'M',
        pillars: { year: '乙丑', month: '癸未', day: '癸酉', hour: '庚申' },
        needs: ['水', '木'],
        avoids: [],
        needsAsStated: '他八字土金水木流通相生，而水木稍弱',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'does-not',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote:
          '你喜木火的五行，他的八字土金旺，且金生水，八字木火相对较弱，他八字没有旺到和平衡你八字的作用',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'supplies',
        scope: 'directional',
        cited: ['abundance'],
        citedCharacters: [],
        quote: '他八字土金水木流通相生，而水木稍弱，你八字水木旺，对他八字有平衡五行的作用。',
      },
    ],
    inferred: [
      '남명의 필요 水木은 「水木稍弱」에서 옮겼다 — 출처는 남명의 용신을 따로 이름 짓지 않았다.',
    ],
    caveats: [
      '쌍의 결론은 「两人五行方面，只有一方旺另一方，没有达到彼此互补，八字合婚匹配度不高」 — **한 방향만 채우면 낮게 친다.**',
      '남명 시는 출처가 받은 생시에서 스스로 세운 것이다(庚申).',
    ],
  },
  {
    id: 'jieyan-341',
    lineage: 'chinese-modern-consult',
    practitioner: '吉言网(서명 없음)',
    credibility: 'C',
    source: {
      title: '八字合婚实例：男女日柱相同组合相似，有矛盾隐患容易不欢而散',
      url: 'https://www.58jieyan.com/bzfx/341.html',
      locator: '八字合婚 문단',
      published: '2020-08-18',
      retrievedAt: '2026-09-25',
    },
    people: [
      {
        label: 'F',
        pillars: { year: '丙子', month: '丙申', day: '辛丑', hour: '己亥' },
        needs: ['火', '水', '木'],
        avoids: ['土', '金'],
        needsAsStated: '所以八字最终天干乙木火为用神，地支水木为用神，而土金为忌神。',
      },
      {
        label: 'M',
        pillars: { year: '乙亥', month: '丙戌', day: '辛丑', hour: '己亥' },
        needs: ['木', '火'],
        avoids: ['土', '金'],
        needsAsStated: '因此八字以财官为用神，以印比为忌神。',
      },
    ],
    directions: [
      {
        receiver: 'F',
        provider: 'M',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '同时都是以财官为喜用神，且八字地支又带食伤，两人八字喜用神的组合也是一样的，代表你们八字有一定的互补性的',
      },
      {
        receiver: 'M',
        provider: 'F',
        verdict: 'partial',
        scope: 'pair',
        cited: [],
        citedCharacters: [],
        quote:
          '同时都是以财官为喜用神，且八字地支又带食伤，两人八字喜用神的组合也是一样的，代表你们八字有一定的互补性的',
      },
    ],
    inferred: [
      '남명의 필요 木火 · 기신 土金은 辛金 일간의 「财官」 · 「印比」에서 옮겼다.',
      '여명의 「天干乙木火」에서 乙은 원국 천간에 없다 — 원문의 오기로 보고 火 · 水 · 木으로 적었다.',
    ],
    caveats: [
      '서명 없는 작명 · 상담 업체 글이라 `C` 다. 문체가 奇门风水刘老师의 글과 비슷하나 같은 사람인지 확인하지 못했다.',
      '필요가 같은 쌍을 「有一定的互补性」으로 읽는다 — 필요가 겹쳐도 공급을 인정하는 쪽의 예다. 쌍의 결론은 「合婚结果比较一般」.',
    ],
  },
];
