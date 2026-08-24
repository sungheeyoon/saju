# PRD: 동의 기반 사주 매칭 서비스

- 상태: 구현 준비
- 제품 단계: 폐쇄형 초대 MVP
- 기준 문서: 루트 도메인 용어집과 ADR 0001~0008
- 핵심 원칙: 계산은 사실을 내고, 정책은 순서를 정하며, AI는 설명만 한다

## Problem Statement

사용자는 자신의 사주를 한 번 입력해 보관하고, 가족·친구 등 여러 Person을 관리하며,
원하는 두 Person의 궁합을 반복 입력 없이 보고 싶다. 더 나아가 공개된 인기나 외모만이
아니라 서로의 오행을 보완하는 사람을 발견하고, 상대의 동의를 받은 뒤 두 사람의 상세
궁합과 이해하기 쉬운 설명을 함께 보고 싶다.

현재 제품에는 브라우저에서 동작하는 만세력 엔진, 한 사람의 명식 화면, 두 사람의 궁합
화면, 구조화된 근거, 결정론적 `match-v0` 지표와 프롬프트 실험 기반이 이미 있다. 반면
로그인 계정, Person 저장, 권한, revision, 후보 노출, 상호 동의, Match, 앱 내 알림,
Reading 저장과 실제 AI 호출은 없다. 지금 상태는 정확한 계산 도구에는 가깝지만, 사용자가
관계를 만들고 다시 돌아오는 매칭 서비스는 아니다.

이 제품에서 출생정보는 민감하고 변경 가능한 계산 입력이다. 계정과 Person을 합치거나,
궁합 동의를 전체 명식 공개 동의로 간주하거나, AI에 정확한 생년월일시를 넘기면 사용자의
기대와 다른 정보 노출이 발생한다. 후보 순서와 궁합 지표를 같은 점수로 만들면 검증되지
않은 가설이 사람을 보이지 않게 만들 수 있다. AI가 계산을 다시 하거나 근거에 없는 말을
추가하면 엔진이 쌓은 신뢰도 사라진다.

따라서 필요한 것은 단순한 회원 기능 추가가 아니다. User와 Person을 분리하고, 계산 입력의
revision과 접근 근거를 보존하며, discovery와 궁합 지표를 분리하고, 상호 동의 이후에만
공유 범위가 제한된 Match와 Reading을 만드는 제품 흐름이 필요하다.

## Solution

제품은 다음 두 흐름을 함께 제공한다.

1. 익명 계산 흐름: 로그인 없이 한 사람의 명식과 사용자가 직접 입력한 두 사람의 궁합을
   브라우저에서 계산한다. 입력은 URL fragment에만 두며 서버에 저장하지 않는다. AI는
   호출하지 않는다.
2. 로그인 매칭 흐름: 초대받은 User가 selfPerson을 저장하고, 가족·친구 Person을 관리하고,
   수동 궁합을 본다. 매칭 참여를 선택하면 다른 참여자의 selfPerson 중 오행 보완 가설에
   따라 정렬된 후보를 본다. 상세 궁합 요청을 상대가 수락하면 Match가 성립하고,
   결정론적 `match-v0` 지표와 중립적인 AI Reading을 양쪽이 제한된 범위에서 함께 본다.

MVP는 Google OAuth와 정확한 이메일 초대 allowlist로 닫힌 성인 테스터에게만 제공한다.
앱 내 알림만 제공하며 공개 가입, 외부 알림, 별도 성년인증, 채팅은 열지 않는다. AI 결과는
계정·Person·동의 흐름이 완성된 뒤 내부 품질 게이트를 통과해야만 테스터에게 노출한다.

### 제품 목표

- 사용자가 자신의 입력을 한 번 저장하고 언제든 같은 규칙으로 명식을 다시 계산하게 한다.
- 한 User가 자기 자신과 가족·친구 Person을 혼동 없이 관리하게 한다.
- 두 Person 사이의 궁합을 계정 소유 여부와 무관하게 계산하게 한다.
- 오행 보완을 후보 발견의 가설로 사용하되 사주 점수로 사람을 숨기지 않는다.
- 상세 궁합은 특정 revision에 대한 양쪽 동의가 있을 때만 공유한다.
- `match-v0`는 정책 버전이 붙은 고정 지표로 제공하고 AI가 점수를 만들지 못하게 한다.
- AI는 정확한 출생 원문을 받지 않고, 저장된 근거 범위 안에서 구체적이고 실용적인 글만 쓴다.
- 사용자가 상대 Person을 볼 수 있는 이유를 `UserPersonAccess`와 Match로 구분해 추적한다.

### MVP 성공 조건

- 초대된 User만 계정을 만들 수 있고, 온보딩 후 정확히 하나의 selfPerson을 갖는다.
- selfPerson 입력 저장·재조회·revision 생성과 권한 규칙이 DB에서 강제된다.
- 관리 중인 Person 두 명을 선택해 기존 궁합 계산과 `match-v0`를 다시 입력하지 않고 볼 수 있다.
- 매칭 참여 User만 후보가 되며, 가족·친구 Person은 후보로 노출되지 않는다.
- pending 요청은 양쪽 revision 중 하나가 바뀌면 항상 무효화된다.
- 동의 전에는 상대의 정확한 생년월일시·출생지·전체 명식·상세 Reading을 볼 수 없다.
- Match 이후에도 상대의 전체 명식은 내려받을 수 없으며 허용된 궁합 범위만 볼 수 있다.
- AI 입력과 출력에 정확한 생년월일시·출생지가 없고, 근거 밖 주장이 품질 게이트를 통과하지 못한다.
- 주요 흐름이 데스크톱과 모바일 브라우저의 자동화 테스트로 잠긴다.

## User Stories

