/**
 * 외부에서 종격이라고 명시한 명조 — 실험 규칙 v1 을 채점하기 위한 자료.
 *
 * `FOLLOWING_PATTERN_POLICY.eokbuOverride` 를 켜려면 이 대조를 먼저 통과해야
 * 한다는 것이 애초의 게이트였다. **지금은 통과하지 못한다.** 그 사실을 지우지
 * 않고 행렬로 고정한다 — 문턱을 만지면 어느 칸이 움직이는지 여기서 보인다.
 *
 * 출처는 한 곳(`fatew.com`)의 두 쪽이다. 서로 다른 두 출처를 대는 것이 더
 * 좋지만, 성립 조건을 조목별로 적고 명조마다 판정을 붙인 자료가 드물어 우선
 * 이것부터 고정한다. **한 출처라는 사실도 결과와 함께 읽어야 한다.**
 *
 * 열여덟 건 모두 오호둔·오자둔에 맞는 실재 가능한 명조다(테스트가 다시 센다).
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
] as const;
