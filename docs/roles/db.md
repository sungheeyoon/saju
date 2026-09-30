# 역할 — DB (마이그레이션 · 함수 · 정책 · pgTAP)

`supabase/migrations/` 와 `supabase/tests/` 를 고치는 일이다. 앱이 그 함수를 부르게 하는 쪽은 `docs/roles/feature.md` 다.

## 먼저 읽는 것

- `docs/architecture.md` 「문 — DB 를 부르는 자리」 · 「그 밖의 자리」
- `docs/agents/delegation.md` 「권한 등급」 — 특히 「예외 — 마이그레이션이 든 PR」 문단
- `docs/agents/delegation.md` 「나란히 맡길 때」 — 원격 DB · 마이그레이션 사슬은 순차다
- `docs/ops/runbook.md` 「규약 넷 — 앱과 DB 는 따로 간다」 · 「묶음 배포」의 0
- `docs/ops/runbook.md` 「개인정보는 화면으로만」
- `docs/agents/test-map.md` 「무엇을 고쳤으면 무엇을 돌리나」의 마이그레이션 줄
- ADR 0071(넓히기 → 앱 → 좁히기) · 0078(문이 실패를 말한다) · 0084(모양을 잠근다) · 0105(접속기록)

## 이 저장소의 방식

- 마이그레이션 이름은 영어 문장(`YYYYMMDDHHMMSS_english_sentence.sql`), 타임스탬프는 **머지 직전 main 의 마지막 뒤**다
- 로컬 차례: `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` → `npm run test:flow`.
  생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다
- 원격에 닿는 것은 `npm run db:push` 와 `npm run db:remote -- --purpose "<목적>" "<sql>"` 뿐이다 — 기계 전체의 잠금 하나를 잡는다.
  `npx supabase db push` 를 직접 부르면 잠금을 지나친다
- **차례는 PR → `db push` → `migration list` 의 remote 칸과 PostgREST 캐시 확인 → 그 뒤 `--auto` 머지다.** 앱이 새 함수를 부르면
  넓히는 마이그레이션 PR 과 앱 PR 로 나눈다
- pgTAP 은 역할을 갈아입고 「막힌다」를 잰다. 새 시험은 자기가 만든 행만 세고 plan 은 수로 고정한다. 파일 번호는 머지 직전에 본다
- `security definer` 함수의 `search_path` 는 `""` 다 — pgTAP 이 이름으로 잡는다
- 운영 베타 동안 `db push` 는 묻지 않고 밟되 **본 값을 적는다**(ADR 0093)

## 하지 않는 것 · 묻는 것

- **운영 개인정보(이메일 · 닉네임과 계정의 짝 · 메시지 · 출생정보 · 풀이)를 읽는 SQL 을 보내지 않는다** — 질의를 써서 건넨다(ADR 0105)
- `supabase config push` 는 등급 4 다 — 원격의 구글 설정을 지운다
- 남은 원격 잠금을 스스로 걷지 않는다 — 멈추고 걷는 법을 말한다
- RLS · grant · 보존 기간 · 실패 때 여닫음이 바뀌면 결정이다 — ADR 을 쓰고 머지하지 않고 보고한다

## 끝날 때 고치는 것

- [ ] PR 「사람이 할 걸음」에 밟은 `db push` 와 본 값(remote 칸 · 캐시)
- [ ] 새 표 · 함수의 이름이 도메인 낱말이면 → `CONTEXT.md` 「9. 용어 ↔ 코드」
- [ ] 운영에서 손으로 도는 SQL · 절차가 바뀌었으면 → `docs/ops/runbook.md`
- [ ] 결정 → ADR. 닫힌 틈 → `docs/product/gaps.md` 와 changelog