1. As an 익명 방문자, I want to 생년월일시와 계산 옵션을 입력한다, so that 계정 없이 내 명식을 볼 수 있다.
2. As an 익명 방문자, I want to 출생 시각을 모름으로 표시한다, so that 지어낸 시주 없이 계산 가능한 범위만 볼 수 있다.
3. As an 익명 방문자, I want to 양력·음력 평달·음력 윤달 중 실제로 알고 있는 형식을 선택한다, so that 음력 생일을 양력 칸에 잘못 넣지 않는다.
4. As an 익명 방문자, I want to 두 사람의 입력으로 궁합을 계산한다, so that 저장이나 가입 없이 기존 궁합 사실을 확인할 수 있다.
5. As an 익명 방문자, I want to 새로고침과 뒤로 가기 후에도 같은 결과를 본다, so that 입력 상태를 잃지 않는다.
6. As an 익명 방문자, I want to 결과 링크를 복사한다, so that 내가 입력한 두 사람의 계산 화면을 다른 사람에게 전달할 수 있다.
7. As an 익명 방문자, I want to 링크에 출생정보가 포함된다는 경고를 본다, so that 공유 범위를 알고 별명을 사용할 수 있다.
8. As an 기존 링크 수신자, I want to 예전 query 링크도 열 수 있다, so that 이미 공유된 링크가 깨지지 않는다.
9. As an 초대받은 사람, I want to Google 계정으로 로그인한다, so that 비밀번호를 새로 관리하지 않고 서비스를 이용할 수 있다.
10. As an 초대받지 않은 사람, I want to 가입이 명확히 거절된다, so that 계정은 만들어졌지만 아무것도 할 수 없는 상태에 놓이지 않는다.
11. As an 신규 User, I want to 온보딩에서 나의 사주 입력을 저장한다, so that selfPerson을 만들고 서비스를 시작할 수 있다.
12. As an 신규 User, I want to 원본 생일 형식과 변환된 양력을 확인한다, so that 저장된 입력이 내가 제공한 정보와 맞는지 알 수 있다.
13. As an User, I want to 내 selfPerson의 명식을 다시 본다, so that 매번 출생정보를 재입력하지 않는다.
14. As an User, I want to selfPerson 입력을 수정한다, so that 새로 알게 된 출생 시각이나 잘못된 정보를 바로잡을 수 있다.
15. As an User, I want to 입력 수정이 새 revision으로 남는다, so that 과거 요청과 Reading이 어느 입력을 사용했는지 되짚을 수 있다.
16. As an User, I want to 출생 시각 유무에 따른 한계를 확인한다, so that 불완전한 입력을 확정적 결과로 오해하지 않는다.
17. As an User, I want to 가족·친구 Person을 추가한다, so that 여러 사람의 명식을 한 계정에서 관리할 수 있다.
18. As an User, I want to 관리 Person을 최대 20명까지 둔다, so that 일반적인 가족·지인 관리 범위 안에서 데이터를 통제할 수 있다.
19. As an User, I want to 각 Person에 나만의 localLabel과 메모를 붙인다, so that 같은 사람을 내 관계 맥락에 맞게 구분할 수 있다.
20. As an User, I want to Person의 명식과 localLabel을 별개로 다룬다, so that 다른 User가 같은 Person을 다른 호칭으로 부를 수 있다.
21. As an User, I want to 내가 접근 가능한 두 Person을 골라 수동 궁합을 본다, so that 나 중심이 아닌 엄마×아빠나 친구×친구 조합도 계산할 수 있다.
22. As an User, I want to 수동 궁합 결과를 중립적인 문체로 본다, so that 누가 읽는지에 따라 관계 사실이 바뀌지 않는다.
23. As an User, I want to 궁합 사실과 `match-v0`의 베타 지표를 구분해 본다, so that 제품 점수를 궁합의 정답으로 오해하지 않는다.
24. As an User, I want to 같은 두 Person을 다시 해석할 때 새 Reading이 만들어진다, so that 과거 결과가 조용히 덮어써지지 않는다.
25. As an User, I want to 최근 Reading 목록을 빠르게 본다, so that 큰 Evidence 전체를 내려받거나 파싱하지 않고 원하는 결과를 찾을 수 있다.
26. As an User, I want to 매칭 참여 여부를 직접 켜고 끈다, so that 내 selfPerson이 후보로 노출되는 것을 통제할 수 있다.
27. As an User, I want to 내가 대신 등록한 가족·친구 Person은 후보가 되지 않는다, so that 타인을 동의 없이 매칭 풀에 올리지 않는다.
28. As an 매칭 참여 User, I want to 공개용 별명·사진·소개를 따로 관리한다, so that Person 입력이나 localLabel을 공개 프로필로 쓰지 않는다.
29. As an 매칭 참여 User, I want to 나의 매칭 선호 조건을 설정한다, so that 사주와 무관한 명시적 조건을 벗어난 후보를 받지 않는다.
30. As an 매칭 참여 User, I want to 오행 보완을 기준으로 정렬된 후보를 본다, so that 기존 데이팅 서비스와 다른 발견 가설을 경험할 수 있다.
31. As an 매칭 참여 User, I want to 노출 순서가 궁합의 좋고 나쁨이 아니라는 설명을 본다, so that 상위 후보를 운명적 추천으로 오해하지 않는다.
32. As an 매칭 참여 User, I want to 상위권 밖의 탐색 후보도 일부 본다, so that 한 정책이 같은 유형만 반복 노출하지 않는다.
33. As an 매칭 참여 User, I want to 사주 점수가 낮다는 이유만으로 후보가 사라지지 않는다, so that 검증되지 않은 가설이 사람을 배제하지 않는다.
34. As an 매칭 참여 User, I want to 차단했거나 나를 차단한 User를 보지 않는다, so that 원하지 않는 접촉이 반복되지 않는다.
35. As an 매칭 참여 User, I want to 후보가 어떤 오행을 채우는지와 그 의미를 본다, so that 명식 원문 없이도 왜 이 사람인지 이해하고 상세 궁합을 보고 싶어진다.
36. As an 매칭 참여 User, I want to 관심 있는 후보에게 상세 궁합 요청을 보낸다, so that 상대의 동의를 구할 수 있다.
37. As an 요청자, I want to 요청이 어느 두 chart revision을 대상으로 했는지 고정된다, so that 나중에 다른 입력과 동의가 섞이지 않는다.
38. As an 요청 수신자, I want to 앱 내 알림함에서 새 요청을 본다, so that 앱에 들어왔을 때 대응할 일을 알 수 있다.
39. As an 요청 수신자, I want to 동의 시 공개되는 범위를 수락 전에 읽는다, so that 궁합 동의와 전체 명식 공개를 혼동하지 않는다.
40. As an 요청 수신자, I want to 요청을 수락하거나 거절한다, so that 상세 궁합 공유 여부를 내가 결정할 수 있다.
41. As an 요청자, I want to 요청의 pending·accepted·rejected·invalidated 상태를 본다, so that 상대의 결정을 추측하지 않는다.
42. As an 요청 당사자, I want to 어느 한쪽의 Evidence 관련 입력이 바뀌면 pending 요청이 취소된다, so that 동의한 대상과 실제 계산 대상이 달라지지 않는다.
43. As an 요청 당사자, I want to 입력 변경으로 요청이 취소됐다는 앱 내 알림을 받는다, so that 요청이 사라진 이유를 안다.
44. As an 요청 수신자, I want to 수락 순간에도 현재 revision을 다시 확인한다, so that 동시에 발생한 수정과 수락이 잘못된 Match를 만들지 않는다.
45. As an 수락한 두 User, I want to 하나의 Match가 만들어진다, so that 서로 합의한 접근 관계가 명시적으로 남는다.
46. As an Match 당사자, I want to 상대 Person이 내 관리 Person 목록에 추가되지 않는다, so that 합의한 접근과 내가 등록한 사람을 구분할 수 있다.
47. As an Match 당사자, I want to 두 사람 사이의 궁합 사실과 고정된 `match-v0` 결과를 함께 본다, so that AI 문장과 무관하게 같은 지표를 공유할 수 있다.
48. As an Match 당사자, I want to 누가 보더라도 같은 중립적 Reading을 본다, so that 독자 관점 때문에 사실이나 결론이 달라지지 않는다.
49. As an Match 당사자, I want to 상대의 정확한 생년월일시·출생지·전체 명식을 받지 않는다, so that 궁합 동의보다 넓은 개인정보가 공개되지 않는다.
50. As an Match 당사자, I want to 궁합 관계와 일부 오행 구성이 상대에게 보일 수 있다는 설명을 본다, so that 실제 공개 범위를 정확히 안다.
51. As an Match 당사자, I want to AI가 어떤 근거로 글을 썼는지 확인한다, so that 근거 없는 단정과 엔진 사실을 구분할 수 있다.
52. As an Match 당사자, I want to AI가 정확한 출생 원문을 보지 않았음을 보장받는다, so that 외부 모델 호출로 민감한 원문이 나가지 않는다.
53. As an Match 당사자, I want to AI가 점수를 새로 만들지 않고 `match-v0`만 설명한다, so that 같은 Match에 서로 다른 점수가 생기지 않는다.
54. As an Match 당사자, I want to 해석이 구체적인 상황과 행동 조언을 포함한다, so that 누구에게나 맞는 뻔한 글이 아니라 실제로 쓸 수 있는 글을 읽는다.
55. As an Match 당사자, I want to 출생 시각 미상과 실험 판정의 한계가 글에 드러난다, so that 약한 근거를 확정적 사실로 읽지 않는다.
56. As an Match 당사자, I want to 해석 생성 실패 시 재시도 상태를 확인한다, so that 빈 화면이나 중복 과금·중복 Reading 없이 결과를 기다릴 수 있다.
57. As an Match 당사자, I want to 상대를 차단할 수 있다, so that 추가 요청과 향후 접촉을 즉시 중단할 수 있다.
58. As an User, I want to 알림을 읽음 처리한다, so that 새 알림과 이미 확인한 알림을 구분할 수 있다.
59. As an User, I want to 매칭 참여를 중단해도 내 Person과 과거 private Reading을 유지한다, so that 공개 노출 중단과 데이터 삭제를 혼동하지 않는다.
60. As an User, I want to 과거 Reading이 입력 수정 후에도 당시 Evidence로 남는다, so that 예전에 본 글의 근거가 현재 엔진 결과로 바뀌지 않는다.
61. As an User, I want to 내 계정과 저장 데이터의 삭제를 요청할 수 있다, so that 서비스 이용을 끝낼 수 있다.
62. As an 운영자, I want to 정확한 이메일을 초대 allowlist에 추가한다, so that 제한된 성인 테스터만 가입시킬 수 있다.
63. As an 운영자, I want to 기존 User의 계정을 중지한다, so that allowlist의 가입 관문과 이용 중 제재를 구분할 수 있다.
64. As an 운영자, I want to 후보 노출·요청·수락·대화 의향·차단 신호를 정책 버전과 함께 본다, so that `discovery-v0` 가설을 근거 있게 평가할 수 있다.
65. As an 운영자, I want to 출생시간 유무에 따른 노출 차이를 본다, so that 데이터 완성도가 후보 기회를 왜곡하는지 감시할 수 있다.
66. As an 운영자, I want to AI 호출량·실패율·지연·재시도를 본다, so that 비용과 품질 문제를 사용자보다 먼저 발견할 수 있다.
67. As an 운영자, I want to AI 품질 평가 세트와 prompt version별 결과를 비교한다, so that 프롬프트 변경을 느낌이 아니라 동일한 기준으로 검토할 수 있다.
68. As an 운영자, I want to 민감 정보 노출 검사 실패 결과를 사용자에게 공개하지 않는다, so that 프롬프트 실수가 개인정보 유출로 이어지지 않는다.
69. As an 운영자, I want to 신고와 차단 기록을 확인하고 필요한 제재를 적용한다, so that 공개 범위를 넓히기 전에 안전 운영 기반을 갖출 수 있다.
70. As an 향후 가입 User, I want to 이미 가족이 등록한 Person을 claim한다, so that 중복 Person을 만들지 않고 내 selfPerson으로 이어받을 수 있다.
71. As an 향후 claim User, I want to claim 후 출생정보 최종 편집권을 가진다, so that 다른 User가 내 매칭 노출을 바꾸지 못한다.
72. As an 향후 기존 관리자, I want to claim 후 viewer로 전환되고 내 localLabel·메모는 유지된다, so that 편집권은 잃어도 나의 관계 맥락은 보존된다.
73. As an 향후 Match 당사자, I want to 별도의 명시적 동의로 전체 명식을 공유한다, so that 궁합 동의와 더 넓은 공유를 분리할 수 있다.
74. As an 향후 Match 당사자, I want to Match 이후 실시간 채팅을 한다, so that 궁합을 본 뒤 서비스 안에서 대화를 이어갈 수 있다.
75. As an 향후 채팅 User, I want to 메시지 저장·읽음·재연결·차단·신고가 동작한다, so that 실시간 연결이 끊겨도 안전하고 지속적인 대화를 할 수 있다.

