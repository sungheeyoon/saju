# 시험 지도 — 커버리지와 재지 않는 것

색인은 `docs/agents/test-map.md` 다.

## 커버리지 — 한 번 쟀다

도구를 안 들였다(`@vitest/coverage-v8` 은 devDependency 에 없다). 2026-09-22 에 `--no-save` 로
한 번 재고 값만 둔다 — 문턱도 없다.

```bash
npm i -D --no-save @vitest/coverage-v8@4.1.10
CI=1 npx vitest run --coverage --coverage.reporter=text \
  --coverage.include='src/**/*.ts' --coverage.include='app/**/*.ts' --coverage.include='app/**/*.tsx' \
  --coverage.exclude='**/*.test.ts' --coverage.exclude='**/*.generated.ts'
```

| 자리 | 파일 | 실행 줄 | vitest 가 닿은 비율 |
| --- | --- | --- | --- |
| `src/lib/saju` | 70 | 2,023 | **99.0%** |
| `src/lib/reading` | 14 | 578 | 97.4% |
| `src/lib/{input,consent,discovery,matching,people,profile,account,db}` | 16 | 312 | 91~100% |
| `src/lib/survey` | 1 | 36 | 0% → **100%**(2026-09-23, `index.test.ts` — 판단 넷) |
| `app/**/*.ts` | 61 | 899 | **31.4%** — 34 파일이 0% |
| `app/**/*.tsx` | 89 | 2,088 | **1.8%** |
| `proxy.ts` | 1 | 17 | 0% |

**낮은 수가 구멍은 아니다.** `app` 의 0% 서른넷은 액션 · 라우트 · 문(`actions.ts` ·
`route.ts` · `candidates.ts` · `same-chart.ts` …)이고, 그것들은 **흐름 검사와 pgTAP 이 실제
스택에서 잰다.** 화면 `.tsx` 는 e2e 가 잰다. `proxy.ts` 는 `notice.spec.ts` 가 밟는다. 이 표가
말하는 것은 「vitest 의 사정권이 어디서 끝나는가」이지 「무엇이 안 재어졌는가」가 아니다.
그래서 CI 에 문턱을 안 건다 — 문턱은 `.tsx` 를 `.ts` 로 억지로 옮기거나 화면 시험을 흉내 내게
만든다.

**정말로 비던 자리 셋**은 2026-09-23 에 다시 쟀다(G-47). 셋 다 vitest 0% 였다.

| 자리 | 무엇인가 | 이제 |
| --- | --- | --- |
| `src/lib/survey` | 표만이 아니었다 — 폼과 운영 화면이 부르는 **순수 판단 넷**(`afterPicking` · `isAnswered` · `withoutHidden` · `choiceLabel`) | **단위가 잰다** — `index.test.ts` 25건, 100%. 슬러그와 DB 검사식은 pgTAP `27_service_survey`, 폼을 누르는 것은 `signed-in.spec.ts` |
| `app/hash-query.ts` | `'use client'` 훅 — `window.location` · `history` · `sessionStorage` 를 구독한다. 코덱은 `src/lib/input/query.ts` 에 있고 그쪽은 이미 단위가 잰다 | **단위로 안 잰다.** 남는 것이 브라우저 구독뿐이라 jsdom 없이는 흉내가 된다. e2e 가 잰다 — `saju.spec.ts`(`#` 링크를 읽고 쓴다) · `reading-entry.spec.ts`(`#resume-reading`) |
| `app/me/reading/preview.ts` | 서버에서 계정 · 사람 행을 읽어 자기 풀이 프롬프트를 짓는 문. 조립은 `readingPromptOf` 가 하고 그쪽은 단위가 잰다 | **단위로 안 잰다.** 판단이 DB 를 읽은 값에 매여 있다. 흐름 `check-reading.mjs`(`/me/reading/inspect?kind=self`) · e2e `signed-in.spec.ts` 가 실제 스택에서 연다 |

## 계약 문구 — 글자가 곧 결정인 것

동의 확인문 · 설문 동의 철회의 삭제 결과 · 수락 때 공개되는 것과 안 되는 것 · 요청만으로 열리는 것이 없다는 약속 ·
풀이권의 임시 차감과 복구 · 승인된 채팅 한도 거절 문장은 **`scripts/copy-contracts.test.ts` 가 독립 리터럴로** 든다
(#147). 제품 상수를 가져와 견주면 둘이 함께 틀려도 초록이라서다. 화면에 뜨는지는 e2e 가 따로 잰다. 그 밖의 한글
단언(역할 이름 · 본문)은 일부러 남겼다 — 문구는 거의 안 바뀌고, 버튼 이름이 바뀌어 깨지는 것은 대개 옳은 신호다.
탈퇴 안내는 G-51 과 함께 이 표에 든다.

## 재지 않는 것

- **모델이 낸 글** — 실호출뿐이고 잠겨 있다. 프롬프트 본문이 바뀌면 사람이 한 번 돌리고 읽는다
- **구글 로그인 화면** — 남의 화면. e2e 는 세션을 만들어 쥐여 주고 가입 관문부터 밟는다
- **운영 DB** — `*.live.test.ts` 셋만, 손으로
- **화면 단위** — jsdom 이 없다. 화면의 판단은 `.ts` 로 내린다
- **`app/hash-query.ts` · `app/me/reading/preview.ts` 의 단위** — 브라우저 구독과 DB 를 읽는 문이라 위 「커버리지」 표대로 e2e · 흐름이 든다
- **커버리지 문턱** — 위 표가 까닭이다

## 어디를 봐야 하나

- `scripts/ci-plan.mjs` — 공용 위험 · 주소 대응 · 알려진 `core` 자리, 공개 출시 뒤의 세 단계. 규칙의 원본
- `.github/workflows/verify.yml` — 차선 여섯(`policy` · `core` · `anon` · `authed` · `flow` · `audit`)과 `gate`
- `playwright.config.ts` — 프로젝트 다섯(`desktop-chromium` · `mobile-chromium` · `authed-desktop` · `authed-mobile` · `notice-gate`), 서버 띄우기
- `scripts/run-checks.mjs` — 흐름 열세 벌(`SCRIPTS`)을 **전부** 돌리고 끝에 한 번 답한다(사슬이면 첫 실패가 나머지를 삼킨다)
- `e2e/session.ts` — 로컬 스택에 초대된 계정을 만든다
- `e2e/hydrated.ts` — 하이드레이션 전의 누름은 사라진다. **모든 시험의 `goto` · `reload` 가 하이드레이션까지 기다린다**(자동 손잡이, `anon.ts` · `session.ts` 가 이어받는다 — 2026-09-26). 그 뒤에 늦게 붙는 요소는 `hydrated(locator)` 로 누른다
- `e2e/target.ts` — 누르는 넓이(`elementFromPoint` 로 손가락이 닿는 자리) · 초점 테두리 · 바탕 이음매를 재는 도우미(#229)
- `supabase/tests/00_helpers.sql` — 역할을 갈아입는 헬퍼. `32_test_isolation` 이 순서 의존을 잰다
- `docs/ops/runbook/access.md` — 로컬 스택 · 접속값 여섯
- `docs/ops/runbook/signup.md` — 코드 · 날짜
