# 만세력 (Saju)

생년월일시에서 사주를 도출하고, 두 사람 사이에 성립하는 관계를 **판정이 아니라 사실로**
내는 서비스. 이 문서는 용어집이다 — 구현도 스펙도 여기 적지 않는다. 무엇을 만드는가는
`docs/prd.md`, 어디에 놓는가는 `docs/architecture.md`, 어떻게 적는가는
`docs/agents/code-rules.md` 가 답한다.

**읽는 법.** 용어마다 첫 줄이 **이름 — 코드에서 부르는 이름 : 한 줄 정의**다. 그 아래는
그 정의를 지키는 까닭이고, `_Avoid_` 는 같은 것을 다르게 부르던 말이다. 용어의 뜻은 한국어로
설명하고 코드 이름은 영어로 적으므로 둘을 잇는 표가 §9 에 있다 — **그 표의 식별자가 코드에 실제로 있는지는
`scripts/code-rules.test.ts` 가 잰다.** 이름이 어긋난 자리는 §10 이 든다. 2026-09-22 에 주제별로
다시 묶었다(ADR 0088). 그 전에는 「(이어서)」 서른 절이 쓰인 차례대로 쌓여 있었다.

## 1. 사람과 계정

**Person** — `person` 표 · `user_person_access` 엣지 : 사용자가 사주를 보고 싶어 저장해 둔
한 사람. 자기 자신을 포함한다.
_Avoid_: 프로필, 상대방, 유저

**User** — `app_user` 표 · `AccountState` : 로그인한 계정 주체. 여러 **Person** 을 소유한다.
_Avoid_: 회원, 사용자(문맥에 따라 Person 과 헷갈림)

**selfPerson** — `app_user.self_person_id` · `create_self_person` : 한 **User** 가 자기
자신이라고 지정한 **Person**. User↔Person 사이의 관계이지 Person 의 속성이 아니다 —
같은 사람이 다른 계정에서는 「나」가 아니다.
_Avoid_: isSelf, 내 사주, 본인 프로필

**localLabel** — `user_person_access.local_label` : 한 **User** 가 어떤 **Person** 을 부르는
이름(「엄마」, 「전여친」). 같은 Person 이 다른 User 에게는 다르게 불리므로 Person 이 아니라
**엣지**가 든다. **닉네임과 다르다** — 내 목록 안에서만 쓰는 말이고 남에게 안 보인다. 단,
**selfPerson 의 localLabel 은 계정 닉네임을 그대로 따른다** — 자기 이름을 두 군데서 고쳐
서로 어긋나지 않게 하기 위해서다.
_Avoid_: relationship, Person.name, 닉네임

**닉네임** — `app_user.nickname` · `nicknameKey` : **User** 가 앱 안에서 불리는 **하나뿐인
이름**. 가입할 때 짓고 2~8자이며 다른 사람과 같을 수 없다. 매칭·요청·소식 어디서나 이
이름이 선다. 참여의 부속물이 아니라 **계정의 것**이라 `app_user` 가 든다 — 인연 찾기에
참여하지 않는 사람도 이름이 있다.
_Avoid_: 별명, 공개용 별명, 표시 이름

**프로필 사진** — `profile_photo` 표 · `photo_of` : **닉네임** 옆에 서는 선택 값. 올린 사람만
서고 없으면 이름의 첫 글자가 선다. 바이트는 Postgres 안에 있고 계정에 cascade 로 매여
있다 — 지우는 일이 **열쇠를 따라가게** 하려는 것이다(ADR 0023). 볼 수 있는 조건은 「지금
그 사람의 이름이 내게 보이는가」와 같다.
_Avoid_: 아바타, 사진첩

**계정 상태** — `app_user.status` · `AccountState` : 계정이 어디에 서 있는가. **정상 · 탈퇴 대기 ·
탈퇴 · 이용 정지** 넷이고 **앱 전체가 이 이름과 문구를 쓴다** — 표는 `docs/prd.md` §5.3 이 든다
(2026-09-23, 사용자가 정했다). 「삭제」는 계정의 상태 이름에 안 쓴다 — 자료의 삭제(처리방침의
열람 · 정정 · 삭제 · 처리정지)와 다른 일이다. 사람 **사이**의 상태(연결됨 · 차단됨)는 계정 상태가
아니다 — 차단은 상대의 계정을 정지시키거나 탈퇴시키지 않는다.
_Avoid_: 회원 상태, 계정 등급

**이용 정지** — `app_user.status` 의 `suspended` · `AccountStatus` : 운영자가 **User** 의 자격을
거둔 상태. 화면 문구는 **`이용이 정지된 계정입니다.`** 계정은 그대로 있고 **자기 계정의 `status`
만 읽어** 정지된 사실을 확인할 수 있다 — Person · 목록 · 프로필 같은 자기 자료는 읽지도 쓰지도
못한다(정책이 `is_active_account()` 로 막는다, pgTAP 08). 화면은 자료가 지워진 것이 아니라 정지된
것이라고 말하고, 그 한 줄을 말할 근거가 상태 한 칸이다. 운영자가 이 상태를 거는 일을 **제재**라
부르고, 그것은 **신고의 결론이지 신고 자체가 아니다** — 어느 표에도 처분을 적지 않고 `status` 한
자리가 든다. 신고 기록에는 「봤다」만 남는다.
_Avoid_: 중지(2026-09-23 까지의 이름), 삭제, 차단, 잠김

**계정을 못 읽음** — `AccountRead` · `readAccount` : 지금 이 화면이 **User** 의 자격을 확인하지
못한 상태. **이용 정지와 다르다** — 정지는 우리가 아는 사실이고 이것은 우리가 모르는 것이다.
모르는 것을 아는 것처럼 말하면, 아무 일도 없는 사람에게 「이용이 정지된 계정입니다」가 선다. 못
읽는 까닭은 둘이고 **사용자에게 할 말이 다르다** — 계정이 그 자리에 없거나(다시 들어오라고
한다), 지금 물어볼 수 없거나(잠시 뒤에 다시 보라고 한다). 뒤엣것에 다시 로그인을 시키면
들어올 곳이 없는 데로 보내는 것이다.
_Avoid_: 오류, 이용 정지(모르는 것을 아는 것처럼 말한다), 없는 계정

**탈퇴 대기** — `app_user.status` 의 `deletion_requested` · `requestAccountDeletion` :
사용자가 탈퇴를 신청했고 처분(신청 뒤 3일 이내)이 끝나기 전인 상태. 화면 문구는 **`탈퇴를
신청한 계정입니다.`** **탈퇴가 아니다** — 접수되면 후보 노출이 꺼지고 살아 있던 요청이
정리되고 바깥으로 나가는 길이 다 막히지만, 저장된 자료는 그 자리에서 지워지지 않는다. 실제
처분은 크론이 하고(`dispose_requested_accounts`, runbook 「탈퇴 신청의 처리」) 무엇이 지워지고 남는지는 **탈퇴** 항목이 든다.
이미 성립한 **Match** 와 **대화방**처럼 두 사람의 것인 기록은 한쪽이 지울 수 없다.
_Avoid_: 계정 삭제 요청 · 삭제 요청(2026-09-23 까지의 이름), 삭제(그 자리에서 사라진다고 읽힌다)

**탈퇴** — `partner_left` · `LEFT_USER_LABEL` : 탈퇴 대기가 크론의 처분(`forget_user`)을
마친 상태. `app_user` 에 값이 따로 없다 — **행이 사라지는 것이 곧 이 상태**이고, 남은 자리에서는
**그 사람을 가리키던 칸이 빈 것**으로 읽힌다(ADR 0094). 떠난 사람 혼자의 것은 지워지고, **함께 보던
궁합**(동의 당시 그 사람의 여덟 글자와 그 궁합풀이)도 지워진다 — 신청 때부터 상대의 목록에서
내려가 있었다. **대화방과 메시지는 남는다** — 떠난 쪽의 자리만 비고 남는 쪽이 닫힌 날부터 90일까지
본다. 그 방에서 그 사람의 이름이 서던 자리에는 닉네임 대신 **`탈퇴한 사용자`** 가 서고, 닫힌 방
안내는 넷째 줄 **`탈퇴한 사용자입니다. 더 이상 대화할 수 없습니다.`** 다. 그 사람이 든 **신고 기록**은
지워지기 전에 떨어진 자리로 옮겨져 처분일부터 6개월 남는다 — 운영자만 읽는다(ADR 0098).
_Avoid_: 삭제된 계정, 떠난 사용자(2026-09-23 까지의 후보), 탈퇴 완료(「탈퇴」가 곧 끝난 상태다)

**운영자** — `operator` 표 · `Operator` : `public.operator` 에 줄이 있는 사람. 그 표는 **「이
사람이 운영자인가」에만 답하고**, 무엇을 더 할 수 있는지는 문마다 따로 정한다 — 깃발이
문을 여는 것이 아니라 문이 깃발을 묻는다. 그래서 「운영자 권한」이라는 하나의 덩어리는
없고, 운영자라는 이름으로 열리는 문의 목록은 **그 이름을 묻는 자리의 개수**다(설문을 읽는
함수 넷, ADR 0061). SQL 로 넣고 앱에는 이 표에 닿는 길이 없다. **풀이권 예외는 여기 안
딸려 온다** — 그것은 **얼마나**에 답하는 다른 표이고(ADR 0043), 합치면 운영자가 되는 것이
곧 풀이권을 더 받는 것이 된다.
_Avoid_: 관리자, 어드민, 운영자 권한(무엇이 열리는지 말하지 않는다)

**운영 검증 계정** — `verification_account` 표 : 제품을 확인하려고 누르는 계정. **「이 시도가
검증용인가」에만 답하고 아무 문도 열지 않는다** — 하루 상한은 이 계정의 시도도 세고(토큰은 나간다),
지출 표가 그 수를 따로 낸다. 운영자와 다른 표인 까닭은 풀이권 예외와 같다 — 지금은 같은 사람이지만
운영자가 실제로 써 보는 날, 또는 운영자가 아닌 시험 계정을 세우는 날 두 물음이 갈린다(G-03).
주소는 저장소에 안 적고 운영자가 SQL 로 넣는다.
_Avoid_: 테스트 계정(픽스처 계정과 헷갈린다), 관리자 계정

