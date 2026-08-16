/**
 * 외부에서 종격이라고 명시한 명조 — 실험 규칙 v1 을 채점하기 위한 자료.
 *
 * `FOLLOWING_PATTERN_POLICY.eokbuOverride` 를 켜려면 이 대조를 먼저 통과해야
 * 한다는 것이 애초의 게이트였다. **지금은 통과하지 못한다.** 그 사실을 지우지
 * 않고 행렬로 고정한다 — 문턱을 만지면 어느 칸이 움직이는지 여기서 보인다.
 *
 * 출처는 둘이다 — `fatew.com` 의 從殺格·從財格 쪽(현대 정리)과 《적천수천미》의
 * 임철초 주석(고전). 계통이 다른 자료를 섞어야 한쪽에만 맞는 규칙을 만들지 않는다.
 *
 * 《적천수천미》 명례 둘은 **이 규칙의 구조적 한계**를 드러낸다. 從强(일간 편이
 * 극왕해 그쪽을 따름)은 지배 세력이 곧 일간 편이라, 압도 비율을
 * `지배 ÷ (지배 + 일간편)` 으로 재는 한 0.5 를 넘을 수 없다. 문턱을 아무리
 * 낮춰도 從强·從旺 계열은 잡히지 않는다 — 분모를 다시 설계해야 하는 문제다.
 *
 * 스무 건 모두 오호둔·오자둔에 맞는 실재 가능한 명조다(테스트가 다시 센다).
 * 억부 데이터셋에서 다섯 중 셋이 지어낸 조합이었던 것과 대비된다.
 */

export type FollowingClaim =
  /** 저자가 종격이라 판정 */
  | 'following'
  /** 저자가 가종이라 판정 */
  | 'pseudo-following'
  /** 저자가 종격이 아니라고 판정 */
  | 'not-following';