## Implementation Decisions

### 제품 범위와 출시 순서

- 제품의 정체성은 궁합 계산기가 아니라 동의 기반 사주 매칭 서비스다. 계정·Person·동의는
  부가 배관이 아니라 핵심 도메인이다.
- 구현 순서는 익명 fragment 흐름 안정화 → Google Auth와 DB 기반 → selfPerson → Person
  관리와 수동 궁합 → discovery → MatchRequest·앱 내 알림·Match → AI 품질 게이트 → 제한된
  테스터 노출 순이다.
- AI는 마지막 설명층이다. 계정과 동의 흐름을 AI 품질 실험 때문에 미루지 않으며, 내부
  품질 게이트 전에는 실제 User에게 AI 결과를 노출하지 않는다.
- 채팅은 Match와 안전 운영이 검증된 뒤 별도 단계로 구현한다.

### 현재 자산과 새로 필요한 것

- 기존 만세력 계산, 명식 분석, 궁합 사실 계산, 구조화된 근거, 결정론적 발화,
  `match-v0`, 익명 화면과 테스트는 재사용한다.
- 새로 필요한 것은 인증·DB·권한, 음력 변환 경계, Person과 revision 저장,
  discovery 정책과 노출 기록, MatchRequest 상태 머신, Match 범위 접근, 앱 내 알림,
  AI 호출·저장·품질 검사다.