**신고** — `report` 표 · `report_user` · `reportUser` : 운영자가 봐야 할 일이 있었다고
남기는 **기록**. **차단이 아니다** — 상대에게 알리지 않고, 후보 목록에서 사라지게 하지도
않는다. 되돌릴 수 없는 개인적 결정인 차단과 달리 **사건이라 여러 번 쌓인다** — 같은
사람에게 두 번 일어난 일은 두 건이다. 마주친 적 있는 사람만 신고할 수 있다 — 안 그러면
이 문이 「그 계정이 있는가」를 묻는 문이 된다.
_Avoid_: 차단, 숨김, 제재(제재는 운영자가 하는 것이고 신고는 그 근거일 뿐이다)

**차단** — `block` 표 · `blockUser` : 그 사람과의 접촉을 끊는 결정. **양방향이고 되돌리지
않는다** — 서로의 후보 목록에서 사라지고, 살아 있던 **pending 요청**도 그 자리에서
거둬진다. 이미 성립한 **Match** 는 목록에서 내려가되 기록은 남는다. **대화방**은 닫히되 둘의
목록에 남고 둘 다 이전 대화를 본다(**닫힘**, ADR 0091). 사이가 막혔다는 문구는
**`차단되어 대화할 수 없습니다.`** — 계정 상태가 아니라 두 사람 사이의 상태다.
_Avoid_: 숨김, 신고, 정지(계정이 정지된 것이 아니다)

**관계**
- 한 **User** 는 여러 **Person** 을 소유하고, 정확히 하나의 **selfPerson** 을 가리킨다
- **User** ↔ **Person** 은 다대다다. 그 엣지(`user_person_access`)가 **localLabel** 과 권한을 든다

**갈렸던 것**
- 「나」가 **Person** 의 속성인지 **User** 의 지정인지 — 해소: User 의 지정(`self_person_id`).
  같은 사람이 다른 계정에서는 「나」가 아니다.
- 「엄마」가 **Person** 의 속성인지 관계의 라벨인지 — 해소: 라벨(**localLabel**). 한 Person 은
  누군가에겐 엄마고 누군가에겐 배우자다.
- 「탈퇴 대기」와 「이용 정지」가 같은 상태여야 하는지 — 해소: **막는 것은 같고
  이유가 다르다.** 값을 하나로 합치면 화면이 「이용이 정지된 계정입니다」라고만 말하게 되고,
  자기가 신청해서 그렇게 된 사람에게 그 문장은 거짓이다. 그래서 `status` 에 값을 하나 더하되 **새
  관문은 두지 않았다** — 이미 모든 문이 `status = 'active'` 를 묻고 있으므로 고칠 문이 없다.
  좁힘을 두 자리에 적으면 바깥쪽 문이 하나를 빠뜨린다.
- 「중지 · 계정 삭제 요청 · 떠난 사용자」냐 「이용 정지 · 탈퇴 대기 · 탈퇴한 사용자」냐 — 해소:
  **뒤의 것**(2026-09-23, 사용자). 국내 서비스에서 익숙한 말이고, 이 이름이 앱 전체의 기준이다.
  용어집이 「정지」를 피하던 까닭(되돌릴 수 있는지 말하지 않는다)은 낱말이 아니라 문장이 답할
  일이라 접었다. 「삭제」는 계정 상태에서 걷는다 — 처리방침의 「삭제」는 자료의 것이라 남는다.

## 2. 입력과 명식

**입력** — `SajuInput` : **명식**을 도출하는 데 필요한 값 한 벌 — 생년월일시, 출생지, 성별,
그리고 결과가 갈리는 **옵션**까지 포함한다.
_Avoid_: 생년월일, 사주 정보

**저장된 입력** — `StoredInput` · `person` 의 여덟 칸 · `write_person_input` : **Person** 이 지금
들고 있는 **입력** 한 벌. 고치면 **그 자리를 고친다** — 이전 입력을 쌓아 두지 않고, 사용자가
과거 값을 고르거나 되돌리는 길도 없다(ADR 0071). 이미 나온 글은 그때의 **여덟 글자
스냅샷**을 스스로 들고 있어 안 움직인다. 이것을 **명식**으로 세우는 일은 **한 자리에서만**
한다 — 읽는 문(`storedInputOf`)이 행을 집어 오고(없거나 못 보면 `null`), 세우는 문
(`storedChartOf`)이 **입력과 명식을 함께** 낸다(ADR 0072). 못 읽으면 기본값으로 메우지 않고
**못 읽는다고 값으로 말한다**. 그 밖의 계산 오류는 값이 아니라 예외다 — 사용자가 고칠 수
있는가가 그 둘을 가른다. **화면에 「판본」이라고 적지 않는다**(ADR 0026) — 사용자 문장에 그
낱말이 새는지는 `consent.test.ts` 가 전부 훑는다.
_Avoid_: 판본, 현재 판본, 저장된 명식, 저장된 출생 정보(같은 것의 옛 이름), revision, 수정 이력

**옵션** — `SajuOptions` · `TimeBasis` · `LATE_NIGHT_RULES` : 학파에 따라 갈리는 지점의
선택값(자시 규칙, 시간 기준 등). 빼면 명식이 달라지므로 **입력**의 일부이지 설정이 아니다.
_Avoid_: 설정, 환경값

**원본 생일** — `person.original_date` + `person.calendar` : 사용자가 실제로 넣은 형식
그대로의 생년월일 — 양력이거나, 음력 평달이거나, 음력 윤달. **Person 이 이것과 변환된
양력(`solar_date`)을 둘 다 든다.**
_Avoid_: birthDate(어느 달력인지 안 말함)

**윤달** — `Calendar` 의 `lunar_leap` · `CALENDAR_KO` : 음력에서 같은 달 번호가 두 번 오는 쪽.
평달과 다른 날이므로 형식이 셋이지 둘이 아니다. 「평달」은 **윤달과 마주 세울 때만 쓰는
말**이라 화면에는 안 적는다 — 고르는 칸은 「양력 · 음력 · 음력 윤달」이다. 값은 그대로 셋이다.

**명식** — `Saju` · `computeSaju` : 한 사람의 **입력**에서 도출된 사주 여덟 글자와 그로부터
나온 구조화된 사실. **판정은 저장하지 않는다** — 볼 때마다 **입력**에서 다시 계산되는
파생 뷰다. 여덟 글자만은 견주고 보여주려고 따로 베껴 둔다(**여덟 글자 스냅샷**).
_Avoid_: SajuChart(엔티티로 오해됨), 사주(화면에서는 이 말을 쓴다 — PRD §3.2), 팔자

**원국** — `Saju.pillars` · `getFourPillars` : 태어난 시각으로 고정된 **명식** — 운(대운·세운·
월운, `fortune/`)과 대비되는 말.
_Avoid_: 본명, 사주 원판

**여덟 글자 스냅샷** — `chartSnapshotOf` · `person.current_chart` · `reading.chart_a`·`chart_b` ·
`match.chart_high`·`chart_low` : 그때 보여 준 여덟 글자를 그대로 베낀 값. **명식이 아니다** —
판정이 안 딸리고 다시 계산하는 데 쓰지 않는다. 쓰는 곳은 둘뿐이다: 지금 명식과 견주어
「수정 전 정보로 만든 풀이」를 말하는 것, 그리고 **동의 당시 여덟 글자**를 보여주는 것. 앱이 이
값을 주장하는 자리는 **입력을 쓰는 문 하나**이고, 그 뒤의 복사는 전부 DB 안에서 일어난다
(ADR 0071).
_Avoid_: 저장된 명식, 원국 사본, 매인 판본

**용신을 잡는 네 길** — `JudgementKey` : 억부(넘치면 누르고 모자라면 돕는다) · 조후(춥고
더움을 고른다) · 통관(맞선 두 세력 사이를 잇는다) · 병약(병이 된 글자를 치는 약을 쓴다).
**엔진은 이 중 억부만 판정한다** — 조후는 참고표, 통관은 사실만, 병약은 없다.
_Avoid_: 「용신」 하나로 부르기(무엇으로 잡았는지가 빠진다)

**통관신** — `TONGGWAN_POLICY` : 맞선 두 세력 사이를 잇는 오행. 극하는 쪽이 낳는 것이
곧 극당하는 쪽을 낳으므로 표에서 곧장 나온다(金剋木 사이의 水). **얼마나 맞서야
대치인가는 문턱이고 아직 안 골랐다** — 그래서 다섯 쌍을 다 내고 순서만 매긴다.
_Avoid_: 「통관용신」(용신이라 부르는 순간 판정이 된다)

**억부·조후 대조** — `judgementPrecedenceOf` : 두 길이 같은 오행을 가리키는가. 견주기만 하고
**어느 쪽이 우선인지는 말하지 않는다** — 그것은 한난조습을 재는 자리가 있어야 답할 수
있고 이 엔진에 그 자리가 없다. 무작위 3000건에서 어긋나는 명식이 43.2% 다.
_Avoid_: 「조후가 우선이다」(재지 않은 것을 말하는 것이다)

**claim** — 코드에 없다(PRD §7.3) : 어떤 **Person** 이 자기 자신임을 **User** 가 승인받는
절차. 끝나면 그 Person 의 출생 정보 편집권이 그 User 에게만 남는다.
_Avoid_: 연결, 병합(merge 는 두 Person 을 하나로 합치는 별개의 일)

**본인확인** — 코드에 없다(PRD §7.3) : 매칭 참여 자격을 정하는 별개의 값. **사주 입력의
생일로 대신하지 않는다** — 사주 입력은 고칠 수 있고 남의 것을 넣는 것이 정상 사용이다.

**관계**
- 한 **Person** 은 정확히 하나의 **입력**을 든다
- **입력** → (계산) → **명식**. 저장되는 것은 왼쪽과 **여덟 글자 스냅샷**뿐이다

