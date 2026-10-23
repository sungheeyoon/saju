# 운영 절차 — 사진 저장소 (G-120, ADR 0202 · 0203)

색인은 `docs/ops/runbook.md` 다.

사진의 바이트를 AWS S3 서울에 두는 일. **지금은 꺼져 있다** — 올리기의 스위치(`public.photo_upload_switch`)가 `db` 이고 `PHOTO_STORE_*`
다섯이 운영에 없어 사진은 DB(`profile_photo.bytes`)에 산다. 바꾸는 길과 그 뒤의 손일을 여기 적는다. 설계는 ADR 0202, 열람 방식(안 A) ·
스위치 · 전환 차례는 ADR 0203, 규격 · 출처는 `docs/product/gaps/records/g-120.md`.

## 올리기의 스위치

올리는 문 다섯은 매번 이 한 줄을 보고 제 길이 아니면 거절한다(`20261228140000`). **바꾸면 배포 없이 다음 요청부터 듣는다** — 화면도
같은 값을 읽는다(`photo_upload_mode()`).

| 값 | 받는 올리기 | 화면 |
| --- | --- | --- |
| `db`(기본값) | 바이트 길 — `add_my_photo` · `replace_my_photo` | 지금 그대로 |
| `paused` | 없음 — 다섯 다 「사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.」 | 사진 판 첫 줄이 그 안내, 빈 칸의 + · 「사진 변경」이 안 선다 |
| `s3` | 저장소 길 — `begin_my_photo_upload` · `add_my_photo_object` · `replace_my_photo_object` | 두 벌을 구워 저장소로. 그 배포에 `PHOTO_STORE_*` 가 없으면 `paused` 처럼 보인다 |

지우기 · 옮기기 · 위치 조정 · 보기 · 표 버리기(`drop_my_photo_upload`)는 어느 값에서도 그대로다. 바꾸는 SQL 과 지금 값 읽기:

```sql
update public.photo_upload_switch set mode = '<db | paused | s3>', changed_at = now() returning mode, changed_at;
select mode, changed_at from public.photo_upload_switch;
```

`npm run db:remote -- --purpose "사진 올리기 스위치 <값>(G-120)" "<위 SQL>"`. 볼 값: 한 줄, `mode` 가 바꾼 값. 셋 밖의 값은 표가 거절한다.

**`db push` 만으로는 아무것도 안 시작된다** — 스위치는 `db` 로 서고, 저장소 길의 문은 `authenticated` 에 열려도(`20261228150000`)
스스로 거절하며, 사진을 지우는 것은 마이그레이션이 아니라 아래 3 의 운영 SQL 이다.

## 사진 저장소로 바꾼다

**운영자 결정(2026-10-23, ADR 0203): 업로드 차단 → 기존 사진 전체 삭제 → 0건 확인 → S3 업로드 개방.** 옛 사진은 옮기지 않는다 —
**되돌릴 수 없다**(운영 DB 에 백업이 없다, Supabase Free · 간극 대장 G-63). 차단이 먼저라 지우는 동안 새 바이트 줄이 안 생기고, 지운 뒤
올리는 장은 모두 저장소에 산다 — 「먼저 바꿔 올리면 남는다」는 없다. 걸음마다 운영자가 따로 지시한다 — 에이전트는 이 SQL 을 돌리지 않는다.

**0. 준비** — 차단 전에 끝나 있다.

- 마이그레이션 `20261228140000`(스위치) · `20261228150000`(열람 · 문 넷)이 운영 DB 에 있다 — `npx supabase migration list` 의 remote 칸.
  스위치 값을 읽어 `db` 다(위 SQL 의 `select`)