- 기존 compatibility 엔진은 다시 만들지 않는다. 저장된 Person revision을 기존 순수 함수
  입력으로 변환하는 연결 계층만 추가한다.
- 현재 AI compatibility prompt가 자체 점수를 만들도록 요구하는 부분은 제거한다. AI는
  저장된 `match-v0` 결과를 설명할 수 있지만 새 점수·등급·승패를 생성할 수 없다.

### 깊은 모듈 경계

- 인증·자격 모듈은 Google OAuth, 초대 allowlist, 계정 상태를 하나의 가입·접근 판정으로
  감싼다. UI는 허용 또는 거절 결과만 사용한다.
- 달력 입력 모듈은 원본 생일 형식과 공식 양력 변환을 책임지고, 만세력 엔진에는 정규화된
  양력 입력만 넘긴다.
- Person 모듈은 Person, UserPersonAccess, selfPerson 지정, 20명 한도와 localLabel을
  책임진다. 명식 계산 결과는 저장하지 않는다.
- revision 모듈은 Evidence를 바꾸는 입력을 불변 판본으로 저장하고 fingerprint를 만든다.
  변경과 pending 요청 무효화는 하나의 트랜잭션 경계에 둔다.
- 접근 판정 모듈은 `UserPersonAccess`와 Match라는 두 접근 근거를 하나의 질문으로 감싼다.
  호출부는 상대 Person을 왜 볼 수 있는지 직접 추론하지 않는다.
- 계산 모듈은 revision을 기존 엔진 입력으로 바꾸고 명식·궁합 사실을 계산한다. 서버와
  익명 브라우저 흐름이 같은 순수 계산 코드를 사용한다.
- discovery 모듈은 후보 자격, 하드 제외, `discovery-v0` 정렬, 탐색 후보 혼합과 노출
  기록을 책임진다. `match-v0`를 후보 정렬에 재사용하지 않는다.
- MatchRequest 모듈은 요청 생성·수락·거절·무효화와 revision 비교를 하나의 상태 머신으로
  제공한다. 수락과 Match 생성은 같은 트랜잭션에서 일어난다.
- Reading 모듈은 redacted Evidence 생성, 고정 지표 snapshot, prompt 조립, AI 호출,
  출력 검사, 저장과 사용자별 응답 projection을 하나의 파이프라인으로 감싼다.
- 알림 모듈은 도메인 사건을 앱 내 inbox 항목으로 바꾸며 외부 채널을 가정하지 않는다.
- 향후 채팅 모듈은 Match 자격만 받아 메시지 전송·저장·읽음·재연결을 제공하고, 계산이나
  Person 권한을 알지 않는다.

### 데이터 모델과 불변식

- 기본 객체는 User·Person·Reading이다. 명식은 입력에서 계산되는 파생 뷰이며 엔티티로
  저장하지 않는다.
- User는 인증 주체와 애플리케이션 계정 상태를 들며 `selfPersonId`로 자신을 지정한다.
  온보딩 중에는 비어 있을 수 있지만 온보딩 완료 User는 정확히 하나의 selfPerson을 갖는다.
- Person은 사람의 안정적인 식별자다. 이름·사진·소개 같은 공개 매칭 정보는 Person 입력이나
  localLabel과 분리된 DiscoveryProfile에 둔다.
- UserPersonAccess는 User가 직접 등록하거나 관리하는 Person과의 엣지다. localLabel,
  개인 메모, 접근 역할을 들며 후보와 Match 상대는 이 목록에 넣지 않는다.
- **별도의 관계 유형 필드를 두지 않는다(2026-08-24 수정).** 이 PRD의 첫 판은 US 19와 위
  항목에 `관계 유형`을 적었으나, 루트 용어집이 「엄마」 같은 관계 맥락을 이미 localLabel로
  해소했고 localLabel의 `_Avoid_`에 `relationship`을 명시했다(`CONTEXT.md`). 두 벌로 두면
  「엄마」가 라벨에도 유형에도 적히고 둘이 어긋난다. 스키마도 처음부터 localLabel·note·role
  셋만 들고 있었으므로, 어긋나 있던 것은 PRD 쪽이다.
