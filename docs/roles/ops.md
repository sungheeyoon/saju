# 역할 — 운영 (배포 · 운영 확인 · 크론 · 절차)

운영 DB 와 Vercel 에 닿는 일이다. 대개 조율자가 라운드 끝에 겸한다.

## 먼저 읽는 것

- `docs/ops/runbook.md` 「어디서 실행하나」 — 접속값 · 비밀 · 개인정보의 경계
- `docs/ops/runbook.md` 「배포」 — 특히 「묶음 배포」와 「규약 넷 — 앱과 DB 는 따로 간다」
- `docs/ops/runbook.md` 「도는 잡이 정말 도나」 · 「보안 점검」
- `docs/agents/delegation.md` 「권한 등급」 · 「공식 운영에 들어가면 켜는 잠금」
- `docs/agents/delegation.md` 「로컬 환경의 함정」 — 키체인 창 · `BEHIND` · 운영 확인용 계정

## 이 저장소의 방식

- **머지는 배포가 아니다**(ADR 0110). 운영 배포는 운영자의 「배포」 답을 받은 뒤 최신 main 을 한 번 올리는 묶음 배포다
- 앱과 DB 는 따로 간다 — 마이그레이션이 먼저, 앱이 나중
- 등급 3 을 밟으면 무엇을 봤는지 값으로 적는다 — `db push` 뒤에는 remote 칸과 PostgREST 캐시, 배포 뒤에는 Ready 와
  배포 SHA = main HEAD 와 익명 smoke
- 원격 질의는 개인을 가리키지 않는 것만 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 보낸다 — 목적이 접속기록에 남는다
- 로그인이 드는 운영 smoke 와 아이폰 확인은 운영자에게 단계별 시나리오로 건넨다

## 하지 않는 것 · 묻는 것

- 「배포」 답 없이 Production 에 올리지 않는다
- 등급 4 — force push · `supabase config push` · Vercel 변수 삭제 · main 가지 삭제
- 운영 개인정보를 직접 조회하지 않는다(ADR 0105) — break-glass 는 사람이 돈다
- 운영자가 미룬 것(간극 대장의 `보류` — 베타 종료일 · 백업 · 2단계 인증 · 보존 기간)을 다시 권하지 않는다

## 끝날 때 고치는 것

- [ ] 그날 노트(`docs/notes/`)에 끝 상태 — Production SHA · DB remote 의 마지막 마이그레이션 · smoke 결과
- [ ] 절차가 바뀌었거나 틀렸으면 → `docs/ops/runbook.md`
- [ ] 보안 점검의 증거가 생겼으면 → `docs/product/gaps.md` 의 G-23 줄
- [ ] 운영자만 할 수 있는 일이 새로 생겼으면 → 운영자 할 일 이슈(#304)에 줄
