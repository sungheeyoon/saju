/**
 * 외부에서 종격이라고 명시한 명조 — 실험 규칙 v1 을 채점하기 위한 자료.
 *
 * `FOLLOWING_PATTERN_POLICY.eokbuOverride` 를 켜려면 이 대조를 먼저 통과해야
 * 한다는 것이 애초의 게이트였다. **지금은 통과하지 못한다.** 그 사실을 지우지
 * 않고 행렬로 고정한다 — 문턱을 만지면 어느 칸이 움직이는지 여기서 보인다.
 *
 * 계통은 둘이다 — `fatew.com` 의 從殺格·從財格 쪽(현대 중화권 정리) 열여덟과
 * 《적천수천미》 임철초 주석(청대 고전) 열일곱. 계통이 다른 자료를 섞어야
 * 한쪽에만 맞는 규칙을 만들지 않는다.
 *
 * 고전 쪽은 세 장에서 나눠 왔고 각각 다른 것을 시험한다.
 * - 體用 둘(`dtsm-following-*`): 극단으로 왕한 것과 극단으로 약한 것의 짝
 * - 從象 열(`dtsm-congxiang-*`): 저자가 真從이라 못박은 것. 從財·從殺뿐 아니라
 *   從旺·從强·從氣·從勢까지 있어 **안으로 종하는 쪽**을 채운다. fatew 열여덟이
 *   전부 밖으로 종하는 계열이라 이쪽이 비어 있었다.
 * - 假從 다섯(`dtsm-jiacong-*`): 저자가 假從이라 못박은 것. 정의상 비겁·인성이
 *   남아 있어 자당 몫이 밖으로 종하는 문턱보다 높게 나온다.
 *
 * 서른다섯 중 하나(`dtsm-jiacong-4-misprint`)는 실재할 수 없는 명조다 —
 * 六丁년에 丙寅월은 없다. 고전 판본의 오배로, **고전 자료라고 이 검사에서
 * 면제되지 않는다**는 증거라 지우지 않고 표시만 한다. 나머지 서른넷은 오호둔·
 * 오자둔에 맞고, 테스트가 손으로 적은 값을 믿지 않고 다시 센다.
 */

export type FollowingClaim =
  /** 저자가 종격이라 판정 */
  | 'following'
  /** 저자가 가종이라 판정 */
  | 'pseudo-following'
  /** 저자가 종격이 아니라고 판정 */
  | 'not-following';

/** 자료의 계통 — 억부 데이터셋의 `EokbuLineage` 와 같은 이유로 손으로 적는다. */
export type FollowingLineage =
  /** 현대 중화권 격국 정리 사이트 */
  | 'modern-chinese'
  /** 청대 고전 주석 (《적천수천미》 임철초) */
  | 'classical-chinese'
  /** 민국 실전 명조 (《천리명고》 위천리) — 억부 자료와 같은 계통 이름을 쓴다 */
  | 'republican-chinese';

export type FollowingExternalCase = {
  id: string;
  pillars: { year: string; month: string; day: string; hour: string };
  lineage: FollowingLineage;
  source: { title: string; url: string; locator: string; retrievedAt: '2026-08-16' };
  /** 저자의 판정과 그 원문 표기 */
  claim: { verdict: FollowingClaim; label: string };
  /**
   * 네 기둥이 오호둔·오자둔과 맞는지. 억부 데이터셋과 같은 뜻이고 같은 방식으로
   * 다시 센다(`following.external.test.ts`). 고전이라고 예외가 아니다 —
   * 판본이 옮겨지며 글자가 어긋난 자리가 실제로 하나 있다.
   */
  chartConstruction: 'consistent' | 'unrealizable';
  caveats?: readonly string[];
};

const KILL_SOURCE = {
  title: '八字特別格 — 從殺格',
  url: 'https://fatew.com/mode/kill.htm',
  retrievedAt: '2026-08-16',
} as const;

const MONEY_SOURCE = {
  title: '八字特別格 — 從財格',
  url: 'https://fatew.com/mode/money.htm',
  retrievedAt: '2026-08-16',
} as const;

