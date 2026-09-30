# 역할 — 화면 (모양 · 문구 · 디자인)

`app/**/*.tsx` 와 `app/ui/` 를 고치는 일이다. 새 동작이 붙으면 `docs/roles/feature.md` 도 읽는다.

## 먼저 읽는 것

- `docs/product/copy-ledger.md` 「01 규칙」과 고칠 화면의 줄 — **문구는 여기서 먼저 찾는다**
- `docs/agents/code-rules.md` 「화면 문구」 · `CONTEXT.md` 「8. 화면 문구 규칙」 — 말투와 표기(해요체는 ADR 0135)
- ADR 0109 — 디자인 체계는 토큰 한 벌이고 부품은 `app/ui/` 에 있다
- `docs/prd.md` 「3. 화면」 가운데 고칠 화면의 절 — 지금 모양의 원본
- `docs/architecture.md` 「새 것을 놓을 때」 — 화면은 그리기만 한다
- `docs/agents/test-map.md` 「무엇을 고쳤으면 무엇을 돌리나」의 화면 줄

## 이 저장소의 방식

- **문구는 대장 한 곳이 든다.** 대장에 있으면 그 글자를 쓰고, 없으면 표(자리 · 지금 · 제안 · 까닭)로 보이고 답을 기다린다.
  시안 · 외부 리뷰 · 에이전트의 문구는 확정이 아니다. 문구가 말하는 상태 전이(누르면 무엇이 되나 · 실패 갈래)는 코드에서 본다
- 여러 화면이 같은 사실을 적으면 상수 하나로 든다. 서비스 이름은 `src/lib/brand` 의 상수다
- 색 · 단추 · 판 · 아이콘은 `app/ui/` 와 토큰에서 가져온다 — 화면은 새 hex 를 지어내지 않는다
- **화면은 DB 를 부르지 않는다** — 문(`.ts`)이 부른다. 판단이 생기면 `.ts` 로 내려야 vitest 가 닿는다(ADR 0080)
- 시험: vitest 는 `.tsx` 를 못 그린다. 화면을 건드렸으면 커밋 전에 그 화면의 e2e 를 돈다 — 비로그인은 `npm run test:e2e`,
  로그인 뒤는 `npm run test:e2e:signed-in` · `npm run test:e2e:match` · `npm run test:e2e:chat`. **로컬 스택의 시험 계정으로 돈다** —
  운영에 로그인해 보는 smoke 와 아이폰 확인은 운영자 몫이다. 문구만 바뀐 라운드는 안 돌린다(e2e 가 그 글자를 붙들면 스펙만 고친다)
- 입구 파일(`page` · `layout` · `loading` · `error` …)은 CI 가 머지 전에 e2e 전부를 돈다(`docs/agents/test-map.md` 「CI」)
- `app/` 아래 `icon` · `opengraph-image` · `manifest` 같은 파일 이름은 Next 에게 특별하다 — 화면을 바꾼 병합 뒤 `npm run build` 한 번
- 뜻을 바꾸지 않는 다듬기(여백 · 정렬 · 반응형 · 포커스)는 전후 스크린샷이 근거다

## 하지 않는 것 · 묻는 것

- **새 사용자 문구 · 화면 흐름 · 메뉴 구조는 결정이다** — PR 까지 만들고 머지하지 않는다(`docs/agents/delegation.md` 「결정 점검표」 ·
  「무인 라운드」). 예외는 `/ops/**` 의 운영자 전용 설명뿐이다
- 남이 띄운 dev 서버(3000)는 죽이기 전에 묻는다. 그 서버를 재사용한 e2e 는 운영 DB 를 본다(`docs/agents/delegation.md` 「로컬 환경의 함정」)
- 운영 배포는 안 한다 — 머지는 배포가 아니다

## 끝날 때 고치는 것

- [ ] 확정된 문구 → `docs/product/copy-ledger.md` 에 줄을 더한다(그 PR 이)
- [ ] 화면의 모양 · 차례가 PRD 와 달라졌으면 → `docs/prd.md` 그 절과 `docs/product/prd-changelog.md`
- [ ] 토큰 · 공용 부품의 규칙을 바꿨으면 → ADR 0109 추기 또는 새 ADR
- [ ] 화면에 새 이름이 섰으면 → `CONTEXT.md`
- [ ] PR 「돌린 것」에 e2e 명령과 결과, 「문서」에 결정 여부, 화면이 바뀐 것은 전후 스크린샷
