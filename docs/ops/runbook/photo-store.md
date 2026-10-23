# 운영 절차 — 사진 저장소 (G-120, ADR 0202)

색인은 `docs/ops/runbook.md` 다.

사진의 바이트를 AWS S3 서울에 두는 일. **지금은 꺼져 있다** — `PHOTO_STORE_*` 다섯이 운영에 없으면 사진은 DB(`profile_photo.bytes`)에
산다. 켜는 길과 그 뒤의 손일을 여기 적는다. 설계는 ADR 0202, 규격 · 출처 · 열람 방식의 안은 `docs/product/gaps/records/g-120.md`.

## 사진 저장소를 켠다

**차례가 곧 안전이다 — 4 를 1 ~ 3 보다 먼저 하면 새로 올린 사진이 아무에게도 안 보인다**(열쇠 줄은 열람 방식이 정해지기 전까지 404).

1. **열람 방식 · 청소 주기가 정해졌다**(G-120 의 결정) — 그 구현(올리는 문 넷을 `authenticated` 에 여는 마이그레이션 포함 — 지금은
   `20261227120000` 이 닫아 두었다)이 main 에 있고 운영에 배포됐다. **처리방침과 대조한다** — 위탁 표의 AWS 목적(지금 접속기록 사본뿐,
   `docs/legal/` 의 처리방침 초안)과 탈퇴 뒤 「3일 안 파기」가 청소 주기 · 실패 때의 지연과 맞는가
2. **마이그레이션** `20261227090000` 이 운영 DB 에 있다(`supabase migration list` 의 remote 칸)
3. **AWS** — 아래 「마법사가 쓸 값」의 버킷 · 역할을 세운다(마법사가 돌면 그 출력의 이름을 쓴다)
4. **Vercel** — Settings → Environment Variables → **Production** 에 `PHOTO_STORE_BUCKET` · `PHOTO_STORE_REGION`(`ap-northeast-2`) ·
   `PHOTO_STORE_ROLE_ARN` 셋. 대안(접근 키)이면 역할 대신 `PHOTO_STORE_ACCESS_KEY_ID` · `PHOTO_STORE_SECRET_ACCESS_KEY`(Sensitive) —
   **둘을 함께 넣으면 오설정이다**(올리기는 DB 길로 가고 청소기가 500). 최신 Production 을 Redeploy 하고 Ready 를 본다. 값은 문서 ·
   채팅 · 커밋에 적지 않는다
5. **확인** — 사람이 운영 계정으로 프로필 사진을 한 장 올린다 → 칸에 선다 → S3 콘솔의 `photos/<계정 id>/` 아래 `card` · `large` 가
   있다 → 그 장을 지운다 → 다음 날 청소 뒤 두 객체가 없다. 청소 크론의 응답(`/api/cron/photo-sweep`, Vercel 의 Cron 로그)이 200 이고
   `{"ticketsMoved":…,"deleted":…,"failed":0,"errorClass":null,"alerted":false}` 꼴이다(`app/api/cron/photo-sweep/sweep.ts` 의
   `SweepResult` — `configured` 칸은 없다). `{"configured":false}` 면 아직 꺼져 있다 — 4 의 값이 그 배포에 안 들었다
6. **옛 사진을 지우고 다시 받는다** — 아래 「켠 뒤 옛 사진을 지우고 다시 받는다」. 5 의 확인이 끝난 뒤다

**끄는 길 — 끄기 전에 지울 줄을 비운다.** 끄면 청소기도 멈춘다(「설정 안 됨」) — 그 사이 탈퇴 · 지운 장의 객체가 저장소에 남는다. 그래서
① 아래 「지울 줄이 안 줄 때」의 집계 질의에서 줄 수가 0 인지 보고(크론을 손으로 한 번 부를 수 있다), ② 4 의 값을 지우고 Redeploy. 새
올리기는 DB 길로 돌아가고, 이미 저장소에 사는 장은 저장소에 남는다(열람이 저장소를 읽으므로 그 장은 켤 때까지 안 열린다).

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
| CORS | 두지 않는다 | 브라우저가 버킷에 직접 안 닿는다(열람 방식 A). B · C 를 고르면 그 PR 이 정한다 |
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
- `GetObject` — 열람(어느 안이든 쓴다 — A 는 함수가 읽고, B · C 는 서명이 이 권한을 빌린다). 열람 방식이 정해지기 전에는 앱이 부르지 않는다
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

