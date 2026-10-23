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
6. **옛 사진은 옮기지 않는다** — 아래 「옛 사진은 DB 에 남는다」

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

**도구 역할의 권한 정책**(`scripts/photo-verify.mjs` · 손 정리 — 옛 사진을 옮기지 않으므로 `PutObject` 가 없다):

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

## 옛 사진은 DB 에 남는다

**옮기지 않는다(운영자 판단 2026-10-23, 운영 베타).** 한 줄은 바이트 또는 열쇠를 들고, 바이트 줄은 저장소를 켠 뒤에도 지금 길로
그대로 열린다 — 옛 장은 DB 에 남고, 사람이 그 장을 바꾸거나 새로 올리는 장부터 저장소에 산다. 옮기는 도구와 그 DB 문 셋은
`20261227150000` 이 걷었다(ADR 0202 의 덧붙인 문단). 옛 장의 화질은 그대로다(긴 변 512px).

## 열쇠 줄 재기

```bash
AWS_PROFILE=saju-photo-admin PHOTO_STORE_BUCKET=<사진 버킷> PHOTO_STORE_REGION=ap-northeast-2 \
  NEXT_PUBLIC_SUPABASE_URL=<운영 주소> SUPABASE_SECRET_KEY=<열쇠> node scripts/photo-verify.mjs
```

DB 의 열쇠 줄마다 두 벌의 머리(`HeadObject`)를 본다 — 있나 · 비지 않았나 · 형식이 DB 와 같은가. 어긋남이 하나라도 있으면 1 로 끝난다.
바이트 줄(옛 장)은 재지 않는다 — DB 에 산다. 출력의 열쇠 앞 칸은 계정 id 다 — 저장소 · 이슈 · 채팅에 붙이지 않는다. 켠 뒤 월 점검에 한 번.

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
| 옛 장(바이트 줄 — 옮기지 않는다) | 바이트가 DB 에 있다 | — | DB 를 따라 되돌아간다(지금과 같다) |
| 계정 삭제 | 줄이 cascade 로 사라지고 열쇠가 지울 줄에 | 다음 청소(하루 안)에 지운다 | 지운 그 순간부터 안 열린다 |

DB 의 백업 · 되돌림 자체는 이 문서가 다루지 않는다(간극 대장의 그 줄).