**갈렸던 것**
- 「사주 저장」이 **입력** 저장인지 **명식** 저장인지 — 해소: **입력**과 **여덟 글자 스냅샷**만
  저장한다. 그로부터 나온 판정(억부·격국·용신·운)은 저장하지 않는다. **명식**은 엔티티가
  아니라 순수 함수의 결과이므로, 판정까지 저장하면 진실이 두 벌이 되고 엔진을 고칠 때
  저장된 값이 조용히 어긋난다. 여덟 글자는 **되짚기 위한 사본**이라 다르다(ADR 0071).
- 「수정 전 정보로 만든 풀이」가 **입력이 달라진 것**인지 **여덟 글자가 달라진 것**인지 —
  해소: **여덟 글자**다. 출생지를 고쳐도 여덟 글자가 같으면 그 풀이는 현재 명식의 것이다.
- 「고친 기록은 덮어쓰지 않고 쌓입니다」가 화면 약속인지 저장 규칙인지 — 해소: **둘 다
  아니다.** 이전 입력을 쌓지 않는다(ADR 0071). `/me` 의 판본 이력 목록을 내린 것이 그 방향의
  첫 걸음이었다.
- 「지문만 남긴다」가 원문 폐기인지 — 해소: **아니다.** 출생 입력은 후보 공간이 작아서 열쇠
  없는 해시는 원문의 다른 표기일 뿐이다(재어 봤다: 시각만 모르면 1 밀리초, 아무것도 몰라도
  두 시간이 안 걸린다). 그래서 **끝난 요청은 지문을 안 든다.** 드는 것은 그때의 **입력 버전**
  (`input_version`)뿐이고, 그것은 세는 수라 입력을 담지 않는다.
- 「생년월일」이 사주 입력인지 신원 정보인지 — 해소: 사주 입력이다. 연령 제한은 별개의
  **본인확인**을 근거로 한다.
- 「연결」이 claim 인지 merge 인지 — claim 은 Person↔User(내가 그 사람이다), merge 는
  Person↔Person(이 둘은 같은 사람이다).

## 3. 문과 실패

**읽는 문** — `storedInputOf` · `currentReading` · `inboxForViewer` 같은 `app/**/*.ts` 함수 :
DB 에서 행을 집어 와 도메인의 말로 옮기는 앱 쪽 함수 하나. 문 안의 **어댑터**가 생성된
`Database` 타입의 snake_case 를 도메인 타입으로 **한 번만** 옮긴다(ADR 0072·0078). 실패를
말하는 법이 셋이다 — 화면의 뜻이 무너지는 **본체**는 던지고(`dbFailure`), **부속 정보**는
값으로 내고, 문이 성공했는데 자료가 없는 것만 `null`·`[]`·`0` 이다.
_Avoid_: 쿼리 함수, fetcher, 리포지토리, 화면용 문

**부속 정보** — `SkippableRead` · `read` / `unread` : 없어도 그 화면의 **본체**가 서는 값 —
헤더의 남은 풀이권, 소식 배지의 수. 못 읽으면 화면이 그 자리만 생략한다. **모르는 것과
0 은 다른 값이다** — 0 은 읽어서 안 것이고, 못 읽은 것은 안 세운다(ADR 0078).
_Avoid_: 선택적 값, optional, 부가 데이터

**열쇠** — `keyedClient` · `service_role` : 자격을 묻지 않고 여는 문. **볼 자격을 묻지
않는다** — 그 답은 `auth.uid()` 를 든 함수가 먼저 낸다. **상대의 계산 입력을 읽던 문이
닫힌다**(ADR 0071). 남는 것은 결과를 저장하는 문과, 생성 작업·webhook 이 쓰는 문들이다
(ADR 0013·0020).
_Avoid_: 관리자 권한, 백도어

## 4. 근거와 글

**근거** — `Evidence` · `evidenceOf` : AI 결과를 만들기 전에 허용된 자료를 구조화한 묶음.
엔진이 낸 사실과 claim 단계를 담고, **옛 실험 지표도 기준점도 안 담는다.** 기준점은 자료가
아니라 프롬프트에만 실린다(ADR 0060) — 자료에 넣으면 엔진이 점수를 낸 것처럼 읽힌다.
사용자에게 보이는 최종 점수·해석은 **Reading**의 출력이다. 구실은 「명식을 보여주는 것」이
아니라 **「AI 의 주장을 되짚는 것」**이다 — 그래서 근거는 모델에 넘긴 것과 정확히 같고,
더도 덜도 아니다.
_Avoid_: 데이터, 분석 결과

**redacted 근거** — `RedactedEvidence` · `redactEvidence` · `reading.evidence` : 모델에
넘기려고 **잘라 낸** 근거. 출생 원문·출생지·분 단위 정밀도가 빠져 있고, 무엇을 왜 뺐는지를
값으로 함께 든다. 자르지 않은 **근거**와 다른 것이며, `reading` 이 저장하는 것은 언제나
이쪽이다(ADR 0008·0013).
_Avoid_: 익명화, 마스킹

**공유 범위 근거** — `SharedEvidence` · `shareEvidence` : Match 공유 결과에 쓰려고 **한 번
더** 자른 redacted 근거. 여덟 글자와 두 원국 **사이의** 사실만 남고 상대 원국 하나에 대한
판정은 빠진다. 자르는 이유가 앞의 것과 다르다 — 앞은 모델에 안 넘기기로 한 것이고 이것은
**두 사람이 서로 열지 않기로 한 것**이다(ADR 0012).
_Avoid_: 요약본, 축약 근거

**발화** — `Utterance` · `assembleText` : **근거**를 재료로 계약이 허락한 상한 안에서 세운
한국어 문장. 엔진의 문장 층(L3)이 낸다.
_Avoid_: 해석, 설명

**분석 표** — `Compatibility` · `analyzeCompatibility` : 관계 표와 거기서 세운 **발화** —
프롬프트와 **근거**를 손보면서 무엇이 나왔는지 대조하는 **엔진 중간 결과**다. **우리끼리
쓰는 말이다** — 화면에서는 **「두 원국을 맞대어 본 표」**로 부르고, 궁합 결과 화면에서
**접어 둔다**(ADR 0035). **숨김 뒤에 자격을 걸지 않는다** — 보안이 아니라 편집이다. 동의로
열린 **공유 결과**에는 안 선다(ADR 0058).
_Avoid_: 원자료, 사실 표, 검산 자리

**해석** — `ReadingOutput` · `reading.output` : **근거**를 받은 AI 가 일반 사용자를 위해 쓴 글.
**발화**와 다른 층이다. **우리끼리 쓰는 말이다** — 사용자 화면에서 이것을 부르는 이름은
**풀이**다.
_Avoid_: 리딩

**풀이** — `READING_NOUN` : `Reading` 을 사용자가 부르는 이름. 한 사람이면 **사주풀이**, 두
사람이면 **궁합풀이**다(PRD §3.2). 「해석」은 내부 화면(`/me/reading/inspect`)에만 남긴다 —
같은 것을 세 낱말로 부르면 알림 한 줄과 화면 제목이 서로 다른 기능처럼 읽힌다(ADR 0026).
_Avoid_: 해석, 리포트, 상세 궁합 리포트

**Reading** — `reading` 표 · `my_reading` · `save_reading` · `currentReading` : 한 사람의 자기
풀이 또는 두 **Person**의 궁합에 대해 AI가 만든 **현재 결과**. 자기 풀이는 해석을, 두 사람
궁합은 점수와 해석을 들며, 실제 사용한 근거·프롬프트·모델 설정을 같은 한 벌로 둔다. 같은
대상에 대한 **결과 생성 요청**이 성공하면 한 벌 전체를 교체하며 이전 결과는 제품에서
보존·참조하지 않는다. **딱 하나 예외는 공유본이다.**
_Avoid_: Reading 이력, 해석 사건, Compatibility(궁합 사실 자체)

**Reading kind** — `ReadingKind` · `READING_KINDS` · `reading.kind` : 현재 AI 결과가 무엇에
대한 것인가. `self`(내 명식 하나) · `person`(내가 관리하는 저장된 사람 하나) · `private`(내가
접근 가능한 두 사람) · `match`(성립한 Match). 넷은 같은 파이프라인과 같은 교체 규칙을 쓰되
근거 범위와 접근 판정이 다르다. **한 kind 의 권한 판정이 다른 kind 를 열지 않는다.**

`self` 와 `person` 은 **한 사람짜리 계열**(`SoloKind`)이라 자료·프롬프트·검사가 같고 궁합
점수를 내지 않는다. 갈리는 것은 접근 판정 하나뿐이다 — `self` 는 부른 사람의 selfPerson 을
스스로 찾고, `person` 은 대상을 받아 엣지를 확인한다. 그래도 한 낱말로 합치지 않는다 — 내
명식을 넘긴 것과 남의 명식을 넘긴 것은 동의 범위가 다른 일이고, 합치면 그 둘이 기록에서
같아진다. **내 selfPerson 은 `person` 의 대상이 아니다** — 그것도 내 엣지에 있으므로 안 막으면
같은 명식에 결과가 둘 서고 같은 자료로 풀이권이 두 번 나간다. 이 판정은 접근 판정 함수에
있고 화면 필터에 있지 않다 — 화면에만 두면 주소로 열린다. 화면이 이 값을 견줄 때는 주소에
적힌 글자가 아니라 **DB 가 정규화한 id** 로 견준다(`uuid` 비교는 대소문자를 안 가리는데
문자열 비교는 가린다). **`person` 본문은 대상 Person 에게 직접 말한다** — `self` 의 프롬프트를
그대로 쓰므로 「당신은」이 그 사람을 가리키고, 읽는 사람은 그 옆에서 읽는다.
_Avoid_: visibility, 공개 범위(그것은 kind 가 아니라 접근 근거가 답한다)

