import type { Instrumentation } from 'next';

/**
 * 서버가 던진 오류를 운영자에게 알린다 — 무엇을 보내고 무엇을 안 보내는지는 `app/request-error.ts` 가 든다.
 *
 * 오류 문장과 요청(`request` — 주소 · 머리)은 넘기지 않는다. 라우트 파일의 무늬 · 자리 · digest 셋뿐이다.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  const { reportRequestError, digestOf } = await import('./app/request-error');
  await reportRequestError(context.routePath, context.routeType, digestOf(error));
};
