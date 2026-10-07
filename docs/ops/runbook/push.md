# 운영 절차 — 웹 푸시 · 계정 채널

색인은 `docs/ops/runbook.md` 다.

## 웹 푸시를 켠다 — 새 메시지 알림을 운영에서 처음 여는 날

새 메시지 알림(ADR 0156)은 코드가 운영에 올라도 **열쇠를 넣기 전에는 꺼진 채다** — 공개 열쇠가 없으면 설정의 줄이 「이 브라우저에서는
알림을 받을 수 없어요」로 서고, Vault 값이 없으면 DB 는 배달 문을 깨우지 않는다. **켜기 전에 처리방침 한 줄(G-71)이 먼저다.**
값을 넣고 바꾸는 것은 사람이다 — 에이전트에게는 운영 설정 변경이다(`docs/agents/delegation/permissions.md`).

### 배포 차례 — 옛 `mark_chat_read(uuid)` 가 걷힌다

같은 묶음의 마이그레이션(`20261120090000`)이 읽음 문을 `mark_chat_read(p_match_id, p_up_to_seq)` 하나로 바꾸고 옛 한 칸 서명을 걷는다.
**`db push` 와 앱 배포 사이에는 옛 앱의 읽음 표시가 실패한다**(안 읽은 수가 줄지 않는다 — 메시지는 그대로 간다). 그래서 `db push` 직후
곧바로 앱을 배포한다(`docs/ops/runbook/deploy.md` 「규약 넷」의 앱과 DB 차례).

### 열쇠를 짓고 넣는다

1. **열쇠는 한 번 짓고 오래 쓴다** — `node scripts/push-vapid-keys.mjs` 가 넷을 찍는다(아무 데도 안 쓴다). 쌍을 바꾸면 이미 맺은 구독이
   모두 못 받고 사람마다 설정에서 다시 켜야 한다(`docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표).
2. **Vercel Production 환경 변수**

   | 이름 | 모양 | 메모 |
   | --- | --- | --- |
   | `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | base64url 87자 | **빌드 때 구워진다** — 넣은 뒤 다시 배포해야 브라우저가 받는다 |
   | `WEB_PUSH_VAPID_PRIVATE_KEY` | base64url 43자 | 비밀 |
   | `PUSH_DISPATCH_SECRET` | 무작위 32바이트(base64url) | 비밀. `CRON_SECRET` 과 다른 값 |
   | `WEB_PUSH_SUBJECT` | `mailto:<운영 연락 주소>` 또는 `https:` 주소 | 선택 — 없으면 배포의 `https` 주소를 쓴다 |

   넣은 뒤 `docs/ops/runbook/deploy.md` 「배포」대로 다시 배포한다.
3. **Supabase Vault 두 값** — 운영 SQL 편집기에서(배포가 Ready 된 뒤):

   ```sql
   select vault.create_secret('<운영 주소>/api/push/dispatch', 'push_dispatch_url');
   select vault.create_secret('<Vercel 의 PUSH_DISPATCH_SECRET 과 같은 값>', 'push_dispatch_secret');
   ```

   `<운영 주소>` 는 `docs/ops/runbook/domain.md` 맨 위의 그 한 줄이다(여기 적지 않는다). 도메인을 옮기면 이 값도 고친다.
   **`push_extra_hosts` 는 넣지 않는다** — 로컬의 가짜 푸시 서비스를 여는 시험용 값이다. 없어야 알려진 푸시 서비스 넷(FCM · Mozilla ·
   WNS · Apple)의 구독만 받는다(ADR 0156). Vercel 의 `WEB_PUSH_EXTRA_HOSTS` 도 같다.
4. **Realtime 설정** — 대시보드 Project Settings → Realtime 에서 「Allow public access」를 끈다. 계정 채널(ADR 0155)은 비공개 채널만
   쓰고, 켜 두면 정책 없이 듣는 public 채널이 열린다 — 누구나 `user:<남>` 이라는 이름의 공개 채널에 쏠 수 있다. 그것이 그 사람의
   비공개 구독에 닿지 않음은 `node scripts/check-live-channel.mjs` 4 가 잰다(로컬은 공개 채널이 열려 있다). 닿더라도 앱은 그 사건을
   「다시 읽어라」로만 쓰고 내용을 믿지 않는다. 동시 연결 한도(Free 200)와 플랜은 G-75.

### 확인

```sql
-- 크론 둘이 섰다 — push-dispatch(매분) · push-delivery-retention-purge(하루 한 번)
select jobname, schedule, active from cron.job where jobname in ('push-dispatch', 'push-delivery-retention-purge');
-- Vault 배선 — 2 여야 한다
select count(*) from vault.decrypted_secrets where name in ('push_dispatch_url', 'push_dispatch_secret');
-- 켠 기기에 다른 계정이 메시지를 보낸 뒤 — 배달 문이 202 로 받았다
select status_code, created from net._http_response order by created desc limit 3;
-- 배달 줄의 상태별 수 — sent 가 늘고 pending 이 기한을 넘겨 쌓이지 않는다
select status, count(*) from public.push_delivery group by status;
```

`401` 이 보이면 Vercel 과 Vault 의 배달 비밀이 갈렸다. `gave_up` 이 늘면 대개 VAPID 쌍이 구독 때와 다르다(403) — 「비밀이 새면」 표의 그 줄.
끝으로 켠 기기 하나에서 알림이 「새 메시지가 왔어요」 한 줄로 서고, 누르면 그 방이 열리는지 본다.