**결과 생성 요청** — `generateReading` · `start_reading_run` · `beginReading` : 사용자가 자기
풀이 또는 이미 볼 권한이 있는 궁합을 AI로 새로 보겠다고 직접 실행하는 동작. 화면 조회도,
상대의 동의를 구하는 **pending 요청**도 아니다. 성공하면 현재 **Reading**을 교체하고
실패하면 직전 성공 결과를 유지한다. **누름과 완성이 같은 요청 안에 있지 않다** — 누르면
시도가 열리고, 만드는 일은 요청 수명 밖에서 돌다가 결과로 돌아온다(ADR 0016·0020). 화면은
시도의 상태를 물어 본다.
_Avoid_: 재계산, MatchRequest, 페이지 새로고침

**시도** — `reading_run` 표 · `my_last_reading_run` · `readingRunState` : 결과 생성 요청 한 번의
기록 — 언제 누가 무엇을 만들려 했고 어떻게 됐는가. **결과가 아니다** — 본문도 근거도 들지
않는다. 실패한 시도 하나가 무엇도 붙들지 않게 하려는 것이다(ADR 0013·0071). 「같은 요청 한
번」을 지키는 것은 **도는 시도 잠금**이다 — 열쇠(`idempotency_key`)를 서버가 지으면 매번 달라
아무것도 막지 못하고, 브라우저가 지으면 손으로 적을 자리가 열린다. 자리만 둔다(ADR 0013).
_Avoid_: 이력, 로그(운영 로그와 헷갈림)

**공유본** — `reading_share` 표 · `share_my_reading` · `shared_reading` · `sharedReadingOf` :
사용자가 링크로 내보내기로 한 그때의 **Reading** 사본 — 한 줄 요약과 사용자용 본문
둘뿐이다(ADR 0063). **결과가 아니라 사본이다.** 원본이 교체돼도 안 바뀌고, 원본이 사라져도
안 따라간다 — `reading`·**Person** 어느 것도 FK 로 안 들기 때문이다. 매는 것은 계정 하나이고,
계정을 지우면 함께 사라진다(ADR 0023). **토큰이 곧 자격이다** — 여는 문(`shared_reading`)은
로그인 없는 역할에게 열려 있고, 이 저장소에서 그렇게 연 유일한 함수다. 「누가 보냈나」는 안
내준다.
_Avoid_: 공유 링크(주소를 뜻할 때만 쓴다), 공유 결과(그것은 Match 의 것이다), 스냅샷(추천
목록이 이미 그 말을 쓴다)

**한 줄 요약** — `reading.metaphor` · `READING_POLICY.metaphorLength` : 풀이마다 함께 나오는
한 문장. **비유하지 않고 직접 말한다** — 개인은 이 사람의 핵심 작동 방식과 그 안의 반전을,
궁합은 두 사람의 차이가 어떻게 맞물리는지를 압축한다. 서로 다른 근거 둘 이상을 잡아 다른
사람이나 다른 관계에는 그대로 붙일 수 없게 쓴다. 궁합에서는 점수 위에, 자기 풀이에서는
점수 없이 혼자 선다. 목록에서도 제목 아래 한 줄로 서서 **본문을 안 싣는 목록이 무슨
이야기였는지** 말한다. **점수보다 이것이 크다** — 점수가 늘 좁은 폭 안에 몰려 두 관계를 못
가르므로 뜻을 이쪽에 옮겼다(ADR 0052). 40자 안팎의 권장 길이와 120자 상한을 지킨다.
한동안 비유를 시켰는데 누구에게나 붙는 풍경 문구만 남아 접었다(ADR 0056 개정). 칸 이름
`metaphor` 는 그대로 둔다 — 까닭은 §10.
_Avoid_: 비유, 한마디(옛 이름), 총평, 캐치프레이즈

**다룰 것** — `PairShape` 의 `needs-v1` : 비공개 궁합 프롬프트가 절 대신 주는 **커버리지
목록**. 무엇을 다룰지는 우리가 정하고 **몇 덩이로 나눌지·어떤 차례로 쓸지·어느 판정을
읽을지는 모델이 정한다**(ADR 0051). 「연애에서 무엇을 궁금해하나」는 다룰 것이고 「4번 절에
잘 맞는 지점 셋을 써라」는 구성이다 — 그 둘을 가르는 것이 이 말의 요점이다.
_Avoid_: 절 목록, 목차(우리가 정하는 것이 아니다)

**용어 판** — `Terminology` : 사주 용어의 **이름을 사용자 본문에 부를 것인가**를 정하는
프롬프트 조립 값. `annotated` 는 뜻을 먼저 놓고 필요하면 이름을 뒤에 달고, `plain` 은 이름을
부르지 않고 그 말이 가리키는 성향·관계·상황을 바로 쓴다. **규칙 한 줄이 아니라 절과 본보기가
함께 갈린다** — 「이름을 쓰지 마라」와 「이름을 숨기지 말고」가 한 프롬프트에 함께 서 있으면
이기는 쪽은 눈앞의 본보기다.
_Avoid_: 쉬운 말 모드(무엇이 쉬워지는지 말하지 않는다), 용어 금지

**이름을 안 부르는 판** — `Terminology` 의 `plain` · `PLAIN_FORBIDDEN_TERMS` : 사용자에게 나가는
글에서 **분류명을 쓰지 않는** 판. 십성·신살·관계 이름·운의 이름을 본문에 부르지 않고 그
이름이 가리키는 성향·관계·변화·상황을 바로 쓴다. **`plain` 은 치환 사전이 아니다** — 한
이름을 정해진 한 마디로 옮겨 두고 갈아 끼우면 그 옮긴 말이 새 전문용어가 되고, 같은 이름이
자리마다 다르게 나타난다는 사실이 사라진다. **오행(목·화·토·금·수)은 예외다** — 「금이
셋이에요」까지 풀면 셀 수 있는 사실을 세지 못하게 된다(ADR 0029·0046).
_Avoid_: 쉬운 말 모드, 초보자 모드(코드 안에서만 `plain`)

**현재 결과 점수** — `reading.score` : AI 해석과 같은 생성 건에서 나온 사용자용 실험 점수.
같은 대상의 현재 **Reading**에 해석과 함께 저장되며, **결과 생성 요청**이 성공하면 새
점수·해석으로 함께 교체된다. 이전 점수는 UI·AI·엔진이 참조하지 않는다.
_Avoid_: 영구 점수, Match 고정 점수, 최신 버전 점수

**기준점** — `baselineIn` · `baselineBlock` : 궁합 풀이가 점수를 낼 때의 출발점. 두 명식에서
**풀이 때 다시 잰** `discovery-v1` 두 축의 가중합이고, 후보 카드의 **예측 궁합 점수**와 같은
함수가 낸 같은 수다(`previewScoreOf`). 모델은 여기서 여덟 항목으로 ±15 안에서 움직인다
(ADR 0060). 프롬프트에만 실리고 근거에는 안 실린다.
_Avoid_: 초기 점수, 기본 점수, 엔진 궁합 점수

**옛 실험 지표** — 코드에 없다(옛 이름 `match-v0`) : 첫 결정론적 베타 계산(오행 보완 · 함께
놓은 균형 · 관계 신호 · 입력 완성도). 궁합 베타 카드가 `discovery-v1` 으로 옮기면서
(2026-09-13) 화면에서 내렸고, 남은 축 함수도 2026-09-14 에 TS·SQL 양쪽에서 걷었다.
프롬프트에 들어간 적도 없다.
_Avoid_: 최종 궁합 점수, 저장된 Match 점수

**근거 밀착성** — 코드에 없다(평가 축) : AI 해석의 결론이 실제로 그 근거의 내용과 조합 때문에
나왔는가. 구체성·실용성과 함께 품질 게이트의 세 축이다. 재는 것은 **문체의 독창성이
아니다** — 같은 명식 구조를 가진 사람은 여럿이므로 「한 사람에게만 맞아야 한다」는 목표가
아니고, 비슷한 근거끼리 문장이 겹치는 것은 실패가 아니다. 만점은 **반사실 민감도**다 —
근거가 바뀌면 해석도 실질적으로 다시 써야 하는가.
_Avoid_: 비뻔함(무엇을 재는지 말하지 않고 실패만 가리킨다), 독창성, 개인화 정도

**체감 적합성** — `reading_feedback` 표 · `FEEDBACK_QUESTIONS` · `leave_reading_feedback` :
사용자가 자기 해석을 읽고 실제와 맞는다고 느끼는 정도. **운영 지표이지 품질 게이트가
아니다** — 내부 평가자는 근거만 보므로 대신 매길 수 없고, 사용자에게 보여준 뒤에만
얻어진다. 반드시 **근거 밀착성과 함께** 본다 — 바넘 문장은 근거 없이도 「내 얘기 같다」를
만들므로, 체감만 오르고 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다.
_Avoid_: 만족도, 정확도

**관계**
- **명식** → **근거** → **발화** / **해석**
- 한 **Reading** 은 kind에 따라 한 **Person**, 두 **Person**, 또는 **Match**를 가리킨다
- **Reading** 은 현재 결과에 사용한 **redacted 근거**를 통째로 든다 — 입력을 따로 베끼지 않는다

**갈렸던 것**
- 「궁합을 저장한다」가 관계 사실 저장인지 사용자 결과 저장인지 — 해소: 관계 사실 자체가
  아니라 현재 점수·해석과 그 생성 자료 한 벌(**Reading**)을 저장한다.
- 「점수가 어디 서는가」가 화면마다 갈렸다 — 해소: **한 화면에 하나**다. 축이 다른 점수 둘을
  함께 두면 무엇을 믿을지 사용자가 정해야 하는데, 그 물음에 우리가 답을 갖고 있지 않다.
  궁합 결과의 「궁합 베타」 카드는 풀이 점수의 기준점과 같은 수라 이 규칙에 안 걸린다
  (ADR 0060).
- 「뻔한 글을 막는다」가 무엇을 재는 것인지 — 해소: **결론이 근거에 의해 결정됐는가**이지
  문장이 독창적인가가 아니다. 그래서 이름을 「근거 밀착성」으로 바꿨다. 만점 조건을 「서로
  충돌하는 근거를 찾았는가」로 두려다 물렀다 — 그렇게 두면 모델이 없는 긴장을 만들어
  점수를 얻고, claim 상한 규율과 정면으로 싸운다.
