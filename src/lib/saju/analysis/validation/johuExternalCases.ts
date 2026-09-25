import type { Element, Stem } from '../../constants';

/**
 * 자료의 계통 — `eokbuExternalCases.ts` 와 같은 뜻이다. 호스트 이름으로 세지 않는다.
 * 현대 한국 자료는 조후 판정을 적은 **공개 명식**을 찾지 못해 이 데이터셋에 없다(급함 기준만
 * `docs/notes/2026-09-25-research-johu.md` 에 적었다).
 */
type JohuLineage =
  /** 청대 고전 주석 — 《滴天髓闡微》 任鐵樵 */
  | 'classical-chinese'
  /** 민국 시대 — 《千里命稿》 韋千里 · 《子平眞詮評註》 徐樂吾 */
  | 'republican-chinese';

/**
 * 출처가 조후를 어떻게 다루었는가 — **출처의 말로만** 가른다.
 *
 * - `johu-first`: 기후를 고치는 글자를 용신(또는 가장 먼저 필요한 것)으로 든다.
 * - `johu-auxiliary`: 기후를 고치는 글자가 필요하다고 하면서도 「暖局일 뿐 용신이 아니다」처럼
 *   용신을 다른 데서 잡는다 — 任鐵樵 「凡冬金喜火取其暖局之意，非作用神也」.
 * - `johu-declined`: 기후가 치우쳤는데 조후를 쓰지 않는다 — 극단을 따르거나(「反以無寒為美」)
 *   고칠 글자에 뿌리가 없어 쓸 수 없다고 한다.
 * - `climate-diagnosis`: 한난조습을 병으로 진단하거나 칭찬하지만 용신을 말하지 않는다
 *   (성정 · 질병 장). 서열 대조에서 뺀다.
 * - `not-invoked`: 한 · 열 달에 났는데 강약만으로 용신을 잡고 조후를 말하지 않는다.
 */
export type JohuVerdict =
  'johu-first' | 'johu-auxiliary' | 'johu-declined' | 'climate-diagnosis' | 'not-invoked';

/** 출처가 적은 원국의 기후 — 「寒金冷水」 「燥烈極矣」 같은 말을 옮긴다. 말하지 않았으면 `null` */
type AuthorClimate = 'cold' | 'hot' | 'cold-wet' | 'hot-dry' | null;

type ExternalJohuCase = {
  id: string;
  pillars: { year: string; month: string; day: string; hour: string };
  lineage: JohuLineage;
  source: {
    title: string;
    url: string;
    /** 장 이름과 원문 한 줄 — 원문이 간체면 간체 그대로 */
    locator: string;
    retrievedAt: '2026-09-25';
  };
  claim: {
    climate: AuthorClimate;
    verdict: JohuVerdict;
    /**
     * 출처가 기후를 고칠 것으로 적은 것. 천간으로 말했으면 `stems`, 오행으로만 말했으면
     * `stems: null` 이다(韋千里 「子水滋潤」은 오행이 아니라 지지로 말한다 — 천간이 없다).
     */
    remedy: { stems: readonly Stem[] | null; element: Element } | null;
    /** 출처가 든 용신의 오행 — 명시하지 않았으면 `null` */
    yongsinElement: Element | null;
    /** 출처가 「急」이라는 낱말을 썼는가 */
    saysUrgent: boolean;
    /** 같은 글자를 강약(억부 · 佩印 · 泄秀)의 까닭으로도 들었는가 */
    eokbuReasonAlso: boolean;
    summary: string;
  };
  caveats: readonly string[];
};

const DTSM = {
  title: '《滴天髓闡微》 — 任鐵樵 주석',
  url: 'https://zh.wikisource.org/wiki/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%97%A1%E5%BE%AE',
  retrievedAt: '2026-09-25',
} as const;

const QLMG = {
  title: '《千里命稿》 評斷篇 — 韋千里',
  url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
  retrievedAt: '2026-09-25',
} as const;