## 켠 뒤 옛 사진을 지우고 다시 받는다

**옮기지 않고 지운다(운영자 결정 2026-10-23, ADR 0202 의 둘째 덧붙임).** 옛 장은 바이트 줄(`profile_photo.bytes`, 긴 변 512px)이다.
지우는 것은 바이트 줄뿐이고 열쇠 줄(켠 뒤 올린 장)은 남긴다. **되돌릴 수 없다 — 운영 DB 에 백업이 없다**(Supabase Free, 간극 대장
G-63). 지운 바이트는 저장소에도 없다(옮기지 않았다).

**차례 — 켜기 → 안내 → 지우기.** 켜기 전에 지우면 켜는 날까지 사진이 비고, 그 사이 다시 올린 장도 DB 길로 가 또 지워야 한다. 켠 뒤에
지우면 안내를 받고 먼저 바꿔 올린 장(「사진 변경」 · 새 장)은 열쇠 줄이라 남아, 그 사람에게는 빈 사진 창이 없다.

1. **「사진 저장소를 켠다」 1 ~ 5 가 끝났다** — 새로 올린 장이 저장소에 서고(5 의 확인), Production 에 `PHOTO_STORE_*` 가 들었다
2. **대상을 잰다** — 개인을 가리키지 않는 집계만(ADR 0105):

   ```sql
   select count(*) filter (where bytes is not null) as byte_rows,
          count(distinct user_id) filter (where bytes is not null) as byte_users,
          coalesce(sum(octet_length(bytes)), 0) as byte_total,
          count(*) filter (where object_key is not null) as key_rows
   from public.profile_photo;
   ```

   `npm run db:remote -- --purpose "사진 삭제 대상 집계(G-120)" "<위 SQL>"`. `byte_rows` · `byte_users` · `key_rows` 를 적어 둔다.
   2026-10-23(꺼진 때) 값은 `byte_rows` 2 · `byte_users` 2 · `byte_total` 50,634(49 kB) · `key_rows` 0
3. **사용자에게 알린다** — `byte_users` 명에게 「며칠에 사진이 지워진다 · 그 전에 바꿔 올리면 그대로다」. 앱에는 이 소식을 낼 자리가
   없다(소식의 갈래는 표의 검사식으로 닫혀 있다 — 새 갈래는 마이그레이션 · 화면이 드는 결정이다). 지금 인원은 운영자가 직접 전한다 —
   문안 시안은 `docs/product/gaps/records/g-120.md` 「2026-10-23 밤 — 옛 사진은 지우고 다시 받는다」
4. **지운다** — 문장 하나라 한 거래다. 중간에 실패하면 아무것도 안 바뀐다(같은 사람이 그 순간 올려 자리가 부딪히면 실패한다 — 다시
   부른다). 바이트 줄을 지우고, 남은 열쇠 줄의 자리를 1 부터 빈틈없이 다시 붙인다(자리는 1..k 여야 한다 — `20261026090000`):

   ```sql
   with gone as (
     delete from public.profile_photo where bytes is not null returning user_id
   ), kept as (
     select user_id, position,
            (row_number() over (partition by user_id order by position))::smallint as n
     from public.profile_photo where bytes is null
   ), moved as (
     update public.profile_photo p set position = k.n
     from kept k
     where p.user_id = k.user_id and p.position = k.position and p.position <> k.n
     returning p.user_id
   )
   select (select count(*) from gone) as deleted_rows,
          (select count(distinct user_id) from gone) as deleted_users,
          (select count(*) from moved) as moved_rows;
   ```

   `npm run db:remote -- --purpose "옛 사진 지우기(G-120)" "<위 SQL>"`. `deleted_rows` 가 2 의 `byte_rows` 이하다(그 사이 바꿔 올린 장만큼
   적다). 자리의 기본키는 문장 끝에 잰다(`deferrable`) — 한 문장 안에서 당겨 앉아도 부딪히지 않는다