- 「AI 해석을 붙인다」가 완성인지 실험인지 — 해소: **실험 인프라**다. 화면은 프롬프트의 출력
  구조를 알지 않고(원문 Markdown 그대로), 현재 점수와 해석은 같은 Reading 에서 읽는다.
  JSON·프롬프트·검사 결과는 내부 테스트 화면에서만 본다. **예외가 하나 있다 — 공유본이다**
  (ADR 0063). 교체 규칙이 무르는 것이 아니라 **사본이 다른 표에 사는 것**이다.

## 5. 궁합과 인연

**궁합** — `Compatibility` · `analyzeCompatibility` : 두 **Person** 사이에 성립하는 사실 그
자체. 늘 참이고 저장되지 않는다 — 사용자에게 보이는 실험 점수와 글은 현재 **Reading** 에
함께 저장된다. 화면에서 상품 이름은 **궁합 · 궁합풀이**다(PRD §3.2).
_Avoid_: 매칭 점수, 상성

**자리 대칭** — `COMPAT_SIDES` : 어느 쪽을 `a` 로 넣든 같은 사실 집합이 나온다는 뜻. **값
대칭이 아니다** — 십성·오행 보완·억부는 방향을 갖되 양방향이 언제나 함께 실린다.

**매칭 참여** — `discovery_profile.opted_in_at`·`opted_out_at` · `set_discovery_participation` ·
`ensure_discovery_participation` : 자기 **selfPerson** 을 **후보**로 내놓겠다는 User 의 결정.
**기본으로 켜져 있다** — 사주를 저장한 사람은 자동으로 후보 풀에 들고, 그 사실은 **가입
폼**에 적혀 있다. 켠 시각과 **끈 시각**을 함께 드는 **사건**이지 설정값이 아니다. 끄면 내놓은
**오행 요약**도 거두고, **끈 사람은 자동으로 다시 켜지지 않는다.** 참여가 실제로 열리는
자리는 **홈에서 내 사주를 읽거나 매칭을 여는 순간**이다 — 요약은 앱만 만들 수 있어서,
앱이 넣지 않으면 켜질 수 없다.
_Avoid_: 공개, 활성화

**DiscoveryProfile** — `discovery_profile` 표 · `DiscoveryProfile` · `myDiscoveryProfile` : **매칭 참여**에 관한 한 벌 — 참여 상태,
내놓은 **오행 요약**, 그리고 사주와 무관한 명시적 조건(`prefer_gender`). **이름과 소개는
여기 없다** — 그 둘은 계정의 것이고 참여를 꺼도 살아 있다(**닉네임**). 참여를 끄면 여기
있는 것만 거둬진다. TS 타입은 `DiscoveryProfile`, 읽는 문은 `myDiscoveryProfile` 하나다.
_Avoid_: 프로필(Person·프로필 화면과 헷갈림), 공개 정보

**오행 요약** — `ElementSummary` · `elementSummaryOf` · `discovery_profile.element_summary` :
참여할 때 매칭 풀에 내놓는 다섯 수 — 오행별 개수와 비중, 센 글자 수. **명식이 아니다**
(판정을 저장하지 않는다는 약속은 그대로다). 어느 입력·어느 엔진에서 나왔는지를 함께
들고(`element_input_version`), 지금 것이 아니면 **후보**가 아니다.
_Avoid_: 오행 벡터(자료구조 이름), 명식 요약

**후보** — `BoardRow` · `my_discovery_board` · `candidatesForViewer` : 매칭 참여에 동의한 다른
User 의 **selfPerson**. 대신 등록한 Person(엄마·친구)은 후보가 되지 않는다. 후보 목록은
뽑아 둔 것을 읽는다(`discovery_candidate`) — 뽑는 자리와 읽는 자리가 갈려 있다.
_Avoid_: 상대, 매칭 대상

**탐색 후보** — `discovery_impression.exploration` : `discovery-v1` 상위가 아닌데도 일부러 섞어
넣는 후보. 정책이 틀렸을 때 신호를 얻는 유일한 자리다. 비율은 `DISCOVERY_POLICY` 가 값으로
든다.

**하드 제외** — `discovery_eligible` · `discovery_unavailable` : 사주와 무관하게 후보에서 반드시
빼는 조건 — 참여를 끔 · 차단 · 이용이 정지된 계정 · 성별 조건 · 이미 오간 요청이나 매칭. **나이로는
거르지 않는다**(PRD §6.1). **사주 점수는 여기 들어가지 않는다.**

**노출 순서** — `DISCOVERY_POLICY` (`discovery-v1`) · `refresh_discovery_snapshot_for` : 아직
선택되지 않은 후보를 어떤 차례로 보여줄지 정하는, 별개 버전의 정책. **정렬만 하고 사람을
제외하지 않는다.** 두 **오행 요약** 사이에서 난다 — 명식도 **궁합**도 보지 않는다.
_Avoid_: 필터, 매칭 알고리즘, 추천 점수

**예측 궁합 점수** — `previewScoreOf` · `buildMatchPreview` : 두 사람의 보이는 글자 수를 합친
균형 70%와, 각자의 20% 미만 오행에 상대 오행이 닿는 정도를 잰 상호보완 30%를 합친 참고값.
상대 비율은 20%에서 포화해 과다 보유를 추가 가점으로 만들지 않는다. **이름은 제품을
말하고 조심은 종결어미와 목록 머리 한 줄이 든다**(ADR 0059) — 일곱 칸 모두 「-일 수 있어요 /
-에 가까워요 / -편이에요」로 닫는다.
_Avoid_: 오행 첫인상 점수, 최고의 궁합, 확정된 궁합

**노출 기록** — `discovery_impression` 표 : 누구를, 어떤 정책 버전으로, 몇 번째 자리에, **탐색
후보**로 보여줬는가의 기록. 운영자가 **노출 순서**를 평가하는 유일한 근거이고 사용자에게는
보이지 않는다.
_Avoid_: 로그, 조회수

**지나친 인연** — `discovery_passed` 표 · `passCandidate` · `restorePassed` : 매칭에서 지금은
넘겼지만 다시 살펴보고 꺼낼 수 있도록 보관한 상대. 지나치기와 복원은 한 사람의 선택이며,
궁합 요청이나 영구 제외를 뜻하지 않는다.
_Avoid_: 차단, 매칭 취소

**pending 요청** — `match_request.status` 의 `pending` · `RequestStatus` · `requestMatch` :
한쪽이 「상세 궁합을 함께 보자」고 요청했고 상대가 아직 수락도 거절도 하지 않은 상태.
근거를 바꾸는 수정이 일어나면 무효화된다.
_Avoid_: 매칭 신청, 대기, MatchRequest

**무효** — `match_request.status` 의 `invalidated` · `invalidate_pending_requests` : 어느 한쪽의
**저장된 입력**이 바뀌어 **pending 요청**이 성립할 수 없게 된 상태. 사람이 거둔 것이 아니다.
_Avoid_: 취소, 만료

**거둠** — `match_request.status` 의 `cancelled` · `cancelRequest` : 요청한 쪽이 스스로 물린
상태. 받는 쪽에게는 알리지 않고, 그 요청의 통보도 서지 않는다.
_Avoid_: 무효, 삭제

**동의 화면** — `MATCH_DISCLOSURE` · `CONSENT_FLOW_STEPS` · `respond_to_match_request` : 수락하면
서로에게 무엇이 열리고 무엇이 열리지 않는지를 **누르기 전에** 적어 둔 자리. 보내는 쪽과
받는 쪽이 **같은 한 벌**을 읽는다(ADR 0008).
_Avoid_: 약관, 안내

**Match** — `match` 표 · `my_matches` · `visible_matches` : 양쪽이 궁합을 함께 보기로 합의해
성립한 관계. **그 자체가 상대 Person 에 대한 접근 근거**이며, `user_person_access` 와는 다른
갈래다. 범위가 정해진 접근이다 — 서로의 여덟 글자가 전부 드러날 가능성은 포함되지만
정확한 출생 원문·출생지와 상대 원국 전체 판정은 포함되지 않는다(ADR 0008·0012).
_Avoid_: 매칭(동사와 헷갈림), 연결

**공유 결과** — `matchResultForViewer` : 성립한 **Match** 위에 서는 화면. 한 문장 결론과
점수, **두 사람의 여덟 글자**, 그리고 현재 **Reading** 의 본문이 차례로 선다 — 동의가 연 것이
그 여덟 글자라 여기서 나란히 본다(ADR 0012). **전체 근거 패널은 여기 없다** — 검산 화면
(`/me/reading/inspect`) 말고는 사용자 화면 어디에도 서지 않는다(ADR 0025). 부르는 이름은
**읽는 사람 쪽에서 갈린다** — 자기는 「나」, 상대는 공개 **닉네임**이다. 화면을 여는 것만으로
AI를 다시 부르지 않고 양쪽이 같은 현재 결과를 읽는다.
_Avoid_: 상세 궁합 리포트, 해석, Reading

**동의 당시 여덟 글자** — `match.chart_high`·`chart_low` : **Match** 가 수락 순간에 베껴 둔 두
사람의 **여덟 글자 스냅샷**. 공유 결과의 **명식 보드가 이것으로 선다.** 점수와 풀이 본문은
다른 것에서 난다 — 수락 트랜잭션이 **함께** 동결한 **전체 입력**(`freeze_reading_input`)이고,
그것은 생성이 끝나면 사라진다. 뒤에 어느 쪽이 입력을 고쳐도 둘 다 움직이지 않는다 —
동의한 것이 그때의 값이라서다(ADR 0012·0071).
_Avoid_: 매인 판본, 현재 명식, 최신 입력

**대화방** — `chat_room` 표 · `my_chat_rooms` : 성립한 **Match** 한 쌍에 하나씩 서는 방(PRD §7.1).
**Match 에 1:1** 이고 Match 가 서는 순간 트리거가 세운다 — 앱이 만들지 않는다. 방을 여는 열쇠는
Match 의 id 다. 목록은 **탭**이고, 안 읽은 수(`unread_chat_count`)는 그 탭이 든다 — **앱 내 알림**
일곱에 새 메시지는 들지 않는다. 화면은 `app/me/chat`(2026-09-23) — **화면의 이름은 「채팅」**이고 빈 목록은
「아직 채팅방이 없습니다」다(사용자가 정했다). 낱말은 대화방, 화면과 탭은 채팅 — 한 화면에는 한 이름이다.
_Avoid_: 채팅방 · 채팅(문서와 식별자에서 — 화면 문구는 위의 둘뿐), 대화(메시지의 묶음을 뜻할 때만), 스레드

