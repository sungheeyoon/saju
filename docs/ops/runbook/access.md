# 운영 절차 — 접속값 · 비밀 · 원격 SQL 의 경계

색인은 `docs/ops/runbook.md` 다.

## 어디서 실행하나

Supabase 대시보드의 SQL Editor 에서 **원격 프로젝트**에 대고 실행한다.
`xgdeguyxgkillndraonc` — 배포된 앱이 보는 곳이다. **서울(`ap-northeast-2`)에 있다.**

> **옛 ref `skxtqxajfmxiusqrgbuf` 는 이제 아니다.** 프로젝트를 서울로 옮겼고, 이 절차서가
> 한동안 옛 ref 를 가리키고 있었다. 여기 적힌 SQL 을 그 프로젝트에 대고 돌리면 아무
> 사용자도 없는 곳을 고치게 된다 — 실행 전에 주소창의 ref 를 눈으로 맞춘다.

로컬에서 연습하려면 `npm run db:start` 뒤에:

```bash
docker exec -i supabase_db_saju psql -U postgres -c "<문장>"   # 워크트리면 supabase_db_saju_wtN
```

> **`supabase config push` 를 쓰지 않는다.** 원격의 구글 설정을 지운다.

### 개인정보는 화면으로만 — 원격 SQL 의 경계 (ADR 0105)

**이용자 개인정보(이메일 · 닉네임과 사람의 짝 · 메시지 본문 · 출생정보 · 풀이)를 읽는 것은 `/ops/**` 화면으로만 한다.**
화면의 문은 읽을 때마다 접속기록(`audit.operator_access`)에 한 줄을 적는다. 이 절차서의 SQL 은 둘로 갈린다.

| 갈래 | 무엇 | 누가 · 어떻게 |
| --- | --- | --- |
| **보통** | 개인을 가리키지 않는 것 — 건수 · 집계 · 마이그레이션 상태 · 크론 · 설정 한 칸 · 신고 id 로 적는 검토 기록 | 사람이든 에이전트든 `npm run db:remote -- --purpose "<목적>" "<sql>"`. 목적과 SQL 의 sha256 이 접속기록에 남는다 |
| **break-glass** | 이메일 · 닉네임과 계정의 짝 · 메시지 본문 · 출생정보를 **SQL 로** 읽는 것 — 아래 「break-glass」 | **사람만.** 장애 · 수사기관의 적법한 요청처럼 화면으로 못 하는 때에만, 밖의 대장에 먼저 적고 |

**에이전트는 운영 개인정보를 예외 없이 직접 조회하지 않는다**(`docs/agents/delegation/permissions.md` 등급 3). 필요하면 질의를 써서
건네고 사람이 검토해 실행한다. 이 절차서에서 `auth.users` 의 이메일이나 메시지 본문을 읽는 질의에는 **break-glass** 라고
적혀 있다. 대시보드 SQL Editor 는 접속기록이 안 남는 자리다 — 거기서 개인정보를 읽지 않는다. 빈도가 늘면 `pgaudit` 로
옮긴다.

#### break-glass — 사람만, 대장 먼저

1. **까닭을 가른다.** 화면(`/ops/reports`)으로 되는 일이면 화면으로 한다. break-glass 는 장애(화면이 안 열리는데 지금
   봐야 한다) · 수사기관의 적법한 요청(`docs/ops/runbook/erasure.md` 「수사기관의 요청이 오면」) · 떠난 사람의 신고(`retention.report`, 화면에 없다)뿐이다
2. **대장에 먼저 적는다** — 저장소 밖의 운영 문서(수사기관 요청 대장과 같은 자리). 칸은 다섯이다:
   **목적**(무엇을 왜) · **실행자** · **대상**(신고 id · 계정 UUID — 이메일이 아니라) · **시각**(시작 · 끝) · **결과**(무엇을
   봤고 어디에 썼나, 밖으로 나갔으면 누구에게)
3. **`npm run db:remote -- --purpose "break-glass: <대장의 번호>" "<sql>"`** 로 보낸다 — 대시보드가 아니라. 목적과 해시가
   접속기록에 남아 대장과 이어진다. **대장과 접속기록은 따로 선다** — 보통 질의의 CLI 기록(목적 · SQL 해시 · 실행자 ·
   시각 · 성공/실패)은 「무엇을 보냈나」만 들고, 대장의 다섯 칸(대상 · 사유 · 결과 · 실행자 · 시각)은 「누구 것을 왜 봤고
   어디에 썼나」를 든다. break-glass 는 **둘 다** 있어야 한 건이다 — 접속기록만 있고 대장이 없으면 그것이 이상 신호다
   (월 점검의 1 에서 `break-glass:` 목적의 줄을 대장과 맞춘다)