- Person 한도 20은 UserPersonAccess로 직접 관리하는 가족·친구 Person에만 적용한다.
- PersonChartRevision은 원본 생일 형식, 변환된 양력, 시간 또는 시간 미상, 국내 출생지,
  성별과 모든 계산 옵션을 불변값으로 저장한다. Person은 현재 revision을 가리킨다.
- selfPerson으로 claim된 Person의 출생정보는 해당 User만 수정할 수 있다. 기존
  manager/editor는 viewer로 내려가며 DB 정책과 트리거로 강제한다.
- MatchRequest는 양쪽 Person·User, 양쪽 chart revision, discovery 정책 버전,
  reason snapshot과 상태를 든다. Evidence 관련 수정은 pending 요청을 무효화한다.
- Match는 양쪽이 수락한 관계이며 상대 Person 전체가 아니라 궁합 범위 접근권을 준다.
- Reading은 두 Person, 양쪽 chart revision, 생성 요청자 또는 Match, `viewedAt`, 정확한
  redacted Evidence 문자열, prompt version, 모델·provider·생성 파라미터, 고정
  `match-v0` snapshot, 출력과 생성 시각을 보존한다.
- 최근 목록용 summary는 재생성 가능한 캐시다. 이름·표시 라벨·계산 시각 같은 목록 필드만
  두고 역사적 진실로 사용하지 않는다.
- `visibility`나 `perspectivePersonId`는 두지 않는다. private Reading은 요청 User만 보고,
  Match Reading은 Match 범위로 양쪽이 본다. 글은 중립적 제3자 문체 하나다.
- Notification은 수신 User, 사건 종류, 관련 객체, 생성 시각, 읽은 시각을 든다. 읽지 않은
  알림 수는 이 데이터에서 계산한다.

### 인증과 접근 제어

- Supabase Auth와 Postgres를 사용한다. MVP 로그인 제공자는 Google OAuth 하나다.
- 정확한 이메일 allowlist를 Postgres Before User Created Auth Hook에서 검사하고, 일치하지
  않으면 auth User 생성 전에 거부한다.
- allowlist는 신규 가입 관문이다. 기존 계정 접근 회수는 allowlist 삭제가 아니라 계정
  중지 상태로 처리한다.
- 일반 User 요청은 사용자 JWT로 실행한다. service role은 사용자 경로에 사용하지 않는다.
- 모든 개인 데이터 테이블은 RLS를 기본으로 하며 명시적으로 허용한 행과 동작만 연다.
- 전체 Evidence text는 Supabase 클라이언트에서 직접 select할 수 없다. 서버 함수나 RPC가
  현재 User와 접근 근거를 확인해 allowlist 방식으로 응답 필드를 구성한다.
- Match 상대에게 내리는 응답은 궁합, limitations, 공유용 AI 글, 고정 지표와 현재 User
  자신의 chart 범위다. 상대 chart, 정확한 입력, 출생지와 전체 명식은 포함하지 않는다.
- 차단은 양방향 후보 노출·새 요청·향후 접촉을 즉시 막는다. 제재 상태는 discovery 자격과
  Match 이후 기능 자격에서 공통으로 사용한다.

### 입력·달력·계산

- 지원 입력 연도는 변환표와 엔진이 보장하는 1900~2100이다. 범위 밖 음력 입력은 추정하지
  않고 거절한다.
- 음력은 런타임 공식 추정이 아니라 생성해 커밋한 한국 음력 변환표를 사용한다. 평달과
  윤달을 구분하고 외부 공식 자료와 대조한 테스트가 완료돼야 활성화한다.
- 국내 출생만 지원하며 Person에 임의 timezone 필드를 두지 않는다. 출생지는 현재 위치나
  매칭 거리와 같은 값으로 재사용하지 않는다.
- 명식을 가르는 기본값도 revision과 익명 URL에 모두 명시한다. 나중에 제품 기본값이
  바뀌어도 과거 입력이 다른 의미가 되지 않게 한다.
- 명식과 궁합 사실은 현재 revision에서 필요할 때 계산한다. 엔진 수정이 과거 Reading의
  Evidence와 글을 바꾸지 않는다.

### 익명 링크와 저장 흐름

- 익명 입력은 query string이 아니라 URL fragment에 둔다. 서버·미리보기 crawler의 HTTP
  요청에는 출생정보가 포함되지 않는다.
- 예전 query 링크는 클라이언트가 한 번 읽고 fragment URL로 교체한다. 첫 요청의 과거 노출을
  되돌릴 수 있다는 표현은 하지 않는다.
- `Referrer-Policy: no-referrer`를 적용하고, analytics·session replay 도입 시 fragment와
  폼 입력 수집을 명시적으로 차단한다.
- fragment는 암호화나 접근 제어가 아니다. 공유 화면은 링크 수신자와 메신저가 값을 볼 수
  있음을 알리고 실명 대신 별명을 권한다.
- 익명 흐름은 저장과 AI 호출을 제공하지 않는다. 서버의 저장·AI 경로는 Person id와 권한을
  확인한 로그인 요청만 받는다.

### discovery와 매칭 지표

- 후보는 매칭 참여에 명시적으로 동의하고 활성 상태인 다른 User의 selfPerson만 가능하다.
- 하드 제외는 미동의, 차단, 제재, 자기 자신과 근거가 있는 명시적 User 조건뿐이다. 법적
  연령 자격은 향후 UserAgeVerification을 근거로 하며 Person의 생년월일을 사용하지 않는다.
- 폐쇄 MVP에는 운영자가 알고 있는 성인만 초대하며 별도 기술적 성년인증은 하지 않는다.
- `discovery-v0`는 reciprocal 오행 보완과 함께 놓은 오행 균형만 사용한다. 입력 완성도와
  관계 신호 밀도는 후보 순서에 사용하지 않는다.