const ZPZQ = {
  title: '《子平眞詮評註》 論用神配氣候得失 — 徐樂吾 주',
  url: 'https://www.suanzhun.net/book/326.html',
  retrievedAt: '2026-09-25',
} as const;

/**
 * 공개된 명식 네 기둥과 저자가 조후를 어떻게 다뤘는가를 옮긴 외부 사례.
 *
 * **정답표가 아니다.** 세 저자의 서열 판단이 서로 다르다 — 任鐵樵는 겨울 금수의 불을 대개
 * 「暖局」으로 낮추고(「取火為用者，十無一二」), 徐樂吾는 같은 자리를 「調候為急」으로 올린다.
 * 한 사람에게 맞춘 규칙은 다른 사람에게 틀린다. `johu.external.test.ts` 는 엔진과의 일치를
 * 고정해 규칙 변경이 무엇을 움직였는지 드러내는 데만 쓴다.
 *
 * 사람 이름은 싣지 않는다 — 책에 실린 간지와 저자의 판단만 옮긴다. 원문의 서술이 간지와
 * 어긋나는 명식(「寅月寅時」라 적고 시주가 甲子인 《滴天髓闡微》 合局편 한 건)은 싣지 않았다.
 */
export const JOHU_EXTERNAL_CASES: readonly ExternalJohuCase[] = [
  // ─── 《滴天髓闡微》 寒暖 ───────────────────────────────────────────────
  {
    id: 'dtsm-handan-gapsin',
    pillars: { year: '甲申', month: '丙子', day: '庚辰', hour: '戊寅' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 二十九、寒暖 — 若非寅时，则年月木火无根，不能作用矣，所谓寒虽甚，要暖有气也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '寒金冷水에 寅時가 丙에 뿌리를 주어 「得氣之寒，遇暖而發」 — 東南 운에 발한다.',
    },
    caveats: ['용신이라는 낱말 대신 「作用」을 쓴다.'],
  },
  {
    id: 'dtsm-handan-giyu',
    pillars: { year: '己酉', month: '丙子', day: '庚辰', hour: '甲申' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 二十九、寒暖 — 此则无寅木，火临绝，所谓寒甚而瞹无气，反以瞹为美',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-declined',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '앞 명식과 시 하나만 다르다 — 丙에 뿌리가 없어 추위를 따르고, 北方 운이 좋고 南方 운이 나쁘다.',
    },
    caveats: [
      '위키문헌 본문은 「反以瞹為美」로 적혔지만 뒤의 운 해석(北方 水地 「有喜無憂」 · 南方 丙火 得地 「破耗多端」)과 어긋나 「無暖」 또는 「寒」의 오기로 읽었다.',
      '앞의 dtsm-handan-gapsin 과 짝이다 — 같은 달 · 같은 일주에서 시 하나가 조후를 켜고 끈다.',
    ],
  },
  {
    id: 'dtsm-handan-jeongchuk',
    pillars: { year: '丁丑', month: '丙午', day: '丙午', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 二十九、寒暖 — 一点壬水……喜其坐辰，通根身库……所谓暖虽至而寒有根也',
    },
    claim: {
      climate: 'hot',
      verdict: 'johu-first',
      remedy: { stems: ['壬'], element: '水' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '火焰南離에 壬 하나가 辰에 뿌리를 두고 丑 습토가 받친다 — 「暖雖至而寒有根」.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-handan-gyemi',
    pillars: { year: '癸未', month: '丁巳', day: '丙午', hour: '癸巳' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 二十九、寒暖 — 天干丙癸，地支全无根气，所谓暖之至，寒无根，反以无寒为美',
    },
    claim: {
      climate: 'hot',
      verdict: 'johu-declined',
      remedy: { stems: ['癸'], element: '水' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '癸에 뿌리가 없어 차가움이 없는 편이 낫다 — 木火 운이 좋고 癸丑 · 壬子 운에 무너진다.',
    },
    caveats: [],
  },
  // ─── 《滴天髓闡微》 燥濕 ───────────────────────────────────────────────
  {
    id: 'dtsm-joseup-byeongjin',
    pillars: { year: '丙辰', month: '辛丑', day: '庚辰', hour: '丙子' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '通神论 三十、燥湿 — 以俗论之，以为寒金喜火……只有寒湿之气，并无生发之意，中[只]得用水，不能用火矣',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'johu-declined',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '「寒金喜火」라는 속설을 물리친다 — 년간 丙은 辛과 합해 水로 가고 시간 丙은 뿌리가 없어 水를 쓴다.',
    },
    caveats: ['저자 스스로 조후 우선(속설)과 반대로 판단한 사례다.'],
  },
  {
    id: 'dtsm-joseup-jeongmi',
    pillars: { year: '丁未', month: '壬子', day: '庚戌', hour: '丙戌' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 三十、燥湿 — 仲冬水旺，所喜者支中重重燥土，足以去其湿气',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'johu-first',
      remedy: { stems: ['丙', '丁'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '겨울 물이 왕한데 戌未 조토가 습을 걷고 丁壬합이 丙을 지킨다 — 丁未 · 丙午 남방 운에 오른다.',
    },
    caveats: ['용신을 낱말로 적지 않았다 — 조토와 화운을 기뻐한 것을 조후로 읽었다.'],
  },
  {
    id: 'dtsm-joseup-gyemi',
    pillars: { year: '癸未', month: '丁巳', day: '甲午', hour: '庚午' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 三十、燥湿 — 支全巳午未，燥烈极矣。天干金水无根，反激火之烈，只可顺火之气也',
    },
    claim: {
      climate: 'hot-dry',
      verdict: 'johu-declined',
      remedy: { stems: ['癸'], element: '水' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '조열이 극에 이르렀는데 金水에 뿌리가 없어 불의 기세를 따른다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-joseup-gyechuk',
    pillars: { year: '癸丑', month: '丁巳', day: '甲辰', hour: '庚午' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 三十、燥湿 — 丑乃北方湿土，晦火蓄水，癸水通根而载丑……癸水坐下余气，竟可作用',
    },
    claim: {
      climate: 'hot',
      verdict: 'johu-first',
      remedy: { stems: ['癸'], element: '水' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '앞 명식과 丑辰 두 글자만 다르다 — 습토가 癸에 뿌리를 주어 癸를 쓴다. 北方 운 삼십 년이 좋다.',
    },
    caveats: ['dtsm-joseup-gyemi 와 짝이다 — 조후 글자의 **뿌리**가 쓰고 안 쓰고를 가른다.'],
  },
  // ─── 《滴天髓闡微》 다른 장 ──────────────────────────────────────────
  {
    id: 'dtsm-gasin-byeongja',
    pillars: { year: '丙子', month: '己亥', day: '辛酉', hour: '己亥' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '通神论 二十六、假神 — 以俗论之，寒金喜火……必用丙火无疑。不知……丙火全无根气，必须用己土之印',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-declined',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '土',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '속설의 「寒金喜火 → 丙」을 물리치고 물을 막는 己土 인성을 쓴다 — 丙이 亥에 절지라 뿌리가 없다.',
    },
    caveats: ['저자가 억부(인성)를 조후 위에 둔 사례다.'],
  },
  {
    id: 'dtsm-jindae-sinyu',
    pillars: { year: '辛酉', month: '庚子', day: '甲子', hour: '丙寅' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '通神论 三十三、震兑 — 甲木生于仲冬，木衰金寒，用火以暖之……故寒木必得火以生之也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '겨울 甲木에 金이 차다 — 시의 丙으로 데우고 金도 누른다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-bucheo-gyemyo',
    pillars: { year: '癸卯', month: '乙丑', day: '庚申', hour: '丁丑' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 一、夫妻 — 此造寒金坐禄，印绶当权，足以用火敌寒',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary:
        '寒金이 녹에 앉고 인성이 권을 잡아 불로 추위를 막는다 — 년간 癸가 丁을 치는 것이 병.',
    },
    caveats: [
      '「坐祿 · 印綬當權」이라 몸이 강하다는 말이 함께 서 있어 관성(火)은 억부로도 나온다.',
    ],
  },
  {
    id: 'dtsm-hajijang-byeongsin',
    pillars: { year: '丙申', month: '己亥', day: '庚辰', hour: '戊寅' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 五、何知章 — 此寒金喜火……无火则土冻金寒，无木则水旺火虚，以火为用，以木为喜',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary:
        '寒金이 불을 기뻐한다 — 다만 재살이 있으니 몸이 먼저 왕해야 한다며 년지 녹 · 인성 셋을 든다.',
    },
    caveats: ['불을 쓰는 조건으로 「身旺」을 먼저 확인한다 — 조후와 강약을 함께 본 사례다.'],
  },
  {
    id: 'dtsm-yeomyeong-jeongmi',
    pillars: { year: '丁未', month: '癸丑', day: '庚子', hour: '丁亥' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 六、女命章 — 寒金喜火，嫌其支全亥子丑……时干之丁虚脱无根，焉能管伏庚金',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '필요한 것은 불인데 亥子丑 북방에 丁이 뿌리 없이 떠 있어 채워지지 않는다.',
    },
    caveats: [
      '필요는 조후인데 원국이 못 채운 사례다 — 「용신을 썼다」가 아니라 「필요한 것」으로 읽었다.',
    ],
  },
  {
    id: 'dtsm-yeomyeong-jeongchuk',
    pillars: { year: '丁丑', month: '癸丑', day: '庚子', hour: '乙酉' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 六、女命章 — 庚金生于季冬，不但寒金喜火，而且时逢阳刃印绶当权，足以用火敌寒',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary:
        '寒金이 불을 기뻐하고 양인 · 인성으로 몸도 강해 불(관)을 쓸 만하다 — 癸가 丁을 친다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-bangug-gapsin',
    pillars: { year: '甲申', month: '丙子', day: '乙酉', hour: '丙戌' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 十七、反局 — 乙木生于仲冬……喜其丙火并透，则金不寒，水不冻，寒木向阳，儿能救母',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary: '겨울 乙木에 재살이 날뛰는데 丙 둘이 드러나 金을 데우고 살을 누른다 — 「兒能救母」.',
    },
    caveats: ['식상이 살을 제하는 억부 논리(兒能救母)와 조후가 같은 글자를 가리킨다.'],
  },
  {
    id: 'dtsm-seongjeong-gichuk',
    pillars: { year: '己丑', month: '丙子', day: '壬辰', hour: '戊申' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 二十四、性情 — 喜其丙敌寒解冻，为人宽厚和平……癸酉运助刃帮身，得官',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '살인(殺刃)이 둘 다 왕한 격 — 丙의 추위 막음은 성정으로만 말하고 운은 양인을 돕는 金水에 좋다.',
    },
    caveats: [
      '위키문헌 본문 「壬不生于子月」은 「壬水生于子月」의 오기로 읽었다(간지가 壬 일간 · 子월이다).',
    ],
  },
  {
    id: 'dtsm-seongjeong-gapja',
    pillars: { year: '甲子', month: '丙子', day: '庚辰', hour: '庚辰' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 二十四、性情 — 月干丙火……解其寒冻之气，谓冬金得火。但子辰双拱，日元必虚，用神不在丙火而在辰土',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '土',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '冬金得火라 추위는 풀렸지만 子辰이 일간을 비게 하니 용신은 辰土다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-seongjeong-jeongsa',
    pillars: { year: '丁巳', month: '壬子', day: '辛巳', hour: '丁酉' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 二十四、性情 — 天干丁火，不过取其敌寒解冻，非用丁火也。用神必在酉金……凡冬金喜火取其暖局之意，非作用神也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '金',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '丁은 추위를 막을 뿐 용신이 아니다 — 설기가 심해 酉金으로 몸을 돕는다.',
    },
    caveats: [
      '徐樂吾 《子平眞詮評註》 論用神配氣候得失도 같은 명식을 들어 「丁火雖通根，而日元泄氣重，須以酉金扶身為用……特冬令金水，不可缺火，非定以為用也」라 한다 — 두 계통이 같은 판단이라 한 건으로 센다.',
    ],
  },
  {
    id: 'dtsm-jilbyeong-jeonghae',
    pillars: { year: '丁亥', month: '丁未', day: '乙亥', hour: '己卯' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 二十五、疾病 — 最喜时禄通根，则受亥水之生，润其燥烈之土……格取食神用印也',
    },
    claim: {
      climate: 'hot-dry',
      verdict: 'johu-first',
      remedy: { stems: null, element: '水' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary: '未월 乙木이 丁 둘에 설기가 심하다 — 亥水 인성이 몸을 살리고 조토를 적신다.',
    },
    caveats: ['亥水는 지지다 — 저자는 천간이 아니라 오행(인성)으로 말한다.'],
  },
  {
    id: 'dtsm-jilbyeong-gichuk',
    pillars: { year: '己丑', month: '丙子', day: '辛酉', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 二十五、疾病 — 金水伤官喜火，不过要其暖局，非取以为用也。取火为用者，十无一二，取水为用者十有八九；取火者必要木火齐来，又要日元旺相',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '丙이 드러나 냉해는 없지만 용신은 水다 — 불을 용신으로 쓰려면 木火가 함께 오고 일간이 왕해야 한다.',
    },
    caveats: ['불을 용신으로 올리는 조건(木火齊來 · 日元旺相)을 명시한 드문 자리다.'],
  },
  {
    id: 'dtsm-chulsin-jeonghae',
    pillars: { year: '丁亥', month: '壬子', day: '庚子', hour: '辛巳' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 二十六、出身 — 伤官太旺，过于泄气，用神在土，不在火也。柱中之火，不过取其暖局耳',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '土',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '상관이 너무 왕해 설기가 지나치니 용신은 巳 속 戊土 — 불은 판을 데울 뿐이다.',
    },
    caveats: [],
  },
  // 진단만 있는 사례 — 서열 대조에서 뺀다
  {
    id: 'dtsm-hajijang-sinchuk',
    pillars: { year: '辛丑', month: '辛丑', day: '癸酉', hour: '癸丑' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 五、何知章 — 此重重湿土，叠叠寒金，癸水浊而且冻，所谓阴之甚，寒之至者也',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: null,
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '불이 하나도 없는 한습 — 속설의 「金水雙清 · 殺印相生」 귀격을 물리치고 요절로 본다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-jaedeok-byeongin',
    pillars: { year: '丙寅', month: '庚子', day: '己亥', hour: '甲戌' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 八、才德 — 己土生于仲冬，寒湿之体……妙在年干透丙，一阳解冻，冬日可暖',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '년간 丙이 추위를 풀고 戌 조토가 물을 막는다 — 성품을 칭찬하는 장이라 용신은 말하지 않는다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-jaedeok-byeongsul',
    pillars: { year: '丙戌', month: '辛丑', day: '己卯', hour: '甲子' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator:
        '六亲论 八、才德 — 得年干透丙，一阳解冻，似乎佳美。第丙辛合而化水，以阳变阴，反增寒湿之气',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '드러난 丙이 辛과 합해 水로 가 오히려 한습을 더한다 — 조후 글자가 있어도 합으로 잃는다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-bunul-gyechuk',
    pillars: { year: '癸丑', month: '乙丑', day: '癸丑', hour: '癸丑' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 九、奋郁 — 凡富贵之造，寒暖适中……未有阴寒湿带，偏枯之象而能富贵者也',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: null,
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '癸 셋 · 丑 넷의 음한습체 — 속설의 「食神清透 · 殺印相生」을 물리친다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-jilbyeong-imjin',
    pillars: { year: '壬辰', month: '壬子', day: '辛酉', hour: '己丑' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 二十五、疾病 — 金水伤官，局中全无火气，金寒水冷，土湿而冻，初患冷漱',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: null,
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '불이 없는 금수상관 — 병(冷嗽)으로 진단하고 격은 「傷官佩印」이라 한다.',
    },
    caveats: [],
  },
  {
    id: 'dtsm-jilbyeong-gichuk-2',
    pillars: { year: '己丑', month: '丁丑', day: '己亥', hour: '乙丑' },
    lineage: 'classical-chinese',
    source: {
      ...DTSM,
      locator: '六亲论 二十五、疾病 — 支逢三丑，日主本旺，过于寒湿，丁火无根，不能去其寒湿之气',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '丁이 뿌리 없어 한습을 못 걷는다 — 몸의 병으로 진단한다.',
    },
    caveats: [],
  },
  // ─── 《千里命稿》 韋千里 ───────────────────────────────────────────────
  {
    id: 'qlmg-yuk-gyemi',
    pillars: { year: '癸未', month: '甲子', day: '丙戌', hour: '己亥' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷之舉例 (一) — 丙既云弱，必须生扶。月上甲木泄水之有余，生火之不足，取用无疑',
    },
    claim: {
      climate: null,
      verdict: 'not-invoked',
      remedy: null,
      yongsinElement: '木',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary:
        '子월 丙火인데 강약(抑者太多，扶者太少)만으로 甲木 인성을 쓴다 — 조후를 말하지 않는다.',
    },
    caveats: [],
  },
  {
    id: 'qlmg-jin-imja',
    pillars: { year: '壬子', month: '丙午', day: '癸亥', hour: '戊午' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷之舉例 (五) — 日元稍弱，宜取壬水，劫财帮身为用',
    },
    claim: {
      climate: null,
      verdict: 'not-invoked',
      remedy: null,
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary: '午월 癸水를 강약으로만 보고 壬 겁재를 쓴다 — 성정에서 「火有水濟」라 할 뿐이다.',
    },
    caveats: [],
  },
  {
    id: 'qlmg-ma-eulyu',
    pillars: { year: '乙酉', month: '丁亥', day: '己丑', hour: '甲子' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷篇 — 己见亥子丑。病于水盛。助成寒湿。妙有丁火煦融……则驱寒有力',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '亥子丑 물에 한습이 병 — 丁火가 데우고 乙木이 丁을 돕는다.',
    },
    caveats: ['억부 외부 사례 `qlmg-ma-unstated-gito` 와 같은 명식이다.'],
  },
  {
    id: 'qlmg-gaek-jeonghae',
    pillars: { year: '丁亥', month: '癸丑', day: '庚子', hour: '丁亥' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator:
        '評斷篇 — 夫寒金喜火。所嫌支全亥子丑……一片寒凉之局……设此等命局。运行东南木火。未始非……由困入亨之一流',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '寒金이 불을 기뻐하나 亥子丑에 癸가 丁을 친다 — 木火 운이 왔다면 풀렸으리라 한다.',
    },
    caveats: [
      '《滴天髓闡微》 女命章의 丁未 癸丑 庚子 丁亥 와 년주만 다르고 문장이 거의 같다 — 韋千里가 任鐵樵의 말을 이었다.',
    ],
  },
  {
    id: 'qlmg-gonmyeong-gisa',
    pillars: { year: '己巳', month: '丁丑', day: '乙丑', hour: '乙酉' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator:
        '評斷篇 — 夫寒弱之木。不宜多水。祇喜木火……若泥於衰则喜帮。而以印为喜见者。失诸毫厘。差以千里矣',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'johu-first',
      remedy: { stems: ['丁'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '寒木은 丁으로 데워야 한다 — 신약이라고 인성(水)을 반기면 틀린다고 억부를 정면으로 물리친다.',
    },
    caveats: ['억부(인성)와 조후가 갈릴 때 조후를 택한다고 명시한 사례다.'],
  },
  {
    id: 'qlmg-byeongsul-eulmi',
    pillars: { year: '丙戌', month: '乙未', day: '丙戌', hour: '辛卯' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator:
        '評斷篇 — 盖六月间火土。燥烈已极。柱中卜[不]见滴水。故富而不贵。今逢子水滋润。调侯为急',
    },
    claim: {
      climate: 'hot-dry',
      verdict: 'johu-first',
      remedy: { stems: null, element: '水' },
      yongsinElement: null,
      saysUrgent: true,
      eokbuReasonAlso: false,
      summary: '6월 화토가 조열한데 물이 한 방울도 없다 — 子 운의 물이 「調候為急」.',
    },
    caveats: ['원국의 용신은 「傷用財」라 따로 말하고, 조후는 운에서 급하다고 한다.'],
  },
  {
    id: 'qlmg-sinhae-gyeongja',
    pillars: { year: '辛亥', month: '庚子', day: '庚辰', hour: '丙戌' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator:
        '評斷篇 — 时值冬令。水旺金强。嫌其过寒。所幸时上丙火透天……调侯亦关紧要。故兼取七煞为相',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '신강이라 상관(水)으로 설하는 것이 격이고, 丙 칠살은 조후로 「겸해서」 쓴다.',
    },
    caveats: [],
  },
  {
    id: 'qlmg-musul-muo',
    pillars: { year: '戊戌', month: '戊午', day: '丁卯', hour: '丙午' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷篇 — 本命以建禄用伤取格……火土伤官。见官本忌。乃调候为争[急]。故反吉也',
    },
    claim: {
      climate: 'hot-dry',
      verdict: 'johu-auxiliary',
      remedy: { stems: null, element: '水' },
      yongsinElement: '土',
      saysUrgent: true,
      eokbuReasonAlso: false,
      summary:
        '신강 丁火는 상관 戊로 설하는 것이 용신 — 물(관)은 꺼리는데 조후가 급해 운에서 오히려 길하다.',
    },
    caveats: ['「調候為爭」은 「調候為急」의 오기로 읽었다.'],
  },
  {
    id: 'qlmg-muja-eulchuk',
    pillars: { year: '戊子', month: '乙丑', day: '辛丑', hour: '壬辰' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷篇 — 辛诞寒冬。叠逢重土盛水。既患寒湿。又兼柔弱',
    },
    claim: {
      climate: 'cold-wet',
      verdict: 'climate-diagnosis',
      remedy: { stems: null, element: '火' },
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '한습과 신약을 함께 병으로 들고 東南 운을 기뻐한다 — 용신은 말하지 않는다.',
    },
    caveats: [],
  },
  {
    id: 'qlmg-gabo-jeongchuk',
    pillars: { year: '甲午', month: '丁丑', day: '辛酉', hour: '甲午' },
    lineage: 'republican-chinese',
    source: {
      ...QLMG,
      locator: '評斷篇 — 财杀两强……第日主较弱。不堪任财任杀……然支中土金重重。可以帮身',
    },
    claim: {
      climate: null,
      verdict: 'not-invoked',
      remedy: null,
      yongsinElement: null,
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary: '丑월 辛金을 재살 대 일간의 강약으로만 보고 土金 운을 반긴다.',
    },
    caveats: ['용신 오행을 하나로 못박지 않고 土金을 함께 든다.'],
  },
  // ─── 《子平眞詮評註》 徐樂吾 ───────────────────────────────────────────
  {
    id: 'zpzq-gyeongin-muja',
    pillars: { year: '庚寅', month: '戊子', day: '甲寅', hour: '丙寅' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator: '徐注 — 寒木向阳，惟有见丙丁食伤则贵……其时上丙火清纯，以泄身调候为用',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: true,
      summary: '겨울 甲木 — 재관은 쓸모없고 시의 丙이 설기와 조후를 함께 한다.',
    },
    caveats: [],
  },
  {
    id: 'zpzq-byeongja-sinchuk',
    pillars: { year: '丙子', month: '辛丑', day: '戊子', hour: '癸丑' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator:
        '徐注 — 冬土亦须调候，盖土金伤官生于冬令，必须佩印也……然冬土寒泎，非丙火照暖，则用不显……亦调和气候为急也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: true,
      eokbuReasonAlso: true,
      summary: '겨울 戊土에 丙 인성이 조후와 佩印을 함께 한다 — 「調和氣候為急」.',
    },
    caveats: ['저자가 《命鑑》에서 이 명식을 倒冲格으로 잘못 보았다고 스스로 고쳤다.'],
  },
  {
    id: 'zpzq-gapsin-byeongja',
    pillars: { year: '甲申', month: '丙子', day: '庚辰', hour: '甲申' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator: '徐注 — 身旺以伤官泄秀为用，特丙火调候，为配合所不可缺，否则，清寒之造也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-auxiliary',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '신왕이라 상관(水)으로 설하는 것이 용신 — 丙은 조후로 「빠질 수 없는 배합」이다.',
    },
    caveats: ['《滴天髓闡微》 寒暖편의 甲申 丙子 庚辰 戊寅 과 시 하나만 다르다.'],
  },
  {
    id: 'zpzq-gyeongjin-imo',
    pillars: { year: '庚辰', month: '壬午', day: '甲辰', hour: '丁卯' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator: '徐注 — 此亦调候之意也……夏木丁火吐秀，日辰时卯，身不为弱，然喜壬水润泽',
    },
    claim: {
      climate: 'hot',
      verdict: 'johu-first',
      remedy: { stems: ['壬'], element: '水' },
      yongsinElement: '水',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '여름 甲木이 약하지 않은데도 壬 인성을 반긴다 — 「佩印」을 강약이 아니라 조후로 설명한다.',
    },
    caveats: ['「身不為弱」인데 인성을 쓰니 억부와 어긋나는 조후 우선이다.'],
  },
  {
    id: 'zpzq-gapja-byeongja',
    pillars: { year: '甲子', month: '丙子', day: '癸亥', hour: '乙卯' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator:
        '徐注 — 若为水木伤官，见财最美，盖财即火也。总之以调候为急。如甲子、丙子、癸亥、乙卯，水木假伤官用财',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: true,
      eokbuReasonAlso: false,
      summary: '겨울 癸水 상관이 재(丙)를 쓴다 — 재가 곧 불이라 「以調候為急」.',
    },
    caveats: [],
  },
  {
    id: 'zpzq-gimi-eulhae',
    pillars: { year: '己未', month: '乙亥', day: '癸亥', hour: '丙辰' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator: '徐注 — 又己未、乙亥、癸亥、丙辰……用丙火之财，亦调候之意也',
    },
    claim: {
      climate: 'cold',
      verdict: 'johu-first',
      remedy: { stems: ['丙'], element: '火' },
      yongsinElement: '火',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary: '겨울 癸水가 丙 재성을 쓴다 — 조후의 뜻이다.',
    },
    caveats: [],
  },
  {
    id: 'zpzq-musul-jeongsa',
    pillars: { year: '戊戌', month: '丁巳', day: '甲寅', hour: '己巳' },
    lineage: 'republican-chinese',
    source: {
      ...ZPZQ,
      locator:
        '徐注 — 夏木用财，如戊戌、丁巳、甲寅、己巳，火旺木焚，而四柱无印，不得已取土泄火之气',
    },
    claim: {
      climate: 'hot',
      verdict: 'johu-declined',
      remedy: { stems: null, element: '水' },
      yongsinElement: '土',
      saysUrgent: false,
      eokbuReasonAlso: false,
      summary:
        '火旺木焚인데 원국에 물(인성)이 없어 「부득이」 土로 불을 설한다 — 인성 운에도 土가 막아 나쁘다.',
    },
    caveats: ['조후 글자가 **원국에 없어서** 못 쓴 사례다 — 뿌리 없음과 다른 까닭이다.'],
  },
];