- 이 구현이 든 앱이 Production 에 배포됐다(`docs/ops/runbook/deploy.md` 「배포」) — 화면이 스위치를 읽고, 열쇠 줄을 저장소에서 읽는다
- 대상을 잰다 — 개인을 가리키지 않는 집계만(ADR 0105):

  ```sql
  select count(*) filter (where bytes is not null) as byte_rows,
         count(distinct user_id) filter (where bytes is not null) as byte_users,
         coalesce(sum(octet_length(bytes)), 0) as byte_total,
         count(*) filter (where object_key is not null) as key_rows
  from public.profile_photo;
  ```

  `npm run db:remote -- --purpose "사진 삭제 대상 집계(G-120)" "<위 SQL>"`. 볼 값: **`key_rows` 0**(저장소 길이 한 번도 안 열렸다 —
  0 이 아니면 멈추고 묻는다). `byte_rows` · `byte_users` 를 적어 둔다. 2026-10-23 값은 `byte_rows` 2 · `byte_users` 2 · `byte_total`
  50,634(49 kB) · `key_rows` 0
- (운영자가 고르면) 대상에게 직접 알린다 — 앱에는 이 소식을 낼 자리가 없다(아래 「사용자 안내」). 화면의 안내는 2 부터 선다

**1. 차단** — 스위치를 `paused` 로(위 「올리기의 스위치」의 `update`). 볼 값: `mode` 가 `paused`. 운영 계정으로 `/me/profile` 을 열어
사진 판 첫 줄이 「사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.」이고 빈 칸에 + 가 없다.

**2. 지운다** — 바이트 줄 전부. 문장 하나라 한 거래다 — 중간에 실패하면 아무것도 안 바뀐다. 차단 뒤라 같은 순간 새 줄이 생기지 않는다.

```sql
with gone as (
  delete from public.profile_photo where bytes is not null returning user_id
)
select count(*) as deleted_rows, count(distinct user_id) as deleted_users from gone;
```

`npm run db:remote -- --purpose "옛 사진 지우기(G-120)" "<위 SQL>"`. 볼 값: `deleted_rows` 가 0 의 `byte_rows` 와 같거나 그보다 적다
(그 사이 사람이 지운 장만큼). 바이트 줄에는 열쇠가 없어 지울 줄(`profile_photo_object_left`)에 아무것도 안 간다. `key_rows` 가 0 이라
남는 줄이 없으므로 자리를 다시 붙일 일도 없다.

**3. 0건을 잰다** — 집계만:

```sql
select (select count(*) from public.profile_photo) as photo_rows,
       (select count(*) from public.profile_photo where bytes is not null) as byte_rows,
       (select count(*) from public.profile_photo where object_key is not null) as key_rows,
       (select count(*) from public.photo_upload_ticket) as tickets,
       (select mode from public.photo_upload_switch) as mode;
```

볼 값: `photo_rows` 0 · `byte_rows` 0 · `key_rows` 0 · `tickets` 0 · `mode` `paused`. 하나라도 아니면 4 로 가지 않는다.

**4. 저장소 값 · 재배포** — 스위치는 아직 `paused` 다.

1. **처리방침 · 청소** — 위탁 표의 AWS 목적(지금 접속기록 사본뿐)과 탈퇴 뒤 「3일 안 파기」가 청소 주기 · 실패 때의 지연과 맞는가
   (G-120 의 남은 줄 — 처리방침 · 청소 주기는 이 절차 밖의 PR 이 든다)
2. **AWS** — 아래 「마법사가 쓸 값」의 버킷 · 역할을 세운다(마법사가 돌면 그 출력의 이름을 쓴다)
3. **Vercel** — Settings → Environment Variables → **Production** 에 `PHOTO_STORE_BUCKET` · `PHOTO_STORE_REGION`(`ap-northeast-2`) ·
   `PHOTO_STORE_ROLE_ARN` 셋. 대안(접근 키)이면 역할 대신 `PHOTO_STORE_ACCESS_KEY_ID` · `PHOTO_STORE_SECRET_ACCESS_KEY`(Sensitive) —
   **둘을 함께 넣으면 오설정이다**(화면은 멈춘 것으로 보이고 청소기가 500). 값은 문서 · 채팅 · 커밋에 적지 않는다
4. **재배포** — 최신 Production 을 Redeploy 하고 Ready 를 본다. 볼 값: 청소 크론의 응답(`/api/cron/photo-sweep`, Vercel 의 Cron 로그)이
   `{"configured":false}` 가 아니라 `{"ticketsMoved":0,"deleted":0,"failed":0,"errorClass":null,"alerted":false}` 꼴(`app/api/cron/photo-sweep/sweep.ts`
   의 `SweepResult`). 손으로 한 번 부를 수 있다. Vercel Pro 는 이 걸음의 조건이 아니다(G-117 은 따로다)

