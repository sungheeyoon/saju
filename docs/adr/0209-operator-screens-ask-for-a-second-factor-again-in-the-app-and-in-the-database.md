# 운영 화면은 다시 2단계 인증(TOTP)을 마친 세션에서만 열리고, DB 의 운영자 판정도 aal2 를 묻는다

> **운영자 결정 2026-10-28**(조율자가 옮김) — 「운영 화면에 TOTP 를 다시 붙인다.」 근거는 「개인정보의 안전성 확보조치 기준」
> 제6조 제2항(2026-11-01 시행분, 안내서가 「비밀번호 인증 외에 일회용 비밀번호(OTP) 등 추가적인 인증 수단」을 예로 든다)이다 —
> `docs/legal/privacy-grounds.md` 「운영자 로그인 — 안전성 확보조치 기준 제6조 제2항 (G-65)」.

ADR 0182 를 통째로 대체하고 ADR 0123 을 되살린다 — 화면 쪽은 0123 그대로이고, 0123 이 설계만 적었던 「DB 층」을 이번에 세운다.
0123 이후 늘어난 운영 화면(`/ops/today` · `/ops/orders` · `/ops/members`)과 쓰는 액션 여섯도 같은 문을 지난다.

## 잰 것 (2026-10-28)

- 운영 화면은 여섯이다 — `app/ops/` 의 `today` · `reports` · `reports/[reportId]` · `survey` · `orders` · `members` 의 `page.tsx`. 쓰는 액션은
  `app/ops/*/actions.ts` 의 여섯(신고 처분 · 무상 지급 · 회수 · 이용 정지 · 해제 · 환불 확보 · 확정 · 준비 취소 — 내보낸 함수로 여섯).
  읽기(`read.ts`)는 화면 머리 뒤에서만 불린다.
- 운영자 판정은 여전히 DB 의 `is_operator()` 하나이고(`20261215090000` 이 「이용 중인 계정만」을 더했다), 그것을 묻는 함수는 서른둘이다(로컬 `pg_proc`, 2026-10-28) —
  운영자 문 · 거절 기록 둘(`note_operator_denial` · `note_operator_refusal`) · 인연 궁합 원문 둘(`my_reading_artifacts` 의 match 줄 ·
  `match_reading_source`). 실행자를 따로 재는 공통 함수(`book_reading_credit_grant` · `change_account_status` · `write_report_review`)는
  `public.operator` 를 직접 보지만 `authenticated` 에 안 열렸고 위 문 뒤에서만 불린다.
- 세션의 aal 을 보는 자리는 0 이었다(ADR 0182 가 걷은 뒤). 로그인은 구글 하나지만 **Auth 의 이메일 공급자는 켜져 있다**
  (`docs/legal/privacy-grounds.md` 「우리 사실」) — 운영자 판정은 계정에 붙으므로 그 계정에 비밀번호가 있으면 구글을 거치지 않고 든다.

## 정한 것

- **운영 화면은 세션이 aal2 가 아니면 운영자 문을 부르지 않는다**(`app/ops/second-factor.ts`). 수준은 서명을 확인한 클레임(`getClaims`)에서
  읽는다. 화면 머리(`secondFactorGate`):
  - aal2 — 지금과 같다(DB 가 판정).
  - aal1 이고 확인을 마친 TOTP 가 있다 — `/ops/mfa?next=…` 로 보낸다.
  - aal1 이고 TOTP 가 없다 · 요소를 못 읽었다 — **운영자가 아닌 사람과 같은 404**, 거절 기록도 같은 줄(`note_operator_denial`, 그 화면의
    머리 문 이름)이다. G-24 ⑪ 「비운영자는 같은 주소에서 404 이고 거절 기록이 남음」이 그대로다.
- **운영 액션은 맨 앞에서 aal2 를 묻는다**(`writeWithoutSecondFactor`) — 아니면 문을 안 부르고 `denied` 한 줄을 적고 DB 의 `42501` 과 같은
  글자로 거절한다. 화면은 이미 aal2 로 열렸으니 이 갈래는 server action 을 바로 POST 한 부름이다.
- 빠진 화면 · 액션은 `app/ops/second-factor.boundary.test.ts` 가 붉힌다 — 새 운영 화면도 같은 한 줄을 든다.
- **`/ops/mfa` — 등록과 확인**(ADR 0123 그대로, 문구도 그때 승인된 `app/ops/mfa/copy.ts`). 로그인한 누구든 제 계정에 TOTP 를 등록하고
  코드로 세션을 aal2 로 올린다. 운영자 여부를 여기서 묻지 않는다 — 등록으로 열리는 운영자 문은 없다. 확인하는 순간 Supabase 가 그 사람의
  다른 세션을 끊는다. 확인 전 TOTP 는 등록을 새로 열 때 걷는다. 돌아갈 자리를 모르면 `/ops/today` 로 간다(운영 머리의 첫 길).
