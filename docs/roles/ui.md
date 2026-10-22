# 역할 — 화면 (모양 · 문구 · 디자인)

`app/**/*.tsx` 와 `app/ui/` 를 고치는 일이다. 새 동작이 붙으면 `docs/roles/feature.md` 도 읽는다.

## 먼저 읽는 것

- `docs/product/copy-ledger.md` 「무리 색인」 · 「01 규칙」 — 대장의 머리: 어느 무리 파일에 어느 절이 사나 · 절 번호를 다는 법 · 버튼과 닫기의 규칙. **문구는 대장에서 먼저 찾는다** — 찾는 자리는 아래 「닿을 때 여는 것」
- `docs/agents/code-rules/screen-copy.md` 「화면 문구」 · `docs/context/copy.md` 「8. 화면 문구 규칙」 — 말투와 표기(해요체는 ADR 0135)
- ADR 0109 — 디자인 체계는 토큰 한 벌이고 부품은 `app/ui/` 에 있다
- `docs/product/prd/screens.md` — 모든 화면의 규칙 · 무리 색인 · §3.2 버튼은 동사로 갈린다
- 하나를 고른다 — 고칠 화면의 무리(둘에 걸치면 둘 다)
  - 첫 화면 · 사주 보기 — `docs/product/prd/screens/first.md`
  - 로그인 · 가입 · 안내 화면 — `docs/product/prd/screens/public.md`
  - 홈 · 저장한 사람 · 풀이 — `docs/product/prd/screens/home.md`
  - 궁합 — `docs/product/prd/screens/compat.md`
  - 인연 · 채팅 · 소식 — `docs/product/prd/screens/matching.md`
  - 설정 · 프로필 · 설문 — `docs/product/prd/screens/settings.md`
  - 결제 · 풀이권 — `docs/product/prd/screens/credits.md`
  - 운영 화면 · 작업대 — `docs/product/prd/screens/ops.md`
- `docs/architecture.md` 「새 것을 놓을 때」 — 화면은 그리기만 한다
- `docs/agents/test-map/what-to-run.md` 「무엇을 고쳤으면 무엇을 돌리나」의 화면 줄

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [화면 문구](../agents/code-rules/screen-copy.md#화면-문구) · [문구 대장의 규칙](../product/copy-ledger.md#01-규칙--버튼은-결과를-말하고-닫는-것은-취소다) — 대장에 없으면 실사례를 출처와 함께 넣고 나중에 확인받는다 · 같은 사실은 상수 하나
- [그 밖의 자리](../architecture.md#그-밖의-자리) · [새 것을 놓을 때](../architecture.md#새-것을-놓을-때) — 토큰과 `app/ui/` · 화면은 DB 를 부르지 않는다(ADR 0109 · 0080)
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나) — 로컬 최소 · e2e 의 예외
- [끝났다는 것](../agents/delegation/done.md) — 전후 그림은 저장소 밖 제 폴더에 두고 경로를 보고

## 하지 않는 것 · 묻는 것

- 화면 흐름 · 메뉴 구조는 결정이다 — PR 까지 만들고 머지하지 않는다. 새 문구는 사후 확인이라 머지까지 가지만, 권한 · 보존 · 요금 · 환불에도 걸리면 결정이다([결정 점검표](../agents/delegation/decisions.md) · [무인 라운드](../agents/delegation/unattended.md))
- 남이 띄운 dev 서버(3000)는 죽이기 전에 묻는다 — 그 서버를 재사용한 e2e 는 운영 DB 를 본다([로컬 환경의 함정](../agents/delegation/local-env.md))
- 운영 배포 · 운영 smoke 는 안 한다 — 머지는 배포가 아니다([권한 등급](../agents/delegation/permissions.md) · [운영 역할](ops.md))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯 · 전후 그림은 커밋하지 않고 경로를 보고. 「문서」 칸이 고칠 원본을 든다
- [ ] 넣은 문구 → 「확인 전」 절(출처와 함께, #770 에 한 줄)로, 운영자가 정해 준 문구는 「확정 문구」 절로 — 그 화면의 무리 파일(`docs/product/copy-ledger/`) 끝에 그 파일 이름을 단 다음 번호의 절(`settings-01` 꼴)로 더한다(그 PR 이). 번호가 끊기면 시험이 붉다 — 번호를 다는 법은 대장 머리의 「무리 색인」. 여러 무리에 걸친 줄은 머리의 「검토 대기」 앞에 `all-NN`
- [ ] 토큰 · 공용 부품의 규칙을 바꿨으면 → ADR 0109 추기 또는 새 ADR

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 화면 글자를 하나라도 바꾸거나 새로 쓰면 → [고칠 화면의 대장 무리 파일](../product/copy-ledger/) — 고칠 자리(파일 이름 · 지금 글자)로 그 무리 파일과 대장 머리 `docs/product/copy-ledger.md` 의 여러 무리에 걸친 줄(탭 · 서비스 이름 · 확인창 · 출생 정보 폼 · 실패 줄)을 찾는다. 있으면 그 문구를 쓴다(ADR 0169). 옛 글자(제목 · 단추)를 `e2e/` 에서 grep 해 스펙도 같이 고친다([일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것) 「사용자와」)
- e2e 를 돌려야 하나 망설이거나 CI 의 주소 차선이 붉으면 → [CI](../agents/test-map/ci.md#ci)
- dev 서버를 띄우거나 `next build` 를 돌리면 → [로컬 환경의 함정](../agents/delegation/local-env.md) — 남의 dev 서버 · `next build` 만 잡는 파일 이름
- 무인(밤) 라운드로 맡았으면 → [무인 라운드](../agents/delegation/unattended.md) — 뜻을 바꾸지 않는 다듬기의 경계
- 전후 그림을 찍으면 → [워크트리에서 전후 그림 찍기](../agents/delegation/local-env.md#워크트리에서-전후-그림-찍기) — 자체 로컬 DB · 진짜 `node_modules` · `UI_ONLY` · `aria-disabled` 단추 · 로그인 spec 이름 · Docker 없이 꾸민 데이터로
- 화면의 동작(흐름 · 상태)까지 바꾸면 → [PRD 색인](../prd.md) — 무리 파일 머리가 가리키는 그 영역 절(§4 · §5 · §6 · §7.1). 새 동작이면 `feature` 역할도 읽는다
- 서비스 이름이나 로고가 바뀌면 → [ADR 0149](../adr/0149-the-service-is-named-mannaljido-and-the-footer-carries-the-business-information.md) 의 1 · 5 — 상수를 따라오지 않는 셋: 이름 뒤에 글자로 붙인 조사(은/는/을/를) · 이름이나 로고를 구운 그림(`scripts/brand-share-images.mjs`) · Next 가 빌드에서만 보는 탭 그림(`app/favicon.ico` · `app/apple-icon.png` · `app/icon.svg`, `scripts/brand-icons.mjs`)
