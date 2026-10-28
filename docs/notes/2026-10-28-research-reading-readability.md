# 긴 글 읽기 조사 — 사람은 화면의 긴 글을 어떻게 읽나, A안은 그에 맞나 (2026-10-28)

> 지금은: 풀이 화면은 `app/me/reading/markdown.tsx` 가 그린다(본문 17px · 행간 1.85 · 열 36rem · 문단 사이 `gap-5`=20px · 제목 Gowun Dodum · `word-break: keep-all` 은 `app/globals.css`). A안은 아직 안 정했다. 이 노트는 요구사항이 아니다 — 코드와 어긋나면 코드가 맞다.

물음은 둘이었다 — 긴 글(10절 · 약 11분)을 폰에서 읽기 쉽게 하는 것에 대해 일차 자료가 무엇을 말하나, 그리고
A안(절마다 굵은 한 줄 요약 띠 · 문단마다 굵은 핵심구 하나 · 문단 3–4문장 · 핵심 세 가지 카드 · 장점 소제목 덩이 ·
주의 카드의 「신호 / 이렇게 / 잘 다루면」 · 직업 칩)이 그 말에 맞나. 확인 날짜는 모두 2026-10-28 이다.

증거의 무게를 셋으로 적는다 — **[잰 것]** 실험 · 시선추적 · 메타분석, **[지침]** 기관 · 전문가의 권고(근거 숫자를 안 밝힌 것 포함),
**[추론]** 내 해석.

## 1. 사람은 어떻게 읽나 — 훑는다, 그리고 제목만 훑을 때가 가장 낫다