**메시지** — `chat_message` 표 · `send_chat_message` · `my_chat_messages` : 대화방 안의 한 줄.
보낸 사람 · 본문 · 시각 · **차례(`seq`)** 를 든다. 한 건은 1,000자까지이고 **삭제 · 수정은 없다** —
신고 스냅샷이 불변이라는 규칙과 맞물린다. 지워지는 길은 **닫힘** 뒤 90일이 지나 운영자가 지우는
것뿐이다(runbook 「채팅」).
_Avoid_: 채팅(화면의 이름으로만 쓴다), 글(풀이의 글과 헷갈림), 댓글

**닫힘** — `chat_room.closed_reason` · `closed_by_user_id` · `closed_at` · `chat_room_readable` :
대화방의 **입력이 양쪽 다 안 되는 상태**. 방이 사라지거나 기록이 지워지는 것이 아니다. 이유는 셋
— `block` · `suspension` · `deletion_request` — 이고 **닫힌 이유가 누가 이전 대화를 보는지를
정한다**: 차단은 둘 다, 이용 정지 · 탈퇴 대기는 그 사람이 아닌 쪽만. 닫는 자리는 전부 트리거이고
되돌리지 않는다. 닫힌 시각은 이유마다 출처가 다르다 — 차단 행 · 탈퇴 신청 시각 · 그리고 이용 정지는
**이 칸이 유일한 출처**다(ADR 0091). 상대가 **탈퇴**하면 이유는 그대로이고 닫은 사람 칸이 빌 수 있다 —
탈퇴는 닫힌 이유가 아니라 상대의 칸이 빈 것이다(ADR 0094). 닫힌 방 안의 안내 문구 넷은 `docs/prd.md`
§7.1 의 표가 든다.
_Avoid_: 삭제, 나가기, 차단(닫힘의 한 이유일 뿐이다)

**전송 한도** — `chat_rate_limit` · `chat_policy` · `chat_rate_limit_hit` 표 : **계정당 1분 30건**.
방 · 상대와 무관하게 계정 단위로 세고 **함수 안에서** 센다(ADR 0039). 걸린 전송은 거절되고
값으로 돌아오며(`rate_limited`), 한 건 한 줄로 남는다 — 던지면 트랜잭션이 되돌아가 세지 못한다.
수의 원본은 DB 의 `chat_policy()` 다.
_Avoid_: 도배 방지, 스팸 필터, 쿨다운

**신고 스냅샷** — `chat_report_snapshot` 표 · `report_chat_message` : **메시지 하나를 고른 신고**에
붙는 불변 사본. 고른 것과 앞 5 · 뒤 5 를 그때의 본문 그대로 jsonb 한 칸에 베낀다. **메시지에 FK 로
매지 않는다** — 메시지가 지워져도 남고, 수명은 **신고**를 따른다. 운영자만 runbook 의 SQL 로
읽는다 — 대화방 전체를 여는 열쇠는 없다. 사람을 신고하는 `report_user` 는 그대로다.
_Avoid_: 증거(법의 말), 캡처, 로그

**접속 상태** — `user_activity` 표 · `touch_activity` · `activity_band_of` · `presence_policy` · `ActivityBand` ·
`activityText` : 상대의 **마지막 활동을 구간 셋으로 접은 것**(PRD §7.2). **활동**은 로그인된 요청이 서버에
온 것이고 `proxy.ts` 가 1분에 한 번 적는다. 구간은 **지금 활동 중**(5분 미만) · **최근 24시간 내 활동** ·
**24시간 이전 활동** 셋이고 화면 문구도 그 말이다(2026-09-23, 사용자가 정했다). 시각은 브라우저로 안
나간다 — 구간은 DB 가 접는다(ADR 0092). 열린 대화방과 후보 카드에 선다. 볼 수 있는 조건은 프로필
사진과 같다 — 지금 그 사람의 이름이 내게 보이는가. 거르는 데는 안 쓴다.
_Avoid_: 온라인/오프라인(실시간이 아니다), 마지막 접속 시각(시각은 안 나간다), 프레즌스

**관계**
- 한 **User** 는 **DiscoveryProfile** 을 하나 갖거나 갖지 않는다
- **매칭 참여** 중인 User 의 **selfPerson** 만 **후보**가 된다 — 대신 등록한 Person 은 아니다
- **후보**를 본 적이 있어야 **pending 요청**을 만들 수 있다 — 요청은 **노출 기록**에 매인다
  (`match_request.impression_id`, ADR 0009)
- 두 **User** 사이에 살아 있는 결정은 하나다 — pending·수락·거절 중 하나뿐이고, **무효**와
  **거둠**은 다시 청할 수 있다
- 수락은 **Match** 를 만들고 `user_person_access` 는 만들지 않는다 — 두 갈래로 남는다
- **Match** → **공유 결과**. 하나의 Match 에 화면 하나이고, 그 화면은 **동의 화면**과 **같은 한
  벌**을 읽는다 — 열린 것과 열리지 않은 것의 목록이 하나다(ADR 0008·0010)

**갈렸던 것**
- 「점수」가 현재 Reading 의 결과 점수인지 후보의 노출 순서인지 — 해소: 전자는 **결과 생성
  요청**의 사용자 결과이고 후자는 후보 정렬용 내부 정책이다. 후보 순서 숫자를 궁합 점수로
  재사용하지 않는다.
- 「이 Person 을 왜 볼 수 있나」의 답이 둘이다 — **내가 등록했다**(`user_person_access`)와
  **우리가 합의했다**(`match`). 값으로 갈라 두지 않으면 나중에 되짚을 수 없다.
- 「그만 보기」가 어느 일인지 — 해소: **그 기능은 걷혔다**(ADR 0077). 후보를 한 사람씩 빼는
  길은 없고, 남은 것은 접촉을 끊는 **차단**과 잠시 넘기는 **지나친 인연** 둘이다.
- 「요청이 사라졌다」가 **무효**인지 **거둠**인지 — 해소: 값으로 가른다. 합치면 「왜 사라졌는지」에
  답할 수 없다.
- 「거절」이 한 번의 답인지 되돌릴 수 없는 결정인지 — 해소: 되돌리지 않는다. 거절한 사람은
  서로의 **후보** 목록에서도 내려간다(ADR 0009).
- 「참여를 끈다」가 자료 삭제인지 노출 중단인지 — 해소: 노출 중단이다. 내놓은 **오행 요약**은
  거두지만 Person·Match·Reading 은 그대로다.
- 「결과가 낡았다」가 고장인지 약속인지 — 해소: 약속이다. 보드는 **동의 당시 여덟 글자**로,
  점수와 본문은 수락 때 동결한 입력으로 났으므로 뒤의 수정이 값을 바꾸지 않는다. 새 입력으로
  보려면 새 요청이 필요하다.
- 「상대의 글자가 보인다」가 여덟 글자 전부 공개까지 포함하는지 — 해소: 포함한다. 관계 여러
  줄을 합치면 년주·월주·일주·시주가 모두 드러날 수 있고 Match 동의가 그것을 연다(ADR 0012).
- 「독자의 관점」은 제품에 넣지 않는다 — 궁합은 언제나 중립 문체 하나이고, A/B 입장 차이는
  관점이 아니라 **양방향 사실**로 이미 글 안에 들어간다.

## 6. 한도와 출시 범위

**풀이권** — `my_reading_credits` · `reading_credit_limit_for` · `readingCredits` : 한 사람이 쓸
수 있는 **결과 생성 요청**의 수. 한도(5)는 모두의 약속이다. 잔액은 브라우저에서 읽고
움직인 자리가 알린다 — `available = 한도 − 성공한 시도 − 도는 시도 − pending 요청`
(ADR 0038·0078). 검사에 걸린 글은 풀이권을 안 깎는다. 다만 토큰은 나간다.

**풀이권 예외** — `reading_credit_grant` 표 : 한 사람에게만 한도 위에 **얹는 몫**. 한도는
모두의 약속이라 한 사람 때문에 옮기지 않고, 예외는 규칙이 아니라 **자료**로 든다 — 누구에게
얼마를 왜 주었는지가 행 하나에 남는다(ADR 0043). 운영자가 SQL 로만 넣으며 앱에는 닿는
길이 없다.
_Avoid_: 추가 지급, 보너스, 무제한

**산 묶음** — `reading_bundle` · `reading_order` : 결제 주문 하나에 매인 풀이권 묶음(1 · 3 · 5 · 20회). 한도 위에
**산 수 − 걷은 수**가 얹힌다. 주문을 승인으로 만드는 것은 서버뿐이다(ADR 0100 · 0106). 판매는 아직 닫혀 있다.
_Avoid_: 충전, 포인트, 캐시

**사용 이력** — `reading_credit_use` : 어느 풀이 시도 · 인연 요청이 어느 **몫**(무료 · 예외 · 어느 산 묶음 · 몫 밖)을
썼는지. 예약 → 확정 · 풀림. **잔액을 정하지 않는다** — 잔액은 여전히 센다(ADR 0021). 환불 셈의 입력이다(ADR 0106).
**몫 밖**(`outside`)은 지운 대상의 시도가 셈에서 빠져 되돌아온 자리로 쓴 것 — 환불 대상이 아니다.
_Avoid_: 차감 내역, 잔고

**Person 한도** — `person_limit` · `my_person_slots` · `PersonSlots` : 사용자가 직접 만들어
관리하는 가족·친구 Person 에만 걸리는 수(10). **후보와 Match 상대는 세지 않는다** —
`user_person_access` 에 들어가지 않기 때문이다. 이 수는 언제나 **풀이권 총량보다 크다**
(10 > 5) — 자리가 풀이권보다 적으면 풀이권을 가지고도 쓸 데가 없는 사람이 생긴다(ADR 0032). **공개 출시에서 걷는다** — 풀이권 묶음이 부등식을 깨므로(ADR 0102).

