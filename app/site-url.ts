/**
 * 이 배포가 브라우저에서 어느 주소로 열리나 — **밖으로 나가는 링크만 이것이 필요하다.**
 *
 * 앱 안에서는 아무도 안 쓴다. 화면끼리 잇는 것은 전부 `/me/...` 같은 상대 경로이고,
 * 로그인 되돌아오는 자리도 브라우저가 든 `window.location.origin` 을 쓴다.
 *
 * 필요한 자리는 **링크 미리보기**다. 카카오톡·슬랙의 수집기는 우리 화면을 열지 않고
 * `<head>` 만 긁어 가므로, 거기 적힌 그림 주소가 절대 주소가 아니면 아무것도 못 받는다.
 *
 * ## 도메인을 손으로 안 적는다
 *
 * 이 프로젝트에는 아직 자기 도메인이 없고 프로덕션은 Vercel 이 붙여 준 별칭으로 선다.
 * 그 값을 파일에 적으면 도메인을 사는 날 **아무도 이 파일을 안 고친다.** 배포판이 스스로
 * 아는 값을 읽는다.
 *
 * - 프로덕션이면 `VERCEL_PROJECT_PRODUCTION_URL` — 그 프로젝트의 **대표 주소**다.
 *   배포마다 달라지는 주소를 쓰면 어제 보낸 링크의 미리보기가 오늘 안 뜬다.
 * - 미리보기 배포면 `VERCEL_URL` — 그 배포 자신의 주소다. 여기서 대표 주소를 쓰면
 *   미리보기에서 프로덕션 그림을 긁어 간다.
 * - 둘 다 없으면 로컬이다.
 *
 * `SITE_URL` 을 맨 앞에 둔 것은 도메인이 생겼을 때 **코드를 안 고치고** 옮기기
 * 위해서다. 없으면 없는 대로 돈다 — 지금이 그렇다.
 *
 * **`NEXT_PUBLIC_` 을 안 붙인다.** 그 접두사는 값을 브라우저 번들에 박아 넣는데, 이
 * 값을 읽는 자리는 서버의 메타데이터 하나뿐이다. 그리고 박힌 값은 **빌드 때 정해진다**
 * — 배포마다 다른 주소를 그렇게 들면 지은 뒤에 바꿀 수가 없다.
 */
export function siteUrl(): URL {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return new URL(configured);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.VERCEL_ENV === 'production' && production) {
    return new URL(`https://${production}`);
  }

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return new URL(`https://${deployment}`);

  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