4. 결과를 저장소 · 이슈 · 채팅에 붙이지 않는다

### 접속값은 여섯이고 넣는 손은 하나다

서울로 옮기면서 **Vercel 마켓플레이스 통합을 끊었다.** 그 통합이 같은 값을 이름 두 벌로
넣어 주고 있었고(`NEXT_PUBLIC_` 접두사, 그리고 옛 `anon`·`service_role` 이름), 코드가
주소를 이름 둘로 찾고 있었다. 지금은 넣는 자리가 손 하나뿐이라 그 갈래가 도달할 수 없다.

| 이름 | 어디서 쓰나 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저와 서버 양쪽 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 |
| `SUPABASE_SECRET_KEY` | 서버 전용 — `definer` 함수를 부르는 자리 |
| `OPENAI_API_KEY` · `OPENAI_WEBHOOK_SECRET` | 풀이 생성과 webhook. 키는 Production · Preview, 서명 비밀은 Production 만(2026-09-24 `vercel env ls`) |
| `CRON_SECRET` | 복구기를 깨우는 자리 |
| `TASTE_BROWSER_SECRET` · `TASTE_IP_SECRET` | 로그인 전 사주 문단의 브라우저 묶음 · IP 를 HMAC 하는 서버 비밀(ADR 0143). Production · Preview 에 둔다 — 둘 다 있다(2026-10-03 `vercel env ls`). 없으면 그 문단이 닫힌다(`docs/ops/runbook/ai.md` 「로그인 전 사주 문단 — 비밀 둘 · 상한 · 비용」) |

- **`NEXT_PUBLIC_` 이 붙으면 브라우저가 본다.** 열쇠를 그 접두사로 넣는 순간 공개된다.
- `POSTGRES_*` 일곱과 `SUPABASE_JWT_SECRET`, 옛 이름 키 넷은 **코드가 한 번도 안 읽어서**
  함께 지웠다. 다시 생기면 통합이 도로 붙은 것이다.
- **열쇠 쪽 이름 갈래는 로컬에만 남겼다.** `supabase status` 가 `SECRET_KEY` 를 안 내주는
  판본에서는 `SERVICE_ROLE_KEY` 뿐이라, 그 갈래가 없으면 로컬 시험이 열쇠 없는 배포와
  같은 얼굴로 실패한다(`playwright.config.ts` 가 이름 둘을 다 덮는 까닭).
- `vercel env pull` 은 **`--environment=production`** 이어야 운영 값이 온다. 그래도
  Secret 로 넣은 것은 안 내려온다 — `"[SENSITIVE]"` 자리표시자로 온다. **그대로 두지 마라** —
  값이 「있는」 것으로 세어져 `keyed-client.ts` 의 「열쇠가 없습니다」 검사를 지나가고 401 로
  떨어진다. 주석 처리해 두면 오류가 이름을 대 준다. 실호출에 드는 것은 `OPENAI_API_KEY` 한 줄이고
  손으로 붙인다.
- **CLI 로 임의 SQL 이 된다** — `npm run db:remote -- --purpose "<목적>" "<sql>"`(= 접속기록에 목적 · 해시를 적고
  `npx supabase db query --linked`, 기계 전체에서 한 번에 하나, ADR 0096 · 0105). 목적 없이는 안 돈다. 출력을 스크립트가
  읽어야 하면 `--json` 을 붙인다 — 본 질의도 `--output-format json` 으로 받는다(봉투든 맨 배열이든, #431). 적는 함수(`audit.note_cli_query`)가
  원격에 없으면 SQL 을 안 보낸다 — 그 함수를 올리는 `db push` 앞의 확인만 `node scripts/remote-lock.mjs npx supabase db query --linked "<sql>"`
  로 직접 보냈다(2026-09-24 한 번, 함수 정의의 md5). Management API 로 붙고
  `postgres` 로 돌므로 비밀번호도 `psql` 도 필요 없다. 다만 `postgres` 라 「비운영자 당사자에게
  무엇이 보이나」는 못 잰다 — 역할별 조회는 대시보드 SQL Editor(마지막 문장의 결과만 준다 — 역할을
  바꿔 가며 잰 줄은 임시 표에 모아 끝에서 한 번에 낸다)나 `SUPABASE_SECRET_KEY` 가 필요하고, 익명
  수준은 발행 키로 REST 를 두드려 잰다(없으면 `404` PGRST202, 닫혀 있으면 `42501`). 다중 문장은
  못 받는다(`begin; … rollback;` 이 죽는다).
- **`.env.development.local` 은 이름과 달리 운영 DB 를 가리킨다.** 로컬 스택에 대고
  돌릴 것을 여기 대고 돌리지 않는다.