/**
 * 《천리명고》 평단편 — **셋째 계통.**
 *
 * 앞의 둘과 성질이 다르다. 현대 정리 사이트는 從財·從殺만 골라 실은 예시집이고 고전
 * 주석은 저자가 진종·가종을 논증하는 자리인데, 이쪽은 **실존 인물의 명조를 놓고 종격이냐
 * 아니냐를 다투는 실전 기록**이다. 그래서 「종격이 아니다」가 셋 나온다 — 우리 자료에 그
 * 방향이 넷뿐이었다.
 *
 * 그중 하나(`qlmg-xu-shiying`)는 저자가 **당대의 통설을 반박하는** 자리다:
 * 「識者咸以從殺格推之，**不知**年頭癸水進氣，泄金生木，乙有根原，**不能從殺**」. 계통이
 * 갈리는 것을 자료가 스스로 들고 있는 셈이라, 우리가 그 반대편에 서는 것은 오검출 하나가
 * 아니라 **계통 차이**로도 읽어야 한다.
 *
 * 시(時) 하나만 다른 짝도 있다(`qlmg-yan-father` · `qlmg-abandon-hurt`). 저자가 한 문단에서
 * 「相差一時인데 壽夭가 이렇게 다르다」며 나란히 든 것이라, **같은 세 기둥에서 시주 두 글자가
 * 종격 여부를 뒤집는가**를 그대로 잰다.
 */
const QIANLI_SOURCE = {
  title: '千里命稿 評斷篇 (民國 韋千里)',
  url: 'https://shuyuan.zhiming.life/read/%E5%8D%83%E9%87%8C%E5%91%BD%E7%A8%BF/15',
  retrievedAt: '2026-08-16',
} as const;

