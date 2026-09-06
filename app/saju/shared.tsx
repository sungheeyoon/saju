import {
  BRANCH_INFO,
  STEM_INFO,
  type Relation,
} from '@/src/lib/saju';


/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
export const PILLAR_COLUMNS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' },
] as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;


export function HorizontalScrollHint() {
  return (
    <p className="mt-2 text-right text-xs text-muted sm:hidden" aria-hidden="true">
      ← 좌우로 넘겨 전체 보기 →
    </p>
  );
}


/**
 * 원국의 관계 — 여덟 글자 안에서 성립하는 형충회합.
 *
 * 길흉을 말하지 않는다. 무엇이 무엇과 어떤 관계인지, 어느 자리에서인지만 적는다.
 * 붙어 있어야 성립한다고 보는 학파를 위해 떨어진 것은 거리를 밝히고, 세 글자
 * 구조에서 둘만 담은 것은 그렇다고 밝힌다. 걸러내는 것은 읽는 사람의 몫이다.
 */
/**
 * 한자 글자 뒤의 조사 — **읽는 소리의 받침을 따른다.**
 *
 * `未이 丑를 형` 이라고 적고 있었다. L3 계약이 문장 틀에서 슬롯 뒤 조사를 아예
 * 금지한 이유가 이것인데(`VARIABLE_PARTICLES`), 화면은 그 검사를 받지 않아 그대로
 * 새어 있었다. 삼형마다 두 글자 행이 셋씩 붙으면서 눈에 띄었다.
 *
 * 글자는 한자로 보이지만 읽는 사람은 '미'·'축' 으로 읽으므로 받침은 그 소리에서
 * 나온다. 계약이 막은 것은 **틀이 미리 고르는 것**이지, 값을 아는 쪽이 고르는 것은
 * 아니다 — 조립기가 이름을 이어 붙일 때 쓰는 판단과 같다(`joinNames`).
 */
const hasFinalConsonant = (char: string): boolean => {
  /*
    지지만 읽고 있었다. 천간을 그대로 넘기면 한자에는 받침이 없으므로 **언제나
    「가」·「를」** 이 나온다 — 壬(임)·辛(신)처럼 받침 있는 글자에서 틀린다. 조후가
    권한 글자를 문장에 넣기 시작하면서 걸렸다.
  */
  const ko =
    BRANCH_INFO[char as keyof typeof BRANCH_INFO]?.ko ??
    STEM_INFO[char as keyof typeof STEM_INFO]?.ko ??
    char;
  const code = ko.charCodeAt(ko.length - 1) - 0xac00;

  return code >= 0 && code <= 11171 && code % 28 !== 0;
};


export const subjectParticle = (char: string) => (hasFinalConsonant(char) ? '이' : '가');

export const objectParticle = (char: string) => (hasFinalConsonant(char) ? '을' : '를');


/**
 * 관계 하나를 가리키는 키.
 *
 * 이름만으로는 모자란다. 같은 관계가 **자리만 달리해** 여러 번 나오고
 * (원국에 辰이 둘이면 월운 卯와 묘진해가 둘 성립한다), 계산판이 섞이면
 * 자리 이름마저 겹친다(원국 년주와 세운 년주가 둘 다 'year'). 글자가 아니라
 * 계산판+자리가 관계의 정체성이다.
 */
export function relationKey(relation: Relation): string {
  return `${relation.kind}:${relation.ko}:${relation.participants
    .map((p) => `${p.chartId}.${p.position}`)
    .join('-')}`;
}