export type FollowingExternalCase = {
  id: string;
  pillars: { year: string; month: string; day: string; hour: string };
  source: { title: string; url: string; locator: string; retrievedAt: '2026-08-16' };
  /** 저자의 판정과 그 원문 표기 */
  claim: { verdict: FollowingClaim; label: string };
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

export const FOLLOWING_EXTERNAL_CASES: readonly FollowingExternalCase[] = [
  {
    id: 'kill-1',
    pillars: { year: '壬寅', month: '丁未', day: '己卯', hour: '乙亥' },
    source: { ...KILL_SOURCE, locator: '從殺格 例1' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-2',
    pillars: { year: '戊午', month: '己未', day: '癸未', hour: '己未' },
    source: { ...KILL_SOURCE, locator: '從殺格 例2' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-3',
    pillars: { year: '戊辰', month: '戊午', day: '癸丑', hour: '己未' },
    source: { ...KILL_SOURCE, locator: '從殺格 例3' },
    claim: { verdict: 'following', label: '從殺格(貧)' },
  },
  {
    id: 'kill-4',
    pillars: { year: '戊戌', month: '辛酉', day: '乙酉', hour: '乙酉' },
    source: { ...KILL_SOURCE, locator: '從殺格 例4' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-5',
    pillars: { year: '庚戌', month: '己丑', day: '乙巳', hour: '乙酉' },
    source: { ...KILL_SOURCE, locator: '從殺格 例5' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-6',
    pillars: { year: '辛亥', month: '丙申', day: '丙申', hour: '壬辰' },
    source: { ...KILL_SOURCE, locator: '從殺格 例6' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-7',
    pillars: { year: '辛亥', month: '己亥', day: '丁丑', hour: '庚子' },
    source: { ...KILL_SOURCE, locator: '從殺格 例7' },
    claim: { verdict: 'following', label: '從殺格' },
  },
  {
    id: 'kill-8-broken',
    pillars: { year: '辛酉', month: '丁酉', day: '乙卯', hour: '乙酉' },
    source: { ...KILL_SOURCE, locator: '從殺格 例8' },
    claim: { verdict: 'not-following', label: '格破' },
  },
  {
    id: 'kill-9-similar',
    pillars: { year: '戊午', month: '丙辰', day: '庚寅', hour: '丙戌' },
    source: { ...KILL_SOURCE, locator: '從殺格 例9' },
    claim: { verdict: 'not-following', label: '유사격' },
  },
  {
    id: 'money-1',
    pillars: { year: '壬寅', month: '壬寅', day: '辛卯', hour: '壬辰' },
    source: { ...MONEY_SOURCE, locator: '從財格 例1' },
    claim: { verdict: 'following', label: '從財格' },
  },
  {
    id: 'money-2',
    pillars: { year: '庚戌', month: '乙酉', day: '丙申', hour: '己丑' },
    source: { ...MONEY_SOURCE, locator: '從財格 例2' },
    claim: { verdict: 'following', label: '格破再成(真從財格)' },
  },
  {
    id: 'money-3',
    pillars: { year: '丙戌', month: '辛丑', day: '甲辰', hour: '辛未' },
    source: { ...MONEY_SOURCE, locator: '從財格 例3' },
    claim: { verdict: 'pseudo-following', label: '假從財格' },
  },
  {
    id: 'money-4',
    pillars: { year: '壬寅', month: '乙巳', day: '壬午', hour: '丙午' },
    source: { ...MONEY_SOURCE, locator: '從財格 例4' },
    claim: { verdict: 'pseudo-following', label: '假從財格' },
  },
  {
    id: 'money-5-excluded',
    pillars: { year: '戊午', month: '丙辰', day: '甲辰', hour: '壬申' },
    source: { ...MONEY_SOURCE, locator: '從財格 例5' },
    claim: { verdict: 'not-following', label: '不入從財格' },
  },
  {
    id: 'money-6',
    pillars: { year: '乙亥', month: '己丑', day: '戊子', hour: '壬子' },
    source: { ...MONEY_SOURCE, locator: '從財格 例6' },
    claim: { verdict: 'following', label: '從財格' },
  },
  {
    id: 'money-7',
    pillars: { year: '丁卯', month: '乙巳', day: '壬午', hour: '丙午' },
    source: { ...MONEY_SOURCE, locator: '從財格 例7' },
    claim: { verdict: 'following', label: '從財格' },
  },
  {
    id: 'money-8',
    pillars: { year: '癸亥', month: '乙卯', day: '辛卯', hour: '乙未' },
    source: { ...MONEY_SOURCE, locator: '從財格 例8' },
    claim: { verdict: 'following', label: '從財格' },
  },
  {
    id: 'money-9-excluded',
    pillars: { year: '癸丑', month: '辛酉', day: '丁巳', hour: '辛亥' },
    source: { ...MONEY_SOURCE, locator: '從財格 例9' },
    claim: { verdict: 'not-following', label: '不入從財格' },
  },
  {
    id: 'dtsm-following-strong',
    pillars: { year: '丙寅', month: '甲午', day: '丙午', hour: '癸巳' },
    source: {
      title: '《滴天髓闡微》 體用 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/13',
      locator: '體用 — 烈火焚木，旺之極矣 … 只得從其強勢',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從强(旺之極)' },
  },
  {
    id: 'dtsm-following-weak',
    pillars: { year: '戊寅', month: '庚申', day: '丙申', hour: '丙申' },
    source: {
      title: '《滴天髓闡微》 體用 — 任鐵樵 주석',
      url: 'https://shuyuan.zhiming.life/read/%E6%BB%B4%E5%A4%A9%E9%AB%93%E9%98%90%E5%BE%AE/13',
      locator: '體用 — 丙火之根已拔 … 只得從其弱勢，順財之性',
      retrievedAt: '2026-08-16',
    },
    claim: { verdict: 'following', label: '從弱(順財)' },
  },
] as const;