export const FOLLOWING_EXTERNAL_CASES: readonly FollowingExternalCase[] = [
  {
    id: 'kill-1',
    pillars: { year: '壬寅', month: '丁未', day: '己卯', hour: '乙亥' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例1' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-2',
    pillars: { year: '戊午', month: '己未', day: '癸未', hour: '己未' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例2' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-3',
    pillars: { year: '戊辰', month: '戊午', day: '癸丑', hour: '己未' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例3' },
    claim: { verdict: 'following', label: '從殺格(貧)' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-4',
    pillars: { year: '戊戌', month: '辛酉', day: '乙酉', hour: '乙酉' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例4' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-5',
    pillars: { year: '庚戌', month: '己丑', day: '乙巳', hour: '乙酉' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例5' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-6',
    pillars: { year: '辛亥', month: '丙申', day: '丙申', hour: '壬辰' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例6' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-7',
    pillars: { year: '辛亥', month: '己亥', day: '丁丑', hour: '庚子' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例7' },
    claim: { verdict: 'following', label: '從殺格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-8-broken',
    pillars: { year: '辛酉', month: '丁酉', day: '乙卯', hour: '乙酉' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例8' },
    claim: { verdict: 'not-following', label: '格破' },
    chartConstruction: 'consistent',
  },
  {
    id: 'kill-9-similar',
    pillars: { year: '戊午', month: '丙辰', day: '庚寅', hour: '丙戌' },
    lineage: 'modern-chinese',
    source: { ...KILL_SOURCE, locator: '從殺格 例9' },
    claim: { verdict: 'not-following', label: '유사격' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-1',
    pillars: { year: '壬寅', month: '壬寅', day: '辛卯', hour: '壬辰' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例1' },
    claim: { verdict: 'following', label: '從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-2',
    pillars: { year: '庚戌', month: '乙酉', day: '丙申', hour: '己丑' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例2' },
    claim: { verdict: 'following', label: '格破再成(真從財格)' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-3',
    pillars: { year: '丙戌', month: '辛丑', day: '甲辰', hour: '辛未' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例3' },
    claim: { verdict: 'pseudo-following', label: '假從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-4',
    pillars: { year: '壬寅', month: '乙巳', day: '壬午', hour: '丙午' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例4' },
    claim: { verdict: 'pseudo-following', label: '假從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-5-excluded',
    pillars: { year: '戊午', month: '丙辰', day: '甲辰', hour: '壬申' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例5' },
    claim: { verdict: 'not-following', label: '不入從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-6',
    pillars: { year: '乙亥', month: '己丑', day: '戊子', hour: '壬子' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例6' },
    claim: { verdict: 'following', label: '從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-7',
    pillars: { year: '丁卯', month: '乙巳', day: '壬午', hour: '丙午' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例7' },
    claim: { verdict: 'following', label: '從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-8',
    pillars: { year: '癸亥', month: '乙卯', day: '辛卯', hour: '乙未' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例8' },
    claim: { verdict: 'following', label: '從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'money-9-excluded',
    pillars: { year: '癸丑', month: '辛酉', day: '丁巳', hour: '辛亥' },
    lineage: 'modern-chinese',
    source: { ...MONEY_SOURCE, locator: '從財格 例9' },
    claim: { verdict: 'not-following', label: '不入從財格' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-following-strong',
    pillars: { year: '丙寅', month: '甲午', day: '丙午', hour: '癸巳' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 體用 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/13',
      locator: '體用 — 烈火焚木，旺之極矣 … 只得從其強勢',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從强(旺之極)' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-following-weak',
    pillars: { year: '戊寅', month: '庚申', day: '丙申', hour: '丙申' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 體用 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/13',
      locator: '體用 — 丙火之根已拔 … 只得從其弱勢，順財之性',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從弱(順財)' },
    chartConstruction: 'consistent',
  },
  // ── 《滴天髓闡微》 從象 편 — 임철초가 真從이라 못박은 열 건 ──────────────────
  // 이 열 건이 이 데이터셋의 축이다. 앞의 fatew 열여덟은 從財·從殺(밖으로 종)에
  // 몰려 있는데, 從象 편은 從旺·從强·從氣·從勢까지 함께 실어 **안으로 종하는 쪽**을
  // 채운다. 축을 자당 몫 하나로 다시 세운 판단이 여기서 채점된다.
  {
    id: 'dtsm-congxiang-1',
    pillars: { year: '戊戌', month: '丙辰', day: '乙未', hour: '丙戌' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 四柱皆財，其勢必從',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從財' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-2',
    pillars: { year: '壬寅', month: '壬寅', day: '庚寅', hour: '戊寅' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 四支皆寅 … 生扶嫩木而從財也',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從財' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-3',
    pillars: { year: '丙寅', month: '庚寅', day: '壬午', hour: '乙巳' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 一點庚金臨絕，丙火力能鍛之，從財格真',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從財格真' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-4',
    pillars: { year: '丁卯', month: '壬寅', day: '庚午', hour: '丙戌' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 支全火局，財生殺旺 … 皆成殺黨，從象斯真',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從殺(從象斯真)' },
    chartConstruction: 'consistent',
    caveats: ['저자는 丁壬 합화 木이 火勢를 따른다고 보는데 이 엔진은 화(化)를 판정하지 않는다.'],
  },
  {
    id: 'dtsm-congxiang-5',
    pillars: { year: '辛巳', month: '辛丑', day: '乙酉', hour: '乙酉' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 支全金局，干透兩辛，從殺斯真',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從殺斯真' },
    chartConstruction: 'consistent',
    caveats: ['巳酉丑 삼합 금국을 근거로 든다 — 이 엔진의 오행 점유율은 합국을 세지 않는다.'],
  },
  {
    id: 'dtsm-congxiang-6-wang',
    pillars: { year: '癸卯', month: '乙卯', day: '甲寅', hour: '乙亥' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 癸之印旺之極矣，從其旺神',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從旺' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-7-qiang',
    pillars: { year: '丙午', month: '甲午', day: '丙午', hour: '甲午' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 四柱皆刃，天干並透甲丙，強旺極矣，可順而不可逆也',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從强' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-8-qi',
    pillars: { year: '癸酉', month: '癸亥', day: '庚申', hour: '丁亥' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 局中氣勢金水，亦是從金水而論，丁反為病',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從氣(金水)' },
    chartConstruction: 'consistent',
    caveats: [
      '從氣는 일간 편·이당의 구분이 아니라 두 오행에 몰린 기세를 따르는 것이라, 자당 몫 하나를 축으로 삼는 이 규칙이 겨눈 형태가 아니다.',
    ],
  },
  {
    id: 'dtsm-congxiang-9-shi',
    pillars: { year: '丙戌', month: '壬辰', day: '癸巳', hour: '甲寅' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 財官傷三者並旺 … 惟官星當令，須從官星之勢',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從勢(從官)' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-congxiang-10',
    pillars: { year: '癸酉', month: '乙丑', day: '丙申', hour: '丙申' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 從象 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/46',
      locator: '從象 — 衰絕無氣，酉丑拱金 … 從化金水之勢',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從化金水' },
    chartConstruction: 'consistent',
    caveats: ['酉丑 공협으로 金을 세는 논리다 — 이 엔진은 드러난 여덟 글자만 센다.'],
  },
  // ── 《滴天髓闡微》 假從 편 — 저자가 假從이라 못박은 다섯 건 ──────────────────
  // 假從은 정의상 비겁·인성이 남아 있는 형태라(「局中雖有劫印，亦自顧不暇」)
  // 자당 몫이 밖으로 종하는 문턱(≤30%)보다 높게 나온다. 이 다섯은 규칙이
  // 놓치는 자리를 통째로 보여 준다.
  {
    id: 'dtsm-jiacong-1',
    pillars: { year: '癸巳', month: '乙卯', day: '己亥', hour: '癸酉' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 假從 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/48',
      locator: '假從 — 格成棄命從殺 … 不作真從而論',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'pseudo-following', label: '假從殺' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-jiacong-2',
    pillars: { year: '丁丑', month: '壬寅', day: '丙申', hour: '壬辰' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 假從 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/48',
      locator: '假從 — 嫩木逢金，緊貼相沖，運根拔盡 … 格成從殺，用財更妙',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'pseudo-following', label: '假從殺' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-jiacong-3',
    pillars: { year: '乙卯', month: '己卯', day: '戊辰', hour: '癸亥' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 假從 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/48',
      locator: '假從 — 四柱絕無金氣 … 格取從官，非身衰論也',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'pseudo-following', label: '假從官' },
    chartConstruction: 'consistent',
  },
  {
    id: 'dtsm-jiacong-4-misprint',
    pillars: { year: '丁卯', month: '丙寅', day: '辛亥', hour: '庚寅' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 假從 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/48',
      locator: '假從 — 天干丙丁庚辛陰陽相克 … 日時寅亥化木，格取從殺',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'pseudo-following', label: '假從殺' },
    chartConstruction: 'unrealizable',
    caveats: [
      '六丁년에 丙寅월은 없다(오호둔으로 壬寅) — 판본의 오배로 알려진 자리이고 바른 월주는 壬寅이다.',
      '적어 둔 그대로 싣고 실재 불가로 표시한다. 고전 자료라고 이 검사에서 면제되지 않는다는 증거라 지우지 않는다.',
    ],
  },
  {
    id: 'dtsm-jiacong-5',
    pillars: { year: '癸亥', month: '乙卯', day: '己未', hour: '丁卯' },
    lineage: 'classical-chinese',
    source: {
      title: '《滴天髓闡微》 假從 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/48',
      locator: '假從 — 春木當令會局 … 不得不從殺矣',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'pseudo-following', label: '假從殺' },
    chartConstruction: 'consistent',
  },
  {
    id: 'qlmg-xu-shiying',
    pillars: { year: '癸酉', month: '辛酉', day: '乙丑', hour: '辛巳' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '許世英 命造' },
    claim: { verdict: 'not-following', label: '不能從殺 (身弱用印)' },
    chartConstruction: 'consistent',
    caveats: [
      '저자가 당대 통설을 반박하는 자리다 — 「識者咸以從殺格推之」라고 적고 그것을 뒤집는다',
      '우리 엔진은 통설 쪽에 선다(가종). 오검출로 세되 계통 차이라는 것을 함께 읽어야 한다',
    ],
  },
  {
    id: 'qlmg-qian-weng',
    pillars: { year: '壬子', month: '戊申', day: '戊辰', hour: '辛酉' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '錢翁 命造' },
    claim: { verdict: 'not-following', label: '從財則又不真 (身不任財)' },
    chartConstruction: 'consistent',
    caveats: ['월간 戊土 비견이 남아 종재가 참되지 못하다는 판정이다'],
  },
  {
    id: 'qlmg-xuantong',
    pillars: { year: '丙午', month: '庚寅', day: '壬午', hour: '丙午' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '宣統帝 命造' },
    claim: { verdict: 'following', label: '棄命而從之 (滿盤是財)' },
    chartConstruction: 'consistent',
  },
  {
    id: 'qlmg-yan-father',
    pillars: { year: '辛酉', month: '戊戌', day: '丁未', hour: '壬寅' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '閻錫山 封翁 命造' },
    claim: { verdict: 'not-following', label: '傷官格 (生化不息)' },
    chartConstruction: 'consistent',
    caveats: ['아래 `qlmg-abandon-hurt` 와 세 기둥이 같고 시주만 다르다 — 저자가 나란히 든 짝이다'],
  },
  {
    id: 'qlmg-abandon-hurt',
    pillars: { year: '辛酉', month: '戊戌', day: '丁未', hour: '辛丑' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '相差一時 命造 (棄命從傷)' },
    claim: { verdict: 'following', label: '棄命從傷' },
    chartConstruction: 'consistent',
    caveats: [
      '출처에 월주가 「戊戍」로 적혀 있다 — 戍는 戌의 전사 오류라 戌로 읽었다',
      '위 `qlmg-yan-father` 와 시주 둘 글자만 다르다',
    ],
  },
  {
    id: 'qlmg-yanfeng-2nd',
    pillars: { year: '乙亥', month: '己卯', day: '壬午', hour: '丙午' },
    lineage: 'republican-chinese',
    source: { ...QIANLI_SOURCE, locator: '雁峰 三胞胎 中 次男' },
    claim: { verdict: 'following', label: '應作從財格論' },
    chartConstruction: 'consistent',
  },
] as const;