- **처음 등록은 운영자가 주소(`/ops/mfa`)를 직접 친다.** 요소가 없는 aal1 세션을 확인 화면으로 보내면 운영자가 아닌 사람까지 그 화면을
  보게 되고(404 가 깨진다), 보낼지 가리려면 「나는 운영자인가」를 여는 문이 필요하다 — ADR 0061 이 안 열기로 한 문이다(ADR 0123 「안 고른 것」).
  런북이 그 주소를 든다(`docs/ops/runbook/operators.md` 「운영자 로그인 — 구글 로그인 뒤 2단계 인증」).
- **DB 층 — `is_operator()` 가 JWT 의 `aal = 'aal2'` 도 묻는다**(ADR 0123 「DB 층」의 설계, 마이그레이션은 이 결정의 둘째 PR). 한 줄로
  위 서른둘이 함께 닫힌다 — 세션 토큰으로 PostgREST 를 직접 두드려도, 이메일 · 비밀번호로 들어온 aal1 세션도 운영자 문이 `42501` 이다.
  aal1 운영자의 부름은 `note_operator_denial` 이 거절로 적고, `note_operator_refusal` 은 적지 않는다(운영자가 아니므로).
  - **안 닿는 것** — CLI 로 `postgres` 가 부르는 SQL(`review_report` 등) · 크론의 열쇠 문. JWT 가 없는 자리다 — 그 길의 막음은 바깥 계정
    MFA(G-23 ⑨)다.
  - 인연 궁합 원문 둘(`/me/reading/inspect`)은 aal1 운영자에게 안 선다 — 운영자는 `/ops/mfa` 를 먼저 지나고 온다.

## 차례 — 앱이 먼저, DB 가 나중 (운영자가 잠기지 않게)

이 마이그레이션은 문을 **좁힌다**(`docs/ops/runbook/deploy.md` 규약 넷의 3 「넓히고, 재고, 좁힌다」). 그래서 보통의 「마이그레이션 먼저」와
거꾸로, 앱 PR 과 마이그레이션 PR 을 나눈다.

1. 앱 PR(화면 · 액션의 막음 · `/ops/mfa`) 머지 → 묶음 배포. 옛 DB 에서도 안전하다 — `is_operator()` 가 aal 을 안 물어도 앱이 먼저 막는다.
2. 운영자가 운영에서 `/ops/mfa` 로 TOTP 를 등록하고 `/ops/today` 가 열리는 것을 본다.
3. 마이그레이션 PR — `db push` 뒤 머지(`docs/agents/delegation/permissions.md` 「예외 — 마이그레이션이 든 PR」).

거꾸로(DB 먼저) 가면 옛 앱에는 `/ops/mfa` 가 없어, 앱 배포 전까지 운영자가 운영 화면을 하나도 못 연다. 어느 쪽이든 영구히 잠기지는
않는다 — `/ops/mfa` 는 운영자를 묻지 않고, 인증 앱을 잃으면 사람이 대시보드에서 요소를 지운다(런북).

## 안 고른 것

- **`proxy.ts` 에서 `/ops/**` 를 aal2 로 막기 · 레이아웃에서 막기.** 관문은 접근 판정을 안 하고, 레이아웃은 화면을 옮겨 다닐 때 다시 안
  돈다(ADR 0041) — 그리고 server action 은 둘 다 안 지난다.
- **DB 층만 두고 앱의 막음은 빼기.** 마이그레이션이 오르기 전의 창에서 aal1 운영자가 읽고, 「운영자 문을 먼저 부르고 aal 을 나중에 보기」는
  자료가 나오고 접속기록에 「읽음」이 선 뒤다(ADR 0123).
- **구글 계정의 2단계 인증으로 대기.** 앱 · Supabase 가 그것을 묻지도 기록하지도 못한다 — 2026-10-28 조사에서도 그것을 인정한 공식 해석 ·
  처분 사례를 못 찾았다(`docs/legal/privacy-grounds.md` G-65 절).
- **SMS · WebAuthn.** 전화 공급자는 꺼져 있고 WebAuthn 은 로컬 설정도 없다. TOTP 는 무료 플랜에 있다.

## 이 결정이 말하지 않는 것

- **법적 충족을 단정하지 않는다.** 안내서가 예로 든 방식(비밀번호 외 OTP 추가 인증)과 같은 방식을 운영 화면에 둔다는 데까지다. G-65 는
  그 대조를 운영자(필요하면 변호사)가 볼 때까지 남는다.
- G-23 ⑨ 의 바깥 계정(Supabase · Vercel · GitHub · PortOne · AWS) 2단계 인증은 이 결정과 따로다.

## 값

- 운영자는 세션마다(새 로그인 · 다른 기기) 6자리를 한 번 더 넣는다. 인증 앱을 잃으면 사람이 대시보드에서 요소를 지운다(런북).
- 운영 화면을 여는 aal1 세션마다 요소 목록을 Auth 에 한 번 묻는다(`listFactors`) — aal2 세션은 왕복이 안 는다.
- e2e 의 운영자는 화면으로 등록 · 확인을 지난다(`e2e/second-factor.ts`, RFC 6238 을 검사 안에서 계산). pgTAP 의 세션(`tests.claims`)은
  2단계를 마친 세션(aal2)이고, aal1 은 `tests.claims_aal1` 이 따로 든다.
