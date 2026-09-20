/**
 * 키 몇을 뺀 사본 — **뺀 것이 이름으로 남는다.**
 *
 * 구조 분해로 버리면(`const { saeun: _saeun, ...rest }`) 쓰지 않는 이름이 남고, 무엇을 왜
 * 뺐는지는 그 이름이 말해 주지 않는다. 여기서는 부르는 자리에 뺀 키가 그대로 적힌다.
 *
 * **컷 두 걸음이 같은 것을 쓴다.** 자료를 짓는 자리(`index.ts`)와 모델에 넘기려고 자르는
 * 자리(`redacted.ts`)에 글자까지 같은 사본이 두 벌 있었다. 둘이 갈리면 한쪽만 거친 값이
 * 생기는데, 그 차이는 자료를 눈으로 읽어서는 안 보인다.
 *
 * 인연 궁합 컷(`shared.ts`)은 이것을 안 쓴다 — 그쪽은 **빼는 것이 아니라 고른다**(ADR 0067).
 */
export function without<T extends object, K extends keyof T>(
  value: T,
  ...keys: readonly K[]
): Omit<T, K> {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of keys) delete copy[key as string];
  return copy as Omit<T, K>;
}
