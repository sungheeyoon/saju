/**
 * 카드 한 장의 겉모양.
 *
 * `saju-calculator` 에 있던 것을 따로 뺐다. 새로 붙은 칸(`evidence-panel`)이 이것을
 * 쓰는데 그 칸을 부르는 것도 `saju-calculator` 라, 두 파일이 서로를 부르는 모양이
 * 됐다. 렌더 안에서만 읽으니 당장 깨지지는 않지만 **부르는 차례가 바뀌면 깨지는
 * 종류**라, 문자열 하나를 옮겨서 그 조건을 없앤다.
 */
export const CARD =
  'rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6';
