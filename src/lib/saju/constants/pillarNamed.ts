import { type Branch } from './branches';
import { pillarOf, type Pillar } from './sexagenary';
import { type Stem } from './stems';

/**
 * 시험 지원 — 간지 이름('甲子')을 기둥으로 바꾼다. 60갑자가 아니면 던진다.
 *
 * 같은 다섯 줄이 시험 24파일에 27벌 복사돼 있었다(2026-10-01, 슬롭 감사 3). 시험의 준비값을
 * 간지 이름으로 적게 하는 도우미라 **시험만 부른다** — 소스는 사용자 입력을 `pillarOf` 로 받고
 * 없음을 `null` 로 낸다(`docs/agents/code-rules.md` 「실패를 말하는 법」). 그래서 묶음 입구
 * (`./index`)에 싣지 않는다.
 */
export const pillarNamed = (name: string): Pillar => {
  const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
  if (!pillar) throw new Error(`간지가 아니다: ${name}`);
  return pillar;
};