**운영 베타** — 코드에 없다(PRD §7.0) · 일정은 `beta_schedule` 표 : 실제 테스터가
프로덕션에서 서비스를 쓰되 **테스트 코드**로 새 참여자를 제한하는 단계. 세 단계의 첫째다 —
다음이 **채팅 안전 베타**, 마지막이 **공개 출시**이고, 단계마다 무엇이 들고 언제 끝나는지는
PRD §7.0 이 든다. 이 문서는 이름만 든다.
_Avoid_: 「출시」 단독(둘째와 셋째를 함께 가리켜 모호하다 — 「공개 출시」처럼 단계 이름
안에서만 쓴다), 개발 중, 베타(어느 베타인지 말하지 않는다)

**테스트 코드** — `signup_code` 표(`valid_on` · `max_uses`) : 운영자가 만들어 전하는 문자열
하나. **성년인증이 아니라 범위 통제**다 — 인증이 없는 동안 공개 매칭을 열지 않기 위한 장치
(ADR 0005). 코드마다 **사는 하루**와 **최대 인원**이 붙는다. 이메일 명단을 대신한다
(ADR 0042) — 명단은 운영자가 주소를 알아야 했고, 코드는 받은 사람이 스스로 들어온다.
_Avoid_: 초대 코드(초대라는 말은 이제 사람이 하는 일이지 관문이 아니다), 초대장, 베타 신청

**가입 완료** — `app_user.signed_up_at` · `complete_signup` : 코드로 들어와 **닉네임**을 짓고
**지금** 처리 안내를 확인한 상태. 셋이 한 문에서 함께 적히므로 값 하나가 든다. 그 앞은
**구글 로그인만 한 계정**이고, 그 계정에는 되돌릴 수 없는 첫 쓰기가 하나도 안 열린다.
_Avoid_: 온보딩 완료(내 명식 등록과 헷갈림 — 그것은 가입 다음이다), 인증

**앱 내 알림** — `notification` 표 · `NotificationKind` · `my_notifications` : 로그인해서 앱을
열었을 때만 보이는 통보. 외부 통보(이메일·카카오·푸시)는 공개 매칭과 함께 온다.

## 7. 설문

**서비스 설문** — `service_survey` 표 · `SurveyAnswers` · `save_service_survey` : 서비스
**전체**에 대해 받는 답. 풀이 설문(`reading_feedback`)과 갈리는 자리는 **무엇에 매이는가**다
— 저것은 그 글을 만든 시도에 매이고(ADR 0022), 이것은 매달릴 시도가 없어서 사람 하나에
한 줄로 선다. 그래서 「무엇이 좋았나」·「얼마면 내겠나」는 이쪽에만 설 수 있다. **띠로
부르지 않고 탭으로 열어 둔다** — 잔액이나 날짜로 띠를 세우면 답할 사람을 우리가 고르는
것이 된다(ADR 0062). **제출한 답과 초안은 다르다** — `submitted_at` 이 비어 있으면 초안이고,
집계에 들지 않는다. 자동 임시 저장이 줄이는 것은 다시 쓰는 부담이지 **제출하지 않은 의견을
모으는 것이 아니다.**
_Avoid_: 종료 설문(종료에 매인 설문이 아니다), 만족도 조사

**지불 의향** — `service_survey.price_solo`·`price_pair` · `PriceOption` : 서비스 설문에서
제시한 금액 중 사용자가 고른 값. **실제 구매 행동도, 정확한 지불 상한도 아니다** — 가격
후보를 좁히는 참고 자료이고, 판매 가격의 적절성은 실제 구매·이탈과 함께 판단한다. 답과 함께
**그때 제시한 금액 목록**(`price_options`)을 남긴다 — 후보를 옮기고 나면 고른 값만으로는
어느 목록에 대한 답인지 말할 수 없다.
_Avoid_: 적정 가격, 구매 의향(무엇을 산다고 한 적이 없다), WTP 상한

## 8. 화면 문구 규칙

용어집이 **무엇을 부르는 이름**을 정한다면 여기는 **어떻게 적는가**를 정한다. 낱말이
한 벌이어도 표기가 셋이면 사용자는 같은 것인지 확인하는 데 눈을 쓴다(ADR 0027). 버튼의
동사와 상품 이름 넷은 `docs/prd.md` §3.2 가 든다.

**마침표는 자리가 정한다.**

| 자리 | 마침표 | 보기 |
| --- | --- | --- |
| 제목 · 라벨 · 딱지 · 버튼 | 없음 | `출생 시각 모름` · `이용이 정지된 계정입니다` · `저장했습니다` |
| 짧은 상태 표시 | 없음 | `복사했습니다` · `풀이 만드는 중…` |
| 설명문 · 안내문 · 경고문 | 있음 | `저장된 값은 그대로 있습니다. 지금 화면이 그 값을 읽지 못하는 것입니다.` |
| 여러 문장 | 문장마다 | 위와 같다 |

**진행 중은 「~ 중…」 하나다.** `저장하는 중…` · `보내는 중…` · `풀이 만드는 중…`.
「~ 중이에요」·「~ 하고 있어요」·「~ 합니다…」로 적지 않는다 — 짧은 상태 라벨에 말투를
싣기 시작하면 화면마다 온도가 달라진다.

**버튼은 해라체를 쓰지 않는다.** 확인 버튼은 `삭제를 요청합니다`·`차단합니다`·
`신고합니다`·`뺍니다` 처럼 합쇼체로 적는다.

**한 사실에는 한 표기.** 「출생 시각 모름」(`HOUR_UNKNOWN_LABEL`)·「출생 정보」가 그
예다. 화면마다 줄이거나 늘리지 않는다 — 표가 좁으면 줄바꿈하지, 낱말을 바꾸지 않는다.

**한 화면에는 한 이름.** `/me/people` 은 **「저장한 사람」**이다 — 탭 제목도, h1 도, 궁합에서
고르는 자리도. 「등록한 사람」은 관리·DB 쪽 말이고 「내 사람」은 관계의 뜻이 너무 세다.
「등록하다」는 **동사로만** 남는다(「사람 등록하기」) — 목록의 이름과 목록에 넣는 동작은
같은 낱말일 이유가 없다.

**늘 참인 문장은 늘 세우지 않는다.** 그 화면에서 한 번도 틀린 적이 없는 안내는 배경이
되고, 배경이 두꺼워질수록 옆에 선 **실제로 갈리는** 한 줄이 같이 안 읽힌다. 그리고
**경고는 되돌릴 수 없는 누름 직전에 선다** — 버튼 옆에 늘 적힌 경고는 누르지 않을
사람에게 하는 말이다(ADR 0028).

**거절은 누른 뒤에 말한다.** 조건이 안 찼다고 버튼을 잠그지 않는다 — 잠긴 버튼은 왜 안
눌리는지를 묻게 만들고, 그 답을 옆에 늘 적어 두면 아직 아무것도 안 한 사람에게 하는 말이
된다(그리고 잠긴 버튼은 키보드 포커스를 안 받아 그 답이 아예 안 읽히는 사람이 생긴다).
누르게 두고, 못 간 그때 무엇이 빠졌는지 **경고 색으로** 말한다. 채워지면 스스로 사라진다.

**기능을 쓸 수 있다고 말할 때는 「이용할 수 있습니다」.** 「쓰실 수 있습니다」와 뜻이 같지만
처리방침이 쓰는 말투가 이쪽이고, 같은 문단 안에서 둘이 갈리면 다른 약속처럼 읽힌다.

## 9. 용어 ↔ 코드

위 항목의 첫 줄을 모은 표다. **이 표의 식별자는 코드에 있어야 한다** — `scripts/code-rules.test.ts`
가 `src/` · `app/` · `supabase/migrations/` 에서 낱말로 찾는다. 이름을 바꾸면 여기와 그 항목을
함께 고친다. 「코드에 없다」는 PRD 에만 있는 말이다.