- `discovery-v0`는 정렬만 한다. 사주 계산값에 하드 threshold를 두어 후보를 삭제하지 않는다.
- **Discovery는 맛보기다(2026-08-25 확정).** 후보 카드는 추천에 직접 필요한 오행 이름과
  그 의미를 설명한다. 「어느 오행인지 감춘다」로 좁히면 왜 이 사람인지 답할 수 없고 발견
  가설 자체가 전달되지 않는다.
- Discovery가 공개하지 않는 것은 생년월일시·출생지, 여덟 글자, 천간·지지, 십성·신살·
  형충회합, 운과 Evidence, 그리고 상대의 전체 오행 구성이다. 형충회합과 상세 근거는
  상호 동의 이후에 열리고, 출생 원문은 그때도 열리지 않는다.
- 후보 카드에는 숫자 점수를 노출하지 않는다. 정렬에는 쓰되 사용자에게는 「균형이 고른
  편」처럼 말로 바꿔 보여준다. 82점과 79점은 절대적인 궁합 차이로 읽힌다.
- 정책은 사용한 축·가중치·탐색 후보 비율·버전을 값으로 선언한다. 첫 배포 전에 고정된
  표본 분포를 측정해 특정 출생시간 유무나 오행 분포에 노출이 과도하게 쏠리지 않는지
  검토한다.
- 후보 목록 일부에는 하드 조건을 만족하는 탐색 후보를 재현 가능한 방식으로 섞는다.
- 노출 로그는 후보, 정책 버전, 위치, 탐색 여부, 당시 오행 벡터와 reason snapshot을 남긴다.
- `match-v0`는 두 Person을 이미 선택하고 필요한 동의가 끝난 뒤 보여주는 베타 지표다.
  complement·combinedBalance·connectionDensity·dataCompleteness 네 축과 현재 가중치를
  유지하고, 억부·종격·격국·조후 조건은 제외한다.
- `COMPAT_POLICY.scoring`은 계속 `not-scored`다. 엔진은 사실만 내고 `match-v0`는 엔진 밖
  제품 정책으로 버전을 갖는다.
- 과거 결과는 당시 `match-v0` snapshot을 보여준다. 정책 변경은 `match-v1`을 만들며 과거
  숫자를 다시 계산해 덮어쓰지 않는다.

### 요청·동의·Match 상태

- 후보 카드만 본 것은 궁합 동의가 아니다. 요청 화면은 상대에게 공개될 정보와 공개되지
  않을 정보를 제출 전에 설명한다.
- MatchRequest 상태는 pending, accepted, rejected, invalidated, cancelled를 최소 집합으로
  사용한다. 동일한 두 User 사이에는 동시에 유효한 pending 요청이 하나만 존재한다.
- 요청 생성은 현재 양쪽 chart revision과 discovery reason을 snapshot으로 잡는다.
- 이름·사진·소개 수정은 요청을 무효화하지 않는다. 생년월일시·출생지·달력 방식·계산 옵션
  등 Evidence를 바꾸는 수정만 무효화한다.
- 수락은 현재 revision 비교, pending 상태 전이, Match 생성, 양쪽 알림을 한 트랜잭션에서
  수행한다. 중복 수락이나 재전송은 하나의 Match만 만든다.
- 이미 성립한 Match와 과거 Reading은 출생정보 수정만으로 삭제하지 않는다. 변경된 입력으로
  새 분석을 원하면 새 Reading을 만든다.
- 차단이나 계정 제재는 새 접근과 접촉을 중단한다. 과거 공유 Reading의 보존·삭제 정책은
  계정 삭제 정책과 함께 공개 출시 전에 별도 확정한다.

### Reading과 AI 품질 게이트

- Reading은 궁합 사실 자체가 아니라 특정 시각·revision·근거·prompt로 AI가 읽은 한 번의
  사건이다. 재생성은 기존 row 수정이 아니라 새 Reading 생성이다.
- AI 입력 Evidence는 정확한 생년월일시 원문과 출생지를 구조적으로 제거한 뒤 만든다.
  프롬프트로만 비공개를 약속하지 않는다.
- `Reading.evidence`는 실제 모델에 보낸 직렬화 문자열 그대로 `text`로 저장한다. DB가
  표현을 정규화하는 `jsonb`를 역사적 원문으로 쓰지 않는다. 무결성 확인용 digest를 함께
  둘 수 있으며 목록 질의 값은 별도 컬럼이나 summary에 둔다.
- Reading은 양쪽 chart revision id를 들어 redacted Evidence와 원본 입력의 역사적 연결을
  보존한다. 입력을 Evidence 안에 다시 복제하지 않는다.
- 실제로 모델에 보낸 system/user message 또는 이를 바이트 단위로 복원할 수 있는 불변
  prompt artifact를 보존한다. prompt version 이름만 저장하고 현재 template로 다시 조립해
  과거 요청을 재현했다고 간주하지 않는다.
- AI는 중립 문체로 두 사람 사이의 양방향 사실을 함께 설명한다. `perspectivePersonId`에 따라
  근거나 결론을 바꾸지 않는다.
- AI는 점수·등급·승패·누구의 득실을 새로 만들지 않는다. UI가 제공한 고정 `match-v0`
  항목을 설명할 수만 있다.
- 모델 출력은 저장 전에 정확한 날짜·시각·출생지 패턴, 근거에 없는 명식 글자와 관계,
  금지된 점수 생성을 검사한다. 실패하면 사용자에게 노출하지 않고 실패 상태와 원인을 남긴다.
- AI 품질 평가는 고정된 실제 사례 세트와 prompt별 결과를 사용한다. audit prompt는 보조
  평가자이며 최종 출시 판단은 제품 담당자의 blind review가 한다.
- 공개 게이트의 hard fail은 근거 밖 사실 1건 이상, 정확한 출생 원문 노출 1건 이상,
  상대 전체 명식 노출, AI 자체 점수 생성이다.
- 정성 항목은 구체성, 비뻔함, 실용성을 각각 5점 척도로 평가한다. 고정 평가 세트에서 각
  항목 평균 4점 이상이고 개별 결과가 3점 미만이 아니어야 제한된 테스터에게 노출한다.
