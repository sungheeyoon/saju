import { Redirect, useLocalSearchParams } from 'expo-router';

import { CompatResultStep } from '@/compat/result-step';

/**
 * **보관함에서 연 궁합풀이** — 웹의 `/me/readings/compat`. 결과는 `/me/compat` 과 같은 부품이고 `<` 만 들어온 칩의 보관함으로 간다.
 * 두 사람이 안 실렸으면 고르는 자리로 보낸다.
 */
export default function ShelfCompatScreen() {
  const { a, b, kind } = useLocalSearchParams<{ a?: string; b?: string; kind?: string }>();
  if (a === undefined || b === undefined) return <Redirect href={'/me/compat' as never} />;
  return <CompatResultStep a={a} b={b} back={`/me/readings${kind === undefined ? '' : `?kind=${encodeURIComponent(kind)}`}`} />;
}
