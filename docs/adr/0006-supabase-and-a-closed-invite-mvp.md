# Supabase 를 쓰고, MVP 는 초대로 닫는다

## Supabase — 편의가 아니라 ADR 0004 때문이다

ADR 0004 는 「서비스 코드의 관례로 두지 않고 DB 불변식으로 건다」고 정했다. Supabase 는
**인증 주체가 DB 안에 있는** 조합이라, RLS 정책에서 `auth.uid()` 를 그대로 써서
「이 Person 이 누군가의 selfPerson 이면 그 User 만 출생정보를 쓴다」를 정책으로 표현할 수
있다. Clerk + 별도 Postgres 조합이면 `auth.uid()` 가 DB 안에 없어 사용자 id 를 앱 코드가
넘겨야 하고, 그것이 정확히 ADR 0004 가 거부한 모양이다.

Kakao 도 갈린다 — Supabase 는 Kakao 를 1급 provider 로 문서화하고, Clerk 은 지원 목록에
없어 custom OIDC 로 붙여야 한다. Vercel Marketplace 네이티브 통합(`supabase`)이라
환경변수와 과금도 붙어 온다.

## Evidence 는 `jsonb` 가 아니라 `text` 로 넣는다

Postgres `jsonb` 는 저장할 때 정규화한다 — 키 순서를 버리고, 중복 키를 지우고, 숫자
표현을 바꾼다. ADR 0001 이 약속한 것은 「AI 가 본 그것 그대로」인데, `jsonb` 로 넣으면
꺼낸 값이 넘긴 바이트와 다르고 **같은 프롬프트를 재현할 수 없다.** 실제로 직렬화해
넘긴 문자열을 그대로 `text` 에 넣는다. TOAST 가 알아서 압축한다. 질의가 필요한 값은
`listSummary` 나 별도 컬럼이 든다 — 아티팩트를 정규화해서 될 일이 아니다.

## MVP 인증은 Google 하나로 닫는다

```
Google OAuth only
운영자가 아는 성인의 이메일만 초대 allowlist 에 등록
앱 내 알림만 · 외부 알림 없음
별도 성년인증 없음
```

**Google OAuth 는 성년인증이 아니다**(ADR 0005). 성인만 들어오는 것은 인증이 보장하는
것이 아니라 운영자가 초대 범위로 통제하는 것이다. Kakao 로그인, Biz App 전환, 외부 알림,
정식 성년인증은 일반 사용자에게 매칭을 개방할 때 함께 온다 — Kakao 의 `account_email`
동의 항목이 Biz App 등록을 요구하므로, Kakao 로그인과 통보 채널은 하나의 묶음이다.

## Consequences

- **앱 내 알림만으로는 동의 기반 매칭이 원리적으로 성립하지 않는다.** 요청이 떠 있어도
  상대가 앱을 열 이유가 없다. 운영자가 직접 메우는 규모에서만 성립하므로, 「외부 통보
  없이는 더 못 늘린다」가 이 단계를 닫는 조건 중 하나다.
- 초대 allowlist 는 Supabase Auth 훅으로 가입 시점에 건다. 앱 코드에서 거르면
  ADR 0004 와 같은 이유로 잊을 수 있는 자리가 된다.

## allowlist 는 가입 관문이다 — DB 훅에서 건다

Supabase 의 **Postgres Before User Created Auth Hook** 에서 정확한 초대 이메일을 검사하고,
허용되지 않은 사용자는 **계정이 만들어지기 전에** 거부한다. 앱 코드에서 걸러 「가입은
됐는데 아무것도 못 하는 계정」을 남기지 않는다 — ADR 0004 와 같은 이유로, 잊을 수 있는
자리에 두지 않는다.

기존 사용자의 접근 회수는 allowlist 에서 지우는 것이 아니라 **계정 중지**로 처리한다.
allowlist 는 들어오는 문만 지키고, 이미 들어온 계정은 별개의 상태로 다룬다.