- 모델·provider·temperature 등 생성 파라미터와 prompt version을 저장한다. 프롬프트 변경은
  새 버전이며 과거 Reading을 재작성하지 않는다.
- AI 호출은 인증·Match 또는 private Reading 권한, rate limit, idempotency key를 통과해야
  한다. 네트워크 재시도는 같은 생성 요청을 중복 Reading으로 만들지 않는다.

### 알림과 운영

- MVP 알림은 앱 내 inbox와 읽지 않은 개수만 제공한다. 이메일·웹 푸시·카카오·SMS와 운영자
  수동 연락을 제품 의존성으로 두지 않는다.
- 최소 알림 사건은 새 요청, 요청 수락, 요청 거절, revision 변경으로 인한 무효화,
  Reading 준비 완료와 생성 실패다.
- 앱 내 알림만으로 요청 응답률이 낮은 것은 폐쇄 테스트에서 측정할 제품 신호다. 외부 알림
  없이는 확장할 수 없다고 판단되는 시점이 공개 매칭 전환 조건이다.
- 운영 화면 또는 안전한 운영 도구는 allowlist 관리, 계정 중지, 신고·차단 조회, AI 실패
  조회와 비용·호출량 확인을 제공해야 한다. 초기에는 UI 대신 감사 가능한 관리자 절차를
  사용할 수 있다.
- 로그에는 원본 출생정보, fragment, Evidence text와 AI prompt 원문을 남기지 않는다.
  식별자, 정책 버전, 상태, 지연, 실패 코드와 digest만 운영 로그에 남긴다.

### 계정 삭제와 데이터 보존

- 폐쇄 MVP에서는 계정 삭제 요청을 운영자가 처리하되, 공개 출시 전 self-service 삭제
  흐름과 보존 기간을 확정한다.
- 삭제 요청 즉시 discovery 참여를 끄고 새 요청·Match 생성·AI 호출을 막는다.
- 다른 User의 권리와 이미 공유된 Reading이 얽히므로 무조건 연쇄 삭제하지 않는다. 어떤
  데이터가 삭제·익명화·보존되는지 공개 출시 전 정책과 화면 문구를 함께 확정한다.
- 과거 계산 입력과 Reading 보존은 최소화 원칙을 따르되, 감사 재현에 필요한 revision 연결과
  상대방에게 이미 제공된 결과의 처리 기준을 분리한다.

## Testing Decisions

- 좋은 테스트는 함수 내부 구현이나 DB 쿼리 모양이 아니라 외부에서 관찰 가능한 계약과
  도메인 불변식을 검증한다. 정책을 리팩터링해도 행동이 같으면 테스트가 깨지지 않아야 한다.
- 기존 순수 만세력·궁합·근거·문장·매칭 지표 테스트와 골든 snapshot을 prior art로 사용한다.
  서버 기능을 추가해도 같은 입력은 같은 순수 엔진을 통과해야 한다.
- 달력 변환 테스트는 공식 한국 음력 자료와 대조하고 평달·윤달·연도 경계·지원 범위 밖
  거절을 포함한다. 생성 스크립트와 커밋된 표의 일치도 검증한다.
- 익명 URL 테스트는 신규 fragment 링크, 예전 query 호환, 새로고침, 뒤로·앞으로 가기,
  복사 후 새 브라우저 열기와 HTTP 요청에 입력이 실리지 않는지를 검증한다.
- Auth Hook 통합 테스트는 allowlist 정확 일치, 대소문자 정규화, 미초대 이메일 거절,
  기존 User 로그인과 계정 중지 흐름을 검증한다.
- RLS 테스트는 최소 세 User를 사용해 자기 selfPerson 수정, 다른 selfPerson 수정 거절,
  manager의 미claim Person 수정, claim 후 viewer 강등, service role 우회가 사용자 경로에
  없는지를 검증한다.
- Person 테스트는 온보딩 완료 후 selfPerson 불변식, localLabel의 User별 차이, 관리 Person
  20명 한도, 후보·Match 상대가 한도에 포함되지 않음을 검증한다.
- revision 테스트는 Evidence 관련 필드만 새 revision을 만들고, 표시 정보 수정은 pending
  요청을 유지하며, 실제 입력 수정은 양쪽 pending 요청을 모두 invalidated로 전이시킴을 검증한다.
- MatchRequest 상태 머신 테스트는 허용된 전이와 금지된 전이, 중복 요청, 동시 수락,
  수락 직전 revision 변경, idempotent 재전송과 차단 후 요청 거절을 검증한다.
- 접근 테스트는 UserPersonAccess와 Match 두 경로를 분리하고, Match 응답에 상대 chart나
  입력이 직렬화되지 않으며 전체 Evidence row를 클라이언트가 직접 읽을 수 없음을 검증한다.
- discovery 테스트는 같은 입력·정책·seed의 재현성, 사주 threshold로 후보가 제거되지 않음,
  입력 완성도와 관계 밀도가 순위에 쓰이지 않음, 탐색 후보 혼합과 하드 제외를 검증한다.
- discovery 분포 테스트는 고정 표본에서 출생시간 미상 여부, 특정 오행 분포와 후보 집단에
  노출이 과도하게 집중되는지 보고한다. 분포 보고는 snapshot으로 남기되 근거 없이 문턱을
  자동 변경하지 않는다.
- `match-v0` 회귀 테스트는 기존 네 축·가중치·제외 항목·0~100 범위와 정책 버전을 유지하고,
  AI 출력이 이 값을 변경하지 못함을 검증한다.
- Evidence 테스트는 정확한 출생 원문·출생지 제거, 정확한 직렬화 text 보존, chart revision
  연결, limitations와 양방향 궁합 사실 포함을 검증한다.
- AI prompt 테스트는 중립 문체, 점수 생성 금지, 근거 상한, 출생 원문 금지와 prompt version
  변경을 snapshot으로 잠근다.