**5. 연다** — 스위치를 `s3` 로. 볼 값: `mode` 가 `s3`. 그다음 운영 계정으로 확인한다:

- 프로필 사진을 한 장 올린다 → 칸에 선다 → 3 의 집계에서 `key_rows` 1 · `byte_rows` 0 → S3 콘솔의 `photos/<계정 id>/` 아래 `card` ·
  `large` 가 있다 → 다른 계정의 덱 · 대화방에서 그 사진이 열린다(안 A — 앱이 저장소에서 읽는다)
- 그 장을 지운다 → 다음 청소 뒤 두 객체가 없다(크론 응답의 `deleted` 2)
- 월 점검(아래 「열쇠 줄 재기」)이 어긋남 0

**되돌리기** — 5 뒤에 문제가 나면 스위치를 `paused` 로(올리기만 멈추고 열람은 그대로). `db` 로 돌리면 새 장이 다시 DB 에 산다 —
이미 저장소에 사는 장은 저장소에서 계속 열린다. 저장소 값을 걷는 것은 아래 「끄는 길」이다.

**끄는 길 — 끄기 전에 지울 줄을 비운다.** 끄면 청소기도 멈춘다(「설정 안 됨」) — 그 사이 탈퇴 · 지운 장의 객체가 저장소에 남는다. 그래서
① 스위치를 `db` 나 `paused` 로, ② 아래 「지울 줄이 안 줄 때」의 집계 질의에서 줄 수가 0 인지 보고(크론을 손으로 한 번 부를 수 있다),
③ 4 의 값을 지우고 Redeploy. 이미 저장소에 사는 장은 저장소에 남고, 값이 없는 배포는 그 장을 500 으로 답한다 — 켤 때까지 안 열린다.

### 지우면 일어나는 것 (코드에서 잰 것, 2026-10-23)

- 지운 사람은 다음 읽기부터 **사진 없는 사람**이다 — 사진 유무(`has_photo`) · 장 수(`photo_count`) · 대표 사진(1번)은 저장된 값이
  아니라 읽을 때 `profile_photo` 를 센다(`my_discovery_board` · `my_matches` · `my_chat_rooms` 등). 카드 · 아바타 · 상대 시트는 이름 첫
  글자의 기본 표시로 선다. 사진 주소는 `no-cache` 라 다음 물음부터 404 다
- **막히는 흐름은 사진을 올리고 바꾸는 일뿐이다** — 가입(`complete_signup` · 가입 폼에 사진 칸이 없다) · 프로필 저장(닉네임 · 소개만,
  `missingInProfile`) · 덱을 채우는 문(`fill_discovery_deck` · `discovery_pair_eligible`) · 요청 · 채팅 · 풀이는 사진을 안 묻는다
  (사진은 선택이다 — PRD 「이름과 얼굴」). 계정 관리의 「사진 추가」는 멈춘 동안에도 서고, 누르면 프로필의 안내로 간다
- 지울 줄 · 청소기 · 저장소는 그대로다 — 트리거 `profile_photo_object_left` 는 열쇠 줄에만 선다. 계정 채널로 「바뀌었다」를 보내는
  트리거도 없다 — 상대 화면은 다음 읽기에 바뀐다
- 다시 올리기는 하루 스무 번 한도(ADR 0125)를 쓴다 — 여섯 장이면 넉넉하다. 멈춘 동안의 거절은 한도를 안 깎는다. 칸마다 고른 보일
  자리(`focus_x` · `focus_y`)는 줄과 함께 사라진다

### 사용자 안내

화면은 1 부터 5 까지 사진 판 첫 줄로 안내한다(대장 settings-05, 확인 전). 앱에 소식(알림)을 낼 자리는 없다 — 소식의 갈래는 표의
검사식(`notification_kind_check`)으로 닫혀 있고, PRD 는 「사진은 선택이다 — 권유 화면 · 알림은 없다」(운영자 2026-10-11)다. 지울
날을 미리 알리고 싶으면 운영자가 직접 전한다 — 문안 시안은 `docs/product/gaps/records/g-120.md` 「2026-10-23 — 차단 → 지우기 → 0건 → 개방」.