5. **지운 뒤 잰다**:

   ```sql
   select (select count(*) from public.profile_photo where bytes is not null) as byte_rows,
          (select count(*) from public.profile_photo where object_key is not null) as key_rows,
          (select count(*) from (select user_id from public.profile_photo group by user_id
                                 having max(position) <> count(*)) g) as gapped_users;
   ```

   `byte_rows` 0 · `gapped_users` 0 · `key_rows` 는 4 앞과 같다(바이트 줄에는 열쇠가 없어 지울 줄에도 아무것도 안 간다)

**지우면 일어나는 것**(코드에서 잰 것, 2026-10-23):

- 지운 사람은 다음 읽기부터 **사진 없는 사람**이다 — 사진 유무(`has_photo`) · 장 수(`photo_count`) · 대표 사진(1번)은 저장된 값이
  아니라 읽을 때 `profile_photo` 를 센다(`my_discovery_board` · `my_matches` · `my_chat_rooms` 등, `20261203090000`). 카드 · 아바타 ·
  상대 시트는 사진 없는 사람의 기본 표시로 선다. 이미 받은 사진은 브라우저 캐시(`private, max-age=60`)만큼 1분 남는다
- **목록에서 빠지는 사람은 없다** — 덱을 채우는 문(`fill_discovery_deck` · `discovery_pair_eligible`)은 사진을 안 본다. 가입 ·
  내 명식 등록 · 요청 · 채팅도 사진을 묻지 않는다(사진은 선택이다 — PRD 「이름과 얼굴」)
- 지울 줄 · 청소기 · 저장소는 그대로다 — 트리거 `profile_photo_object_left` 는 열쇠 줄에만 선다. 계정 채널로 「바뀌었다」를 보내는
  트리거도 없다 — 상대 화면은 다음 읽기에 바뀐다
- 다시 올리기는 하루 스무 번 한도(ADR 0125)를 쓴다 — 여섯 장이면 넉넉하다. 칸마다 고른 보일 자리(`focus_x` · `focus_y`)는 줄과 함께 사라진다

## 열쇠 줄 재기

```bash
AWS_PROFILE=saju-photo-admin PHOTO_STORE_BUCKET=<사진 버킷> PHOTO_STORE_REGION=ap-northeast-2 \
  NEXT_PUBLIC_SUPABASE_URL=<운영 주소> SUPABASE_SECRET_KEY=<열쇠> node scripts/photo-verify.mjs
```

DB 의 열쇠 줄마다 두 벌의 머리(`HeadObject`)를 본다 — 있나 · 비지 않았나 · 형식이 DB 와 같은가. 어긋남이 하나라도 있으면 1 로 끝난다.
바이트 줄(옛 장)은 재지 않는다 — 켠 뒤 지운다(위 절). 출력의 열쇠 앞 칸은 계정 id 다 — 저장소 · 이슈 · 채팅에 붙이지 않는다. 켠 뒤 월 점검에 한 번.

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
| 옛 장(바이트 줄 — 켠 뒤 지운다) | 지우기 전에는 바이트가 DB 에 있다 | — | 지운 뒤에는 어디에도 없다 — 백업이 없어 되돌릴 수 없다. 다시 올려야 한다 |
| 계정 삭제 | 줄이 cascade 로 사라지고 열쇠가 지울 줄에 | 다음 청소(하루 안)에 지운다 | 지운 그 순간부터 안 열린다 |

DB 의 백업 · 되돌림 자체는 이 문서가 다루지 않는다(간극 대장의 그 줄).