- AI 출력 검사 테스트는 날짜·시간·출생지 누출, 근거에 없는 글자·관계, 자체 점수와 금지된
  개인정보를 포함한 출력을 hard fail로 거절한다.
- AI 품질 게이트는 고정 사례별 evidence consistency와 구체성·비뻔함·실용성 rubric을
  기록한다. prompt 변경 전후를 같은 모델 설정과 같은 사례로 비교한다.
- Reading 생성 통합 테스트는 성공·provider 실패·timeout·재시도·idempotency·rate limit과
  같은 요청의 중복 저장 방지를 검증한다.
- 알림 테스트는 각 도메인 사건이 정확한 수신자에게 한 번만 생성되고, 읽음 상태가 다른
  User에게 영향을 주지 않음을 검증한다.
- E2E는 초대 로그인 → selfPerson 저장 → Person 추가 → 수동 궁합, discovery opt-in → 요청 →
  수락 → Match → Reading, revision 변경 → pending 무효화, 차단 흐름을 데스크톱과 모바일에서
  검증한다.
- 접근성 테스트는 키보드 탐색, 폼 label, 오류 연결, 색상에만 의존하지 않는 상태 표시와
  모바일 화면에서 동의 범위가 제출 버튼 전에 읽히는지를 확인한다.
- 성능 테스트는 최근 Reading 목록이 큰 Evidence text를 읽지 않는지, 후보 페이지가 후보마다
  전체 궁합 엔진을 전수 실행하지 않는지, AI 호출이 요청 응답을 무기한 점유하지 않는지를
  검증한다.

## Out of Scope

다음은 폐쇄형 초대 MVP의 범위 밖이다. 전체 제품 방향에서 폐기한 것이 아니라 선행 조건이
준비된 뒤 별도 PRD나 후속 단계로 다룬다.

- Kakao 로그인, Kakao Biz App 전환, magic link와 비밀번호 로그인
- 불특정 다수의 공개 가입과 공개 매칭
- 기술적 성년인증과 UserAgeVerification provider 연동
- 이메일·카카오·SMS·웹 푸시 등 외부 알림
- WebSocket 기반 실시간 채팅, 메시지 저장·읽음·재연결·신고 운영
- 결제, 구독, 유료 Reading과 환불
- Person claim·초대·merge의 사용자 화면과 자동 병합
- Match 수락에 포함되지 않는 전체 명식 공유와 별도 공유 동의
- AI가 궁합 점수, 길흉 등급, 승자·패자나 누구의 득실을 만드는 기능
- `perspectivePersonId`에 따라 궁합 근거나 문장을 바꾸는 기능
- 사주 점수를 이용한 후보 하드 제외
- 해외 출생, 임의 timezone과 1900~2100 밖의 음력 변환
- 익명 AI 호출과 익명 Reading 저장
- `match-v1`, 억부·종격·격국·조후 조건을 매칭 점수에 넣는 변경
- 현재 위치 기반 거리 매칭. 출생지는 현재 위치로 사용하지 않는다.
- 완전 자동 moderation. 공개 매칭 전에는 신고 처리 절차와 운영 책임을 별도 확정한다.

## Further Notes

### 단계별 전달 계획

1. 익명 fragment 이전과 호환·회귀 테스트를 완료한다.
2. 음력 변환표의 공식 대조 자료와 생성·검증 절차를 확정한다.
3. Supabase 스키마, RLS와 Google OAuth allowlist 가입 관문을 구축한다.
4. selfPerson 온보딩, Person 관리, revision과 수동 궁합을 세로 흐름으로 완성한다.
5. DiscoveryProfile, opt-in, `discovery-v0`, 노출 기록과 후보 화면을 추가한다.
6. MatchRequest 상태 머신, 앱 내 알림, 동의 화면과 Match 범위 접근을 추가한다.
7. 고정 `match-v0` 공유 결과를 완성하고 AI 없이도 전체 동의 흐름을 실제로 테스트한다.
8. redacted Evidence와 Reading 파이프라인을 만들고 내부 AI 품질 게이트를 반복한다.
9. 게이트 통과 후 초대된 성인 테스터에게 AI Reading을 제한적으로 노출한다.
10. 공개 전환을 검토할 때 성년인증, 외부 알림, Kakao, 계정 삭제, moderation을 먼저 해결한다.
11. Match와 안전 운영이 검증된 뒤 채팅을 별도 단계로 연다.

### 제품 분석 지표

- 온보딩 시작·selfPerson 저장 완료율
- Person 추가와 수동 궁합 실행률
- discovery opt-in·후보 노출·상세 요청률
- 요청 수락·거절·무효화·미응답률과 응답 시간
- Match 이후 Reading 열람률과 항목별 유용성 피드백
- `discovery-v0` 위치·탐색 후보 여부에 따른 요청·수락 차이
- 출생시간 유무에 따른 노출 격차
- 차단·신고율
- AI 근거 hard fail, 품질 rubric, 생성 실패·지연·호출 비용

초기 폐쇄 테스트에는 성장 목표 숫자를 미리 만들지 않는다. 먼저 소수 테스터의 흐름과
품질 기준선을 측정하고, 공개 전환 목표는 그 분포를 본 뒤 별도 결정으로 기록한다.

### 공개 전 반드시 다시 결정할 것

- 음력 변환표를 장기간·윤달 경계까지 대조할 공식 자료와 표본 범위
- `discovery-v0`의 첫 가중치와 탐색 후보 비율을 정한 측정 근거
- Person claim·초대·merge의 신원 확인과 충돌 해결 흐름
- 본인확인 provider, 성년 상태와 사주 입력 충돌 처리
- 외부 알림 채널과 수신 동의·실패 처리
- 신고·제재 운영 정책과 계정 삭제·과거 공유 Reading 보존 기준
- 채팅 보존 기간, 차단·신고, 운영자 접근과 안전 대응 기준

이 PRD에서 사실·정렬 정책·고정 지표·AI 설명은 서로 다른 층이다. 이후 구현이나 실험에서
한 층의 편의를 위해 다른 층의 책임을 합치려면 기존 ADR을 명시적으로 다시 열어야 한다.