| 주장 | 무게 | 출처 |
| --- | --- | --- |
| 시험 사용자의 79% 가 새 페이지를 늘 훑었고 16% 만 낱말마다 읽었다 — "79 percent of our test users always scanned any new page they came across; only 16 percent read word-by-word" | [잰 것] 1997, 작은 표본 | Nielsen, [How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/) (1997-09-30) |
| 같은 내용을 다섯 문체로 쓴 사이트(51명): 간결 +58%, 훑기 쉬움 +47%, 객관 +27%, **셋을 합치면 +124%**. 훑기 쉬운 판은 굵은 핵심어 · 소제목 · 짧은 절을 썼다. 훑는 사람은 문단의 첫 문장만 읽는 일이 잦았다("one idea per paragraph") | [잰 것] 51명, 1997 | Morkes & Nielsen, [Concise, SCANNABLE, and Objective](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/) |
| 평균 페이지에서 사용자는 낱말의 많아야 28%, 대개 20% 를 읽는다. 100낱말이 늘 때 머무는 시간은 4.4초만 는다 | [잰 것] 로그 분석 · 모형 | Nielsen, [How Little Do Users Read?](https://www.nngroup.com/articles/how-little-do-users-read/) (2008-05-05). GOV.UK 도 같은 수를 든다("only read 20 to 28% of text") — [Clear structure](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-structure/) |
| **F 패턴은 기본값이자 나쁜 것이다** — "the default pattern when there are no strong cues", "bad for users and businesses". 다른 패턴: 레이어 케이크(제목만), 점찍기(굵은 글 · 숫자 · 링크), 표시하기, 건너뛰기(목록 머리말이 같으면 건너뜀), 몰입(다 읽음, 드묾) | [잰 것] 시선추적 | Pernice, [F-Shaped Pattern…](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/) (2017-11-12) |
| **레이어 케이크가 "by far the most effective way to scan pages"** — 단, 제목이 그 절의 내용을 전부, 그 절의 내용만 말할 때. 제목은 일정하게 눈에 띄되 광고로 보일 만큼 과하지 않게 | [잰 것] + [지침] | Pernice, [Layer-Cake Pattern](https://www.nngroup.com/articles/layer-cake-pattern-scanning/) (2019-08-04) |
| 훑기가 읽기와 "almost the same amount of information" 을 줄 수 있다. 몰입해서 다 읽는 사람도 덩이로 나뉘고 요점이 소제목에 있으면 이해가 오른다. "most users will read very little from a wall of text" | [잰 것] 시선추적 | Pernice, [Text Scanning Patterns: Eyetracking Evidence](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/) (2019-08-25) |

**[추론]** 이 앱의 풀이는 사용자가 돈 내고 산 글이라 「몰입」 비율이 일반 웹보다 높을 것이다. 그래도 11분짜리는 두 번째 방문부터
훑기로 바뀐다. 그러니 **제목 · 요약 한 줄만 읽어도 뜻이 서게** 짓는 것이 두 독자를 다 잡는다.

## 2. 앞에 둔다 — 역피라미드 · 요약

- **[지침]** "The first sentence of every paragraph should be the most important." 결론을 먼저, 그 뒤로 갈수록 덜 중요한 것 — Schade, [Inverted Pyramid](https://www.nngroup.com/articles/inverted-pyramid/) (NN/g 2018-02-11). GOV.UK: "Put the most important information first" ([Clear structure](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-structure/)).
- **[지침 + 관찰]** 긴 글(1,000낱말 넘는) 사용성 시험에서: 첫머리 요약은 "helps readers quickly determine if the article is relevant", 절 요약은 대개 **절의 끝**에 두어 지친 사람 · 훑는 사람의 확인점으로 쓴다, 끝 요약은 "low discoverability". 여러 요점이면 글머리표로 — Wang & Chan, [5 Formatting Techniques for Long-Form Content](https://www.nngroup.com/articles/formatting-long-form-content/) (NN/g 2023-11-17, 표본 수 미공개).
- **[잰 것]** 제목은 낯선 주제의 회상을 돕고(익숙한 주제는 아님) — Lorch & Lorch 1996, *Contemporary Educational Psychology* 21(3) ([초록](https://scholars.uky.edu/en/publications/effects-of-headings-on-text-recall-and-summarization/)). 제목이 있는 글이 하위 주제 기억에 낫고, 같은 내용을 미리보기 문장으로 주면 구조 과제에선 비슷하지만 "they do not elicit readers' attention to topic information as readily as headings do" — Lorch, Lemarié & Chen 2013, *Psicologia Educativa* 19(2) ([초록](https://scholars.uky.edu/en/publications/signaling-topic-structure-via-headings-or-preview-sentences/)).
- **[잰 것, 이차 확인]** 신호 주기(signaling) 메타분석: 작거나 중간 크기의 효과(r = .17), **사전 지식이 적은 사람에게 더 크다** — Richter, Scheiter & Eitel 2016, *Educational Research Review*(텍스트–그림 신호가 대상). 원문 초록은 직접 못 열었고 검색 요약으로만 확인.

**[추론]** 사주는 대부분의 사용자에게 「낯선 주제」다. 제목 · 요약 · 라벨의 효과가 가장 큰 쪽의 독자다.

## 3. 굵게 — 효과는 있으나 아껴야 산다

| 주장 | 무게 | 출처 |
| --- | --- | --- |
| 훑기 쉬운 판(+47%)은 굵은 핵심어를 썼다. 참가자: "easy to read because it uses bold to highlight certain points" | [잰 것] | Morkes & Nielsen 위 |
| 점찍기 패턴: 눈이 굵은 글 · 링크 · 글머리표에 멎는다 | [잰 것] | Pernice 2019 위 |
| "Use bolding and highlighting selectively and sparingly", "**no more than 30% of an article's text**", "Do not bold just to strengthen your tone, as it can slow down scanning" | [지침] 30% 는 근거 미공개 | Wang & Chan 2023 위 |
| "max 10% of your content should be highlighted. Otherwise it's no longer a highlight, but merely a noisy text style". 밑줄은 링크에 남겨 두라 | [지침] 실험 없음(글이 스스로 밝힘) | Holst, [Baymard — Highlighting text](https://baymard.com/blog/highlighting-text-online) (2010-11-30) |
| GOV.UK 는 강조용 굵게를 **쓰지 않는다**: "Use bold sparingly - using too much will make it difficult for users to know which parts… they need to pay the most attention to. Do not use bold in other situations, for example to emphasise text." 대신 문장 앞세우기 · 제목 · 글머리표 · 콜아웃 | [지침] | [GOV.UK A to Z — Bold](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/) |
| 생성형 AI 출력은 "failed to use bold, italics, and underlining to emphasize key points", "often end up being unnecessarily long", "Shorter text increases user comprehension" | [관찰] | Dykes, [Product-Specific GenAI Needs to Write for the Web](https://www.nngroup.com/articles/genai-write-for-the-web/) (NN/g 2025-04-04) |

**정리.** 굵게는 효과가 잰 것으로 서 있지만, **얼마까지**에 대한 숫자(10% · 30%)는 둘 다 실험 없는 권고다. 두 권고가 공통으로 말하는 것은
「많으면 강조가 아니라 소음」이다. GOV.UK 는 아예 금지 쪽이다 — 의견이 갈린다고 적는다.

## 4. 문단 · 문장 길이

- **[지침]** "Try to split up sentences that are over 25 words long" · "Plain English is mandatory for all of GOV.UK" — [GOV.UK Clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/). 문단 길이 숫자는 GOV.UK 현행 쪽에서 **찾지 못했다**(「문단 N문장」은 이차 자료에만 돈다).
- **[잰 것]** 「한 문단 한 생각」 — 훑는 사람이 첫 문장만 읽는다는 관찰(Morkes & Nielsen 위). 문장 수 상한을 잰 일차 연구는 못 찾았다.
- **[지침]** NN/g: 덩이 나누기는 "helps avoid walls of text, which can appear intimidating or time-consuming" — Moran, [How Chunking Helps Content Processing](https://www.nngroup.com/articles/chunking/) (2016-03-20).

**[추론]** 한국어 25낱말 ≈ 25어절은 꽤 긴 문장이다. 폰 한 줄(아래 5절, 약 21자)에 4–5어절이 드니 25어절이면 5–6줄. 「한 문장 3줄 안」 쪽이 실감에 맞다.

## 5. 한 줄 길이 · 행간 · 문단 간격

| 주장 | 무게 | 출처 |
| --- | --- | --- |
| WCAG 1.4.8(AAA): "Width is no more than 80 characters or glyphs (40 if CJK)", 양쪽 정렬 금지, "Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing" | [지침] 표준 | [WCAG 2.1](https://www.w3.org/TR/WCAG21/) |
| WCAG 1.4.12(AA): 사용자가 행간 1.5 · 문단 뒤 2배 · 자간 0.12 · 낱말 간격 0.16 으로 바꿔도 내용이 깨지지 않아야 한다(요구는 「버틸 것」이지 「그 값으로 짤 것」이 아니다) | [지침] 표준 | 위 |
| 본문 최적 50–75자(영문, 공백 포함), 100자 넘으면 지친다 | [잰 것이라 주장, 수치 미공개] | Scott, [Baymard — Optimal Line Length](https://baymard.com/blog/line-length-readability) (2022-05-10) |
| Bringhurst: 45–75자 만족, 66자 이상적(세리프 · 단일 단) | [지침] **책은 못 열었다 — 이차 인용으로만 확인** | 예: [webtypography.net 2.1.2](https://webtypography.net/2.1.2) |
| 화면 실험: 긴 줄(~100자)이 더 빨리 읽히지만 사람들은 중간 길이를 더 좋아한다. 핵심 변수는 「줄당 글자 수」 | [잰 것] **초록만 확인, 수치는 이차** | Dyson 2004, *Behaviour & IT* 23(6) ([초록](https://centaur.reading.ac.uk/23344)) |
| klreq(한글 조판 요구사항): 줄 간격 방식 넷을 들고 그림 예에 160% 를 쓴다 — **권장 범위는 적지 않는다**. 줄 길이 숫자도 없다. 줄 끝 한글은 "character or word basis" 로 끊되 저자가 고른다 | [지침] W3C Group Note Draft 2026-03-21 | [klreq](https://www.w3.org/TR/klreq/) |
| `keep-all` 은 "the other common behavior for Korean (which uses spaces between words)" | [지침] 표준 | [CSS Text 3](https://www.w3.org/TR/css-text-3/) |

**한국어 「행간 160–180%」 · 「한 줄 N자」를 일차 자료로 못박은 곳은 못 찾았다.** klreq 는 160% 를 그림 예로만 쓰고, KWCAG 는
일차 문서를 열지 못했으며 이차 자료(요즘IT 등) 범위에서는 행간 · 줄 길이 검사 항목이 보이지 않는다. 국내 논문은 어린이 대상
(12pt · 160% 가 높게 나옴) 정도만 찾았다 — 일반 성인 본문의 기준으로 쓰기 어렵다.

**[추론] 지금 화면을 견주면:**
- **줄 길이.** 36rem(576px) ÷ 17px ≈ 34자는 **데스크톱에서만**이다. 폰(390px − 좌우 16px)은 약 358px ÷ 17px ≈ **21자**다.
  WCAG 의 40자(상한)는 넉넉히 안이고, 영문 45–75자를 한글 폭으로 옮겨도(한글 한 자 ≈ 영문 두 자) 22–37자다 — 폰은 그 아래 끝이다.
  줄이 짧으면 문단 하나가 세로로 길어진다. **글자를 더 키우지 말 것**, 16–17px 이 폰에서 안 넘치는 끝이다.
- **행간 1.85** 는 WCAG 1.5 를 넘고 160–180% 관행의 위 끝이다. 문제 없음.
- **문단 사이 20px** 은 행간(약 31px)보다 **좁다**. WCAG 1.4.8(AAA)의 「문단 간격 ≥ 행간 × 1.5」(≈ 47px)에 못 미친다. AAA 라 의무는
  아니지만, 문단 경계가 흐리면 「벽」으로 보인다 — A안처럼 문단을 짧게 쪼갤수록 문단 간격이 덩이를 보이게 하는 장치가 된다.

## 6. 덩이와 기억 — 「일곱」이 아니라 「넷 안팎」, 그러나 읽기는 재인이다

- **[잰 것]** Miller 1956 은 "seven" 을 스스로 "a pernicious, Pythagorean coincidence" 일지 모른다고 했고, 요점은 덩이의 수가 덩이의 크기보다 중요하다는 것("we can increase the number of bits… simply by building larger and larger chunks") — [원문](https://psychclassics.yorku.ca/Miller/).
- **[잰 것]** Cowan 2001 은 순수한 용량을 약 **4덩이**로 다시 잡았다 — *Behavioral and Brain Sciences* 24(1) ([Cambridge](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496), 초록은 검색 요약으로 확인).
- **[지침]** NN/g 는 이것을 「메뉴 일곱 개 제한」 같은 데 쓰지 말라고 한다 — 화면은 기억(회상)이 아니라 알아보기(재인)라서 — Moran 2016 위.
- **[잰 것]** Sweller 1988 의 인지 부하는 문제 풀이 학습에서 나온 이론이다(*Cognitive Science* 12(2)). 읽기 화면에 바로 옮기는 것은 [추론]이다.

**[추론]** 「먼저 볼 핵심 세 가지」의 셋은 4덩이 안이라 근거와 맞는다. 다만 이유는 「기억 한도」보다 「한 화면에 들고 훑기 쉬운 수」다.
절 10개는 한 번에 쥘 수 없으니 **목차(지도)** 가 필요하다는 쪽의 근거가 된다.

## 7. 폰에서 · 접기 · 목차

- **[잰 것]** 276명 · 1,629건: 폰과 컴퓨터의 이해 점수에 "no practical differences". 어려운 글은 폰에서 더 느렸다(낱말당 약 30ms). 그래도 짧게 쓰라는 권고는 그대로 — Moran, [Reading Content on Mobile Devices](https://www.nngroup.com/articles/mobile-content/) (2016-12-11). 2011년의 「폰 이해도 절반」 결과는 이 연구로 갱신됐다고 본다.
- **[지침]** 아코디언은 "get the big picture before focusing on details" 를 돕지만, 내용이 길면 접으러 다시 올라가야 하고 펼친 판이 새 페이지처럼 보여 길을 잃는다 — Budiu, [Accordions on Mobile](https://www.nngroup.com/articles/mobile-accordions/) (2015-05-31). "When your audience requires the majority or all the content on the page" 에는 쓰지 말라, 잦은 펼침은 비용이 쌓인다 — Wang, [Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/) (2023-07-30).
- **[지침]** 점진적 공개: 처음 보이는 것이 곧 「중요하다」는 신호다. 2단계를 넘으면 쓰기 어렵다 — Nielsen, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) (2006-12-03).
- **[관찰]** 긴 페이지 아래쪽 내용은 덜 읽힌다 — 목차가 그것을 끌어올린다. 폰은 본문 안 목차 · 제목을 아코디언으로 · 붙어 다니는 목차가 있는데, 붙어 다니는 목차는 "many users failed to notice" — Wang & Brown, [Table of Contents](https://www.nngroup.com/articles/table-of-contents/) (NN/g 2023-10-06).

**[추론]** 풀이는 「대부분을 읽을 글」이라 절을 기본으로 접는 것은 근거와 어긋난다. 대신 **맨 위 목차(절 제목 + 한 줄 요약, 누르면 그 절로)** 가 맞다.

## 8. 벽 같은 글이 왜 지치나 — 읽기 쉬움이 「할 만함」을 바꾼다

- **[잰 것, 일차 미확인]** 같은 운동 안내를 읽기 어려운 글꼴로 주면 사람들이 더 오래 걸리고 더 어렵다고 예측하고 하려는 마음이 줄었다(기억은 같았다) — Song & Schwarz 2008, *Psychological Science* 19(10) 「If It's Hard to Read, It's Hard to Do」. 저널 쪽은 403 이라 [미시간대 보도](https://news.umich.edu/if-its-hard-to-read-is-it-hard-to-do) 로 확인.
- **[지침]** 덩이 없는 글은 "intimidating or time-consuming" 해 보인다 — Moran 2016 위.
- **[잰 것] 읽는 시간.** 영어 성인 묵독 평균 비소설 238 낱말/분(190개 연구, 18,573명) — Brysbaert 2019, *Journal of Memory and Language* 109 ([PDF 사본](https://reader.ku.edu/sites/reader/files/2024-01/How%20many%20words%20do%20we%20read%20per%20minute%20(1).pdf)). **한국어 묵독 속도(분당 음절)의 일차 연구는 못 찾았다** — 「11분」 같은 예상 시간은 기준값을 밝히고 써야 한다.

**[추론]** 「읽기 힘들다」는 운영자의 감각은 글자 크기 · 행간이 아니라 **처음 화면이 보여 주는 덩어리의 모양**에서 올 가능성이 크다.
지금 값(17px · 1.85)은 이미 권고 안이다. 바꿀 것은 짜임이다 — A안이 겨냥하는 자리가 맞다.

## A안에 비추어

| A안 요소 | 판정 | 근거 | 수정점 |
| --- | --- | --- | --- |
| 절 제목 바로 아래 굵은 한 줄 요약(옅은 띠) | **대체로 지지** | 역피라미드 · 레이어 케이크 · 첫머리 요약(2절) · 낯선 주제에 신호 효과가 큼 | ① 요약은 **굵게 하지 말고** 보통 굵기로 — 제목이 이미 굵고, 바로 아래 문단의 굵은 핵심구까지 겹치면 한 화면에 굵은 층이 셋이 된다(3절 「많으면 소음」). 띠(배경)로 이미 구별되니 굵기는 덜어도 된다. ② 띠는 콜아웃이다 — 절마다 늘 나오면 콜아웃의 「드묾」이 사라진다. 띠 대신 **제목 밑 회색 한 줄(부제)** 도 견줘 볼 것. ③ 요약은 그 절의 결론 문장이어야 한다(「이 절에서는…」 같은 안내문 금지 — 제목 지침 「only topics in the section」) |
| 문단마다 굵은 핵심구 하나 + 형광 밑줄 | **부분 지지** | 굵은 핵심어는 잰 효과(+47%의 일부). 그러나 양은 권고 10–30%, GOV.UK 는 강조 굵게 금지. 밑줄은 링크로 읽힐 위험(Baymard) | ① **문단마다 의무로 두지 말 것** — 「한 화면에 하나, 많아야 둘」로 상한. 문단 3–4문장이면 폰 한 화면에 문단이 둘–셋이라 「문단마다」는 화면마다 굵은 것 3–4개 + 요약 + 제목이 된다. ② 굵게와 형광을 **둘 다 쓰지 말고 하나만**(굵게 우선). 형광 밑줄은 링크 · 「밑줄 친 것=누를 수 있음」과 겹친다. ③ 굵게는 **문단 첫머리 쪽** 낱말에 — 훑는 눈은 문단 첫 문장을 읽는다(1절) |
| 문단 3–4문장 상한 | **지지** | 한 문단 한 생각 · 덩이 나누기 · GOV.UK 문장 25낱말 | ① 상한을 문장 수보다 **폰 줄 수**로 함께 잴 것(약 21자/줄에서 6–7줄 안). ② 한 문장 3줄 안. ③ **문단 간격을 지금 20px 에서 넓힐 것** — 행간(31px)보다 좁아 문단 경계가 흐리다(WCAG 1.4.8 AAA 의 1.5배 ≈ 47px 은 상한 참고값, 28–32px 정도부터 실측) |
| 「먼저 볼 핵심 세 가지」 번호 카드(굵은 제목 + 두 문장) | **지지** | 첫머리 요약 · 여러 요점은 목록으로(Wang & Chan) · 셋은 4덩이 안 | ① 풀이 **맨 위**(첫 절 앞)에 둔다 — 끝 요약은 발견성이 낮다. ② 카드 제목이 그 자체로 결론이 되게(제목만 읽어도 서게) |
| 장점: 소제목 붙은 짧은 덩이 | **지지** | 레이어 케이크 · 제목의 회상 효과 | 소제목은 **핵심 낱말로 시작**(「~할 때 빛나는 ~」보다 「책임감 — …」). 목록 머리말이 같으면 건너뛰기 패턴에 걸린다 — 「~하는 힘」 식 반복 금지 |
| 주의: 카드 + 라벨 줄(신호 / 이렇게 / 잘 다루면) | **부분 지지** | 신호 주기는 구조 이해에 잰 효과가 있다(Lorch). 그러나 같은 라벨이 카드마다 되풀이되면 건너뛰기 패턴 · 콜아웃 남발 | ① 라벨 셋을 카드마다 **굵게 다 달지 말고** 작은 회색 글씨로 낮출 것 — 라벨은 길잡이지 내용이 아니다. ② 카드는 주의 둘–셋까지. 넷을 넘으면 카드가 「벽」이 된다. ③ 장점(덩이)과 주의(카드)를 **모양이 다르게** 두는 것은 좋다 — 다만 카드가 핵심 세 가지 · 주의 · 칩 셋에 다 쓰이면 카드가 강조 신호를 잃는다 |
| 직업 분야: 낱말 칩 | **근거 약함, [추론] 무방** | 칩에 대한 읽기 연구는 못 찾았다. 짧은 항목은 목록이 훑기 쉽다는 일반 권고뿐 | 칩은 **누를 수 있게 생긴 것**이라 눌러도 아무 일이 없으면 헷갈린다. 테두리 · 그림자 없이 낮은 배경의 「꼬리표」 모양으로 |
| 본문 17px · 행간 1.85 · 36rem · keep-all | **지지** | WCAG 1.4.8 · 1.4.12 · CSS Text 3 · klreq | 그대로. 단, 「약 34자」는 데스크톱 값이라 폰(약 21자) 기준으로 문서를 고쳐 적을 것 |
| 첫 문단 크게(리드) | **부분 지지** | 역피라미드 — 첫 문단이 결론일 때만 의미 | 절마다 요약 띠가 서면 리드와 역할이 겹친다. **둘 중 하나만** — 요약 띠가 있으면 리드 확대는 맨 첫 절만 |

### A안에 없는데 근거가 권하는 것

1. **맨 위 목차** — 10절 · 11분은 「긴 페이지 아래는 덜 읽힌다」의 전형이다. 절 제목 + 한 줄 요약을 나열하고 누르면 그 절로. 폰에서 붙어 다니는 목차는 잘 안 보인다는 관찰이 있으니 **본문 안, 핵심 세 가지 바로 뒤**에(Wang & Brown 2023).
2. **TL;DR 를 첫 화면에** — 핵심 세 가지가 그 역할이지만, 첫 화면(폰 한 화면) 안에 들어오는지 실측. 그 앞의 머리말이 한 문단만 돼도 목차 · 요약이 접힌 아래로 밀린다(같은 글).
3. **읽는 시간 · 진행** — 「약 N분」 · 지금 몇 번째 절인지. 근거는 약하다(읽는 시간 표시의 효과를 잰 일차 연구는 못 찾았고 한국어 묵독 속도 기준값도 없다) — 넣는다면 기준값을 밝힐 것.
4. **절 접기는 넣지 않는다** — 대부분을 읽을 글에는 아코디언을 쓰지 말라는 권고(Wang 2023)와, 폰에서 긴 펼침이 길을 잃게 한다는 관찰(Budiu 2015). 다시 볼 때를 위해서는 목차가 낫다.
5. **글 자체를 줄이기** — 간결이 단일 효과로 가장 컸다(+58%), 셋을 합치면 +124%. 모양을 입히기 전에 절 수 · 분량을 줄일 여지를 먼저 본다(NN/g 2025 「AI 출력은 쓸데없이 길다」).
6. **절 끝 요약은 빼도 된다** — 제목 아래 요약이 이미 있으면 끝 요약과 겹친다. NN/g 는 절 요약을 끝에 두라고 하지만, 이 화면은 훑는 사람이 제목 · 첫 줄만 볼 가능성이 커 위가 낫다 [추론].

### 못 찾은 것 · 다시 볼 것

- 한글 본문 행간 160–180% · 한 줄 N자의 일차 근거(klreq 에 없음, KWCAG 일차 문서 미확인).
- 한국어 성인 묵독 속도의 일차 연구.
- Bringhurst · Dyson 2004 · Song & Schwarz 2008 · Richter 2016 · Cowan 2001 은 원문을 열지 못하고 초록 · 이차 인용으로 확인했다.
- 굵게의 「적정량」(10% · 30%)은 둘 다 실험 없는 권고다.