## 마법사가 쓸 값

AWS 마법사(`docs/ops/runbook/security.md` 「반출」의 마법사)가 사진 버킷을 덧붙일 때 이 절을 그대로 쓴다. **접속기록 반출과 같은 계정 ·
다른 버킷 · 다른 역할이다** — 두 역할은 서로의 버킷에 닿지 않는다.

| 무엇 | 값 | 까닭 |
| --- | --- | --- |
| 버킷 이름 | `saju-photos-<무작위 몇 자>` | 버킷 이름은 전 세계에서 하나다. 반출 버킷(`saju-audit-…`)과 머리로 가른다 |
| 지역 | `ap-northeast-2`(서울) | 앱의 함수(`vercel.json` 의 `icn1`)와 같은 곳 |
| Block Public Access | 넷 다 켠다 | 사진은 공개 주소로 안 나간다 — 열람은 판정을 지난다 |
| Object Ownership | Bucket owner enforced(ACL 끔) | 객체마다 권한을 안 쓴다 |
| 버전 관리 | **끈다**(켜지 않는다) | 켜면 지운 객체가 이전 판으로 남아 「떠나면 사라진다」가 깨진다(ADR 0202) |
| Object Lock | 끈다 | 지울 수 있어야 한다 — 반출 버킷과 반대다 |
| 암호화 | 기본(SSE-S3) | |
| 수명 주기 | 「Delete expired object delete markers or incomplete multipart uploads」 — 미완료 멀티파트 1일 | 앱은 멀티파트를 안 쓰지만 도구가 끊긴 흔적을 안 남게 |
| 접두사 | `photos/` | 열쇠는 `photos/{계정 id}/{올림 id}`, 두 벌은 그 아래 `card` · `large`(`src/lib/profile/photo-variants.ts`) |
| CORS | 두지 않는다 | 브라우저가 버킷에 직접 안 닿는다(열람 방식 A, ADR 0203) |
| 앱 역할 이름 | `saju-photo-store` | 세션 이름도 같다(`app/me/photo/s3-store.ts`) — CloudTrail 에서 반출(`saju-audit-export`)과 가른다 |
| 도구 역할 이름 | `saju-photo-admin` | 사람의 AWS 프로필(SSO · MFA)에서만 받는다. Vercel 에 넣지 않는다 |

**버킷 정책 — TLS 만:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TlsOnly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::<사진 버킷>", "arn:aws:s3:::<사진 버킷>/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

**앱 역할의 신뢰 정책** — 반출 역할과 같은 꼴(Vercel OIDC, 이 프로젝트 · Production 만). 발급자 · audience · `sub` 의 모양은 반출과 같은
줄을 쓴다(`docs/ops/runbook/security.md` 「반출」 5 의 3):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<계정>:oidc-provider/oidc.vercel.com/<팀 슬러그>" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.vercel.com/<팀 슬러그>:aud": "https://vercel.com/<팀 슬러그>",
        "oidc.vercel.com/<팀 슬러그>:sub": "owner:<팀 슬러그>:project:<프로젝트 이름>:environment:production"
      }
    }
  }]
}
```

**앱 역할의 권한 정책 — 최소:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PhotoObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<사진 버킷>/photos/*"
    }
  ]
}
```

- `PutObject` — 올리기(두 벌). `DeleteObject` — 청소기와 올리기의 되돌리기(`DeleteObjects` 도 객체마다 이 권한을 본다)
- `GetObject` — 열람(안 A — 사진 라우트가 판정 뒤 읽는다, ADR 0203)
- `ListBucket` 이 없다 — 앱은 키를 DB 에서만 받는다. 버킷 밖 · `photos/` 밖에는 닿지 않는다

