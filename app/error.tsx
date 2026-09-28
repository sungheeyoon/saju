'use client';

import { ErrorScreen } from './error-screen';

/**
 * 화면 한 칸이 던졌을 때 — 루트 레이아웃(머리 줄)은 그대로 서고 그 아래만 이 화면으로 바뀐다.
 *
 * `error` prop 은 꺼내지 않는다 — 까닭은 `ErrorScreen` 머리말. 기록은 서버에 있다.
 */
export default function RouteError({ retry }: { retry: () => void }) {
  return <ErrorScreen retry={retry} />;
}