| 용어 | 코드 | 자리 |
| --- | --- | --- |
| Person | `person` · `user_person_access` | 표 · 엣지 표 |
| User | `app_user` · `AccountState` | 표 · `src/lib/account` |
| selfPerson | `self_person_id` · `create_self_person` | `app_user` 칸 · 함수 |
| localLabel | `local_label` | `user_person_access` 칸 |
| 닉네임 | `nickname` · `nicknameKey` | `app_user` 칸 · `src/lib/profile` |
| 프로필 사진 | `profile_photo` · `photo_of` | 표 · 함수 |
| 이용 정지 | `suspended` · `AccountStatus` | `app_user.status` 값 · `src/lib/account` |
| 계정을 못 읽음 | `AccountRead` · `readAccount` | `app/me/account.ts` |
| 탈퇴 대기 | `deletion_requested` · `requestAccountDeletion` | `app_user.status` 값 · 액션 |
| 운영자 | `operator` · `Operator` | 표 · `src/lib/consent` |
| 운영 검증 계정 | `verification_account` | 표 |
| 신고 | `report` · `report_user` · `reportUser` | 표 · 함수 · 액션 |
| 차단 | `block` · `blockUser` | 표 · 액션 |
| 입력 | `SajuInput` | 엔진 |
| 저장된 입력 | `StoredInput` · `write_person_input` · `edit_person_input` · `storedInputOf` · `storedChartOf` | `src/lib/input` · 함수 · 읽는 문 · 세우는 문 |
| 옵션 | `SajuOptions` · `TimeBasis` · `LATE_NIGHT_RULES` | 엔진 · `src/lib/input` |
| 원본 생일 | `original_date` · `calendar` · `solar_date` | `person` 칸 |
| 윤달 | `lunar_leap` · `CALENDAR_KO` | `Calendar` 값 · 엔진 |
| 명식 | `Saju` · `computeSaju` | 엔진 |
| 원국 | `pillars` · `getFourPillars` | 엔진 |
| 여덟 글자 스냅샷 | `chartSnapshotOf` · `current_chart` · `chart_a` · `chart_b` · `chart_high` · `chart_low` | 엔진 · `person` · `reading` · `match` 칸 |
| 용신을 잡는 네 길 | `JudgementKey` | 엔진 `analysis/precedence` |
| 통관신 | `TONGGWAN_POLICY` | 엔진 `analysis/tonggwan` |
| 억부·조후 대조 | `judgementPrecedenceOf` | 엔진 |
| 읽는 문 | `dbFailure` | `app/db-error.ts` |
| 부속 정보 | `SkippableRead` · `unread` | `app/db-error.ts` |
| 열쇠 | `keyedClient` · `service_role` | `app/keyed-client.ts` · DB 역할 |
| 근거 | `Evidence` · `evidenceOf` | 엔진 `evidence/` |
| redacted 근거 | `RedactedEvidence` · `redactEvidence` | 엔진 `evidence/redacted` |
| 공유 범위 근거 | `SharedEvidence` · `shareEvidence` | 엔진 `evidence/shared` |
| 발화 | `Utterance` · `assembleText` | 엔진 `text/` |
| 분석 표 · 궁합 | `Compatibility` · `analyzeCompatibility` | 엔진 `compat/` |
| 해석 | `ReadingOutput` · `output` | `src/lib/reading` · `reading` 칸 |
| 풀이 | `READING_NOUN` | `src/lib/reading` |
| Reading | `reading` · `my_reading` · `save_reading` · `currentReading` | 표 · 함수 · 읽는 문 |
| Reading kind | `ReadingKind` · `READING_KINDS` · `SoloKind` | `src/lib/reading` |
| 결과 생성 요청 | `generateReading` · `start_reading_run` · `beginReading` | 액션 · 함수 · 파이프라인 |
| 시도 | `reading_run` · `my_last_reading_run` · `readingRunState` · `idempotency_key` | 표 · 함수 · 액션 · 칸 |
| 공유본 | `reading_share` · `share_my_reading` · `shared_reading` · `sharedReadingOf` | 표 · 함수 · 읽는 문 |
| 한 줄 요약 | `metaphor` · `metaphorLength` | `reading` 칸 · `READING_POLICY` |
| 다룰 것 | `PairShape` · `needs-v1` | `src/lib/reading/prompt.ts` |
| 용어 판 · 이름을 안 부르는 판 | `Terminology` · `plain` · `PLAIN_FORBIDDEN_TERMS` | `src/lib/reading` |
| 현재 결과 점수 | `score` | `reading` 칸 |
| 기준점 | `baselineIn` · `baselineBlock` · `previewScoreOf` | `src/lib/reading` · `src/lib/discovery` |
| 체감 적합성 | `reading_feedback` · `FEEDBACK_QUESTIONS` · `leave_reading_feedback` | 표 · `src/lib/reading` · 함수 |
| 자리 대칭 | `COMPAT_SIDES` | 엔진 `compat/` |
| 매칭 참여 | `opted_in_at` · `opted_out_at` · `set_discovery_participation` · `ensure_discovery_participation` | `discovery_profile` 칸 · 함수 |
| DiscoveryProfile | `discovery_profile` · `prefer_gender` · `DiscoveryProfile` · `myDiscoveryProfile` | 표 · 칸 · `src/lib/discovery` · 읽는 문 |
| 오행 요약 | `ElementSummary` · `elementSummaryOf` · `element_summary` | `src/lib/discovery` · 칸 |
| 후보 | `BoardRow` · `my_discovery_board` · `candidatesForViewer` · `discovery_candidate` | `src/lib/discovery` · 함수 · 읽는 문 · 표 |
| 탐색 후보 | `exploration` · `DISCOVERY_POLICY` | `discovery_impression` 칸 · `src/lib/discovery` |
| 하드 제외 | `discovery_eligible` · `discovery_unavailable` | 함수 |
| 노출 순서 | `DISCOVERY_POLICY` · `refresh_discovery_snapshot_for` | `src/lib/discovery` · 함수 |
| 예측 궁합 점수 | `previewScoreOf` · `buildMatchPreview` | `src/lib/discovery` · `src/lib/matching` |
| 노출 기록 | `discovery_impression` | 표 |
| 지나친 인연 | `discovery_passed` · `passCandidate` · `restorePassed` | 표 · 액션 |
| pending 요청 | `match_request` · `pending` · `RequestStatus` · `requestMatch` | 표 · 값 · `src/lib/consent` · 액션 |
| 무효 | `invalidated` · `invalidate_pending_requests` | 값 · 함수 |
| 거둠 | `cancelled` · `cancelRequest` | 값 · 액션 |
| 동의 화면 | `MATCH_DISCLOSURE` · `CONSENT_FLOW_STEPS` · `respond_to_match_request` | `src/lib/consent` · 함수 |
| Match | `match` · `my_matches` · `visible_matches` | 표 · 함수 |
| 공유 결과 | `matchResultForViewer` | `app/me/match/result.ts` |
| 동의 당시 여덟 글자 | `chart_high` · `chart_low` · `freeze_reading_input` | `match` 칸 · 함수 |
| 대화방 | `chat_room` · `my_chat_rooms` · `unread_chat_count` · `chatRoomsForViewer` · `CHAT_TAB_LABEL` | 표 · 함수 · `app/me/chat` · `src/lib/chat` |
| 메시지 | `chat_message` · `send_chat_message` · `my_chat_messages` · `mark_chat_read` · `sendChatMessage` · `messagesForViewer` | 표 · 함수 · 액션 · 읽는 문 |
| 닫힘 | `closed_reason` · `closed_by_user_id` · `closed_at` · `chat_room_readable` · `closedRoomText` | `chat_room` 칸 · 함수 · `src/lib/chat` |
| 전송 한도 | `chat_rate_limit` · `chat_policy` · `chat_rate_limit_hit` · `CHAT_POLICY` · `RATE_LIMITED_TEXT` | 함수 · 표 · `src/lib/chat` |
| 신고 스냅샷 | `chat_report_snapshot` · `report_chat_message` · `purge_closed_chat_messages` · `reportChatMessage` | 표 · 함수 · 액션 |
| 접속 상태 | `user_activity` · `touch_activity` · `activity_band_of` · `presence_policy` · `ActivityBand` · `activityText` | 표 · 함수 · `src/lib/presence` |
| 풀이권 | `my_reading_credits` · `reading_credit_limit_for` · `readingCredits` | 함수 · 읽는 문 |
| 풀이권 예외 | `reading_credit_grant` | 표 |
| 산 묶음 | `reading_bundle` · `reading_order` · `approve_reading_order` · `READING_BUNDLES` | 표 · 함수 · `src/lib/reading` |
| 사용 이력 | `reading_credit_use` · `operator_reading_refund_basis` · `refundableCredits` | 표 · 함수 · `src/lib/reading` |
| Person 한도 | `person_limit` · `my_person_slots` · `PersonSlots` | 함수 · `src/lib/people` |
| 운영 베타 | `beta_schedule` · `BetaDates` | 표 · `src/lib/consent` |
| 테스트 코드 | `signup_code` · `valid_on` · `max_uses` | 표 · 칸 |
| 가입 완료 | `signed_up_at` · `complete_signup` | `app_user` 칸 · 함수 |
| 앱 내 알림 | `notification` · `NotificationKind` · `my_notifications` | 표 · `src/lib/consent` · 함수 |
| 서비스 설문 | `service_survey` · `SurveyAnswers` · `save_service_survey` · `submitted_at` | 표 · `src/lib/survey` · 함수 · 칸 |
| 지불 의향 | `price_solo` · `price_pair` · `price_options` · `PriceOption` | `service_survey` 칸 · `src/lib/survey` |

## 10. 어긋난 이름

코드가 용어집과 다른 말을 쓰는 자리다. 고칠 때는 여기서 지운다. 2026-09-22 에 잰 것이고,
고치는 일은 값을 재고 따로 한다(ADR 0088).

| 코드의 이름 | 용어집의 말 | 어디 | 왜 남았나 |
| --- | --- | --- | --- |
| 사유값 `unreadable-revision` | 저장된 입력을 못 읽었다 | `fail_reading_job` 의 `p_failure_code` 로 적히는 값 · `app/me/reading/pipeline.ts` | 그대로 둔다 — DB 에 이미 적힌 값이라 바꾸면 옛 행과 새 행이 갈린다. 화면에 안 나간다(2026-09-23 결정) |
| `metaphor` · `metaphorLength` | 한 줄 요약 | `reading` · `reading_share` 칸 · RPC 다섯 · 구조화 출력 필드 · `READING_POLICY` | 그대로 둔다 — 구조화 출력의 키는 프롬프트의 일부라 바꾸면 프롬프트를 바꾸는 일이고(실호출이 들고, 배포 순간 돌던 생성은 옛 키로 돌아온다), 칸 이름은 RPC 의 반환 열 · 인자라 바꾸면 떠 있는 옛 앱이 깨진다. 비유를 접은 뒤에도(ADR 0056) 이름만 남았다(2026-09-23 결정) |
| `my_discovery_snapshot` · `refresh_discovery_snapshot` · `refresh_discovery_snapshot_for` · `snapshot_id` | 후보 목록 | 함수 · `discovery_candidate_slot` 칸 | 그대로 둔다 — 표 둘은 2026-09-23 에 `discovery_candidate` · `discovery_candidate_slot` 으로 옮겼다. RPC 둘은 앱이 불러 이름을 바꾸면 넓히고 좁히는 세 걸음이고 뜻은 안 갈린다. 칸은 표를 따라 읽힌다(2026-09-23 결정) |
| `requestAccountDeletion` · `request_account_deletion` · `deletion_requested` · `DELETION_NOTE` | 탈퇴 대기 | 액션 · 함수 · `app_user.status` 값 · `src/lib/account` | 식별자는 그대로 둔다 — DB 값을 바꾸면 마이그레이션이고 뜻은 안 갈린다. 화면 문구는 2026-09-23 에 옮겼다(카드 「탈퇴」 · 버튼 「탈퇴를 신청합니다」) |
