# DB 크기는 Free 의 읽기 전용 문턱(500MB)에 닿기 전에 감시기가 알린다 — 넘은 뒤에는 알림도 못 나간다

> **운영자 결정 2026-10-22**(조율자 세션에서 전함) — 권고안 그대로: 문턱은 **안 A**, 경고 **350MB** · 위험 **425MB**. 점검표의
> 「비용 · 요금 · 외부 서비스 — 플랜 · 한도」 줄에 걸린 결정이다(문턱 둘이 플랜을 올릴 때를 정한다).

## 무엇이 문제였나

DB 크기를 보는 자리가 없었다(`pg_database_size` 를 부르는 코드 0, 2026-10-22). Supabase Free 는 DB 크기가 500MB 를 넘으면 읽기 전용이
된다 — <https://supabase.com/docs/guides/platform/database-size>(2026-10-22 에 읽음): 「Free Plan projects enter read-only mode when
your database size exceeds 500 MB」, 「In read-only mode, clients will encounter errors such as cannot execute INSERT in a read-only
transaction」. 크기는 클러스터의 모든 DB 의 `pg_database_size` 합이다(디스크 크기 · WAL 이 아니다).

그때는 가입 · 풀이 · 채팅 · 사진(DB 의 `bytea`)이 다 선다. **알림도 함께 선다** — `notify_ops` 는 `ops_alert` 에 한 줄을 적어야
보내므로(`20260909090000`) 그 insert 가 같은 오류로 실패한다. 그래서 이 감시의 요점은 **넘기 전에** 울리는 것이다.

운영 값(2026-10-22, 크기만 잼): 합 **52MB**(54,256,665 바이트) — `postgres` 37MB · `template0` 7.5MB · `template1` 7.7MB. 큰 표는
`cron.job_run_details` 12MB · `pg_proc` 2.6MB · `public.reading` 2.3MB 순이다.

## 정한 것(안)

| 물음 | 답 |
| --- | --- |
| 어디서 보나 | `watch_cron()`(10분마다)의 다섯째 갈래. 앞 넷은 그대로 |
| 무엇을 재나 | `database_size_counted()` — 클러스터의 모든 DB 의 `pg_database_size` 합(Supabase 가 세는 값) |
| 문턱 | **경고 350MB · 위험 425MB — 운영자 결정 대기.** 이름 붙은 함수 둘(`database_size_warning_bytes` · `database_size_critical_bytes`)에 두어 한 줄로 고친다 |
| 몇 번 | 종류마다 하루 한 줄(`ops_alert` 의 `(kind, day)`). 문턱 위에 있는 동안 매일 다시 온다 |
| 누가 부르나 | 아무도 — 감시기 안에서만 돈다(알림함을 채울 수 없게) |
| 못 재면 | 다섯째 갈래는 제 블록 안에서 돈다 — 예외가 나면 `database-size-unreadable` 을 알리고 끝나, 앞의 네 갈래가 함께 넘어지지 않는다 |

## 고르지 않은 것

- **넘은 뒤 알린다** — 읽기 전용에서는 `ops_alert` insert 가 실패해 못 나간다.
- **외부 감시(대시보드 · 이메일)에 맡긴다** — Supabase 의 사용량 이메일이 Free 에서 언제 오는지 확인하지 않았다. 새 제공자 · 새 비용 없이 있는 길을 쓴다.

## 재는 자리

`supabase/tests/99_database_size_alert.test.sql`(12건) — 한 번 잰 크기가 클러스터 합과 같은가 · 문턱 아래 · 경고 · 같은 날 두 번 · 위험 · 감시기(시험 DB 는 문턱 아래라 0 줄, 트랜잭션 안에서 경고 문턱을 0 으로 내리면 한 바퀴가 경고 한 줄 — 다섯째 갈래가 없으면 붉다) · 크기를 못 재면 `database-size-unreadable` 한 줄을 남기고 감시기는 넘어지지 않는다 · 익명 · 로그인한 사람 · 열쇠 모두 네 함수를 못 부른다. 500MB 를 채우지 않으려고 알리는 함수가 크기를 인자로 받는다.