**도구 역할의 권한 정책**(`scripts/photo-verify.mjs` · 손 정리 — 도구는 저장소에 쓰지 않으므로 `PutObject` 가 없다):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PhotoObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<사진 버킷>/photos/*"
    },
    {
      "Sid": "PhotoList",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<사진 버킷>",
      "Condition": { "StringLike": { "s3:prefix": ["photos/*"] } }
    }
  ]
}
```

**대안 — 접근 키.** 역할을 못 세운 날만. IAM → Users → `saju-photo-store`(콘솔 접근 없음)에 앱 역할의 권한 정책을 인라인으로 걸고
Access key 하나. 교체는 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 `PHOTO_STORE_*` 줄.

## 열쇠 줄 재기

```bash
AWS_PROFILE=saju-photo-admin PHOTO_STORE_BUCKET=<사진 버킷> PHOTO_STORE_REGION=ap-northeast-2 \
  NEXT_PUBLIC_SUPABASE_URL=<운영 주소> SUPABASE_SECRET_KEY=<열쇠> node scripts/photo-verify.mjs
```

DB 의 열쇠 줄마다 두 벌의 머리(`HeadObject`)를 본다 — 있나 · 비지 않았나 · 형식이 DB 와 같은가. 어긋남이 하나라도 있으면 1 로 끝난다.
바이트 줄(옛 장)은 재지 않는다 — 열기 전에 지운다(「사진 저장소로 바꾼다」 2). 출력의 열쇠 앞 칸은 계정 id 다 — 저장소 · 이슈 · 채팅에 붙이지 않는다. 켠 뒤 월 점검에 한 번.

## 지울 줄이 안 줄 때

운영 알림 `photo-trash-stuck`(다섯 번 넘게 못 지운 객체가 있다)이 오면:

```sql
-- 보통 갈래 — 개인을 가리키지 않는 집계
select count(*) as stuck, max(attempts) as attempts, array_agg(distinct last_error) as errors
from public.photo_object_trash where attempts >= 5;
```

`npm run db:remote -- --purpose "사진 지울 줄 점검" "<위 SQL>"`. 분류가 `delete:accessdenied` 면 앱 역할의 권한 정책(`DeleteObject`)과
버킷 이름을, `delete:nosuchbucket` 이면 `PHOTO_STORE_BUCKET` 을 본다. 고친 뒤 다음 청소가 이어 지운다(다섯 번까지는 날마다, 그 뒤 간격이
길어져 길어야 이레 — `next_try_at` 을 `now()` 로 당기면 다음 청소에 든다).

## DB 와 파일의 복구 범위

DB 가 장부이고 저장소가 바이트다. 둘은 따로 되돌아간다 — **한쪽만 되돌리면 어긋난다.**

| 일 | DB | 저장소 | 사용자에게 |
| --- | --- | --- | --- |
| DB 를 앞 시점으로 되돌림 | 그 시점의 줄 — 그 뒤에 지운 장의 줄이 돌아온다 | 그 뒤에 청소기가 지운 객체는 **없다**(버전 관리를 끈다) | 돌아온 줄의 사진이 안 열린다(404) — 다시 올려야 한다 |
| 같은 되돌림 | 그 뒤에 올린 장의 줄이 사라진다 | 그 객체는 **남는다** — 어느 줄도 안 가리켜 안 열린다 | 안 보인다. 저장소의 고아다 — 지금 이것을 찾는 도구는 없다(도구 역할의 `ListBucket` 으로 `photos/` 를 훑어 `scripts/photo-verify.mjs` 의 열쇠와 견주는 손일) |
| 객체를 잘못 지움 · 버킷 사고 | 줄은 그대로 | 없다 — 다른 사본이 없다 | 그 장이 안 열린다 — 다시 올려야 한다 |
| 옛 장(바이트 줄 — 열기 전에 지운다) | 지우기 전에는 바이트가 DB 에 있다 | — | 지운 뒤에는 어디에도 없다 — 백업이 없어 되돌릴 수 없다. 다시 올려야 한다 |
| 계정 삭제 | 줄이 cascade 로 사라지고 열쇠가 지울 줄에 | 다음 청소(하루 안)에 지운다 | 지운 그 순간부터 안 열린다 |

DB 의 백업 · 되돌림 자체는 이 문서가 다루지 않는다(간극 대장의 그 줄).
