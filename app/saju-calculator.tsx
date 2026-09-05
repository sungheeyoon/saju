'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { BirthFields } from './birth-form';
import { CARD } from './card';
import { calculateChart } from './chart';
import { useHashParams, writeParams } from './hash-query';
import { CopyLinkButton } from './copy-link';
import { SavePersonForReading } from './save-for-reading';
import { ELEMENT_TONE } from './element-tone';
import {
  TOPICS_THE_TABLE_HOLDS,
  TOPIC_TABLE_FOOTNOTE,
  ClaimStrengthLegend,
  UtteranceList,
  placeNowUtterances,
  said,
} from './utterances';
import {
  DEFAULT_QUERY,
  HOUR_UNKNOWN_LABEL,
  TIME_BASIS,
  missingAnswer,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from './query';
import {
  BRANCH_INFO,
  DAEUN_DIRECTION_KO,
  ELEMENTS,
  ELEMENT_KO,
  GENDER_KO,
  HIDDEN_STEM_ROLE_KO,
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_POLICY,
  JUDGEMENT_KO,
  PRECEDENCE_REASON_KO,
  FOLLOWING_PATTERN_STATUS_KO,
  EMPTINESS_BASIS_KO,
  UNRESOLVED_FACTOR_KO,
  PILLAR_POSITIONS,
  PILLAR_POSITION_KO,
  RELATION_KIND_KO,
  SPIRIT_BASIS_KO,
  STEM_INFO,
  TEN_GOD_KO,
  TRANSFORMATION_VERDICT_KO,
  TWELVE_SPIRIT_ALIAS,
  TWELVE_SPIRIT_KO,
  TWELVE_STAGE_KO,
  assembleNowText,
  assembleText,
  currentFortuneOf,
  type CurrentFortune,
  type DaeunAbsence,
  type DaeunSpan,
  type Element,
  directionParticipantsOf,
  orderedParticipants,
  toCivil,
  zoneIntervalAt,
  type PillarPosition,
  type Relation,
  type Saju,
  type StarNature,
  type StemTransformation,
  type StarTarget,
  type Utterance,
} from '@/src/lib/saju';

/**
 * 만세력 엔진은 순수 함수라 서버 없이 브라우저에서 그대로 돈다.
 * 제출한 입력만 계산하므로, 타이핑 도중의 반쪽 날짜로 계산하지 않는다.
 *
 * 화면이 묻는 것은 **무엇을 기준 시각으로 볼 것인가** 하나뿐이다.
 * 경도·균시차의 보정값 자체는 천문학적으로 정해지므로 선택지가 아니다.
 * 갈리는 것은 명리 계산에 출생기록 시각·지방평균태양시·진태양시 중 무엇을
 * 쓰느냐이고, 그것은 계통의 선택이다. 그래서 세 단계 하나로 묶었다.
 *
 * 두 값을 따로 켜게 두면 "경도 끔 + 균시차 켬" 같은 조합이 생긴다.
 * 그것은 출생지의 진태양시가 아니라 아무 곳의 시각도 아닌 값이다.
 *
 * 서머타임은 선택이 아니라 사실이라 묻지 않는다 — 1988년 7월 14시에
 * 태어난 사람의 시계는 실제로 UTC+10이었고, 되돌리는 것이 옳은 계산이다.
 * 시행 기간이 아닌 절대다수에게는 애초에 물어볼 것도 없는 질문이다.
 * 대신 되돌린 사실은 '적용된 보정' 표에 그대로 남는다.
 *
 * 예외가 하나 있다. 서머타임이 해제되던 날의 겹친 한 시간은 역사적 사실만으로
 * 어느 쪽인지 정할 수 없다. 이때는 전역 옵션이 아니라 그 계산에만 붙는
 * 경고로 알린다(앞선 쪽으로 해석했다고 밝힌다).
 *
 * 오행 색은 **정체성을 지지 않는다**(`app/element-tone.ts`).
 *
 * 전통색(청·적·황·백·흑)을 그대로 쓰지 않는다. 白(금)은 채움색으로 성립하지
 * 않고, 대체색을 넣으면 접근성 게이트를 넘지 못한다 — 토=갈색/금=금색은
 * 적↔갈 ΔE 2.5(deutan)로 사실상 같은 색이고, 은색·회색은 채도 하한에 걸린다.
 *
 * 그래서 오래 이 자리는 단일 색조였다. 지금 다섯 색조를 쓰는 것은 그 판단을
 * 뒤집은 것이 아니라 **조건을 지킨 채 들어온 것**이다: 글자 칸에도 막대에도
 * 오행 이름이 함께 붙어 있어서, 색을 못 가르는 사람에게 사라지는 정보가 없다.
 * 색이 유일한 단서가 되는 자리(범례만 있는 그림, 색으로만 갈리는 배지)에는
 * 여전히 쓰지 않는다 — 그 순간 위의 ΔE 문제가 그대로 돌아온다.
 */

/**
 * 궁성(宮星) — 각 기둥이 상징하는 자리와 시기.
 *
 * 계산이 아니라 **표시 규칙**이다. 여덟 글자에서 나오는 값이 아니라 자리에
 * 붙은 관습적 의미라서, 엔진이 아니라 화면이 들고 있는다.
 *
 * 육친을 성별로 단정하지 않는다 — "월간은 부친" 같은 배정은 계통과 성별에
 * 따라 갈리므로 관계(부모·형제) 수준까지만 적는다. 연령 구간도 대략이다.
 */
const PALACE: Record<'year' | 'month' | 'day' | 'hour', { role: string; period: string }> = {
  year: { role: '조상·뿌리', period: '초년' },
  month: { role: '부모·형제', period: '청년' },
  day: { role: '나·배우자', period: '중년' },
  hour: { role: '자녀·결실', period: '말년' },
};

/** 전통 표기 순서 — 시주가 왼쪽, 년주가 오른쪽 */
export const PILLAR_COLUMNS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' },
] as const;


const pad = (n: number) => String(n).padStart(2, '0');
const round1 = (n: number) => Math.round(n * 10) / 10;
const signedMinutes = (n: number) => `${round1(n) >= 0 ? '+' : ''}${round1(n)}분`;
const ageRangeLabel = (from: number, to: number) =>
  from === to ? `만 ${from}세` : `만 ${from}→${to}세`;
const koreaMonthDay = (date: Date) => {
  const local = toCivil(date, zoneIntervalAt(date).totalOffsetMinutes);
  return `${local.month}/${local.day}`;
};


/**
 * 제출된 입력은 주소창이 들고, 폼은 타이핑 중인 값만 들고 있다.
 *
 * 그래서 결과 화면을 그대로 링크로 줄 수 있고, 새로고침·뒤로가기에도 같은
 * 명식이 나온다. 계산은 여전히 브라우저 안에서만 일어난다 — 주소창은 서버로
 * 가는 통로가 아니라 이 페이지가 스스로 읽는 상태 저장소다.
 *
 * 입력은 쿼리스트링이 아니라 **`#` 뒤**에 실린다(`app/hash-query.ts`) — 그래야 서버
 * 로그에도, 링크 미리보기 크롤러에도, `Referer` 에도 가지 않는다. 주소는 `history`
 * API 로 직접 바꾸고, 라우트 전환 없이 주소만 바뀐다.
 *
 * 첫 계산은 `push`, 이후 수정은 `replace` 다. 첫 계산에는 "빈 화면으로
 * 되돌아간다"는 뒤로가기가 있어야 하지만, 세운 연도를 몇 번 옮겼다고 뒤로가기를
 * 그만큼 눌러야 하는 것은 아니다.
 */
export function SajuCalculator() {
  const searchParams = useHashParams();
  const query = useMemo(() => queryFromSearchParams(searchParams), [searchParams]);

  const [form, setForm] = useState<Query>(query ?? DEFAULT_QUERY);

  /**
   * 운을 짚을 기준 시각 — **제출할 때마다 새로 잡는다.**
   *
   * 한동안 결과 화면 안에서 `useState(() => Date.now())` 로 잡았고, 그래서 **첫 계산
   * 때 한 번 얼었다.** '결과 업데이트' 를 눌러도 갱신되지 않아, 탭을 열어 둔 채
   * 입춘·절입·생일을 넘기면 지난 운을 지금이라고 보여 줬다 — 문장이 "이 화면을 다시
   * 열면 그때의 시각으로 다시 셉니다"라고 적고 있는데 그 절반이 거짓이었다.
   *
   * 폼 위쪽에 두는 이유는 **제출이 여기서 일어나기** 때문이다. 결과 화면 안에서는
   * 자기가 왜 다시 그려지는지 알 수 없어서 "다시 제출됐다"를 알아낼 방법이 없다.
   *
   * 링크로 바로 들어온 경우에는 제출이 없으므로 첫 렌더 시각이 그 값이다. 어느
   * 쪽이든 `Date.now()` 를 부르는 곳은 여기 한 곳이고, 엔진은 시각을 스스로 묻지
   * 않는다(`NOW_POLICY.viewingInstant`).
   */
  const [viewedAt, setViewedAt] = useState(() => Date.now());

  const missing = missingAnswer(form);

  // 주소가 밖에서 바뀌면(뒤로가기·앞으로가기·링크로 들어옴) 폼도 그 값으로 되돌린다.
  // 화면은 주소가 가리키는 명식을 보여주는데 폼만 옛 입력을 들고 있으면,
  // '입력이 바뀌었습니다' 가 사용자가 바꾼 적 없는데도 떠 있게 된다.
  const shown = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current === shown.current) return;
    shown.current = current;
    setForm(queryFromSearchParams(searchParams) ?? DEFAULT_QUERY);
  }, [searchParams]);

  const result = useMemo(() => (query === null ? null : calculateChart(query)), [query]);
  const dirty =
    query !== null && (Object.keys(form) as (keyof Query)[]).some((k) => form[k] !== query[k]);


  const submit = (next: Query) => {
    const params = toSearchParams(next).toString();
    shown.current = params;
    // 제출은 "지금 다시 봐 달라"는 뜻이기도 하다.
    setViewedAt(Date.now());
    writeParams(params, query === null ? 'push' : 'replace');
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(form);
        }}
        className={`${CARD} flex flex-col gap-4`}
      >
        <BirthFields value={form} onChange={setForm} idPrefix="natal" />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={missing !== null}
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto"
          >
            {/*
              **명식**이다 — 「사주」도 「만세력」도 아니다(용어집).

              만세력은 절기와 간지를 찾는 책력이고 이 저장소의 이름이다. 그 표로
              한 사람의 입력에서 뽑아 낸 여덟 글자가 **명식**이고, 이 버튼이 내는
              것이 그것이다. 「사주」는 그 둘과 이 일 전체를 다 가리켜서, 버튼에
              적으면 무엇이 나오는지 말해 주지 않는다.
            */}
            {query === null ? '사주 결과 보기' : '수정한 정보로 다시 보기'}
          </button>

          {/* 왜 눌리지 않는지 버튼 옆에서 말한다 — 잠긴 버튼만 두면 이유를 찾아야 한다 */}
          {missing !== null && <p className="text-sm text-secondary">{missing}</p>}
        </div>

        {dirty && (
          <p className="text-sm text-secondary">
            입력이 바뀌었습니다. &lsquo;수정한 정보로 다시 보기&rsquo;를 누르면 반영됩니다.
          </p>
        )}
      </form>

      {/*
        **입력 전에는 아무것도 안 세운다.** 한동안 「생년월일시를 입력해 주세요」라는
        빈 칸이 서 있었는데, 바로 위의 폼이 이미 같은 말을 하고 있다 — 폼을 보고 있는
        사람에게 폼을 채우라고 한 번 더 말하는 자리였다. 예시 명식을 안 채우는 규율은
        그대로다(`query.ts`).
      */}
      {result === null ? null : result.ok ? (
        <>
          <SajuView saju={result.saju} viewedAt={viewedAt} />
          {/*
            **AI 로 가는 길은 저장 하나다.** 이 화면은 대상을 안 만들므로 시도도 잠금도
            풀이권도 걸 자리가 없다(ADR 0013·0030). 저장하면 그 사람의 화면으로 가고,
            거기가 저장한 사람의 풀이가 사는 자리다.

            `SajuView` 안이 아니라 여기다 — 그 컴포넌트는 저장한 사람의 화면도 함께 쓴다
            (`SajuResult`). 안에 두면 **이미 저장된 사람에게 「저장하세요」가 선다.**

            `query` 를 넘긴다. 폼(`form`)은 사용자가 지금 고치고 있는 값이라, 그것을
            저장하면 화면에 서 있는 명식과 다른 사람이 목록에 남는다.
          */}
          {query !== null && <SavePersonForReading query={query} />}
        </>
      ) : (
        <p role="alert" className={`${CARD} text-sm`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

/**
 * 저장한 사람의 상세 화면도 공개 계산기와 같은 결과 구성을 쓴다.
 * 저장된 입력을 주소로 옮기지 않고, 서버가 권한을 확인해 계산한 명식만 받는다.
 */
export function SajuResult({ saju }: { saju: Saju }) {
  const [viewedAt] = useState(() => Date.now());
  return <SajuView saju={saju} viewedAt={viewedAt} />;
}

function SajuView({ saju, viewedAt }: { saju: Saju; viewedAt: number }) {
  const [fortuneView, setFortuneView] = useState<'daeun' | 'saeun' | 'wolun'>('saeun');

  const utterances = useMemo(() => assembleText(saju), [saju]);

  /**
   * **지금을 한 번만 짚는다.**
   *
   * 세운 표와 월운 표가 각자 `viewedAt` 을 절입 시각과 견주어 '현재' 줄을 찾고
   * 있었고, 여기에 현재운 카드가 세 번째로 같은 판정을 하려던 자리다. 엔진이
   * "따로 세면 어긋난다"로 세운 규율은 화면에서도 같다 — `CurrentFortune` 이 세 칸의
   * `chartId` 를 이미 들고 있으므로 표는 그것과 견주기만 한다.
   */
  const now = useMemo(() => currentFortuneOf(saju, new Date(viewedAt)), [saju, viewedAt]);

  return (
    <div className="flex flex-col gap-6">
      <ResultNav />
      <CopyLinkButton />
      <PillarChart saju={saju} />
      <SaidAbout
        utterances={said(utterances, (topic) => !TOPICS_THE_TABLE_HOLDS.includes(topic))}
      />
      <div id="analysis" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
        <ElementChart saju={saju} />
        <StrengthMeter saju={saju} />
      </div>
      <RelationTable
        saju={saju}
        coverage={said(utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)}
      />
      <NowFortune now={now} />
      <FortuneTabs view={fortuneView} onChange={setFortuneView} saju={saju} now={now} />
      <StarTable saju={saju} />
      <TimeCorrections saju={saju} />
      <Warnings saju={saju} />
      {/*
        넘길 자료 패널은 **여기 서지 않는다**(`/evidence`).

        「프롬프트 + 자료 복사」·「JSON 내려받기」·「붙여 넣을 분량 46KB」·`relations-v1`
        은 계약을 검산하는 우리에게 필요한 것이지 사주를 보러 온 사람이 쓰는 것이 아니다.
        같은 링크의 `#` 뒤를 그대로 넘기면 그쪽에서 같은 자료가 선다.
      */}
    </div>
  );
}

/**
 * 이 명식에 대해 **말할 수 있는 것** — 문장은 요약, 아래 카드가 근거다.
 *
 * 궁합에서는 손으로 쓴 카드를 발화로 갈아 끼웠다. 여기서는 그러지 않는다 —
 * **원국 카드가 발화보다 자세하기** 때문이다. 세력 막대와 세 기준, 지장간 며칠치,
 * 조후 원문의 조건, 종격 판정의 재료 넷은 한 문장으로 접을 수 없고 접어서도 안 된다.
 * 그래서 역할을 나눈다: 이 카드는 **얼마나 세게 말할 수 있는가**를 들고, 아래 카드들은
 * 그렇게 말하게 해 준 숫자를 든다.
 *
 * **나란히 서는 것이 요점이다.** 억부 문장과 종격 문장이 서로 다른 오행을 가리킬 수
 * 있어서, 종격 여섯 벌이 전부 "억부 후보를 뒤집지 않습니다"를 달고 나간다. 두 문장을
 * 서로 다른 카드에 흩어 두면 그 마디가 무엇을 향한 말인지 보이지 않는다.
 */
function SaidAbout({ utterances }: { utterances: Utterance[] }) {
  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">이 명식에 대해 말할 수 있는 것</h2>

      <div className="mt-3">
        <UtteranceList utterances={utterances} />
      </div>

      <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
        <ClaimStrengthLegend tail=" 아래 카드들이 그 근거를 숫자로 폅니다." />
      </div>
    </section>
  );
}

/**
 * 지금의 운 — **버튼을 누른 시각을 기준으로 짚은 세 칸.**
 *
 * 아래 표들과 역할이 갈린다. 표는 **둘러보기** 도구다(세운 시작 연도를 옮겨 아홉 칸·
 * 열두 칸을 훑는다). 이 카드는 고르지 않고 **지금 하나**를 짚는다 — 사용자가 원한 것이
 * "몇 년 몇 월을 볼까"가 아니라 "지금 어떤가"였다.
 *
 * **강도 딱지가 여기서 처음 한 카드 안에서 갈린다.** 세운·월운 행은 사실이고 대운
 * 문장만 유도다. 갈리는 까닭은 대운수를 우리가 골랐기 때문이고(반올림이냐 버림이냐),
 * 그것을 문장이 스스로 밝힌다. 같은 카드에 나란히 서지 않으면 왜 하나만 딱지가 다른지
 * 보이지 않는다 — 억부와 종격을 한 카드에 모은 것과 같은 이유다.
 *
 * 현재운을 **밖에서 받는다.** 여기서 짚으면 아래 표들이 각자 짚는 '지금' 과 어긋날
 * 수 있고, 무엇보다 엔진이 시각을 스스로 묻지 않기로 한 결정
 * (`NOW_POLICY.viewingInstant`)이 화면에서 되돌아온다.
 */
/**
 * 겹침을 **운이 데려온 글자로 묶는다.**
 *
 * 운의 한 자가 원국의 어느 글자와 같으면 그 자리에 걸려 있던 관계가 **통째로** 겹친다 —
 * 대운 寅이 시지 寅과 같아서 다섯 관계가 한꺼번에 겹치는 것이 그것이다. 줄로 풀면 다섯
 * 줄이 한 사실을 다섯 번 말하고, 그러면 파묻힌 줄을 꺼내려고 만든 칸이 다시 목록이 된다.
 *
 * 엔진이 낸 값을 다시 세지 않는다 — `overlaps` 를 **모으기만** 한다.
 */
function groupOverlaps(
  overlaps: CurrentFortune['overlaps'],
): Map<string, { char: string; seats: PillarPosition[]; names: string[] }> {
  const grouped = new Map<string, { char: string; seats: PillarPosition[]; names: string[] }>();

  for (const overlap of overlaps) {
    const key = `${overlap.from.chartId}:${overlap.from.char}`;
    const found = grouped.get(key) ?? { char: overlap.from.char, seats: [], names: [] };

    grouped.set(key, {
      char: found.char,
      // 자리는 년→시 차례로 — 모은 순서는 관계가 세어진 순서라 사람이 읽는 차례가 아니다.
      seats: [...new Set([...found.seats, ...overlap.natalSeats])].sort(
        (a, b) => PILLAR_POSITIONS.indexOf(a) - PILLAR_POSITIONS.indexOf(b),
      ),
      names: [...new Set([...found.names, overlap.ko])],
    });
  }

  return grouped;
}

function NowFortune({ now }: { now: CurrentFortune }) {
  const { header, body, relations, footnote } = useMemo(
    () => placeNowUtterances(assembleNowText(now)),
    [now],
  );

  return (
    <section id="fortune" className={`${CARD} scroll-mt-20`}>
      <h2 className="text-base font-semibold">지금의 운</h2>

      <div className="mt-3">
        <UtteranceList utterances={header} />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <UtteranceList utterances={body} />
      </div>

      {/*
        관계를 갈라 세운다. 섞어 두면 아홉 줄이 본론인 세 칸을 묻는다 — 버리는 것이
        아니라 자리를 주는 것이고, 원국 화면에서 이 주제를 뺀 것과 이유가 다르다
        (저쪽은 표가 든다).
      */}
      {/*
        **열아홉 줄에 파묻히던 한 줄을 먼저 세운다.**

        원국에 이미 인신충이 있는 사람에게 이번 달 申이 또 오면, 그 달은 「새 충 하나」가
        아니라 **같은 자리를 두 번째로 치는 달**이다. 두 사실은 아래 목록에 다 있었지만
        서로 다른 줄에 있었고, 줄이 스물에 가까우면 사람도 모델도 그 짝을 못 맞춘다.

        엔진이 세어 준 것만 세운다(`now.overlaps`) — 화면이 다시 맞추면 목록과 이 칸이
        어긋나는 날 어느 쪽이 맞는지 알 수 없다.
      */}
      {now.overlaps.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-medium">원국의 같은 자리를 다시 밟는 것</h3>
          {/*
            **글자로 묶는다.** 운이 데려온 한 자가 원국의 어느 글자와 같으면 그 자리의
            관계가 통째로 겹치므로, 줄로 풀면 다섯 줄이 한 사실을 다섯 번 말한다. 겹치게
            만든 것은 그 **한 자**이고, 무엇이 겹쳤는지는 그 옆에 이름으로 선다.
          */}
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {[...groupOverlaps(now.overlaps)].map(([key, group]) => (
              <li key={key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="glyph font-medium">{group.char}</span>
                <span className="text-secondary">
                  {subjectParticle(group.char)} 원국{' '}
                  {group.seats.map((seat) => PILLAR_POSITION_KO[seat]).join('·')}의 같은 자리를
                  다시 밟습니다 —{' '}
                  <span className="text-foreground">{group.names.join(' · ')}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            새로 센 것이 아니라 아래 목록과 원국의 관계 표를 맞춰 본 것입니다 — 같은 종류가
            같은 자리에 다시 걸린 것만 셉니다.
          </p>
        </div>
      )}

      {relations.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-medium">지금이 원국과 맺는 관계</h3>
          <div className="mt-2">
            <UtteranceList utterances={relations} />
          </div>
        </div>
      )}

      {footnote.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <UtteranceList utterances={footnote} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        지금 하나만 짚습니다. 다른 시점은 아래 <strong className="font-medium">운 흐름</strong>{' '}
        표에서 골라 봅니다.
      </p>
    </section>
  );
}

const RESULT_LINKS = [
  ['chart', '명식'],
  ['analysis', '분석'],
  ['relations', '관계'],
  ['fortune', '운'],
  ['stars', '신살'],
  ['corrections', '보정'],
] as const;

function ResultNav() {
  return (
    <nav
      aria-label="결과 바로가기"
      className="sticky top-20 z-20 -my-2 overflow-x-auto rounded-xl border border-border bg-surface/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      <ul className="flex min-w-max items-center gap-1">
        {RESULT_LINKS.map(([target, label]) => (
          <li key={target}>
            <a
              href={`#${target}`}
              className="flex min-h-10 items-center rounded-lg px-3 text-sm text-secondary hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FortuneTabs({
  view,
  onChange,
  saju,
  now,
}: {
  view: 'daeun' | 'saeun' | 'wolun';
  onChange: (view: 'daeun' | 'saeun' | 'wolun') => void;
  saju: Saju;
  now: CurrentFortune;
}) {
  const tabs = [
    { key: 'daeun', label: '대운' },
    { key: 'saeun', label: '세운' },
    { key: 'wolun', label: '월운' },
  ] as const;

  const selectByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    // `id="fortune"` 은 위의 `NowFortune` 이 든다 — 바로가기가 '운' 을 가리킬 때
    // 먼저 보여야 하는 것은 지금이고, 표는 그 아래에서 둘러보는 것이다.
    <section className={`${CARD} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">운 흐름</h2>
          <p className="mt-0.5 text-xs text-secondary">
            다른 시점을 골라 한 표씩 집중해서 봅니다.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="운 종류"
          className="grid min-h-11 grid-cols-3 rounded-lg bg-surface-sunken p-1"
        >
          {tabs.map((tab, index) => {
            const selected = view === tab.key;
            return (
              <button
                key={tab.key}
                id={`fortune-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="fortune-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.key)}
                onKeyDown={(event) => selectByKeyboard(event, index)}
                className={`min-h-9 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="fortune-panel"
        role="tabpanel"
        aria-labelledby={`fortune-tab-${view}`}
        className="border-t border-border pt-5"
      >
        {view === 'daeun' && <DaeunTable saju={saju} now={now} />}
        {view === 'saeun' && <SaeunTable saju={saju} now={now} />}
        {view === 'wolun' && <WolunTable saju={saju} now={now} />}
      </div>
    </section>
  );
}

function HorizontalScrollHint() {
  return (
    <p className="mt-2 text-right text-xs text-muted sm:hidden" aria-hidden="true">
      ← 좌우로 넘겨 전체 보기 →
    </p>
  );
}

/**
 * 기둥마다 한 칸씩 붙는 표식 — 12운성·12신살·공망이 같은 모양이다.
 *
 * 셋 다 "이 자리에 무엇이 붙는가"라서 행 하나로 충분하다. 기준이 갈리는
 * 것(년지/일지, 일주/년주)은 행을 나누고 무엇을 기준으로 삼았는지 왼쪽에
 * 적는다 — 기준을 안 적으면 두 줄이 왜 다른지 알 수 없다.
 */
function MarkRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: (position: PillarPosition) => string | null;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-2 text-right align-middle text-xs whitespace-nowrap text-muted">
        {label}
        <span className="block text-[10px] opacity-70">{hint}</span>
      </td>
      {PILLAR_COLUMNS.map(({ key }) => {
        const mark = value(key);
        return (
          <td
            key={key}
            className={`px-2 py-1.5 text-xs ${key === 'day' ? 'font-medium' : 'text-secondary'}`}
          >
            {mark ?? <span className="text-muted opacity-40">·</span>}
          </td>
        );
      })}
    </tr>
  );
}

/**
 * 신살 — 어느 자리에 걸렸는지가 본론이므로 기둥별 표로 놓는다.
 *
 * 목록으로 늘어놓으면 "천을귀인이 있다"까지는 알아도 그게 월지인지 일지인지
 * 표에서 눈으로 못 찾는다. 원국 표와 같은 네 열을 쓰고, 천간에 걸린 것과
 * 지지에 걸린 것을 행으로 가른다 — 만세력이 관습적으로 그렇게 보여준다.
 *
 * 칸마다 무엇을 기준으로 뽑았는지(일간·년지 따위)를 작게 붙인다. 특히
 * 역마·도화는 년지 기준과 일지 기준이 서로 다른 자리를 가리키므로, 기준을
 * 안 적으면 같은 이름이 왜 두 자리에 있는지 알 수 없다.
 *
 * 길흉 분류는 표에 섞지 않고 아래 한 줄로 뺀다. 자리를 읽는 것과 좋고 나쁨을
 * 재는 것은 다른 일이고, 표 안에 색이나 기호로 섞으면 판정처럼 읽힌다.
 */
const STAR_ROWS = [
  { target: 'stem', label: '천간' },
  { target: 'branch', label: '지지' },
  { target: 'pillar', label: '간지' },
] as const satisfies readonly { target: StarTarget; label: string }[];

const STAR_NATURE_KO: Record<StarNature, string> = {
  auspicious: '길신',
  inauspicious: '흉신',
  neutral: '특수',
};

/**
 * 12신살에서 옮겨 온 셋 — 기준마다 걸린 자리가 없을 수 있다.
 *
 * 걸린 자리가 없으면 항목이 아예 안 나오는데, 그러면 "계산했는데 없다"와
 * "여기서는 안 본다"가 화면에서 같아 보인다. 도화를 년지 기준으로만 보는
 * 만세력과 결과를 맞춰볼 때 바로 이 구분이 필요하다. 그래서 없는 기준을
 * 따로 적어 준다. 값은 12신살 결과에서 그대로 읽으므로 신살 표와 갈릴 수 없다.
 */
const RESTATED_SPIRIT_KO: Record<string, string> = {
  驛馬殺: '역마',
  年殺: '도화',
  華蓋殺: '화개',
};

function missingSpiritNotes(saju: Saju): string[] {
  return saju.sinsal.twelveSpirits.flatMap((chart) => {
    const present = new Set(PILLAR_COLUMNS.map(({ key }) => chart.byPosition[key]));
    const missing = Object.entries(RESTATED_SPIRIT_KO)
      .filter(([spirit]) => !present.has(spirit as never))
      .map(([, ko]) => ko);

    if (missing.length === 0) return [];
    return [
      `${SPIRIT_BASIS_KO[chart.basis]} ${chart.basisBranch} 기준으로는 ${missing.join('·')}가 걸린 자리가 없습니다.`,
    ];
  });
}

function StarTable({ saju }: { saju: Saju }) {
  const { stars } = saju.sinsal;
  const missingSpirits = missingSpiritNotes(saju);

  /** 자리·대상별로 나눠 담는다 — 한 신살이 여러 칸에 걸릴 수 있다 */
  const at = (target: StarTarget, position: PillarPosition) =>
    stars.flatMap((star) =>
      star.hits
        .filter((hit) => hit.target === target && hit.position === position)
        .map((hit) => ({ star, hit })),
    );

  // 괴강·백호가 없으면 간지 행은 통째로 비므로 아예 내지 않는다.
  const rows = STAR_ROWS.filter(
    ({ target }) => target !== 'pillar' || stars.some((s) => s.hits.some((h) => h.target === target)),
  );

  return (
    <section id="stars" className={`${CARD} scroll-mt-20`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">신살</h2>
        <p className="text-sm text-secondary">
          {stars.length === 0 ? '걸린 신살이 없습니다' : `${stars.length}개`}
        </p>
      </div>

      {stars.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <thead>
                <tr>
                  <th className="w-14 pb-2" />
                  {PILLAR_COLUMNS.map(({ key, label }) => (
                    <th
                      key={key}
                      className={`px-2 pb-2 text-xs font-normal ${
                        key === 'day' ? 'text-foreground' : 'text-muted'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ target, label }) => (
                  <tr key={target} className="border-t border-border align-top">
                    <td className="py-2 pr-2 text-right text-xs whitespace-nowrap text-muted">
                      {label}
                    </td>
                    {PILLAR_COLUMNS.map(({ key }) => {
                      const found = at(target, key);
                      return (
                        <td key={key} className="px-2 py-2">
                          {found.length === 0 ? (
                            <span className="text-xs text-muted opacity-40">·</span>
                          ) : (
                            <ul className="flex flex-col gap-1.5">
                              {found.map(({ star, hit }) => (
                                <li key={`${star.id}:${hit.char}`}>
                                  <span className="text-sm">{star.ko}</span>
                                  {star.basis && (
                                    <span className="block text-[10px] text-muted">
                                      {star.basis.label} {star.basis.char}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs">
            {(Object.keys(STAR_NATURE_KO) as StarNature[]).map((nature) => {
              const named = [
                ...new Set(stars.filter((s) => s.nature === nature).map((s) => s.ko)),
              ];
              if (named.length === 0) return null;
              return (
                <div key={nature} className="flex gap-2">
                  <dt className="w-8 shrink-0 text-muted">{STAR_NATURE_KO[nature]}</dt>
                  <dd className="text-secondary">{named.join(' · ')}</dd>
                </div>
              );
            })}
          </dl>
        </>
      )}

      {missingSpirits.length > 0 && (
        <ul className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3 text-xs text-secondary">
          {missingSpirits.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {/*
        **결과를 읽는 데 필요한 것과 계산을 검산하는 데 필요한 것을 가른다.**

        여덟 줄이 한 문단으로 서 있었다. 그중 사용자가 이 표를 **해석**하는 데 필요한
        것은 둘뿐이다 — 기준이 갈린다는 사실과, 길신·흉신이 좋고 나쁨이 아니라는 것.
        「현침은 甲辛卯午申 중 3자 이상」부터는 우리 계산이 맞는지 되짚을 때 필요한
        것이라, 같은 카드 안에서 한 겹 아래로 내린다.

        `/evidence` 로 보내지 않은 이유: 그 화면은 걸어 두지 않은 주소다(ADR 0025).
        여기서 링크를 걸면 그 결정이 풀리고, 안 걸면 궁금한 사람이 닿을 길이 없다.
        접는 것은 **읽는 차례에서 빼는 것**이고 그것이 여기서 고치려던 문제다.
      */}
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
        <p>
          산출법이 갈리는 신살은 채택한 기준을 밝히고 그 기준으로만 뽑습니다 — 고전 하나로
          통일한 것이 아닙니다. 길신·흉신은 전통적 분류일 뿐 좋고 나쁨의 판정이 아닙니다.
          {!saju.meta.hourKnown && ' 시주를 몰라 시주에 걸린 신살은 빠져 있습니다.'}
        </p>

        <details className="mt-2">
          <summary className="cursor-pointer hover:text-accent">어떤 기준으로 뽑았나</summary>
          <p className="mt-1.5 leading-5">
            현침은 甲辛卯午申 중 3자 이상, 천문은 戌亥가 함께 있어야 성립하고, 천의성은 월지
            바로 앞 지지입니다. 귀문관살·원진살은 원국 네 지지의{' '}
            <strong className="font-medium">모든 쌍</strong>에서 찾습니다(일지 기준으로 좁히는
            계통은 쓰지 않습니다). 역마·도화·화개는 12신살에서, 귀문관살·원진살은 관계 표에서
            가져온 값이라 그쪽과 언제나 일치합니다 — 두 글자가 서로 어떻게 걸렸는지는
            &lsquo;원국의 관계&rsquo;에 있습니다.
          </p>
        </details>
      </div>
    </section>
  );
}

/**
 * 원국의 관계 — 여덟 글자 안에서 성립하는 형충회합.
 *
 * 길흉을 말하지 않는다. 무엇이 무엇과 어떤 관계인지, 어느 자리에서인지만 적는다.
 * 붙어 있어야 성립한다고 보는 학파를 위해 떨어진 것은 거리를 밝히고, 세 글자
 * 구조에서 둘만 담은 것은 그렇다고 밝힌다. 걸러내는 것은 읽는 사람의 몫이다.
 */
/**
 * 한자 글자 뒤의 조사 — **읽는 소리의 받침을 따른다.**
 *
 * `未이 丑를 형` 이라고 적고 있었다. L3 계약이 문장 틀에서 슬롯 뒤 조사를 아예
 * 금지한 이유가 이것인데(`VARIABLE_PARTICLES`), 화면은 그 검사를 받지 않아 그대로
 * 새어 있었다. 삼형마다 두 글자 행이 셋씩 붙으면서 눈에 띄었다.
 *
 * 글자는 한자로 보이지만 읽는 사람은 '미'·'축' 으로 읽으므로 받침은 그 소리에서
 * 나온다. 계약이 막은 것은 **틀이 미리 고르는 것**이지, 값을 아는 쪽이 고르는 것은
 * 아니다 — 조립기가 이름을 이어 붙일 때 쓰는 판단과 같다(`joinNames`).
 */
const hasFinalConsonant = (char: string): boolean => {
  /*
    지지만 읽고 있었다. 천간을 그대로 넘기면 한자에는 받침이 없으므로 **언제나
    「가」·「를」** 이 나온다 — 壬(임)·辛(신)처럼 받침 있는 글자에서 틀린다. 조후가
    권한 글자를 문장에 넣기 시작하면서 걸렸다.
  */
  const ko =
    BRANCH_INFO[char as keyof typeof BRANCH_INFO]?.ko ??
    STEM_INFO[char as keyof typeof STEM_INFO]?.ko ??
    char;
  const code = ko.charCodeAt(ko.length - 1) - 0xac00;

  return code >= 0 && code <= 11171 && code % 28 !== 0;
};

const subjectParticle = (char: string) => (hasFinalConsonant(char) ? '이' : '가');
const objectParticle = (char: string) => (hasFinalConsonant(char) ? '을' : '를');

function RelationTable({ saju, coverage }: { saju: Saju; coverage: Utterance[] }) {
  const { relations } = saju;

  return (
    <section id="relations" className={`${CARD} scroll-mt-20`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">원국의 관계</h2>
        <p className="text-sm text-secondary">
          {relations.length === 0 ? '성립하는 관계가 없습니다' : `${relations.length}개`}
        </p>
      </div>

      {relations.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">
              여덟 글자 사이에 성립하는 합·충·형·해·파·원진·귀문
            </caption>
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-1.5 text-left font-normal whitespace-nowrap">종류</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">글자</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">이름</th>
                <th className="pb-1.5 pl-3 text-left font-normal whitespace-nowrap">자리</th>
                <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비고</th>
              </tr>
            </thead>
            <tbody>
              {relations.map((relation) => (
                <tr key={relationKey(relation)} className="border-t border-border">
                  <td className="py-1.5 whitespace-nowrap text-secondary">
                    {RELATION_KIND_KO[relation.kind]}
                  </td>
                  <td className="glyph py-1.5 pl-3 text-base whitespace-nowrap">
                    {orderedParticipants(relation)
                      .map((p) => p.char)
                      .join('')}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap">
                    {relation.ko}
                    {relation.name && (
                      <span className="ml-1.5 text-xs text-muted">{relation.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-3 whitespace-nowrap text-secondary">
                    {orderedParticipants(relation)
                      .map((p) => PILLAR_POSITION_KO[p.position].charAt(0))
                      .join('·')}
                  </td>
                  <td className="py-1.5 pl-3 text-xs text-muted">
                    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                      {relation.targetElement && (
                        <span className="text-secondary">
                          합화 오행 {ELEMENT_KO[relation.targetElement]}
                        </span>
                      )}
                      {(() => {
                        const arrow = directionParticipantsOf(relation);
                        return (
                          arrow && (
                            <span>
                              {arrow.from.char}
                              {subjectParticle(arrow.from.char)} {arrow.to.char}
                              {objectParticle(arrow.to.char)} 형
                            </span>
                          )
                        );
                      })()}
                      {/*
                        세 글자가 다 모인 삼형은 화살표 하나로 못 적는다 — 고리로
                        적고 첫 글자로 되돌아오는 것까지 보인다. 시작점은 고전이
                        부르는 차례일 뿐이라 "丑이 먼저"라는 뜻이 아니다.
                      */}
                      {relation.cycle && (
                        <span className="glyph">
                          {orderedParticipants(relation)
                            .map((p) => p.char)
                            .concat(orderedParticipants(relation)[0].char)
                            .join('→')}{' '}
                          <span className="font-sans">순환</span>
                        </span>
                      )}
                      {/*
                        '반쪽' 이라고 적던 자리다. `full: false` 의 뜻은 그대로이고
                        (이 관계가 세 글자 구조에서 둘만 담았다) 낱말만 낡았다 —
                        삼형 안의 두 글자 형을 따로 내기로 하면서, 바로 위에 未 가
                        서 있는데도 "반쪽" 이 붙는 자리가 생겼다. 그때 '반쪽' 은
                        "나머지 글자가 명식에 없다" 로 읽힌다.

                        합에서는 지금도 참이다(흡수된 반합은 버리므로 진짜 반쪽이다).
                        그래도 한 낱말로 둔다 — '두 글자' 는 양쪽에서 다 참이고,
                        반합·반방합은 이름에 이미 반(半) 이 들어 있어 잃는 것이 없다.
                      */}
                      {!relation.full && <span>두 글자</span>}
                      {!relation.adjacent && <span>{relation.distance}칸 떨어짐</span>}
                      {relation.contested.length > 0 && (
                        <span className="text-accent">
                          쟁합 · {relation.contested[0].over.char}를 두고 다툼
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <HorizontalScrollHint />
        </>
      )}

      {/*
        손으로 적던 자리다: "시주를 몰라 시주가 걸린 관계는 빠져 있습니다."
        같은 말인데 **목록의 한계는 목록이 든다**는 규칙에서 나온 문장이 따로 있고,
        그 문장은 강도까지 달고 나온다(`relation.coverage`). 두 벌 적을 이유가 없다.
      */}
      {coverage.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <UtteranceList utterances={coverage} />
        </div>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        성립 여부만 적습니다. 합이 이뤄지는지, 충이 합을 깨는지는 학파마다 갈려 판정하지 않습니다.
        원진과 귀문은 네 쌍이 겹치므로 같은 두 글자에 두 줄이 함께 나올 수 있습니다.
      </p>
    </section>
  );
}

/**
 * 관계 하나를 가리키는 키.
 *
 * 이름만으로는 모자란다. 같은 관계가 **자리만 달리해** 여러 번 나오고
 * (원국에 辰이 둘이면 월운 卯와 묘진해가 둘 성립한다), 계산판이 섞이면
 * 자리 이름마저 겹친다(원국 년주와 세운 년주가 둘 다 'year'). 글자가 아니라
 * 계산판+자리가 관계의 정체성이다.
 */
function relationKey(relation: Relation): string {
  return `${relation.kind}:${relation.ko}:${relation.participants
    .map((p) => `${p.chartId}.${p.position}`)
    .join('-')}`;
}

/**
 * 이 관계가 **어느 판과 걸렸는가** — 자기 판과 원국은 적지 않는다.
 *
 * 세운·월운 칸은 이제 원국만 놓고 보지 않는다. 세운은 자기를 감싼 대운을, 월운은
 * 그 위에 세운까지 놓고 본다. 종류(`ko`)만 찍으면 **원국과 걸린 것과 대운과 걸린
 * 것이 한 줄로 읽히고**, 그 둘은 같은 무게가 아니다 — 하나는 타고난 판과 걸린
 * 것이고 하나는 십 년만 서는 글자와 걸린 것이다.
 *
 * 원국을 안 적는 것은 그것이 바탕이기 때문이다. 관계 대부분이 원국과 걸리므로
 * 다 적으면 딱지가 배경이 되어 아무것도 가르지 못한다. 여기 딱지가 붙은 줄만
 * 원국 밖의 글자가 낀 것이다.
 */
function crossedChartsKo(relation: Relation, selfChartId: string): string | null {
  const names = new Set<string>();

  for (const participant of relation.participants) {
    const { chartId } = participant;
    if (chartId === selfChartId || chartId === 'natal') continue;
    names.add(
      chartId.startsWith('decade:') ? '대운' : chartId.startsWith('annual:') ? '세운' : '월운',
    );
  }

  return names.size > 0 ? [...names].join('·') : null;
}

/** 걸친 대운을 한 줄로 — 경계를 넘으면 둘이다 */
function daeunSpanLabel(spans: readonly DaeunSpan[]): string | null {
  if (spans.length === 0) return null;
  return spans.map((span) => `${span.index}대운`).join('·');
}

/**
 * 걸친 대운이 없는 까닭 — **둘을 가른다.**
 *
 * 앞은 이 사람에 대한 사실이라 그대로 적고, 뒤는 우리가 뽑은 칸 수의 한계라
 * 그렇게 적는다. 하나로 묶으면 우리 표의 한계가 그 사람의 사실처럼 읽힌다.
 */
const DAEUN_ABSENCE_KO: Record<DaeunAbsence, string> = {
  'before-first': '대운 전',
  'beyond-table': '표 밖',
};

/**
 * 세운 — 해마다의 간지.
 *
 * 대운 표와 같은 모양으로 늘어놓되, 세운은 **원국·대운과 무엇을 하는가**가 본론이라
 * 관계를 칸 아래에 함께 적는다. 그 관계는 원국 안에서 닫힌 것을 뺀 것이다 —
 * 그건 해마다 같아서 세운 칸에 적을 이유가 없다.
 *
 * 해의 경계는 입춘이다. 1월에 일어난 일은 아직 전 해의 세운이라, 각 칸에
 * 입춘 날짜를 적어 둔다.
 */
function SaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { entries } = saju.saeun;
  // 절입 시각을 여기서 다시 견주지 않는다 — 지금이 어느 해인지는 현재운이 이미 짚었다.
  // 그 해가 이 표 밖이면 어느 줄도 강조되지 않고, 그것이 맞는 답이다.
  const currentChartId = now.saeun.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">세운</h2>
        <p className="text-sm text-secondary">
          {entries[0].year}년 ~ {entries[entries.length - 1].year}년
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        해의 경계는 입춘입니다. 양력 1월에 일어난 일은 아직 전 해의 세운입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-center">
          <caption className="sr-only">해마다의 간지와 원국·대운과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <th
                    key={entry.year}
                    className={`px-1 pb-2 text-xs font-normal ${current ? 'text-accent' : 'text-secondary'}`}
                  >
                    {entry.year}
                    {current && <span className="ml-1 text-[10px] font-medium">현재</span>}
                    <span className="block text-[11px] text-muted">
                      {ageRangeLabel(entry.ageAtStart, entry.ageAtEnd)}
                    </span>
                    {/*
                      그 해가 어느 대운 안에 있는가. 아래 관계 목록이 대운과 걸린 것을
                      함께 내므로, 어느 대운인지가 여기 없으면 딱지만 있고 대상이 없다.
                      한 해가 대운 경계를 넘으면 둘이 적힌다 — 실제로 두 대운이 지난다.
                    */}
                    <span className="block text-[10px] text-muted">
                      {daeunSpanLabel(entry.daeunSpans) ??
                        (entry.daeunAbsence ? DAEUN_ABSENCE_KO[entry.daeunAbsence] : '')}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <td key={entry.year} className="snap-start px-1 align-top">
                    <div
                      className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                        current
                          ? 'border-accent bg-accent-wash'
                          : 'border-border bg-surface-sunken'
                      }`}
                    >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                    <span className="text-[10px] text-muted">
                      {TWELVE_SPIRIT_ALIAS[entry.spirits.year] ??
                        TWELVE_SPIRIT_KO[entry.spirits.year]}
                    </span>
                    </div>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                      {entry.relations.map((relation) => {
                        const crossed = crossedChartsKo(relation, entry.chartId);
                        return (
                          <li key={relationKey(relation)}>
                            {relation.ko}
                            {/*
                              딱지가 둘 붙을 수 있다 — '사유축 금국 대운 합쳐서' 는 어디까지가
                              관계 이름인지 읽히지 않는다. 가운뎃점이 그것을 가른다.
                            */}
                            {crossed !== null && <span className="text-muted"> · {crossed}</span>}
                            {relation.scope === 'combinedFormation' && (
                              <span className="text-muted"> · 합쳐서</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) ·
        12신살(년지 기준)입니다. 아래 목록은 그 해가{' '}
        <strong className="font-medium">원국과 그 해를 감싼 대운</strong>에 대해 맺는
        관계로, 원국 안에서만 성립하는 관계와 원국·대운 사이의 관계는 뺐습니다.
        대운과 걸린 줄에는 <span className="text-secondary">대운</span> 딱지가 붙습니다.
        머리의 <span className="text-secondary">N대운</span>은 그 해가 지나는
        대운이고, 대운 경계를 넘는 해에는 둘이 적힙니다.
      </p>
    </section>
  );
}

/**
 * 월운 — 한 해의 열두 달.
 *
 * 세운 표와 같은 모양이되 경계가 다르다. 달력 월이 아니라 절입이라, 각 칸에
 * 그 달이 시작되는 절과 날짜를 적는다 — 3월 3일이 아직 인월이라는 것이
 * 월운에서 가장 자주 어긋나는 지점이다.
 */
function WolunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { year, entries } = saju.wolun;
  const currentChartId = now.wolun.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">월운</h2>
        <p className="text-sm text-secondary">{year}년 (사주년)</p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        경계는 절입입니다. 달력 월이 아니라 절기가 달을 가릅니다 — 3월 초 경칩
        전까지는 아직 인월(寅月)입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-center">
          <caption className="sr-only">한 해 열두 달의 간지와 원국·세운과의 관계</caption>
          <thead>
            <tr>
              {entries.map((entry) => (
                <th
                  key={entry.chartId}
                  className={`px-1 pb-2 text-xs font-normal ${
                    entry.chartId === currentChartId ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {entry.startTerm.name}
                  {entry.chartId === currentChartId && (
                    <span className="ml-1 text-[10px] font-medium">현재</span>
                  )}
                  <span className="block text-[11px] text-muted">
                    {koreaMonthDay(entry.startTerm.date)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {entries.map((entry) => (
                <td key={entry.chartId} className="snap-start px-1 align-top">
                  <div
                    className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                      entry.chartId === currentChartId
                        ? 'border-accent bg-accent-wash'
                        : 'border-border bg-surface-sunken'
                    }`}
                  >
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.stem]}
                    </span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                    <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                    <span className="text-[10px] text-muted">
                      {TEN_GOD_KO[entry.tenGods.branch]}
                    </span>
                    <span className="mt-1 text-[11px] text-secondary">
                      {TWELVE_STAGE_KO[entry.stage]}
                    </span>
                  </div>

                  <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                    {entry.relations.map((relation) => {
                      const crossed = crossedChartsKo(relation, entry.chartId);
                      return (
                        <li key={relationKey(relation)}>
                          {relation.ko}
                          {crossed !== null && <span className="text-muted"> · {crossed}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        아래 목록은 그 달이 <strong className="font-medium">원국과 세운과 대운</strong>에
        대해 맺는 관계입니다. 그 달이 끼지 않은 관계는 빼두었습니다 — 원국 안에서
        닫힌 것도, 원국·세운·대운끼리의 것도 여기 적을 이유가 없습니다. 원국 밖의
        글자가 낀 줄에는 <span className="text-secondary">세운</span>·
        <span className="text-secondary">대운</span> 딱지가 붙습니다.
      </p>
    </section>
  );
}

/**
 * 대운 — 10년마다 갈아입는 간지. 시간 순서가 있으므로 가로로 늘어놓는다.
 *
 * 나이는 만 나이(출생일로부터의 경과 연수)다. 세는나이로 적는 만세력과는
 * 한 살 차이가 나므로 화면에 밝혀 둔다.
 */
function DaeunTable({ saju, now }: { saju: Saju; now: CurrentFortune }) {
  const { daeun } = saju;
  const currentChartId = now.daeun?.chartId;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">대운</h2>
        <p className="text-sm">
          <span className="font-medium">{DAEUN_DIRECTION_KO[daeun.direction]}</span>
          <span className="mx-1.5 text-muted">·</span>
          대운수 <span className="tabular-nums font-medium">{daeun.startAge}</span>
          {daeun.approximate && <span className="ml-1.5 text-xs text-muted">근사</span>}
        </p>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        {daeun.directionReason} {daeun.boundaryTerm.name} 절입까지{' '}
        {round1(daeun.daysToBoundary)}일이라 3으로 나눠 {round1(daeun.startAgeExact)}년입니다.
      </p>

      <div className="mt-4 snap-x snap-proximity overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-center">
          <caption className="sr-only">10년 단위 대운의 간지와 원국과의 관계</caption>
          <thead>
            <tr>
              {daeun.entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <th
                    key={entry.chartId}
                    className={`px-1 pb-2 text-xs font-normal ${current ? 'text-accent' : 'text-secondary'}`}
                  >
                    {entry.startAge}세
                    {current && <span className="ml-1 text-[10px] font-medium">현재</span>}
                    <span className="block text-[11px] text-muted">{entry.startYear}년</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {daeun.entries.map((entry) => {
                const current = entry.chartId === currentChartId;
                return (
                  <td key={entry.chartId} className="snap-start px-1 align-top">
                    <div
                      className={`mx-auto flex min-h-[7.25rem] w-full max-w-24 flex-col items-center gap-0.5 rounded-lg border py-2.5 ${
                        current ? 'border-accent bg-accent-wash' : 'border-border bg-surface-sunken'
                      }`}
                    >
                      <span className="text-[10px] text-muted">
                        {TEN_GOD_KO[entry.tenGods.stem]}
                      </span>
                      <span className="glyph text-2xl leading-none">{entry.pillar.stem}</span>
                      <span className="glyph text-2xl leading-none">{entry.pillar.branch}</span>
                      <span className="text-[10px] text-muted">
                        {TEN_GOD_KO[entry.tenGods.branch]}
                      </span>
                      <span className="mt-1 text-[11px] text-secondary">
                        {TWELVE_STAGE_KO[entry.stage]}
                      </span>
                      <span className="text-[10px] text-muted">
                        {TWELVE_SPIRIT_ALIAS[entry.spirits.year] ??
                          TWELVE_SPIRIT_KO[entry.spirits.year]}
                      </span>
                    </div>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-secondary">
                      {entry.relations.map((relation) => (
                        <li key={relationKey(relation)}>
                          {relation.ko}
                          {relation.scope === 'combinedFormation' && (
                            <span className="text-muted"> 합쳐서</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) ·
        12신살(년지 기준)입니다. 아래 목록은 그 대운이 원국과 맺는 관계입니다.{' '}
        <strong className="font-medium">세운·월운과 걸리는 것은 세운·월운 표에 있습니다</strong>{' '}
        — 한 칸이 열 해라 함께 놓을 세운이 하나가 아니어서, 좁은 쪽이 자기를 감싼 대운을
        듭니다. 나이는 만 나이입니다.
        {daeun.approximate && ' 출생 시각을 몰라 정오 기준으로 계산해 대운수가 두어 달 흔들립니다.'}
      </p>
    </section>
  );
}

/** 사주팔자 — 차트가 아니라 표다. 일주(나) 열만 강조한다. */
function PillarChart({ saju }: { saju: Saju }) {
  const { pillars, analysis } = saju;

  return (
    <section id="chart" className={`${CARD} scroll-mt-20`}>
      <h2 className="mb-4 text-base font-semibold">사주팔자</h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-center">
          <thead>
            <tr>
              <th className="w-16" />
              {PILLAR_COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  className={`px-2 pb-2 text-xs font-medium ${
                    key === 'day' ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {label}
                  {key === 'day' && <span className="ml-1 opacity-70">나</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TenGodRow label="십성" saju={saju} position="stem" />

            <tr>
              <RowLabel>천간</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => {
                const pillar = pillars[key];
                return (
                  <GlyphCell
                    key={key}
                    emphasis={key === 'day'}
                    glyph={pillar && pillar.stem}
                    element={pillar ? STEM_INFO[pillar.stem].element : null}
                    caption={
                      pillar
                        ? `${STEM_INFO[pillar.stem].ko} · ${ELEMENT_KO[STEM_INFO[pillar.stem].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                  />
                );
              })}
            </tr>

            <tr>
              <RowLabel>지지</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => {
                const pillar = pillars[key];
                return (
                  <GlyphCell
                    key={key}
                    emphasis={key === 'day'}
                    glyph={pillar && pillar.branch}
                    element={pillar ? BRANCH_INFO[pillar.branch].element : null}
                    caption={
                      pillar
                        ? `${BRANCH_INFO[pillar.branch].ko} · ${ELEMENT_KO[BRANCH_INFO[pillar.branch].element]}`
                        : HOUR_UNKNOWN_LABEL
                    }
                  />
                );
              })}
            </tr>

            <TenGodRow label="십성" saju={saju} position="branch" />

            <tr>
              <RowLabel>지장간</RowLabel>
              {PILLAR_COLUMNS.map(({ key }) => (
                <td key={key} className="px-2 pt-2 align-top">
                  <ul className="flex flex-col gap-0.5 text-[11px] text-muted">
                    {analysis.tenGods[key]?.hiddenStems.map((hidden) => (
                      <li key={hidden.stem + hidden.role}>
                        <span className="glyph">{hidden.stem}</span> {TEN_GOD_KO[hidden.tenGod]}
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            <MarkRow
              label="궁"
              hint="자리의 상징"
              value={(key) => `${PALACE[key].role} · ${PALACE[key].period}`}
            />

            {/*
              **계통을 밝힌다.** 「일간 기준」만으로는 부족하다 — 음간을 역행시키느냐
              (음양순역, 연해자평 이래의 정통) 양간과 같이 보느냐(양포태)에 따라 같은
              일간·지지에서 다른 운성이 나온다. 산출법이 갈리는 신살은 기준을 밝힌다고
              해 놓고 이 줄만 안 밝히고 있었다.

              값은 명식이 들고 있다(`stages.yinReverse`) — 화면이 기본값을 다시 적으면
              옵션을 바꾼 명식에서 거짓말이 된다.
            */}
            <MarkRow
              label="12운성"
              hint={`일간 기준 · ${saju.stages.yinReverse ? '음양순역' : '양포태'}`}
              value={(key) => {
                const stage = saju.stages.byDayMaster[key];
                return stage ? TWELVE_STAGE_KO[stage] : null;
              }}
            />

            {saju.sinsal.twelveSpirits.map((chart) => (
              <MarkRow
                key={chart.basis}
                label="12신살"
                hint={`${SPIRIT_BASIS_KO[chart.basis]} 기준`}
                value={(key) => {
                  const spirit = chart.byPosition[key];
                  if (!spirit) return null;
                  return TWELVE_SPIRIT_ALIAS[spirit] ?? TWELVE_SPIRIT_KO[spirit];
                }}
              />
            ))}

            {saju.sinsal.emptiness.map((emptiness) => (
              <MarkRow
                key={emptiness.basis}
                label="공망"
                hint={`${EMPTINESS_BASIS_KO[emptiness.basis]} 기준 ${emptiness.branches.join('')}`}
                value={(key) => (emptiness.positions.includes(key) ? '공망' : null)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <HorizontalScrollHint />

      <p className="mt-3 text-xs text-muted">
        궁(宮)은 계산 결과가 아니라 자리에 붙은 관습적 의미입니다. 육친을 성별로
        단정하지 않았고(월간=부친 같은 배정은 계통마다 갈립니다), 연령 구간도
        대략입니다.
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-4 text-sm">
        <Term>일간</Term>
        <dd>
          <span className="glyph">{pillars.dayMaster}</span> {STEM_INFO[pillars.dayMaster].ko} ·{' '}
          {ELEMENT_KO[STEM_INFO[pillars.dayMaster].element]}
        </dd>

        {saju.meta.gender && (
          <>
            <Term>성별</Term>
            <dd>
              {GENDER_KO[saju.meta.gender]}
              <span className="text-muted"> · 여덟 글자는 성별로 달라지지 않습니다</span>
            </dd>
          </>
        )}

        <Term>사주년</Term>
        <dd>
          {pillars.meta.sajuYear}년 <span className="text-muted">입춘 기준</span>
          {pillars.meta.sajuYear !== saju.meta.inputTime.year && (
            <span className="text-muted"> · 달력연도와 다릅니다</span>
          )}
        </dd>

        <Term>절기</Term>
        <dd>
          {pillars.meta.monthTerm.name} ~ {pillars.meta.nextTerm.name}
        </dd>

        {pillars.meta.hourKnown ? (
          <>
            <Term>자시 규칙</Term>
            <dd>
              {pillars.meta.lateNightRule === 'jo' ? '조자시' : '야자시'}
              {pillars.meta.lateNightShiftApplied && (
                <span className="text-muted"> · 일주를 다음 날로 넘겼습니다</span>
              )}
            </dd>
          </>
        ) : (
          <>
            <Term>출생 시각</Term>
            <dd>
              미상 <span className="text-muted">· 시주를 뽑지 않았습니다</span>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <td className="pr-2 text-right align-middle text-xs text-muted whitespace-nowrap">
      {children}
    </td>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted">{children}</dt>;
}

function TenGodRow({
  label,
  saju,
  position,
}: {
  label: string;
  saju: Saju;
  position: 'stem' | 'branch';
}) {
  return (
    <tr>
      <RowLabel>{label}</RowLabel>
      {PILLAR_COLUMNS.map(({ key }) => {
        const chart = saju.analysis.tenGods[key];
        // 시주가 없으면 십성도 없다. 일간 자리의 null 과 구분해야 한다.
        if (chart === null) {
          return (
            <td key={key} className="px-2 py-1 text-xs text-muted">
              —
            </td>
          );
        }
        const god = chart[position];
        return (
          <td key={key} className="px-2 py-1 text-xs text-secondary">
            {god ? TEN_GOD_KO[god] : <span className="text-accent">일간</span>}
          </td>
        );
      })}
    </tr>
  );
}

function GlyphCell({
  glyph,
  caption,
  emphasis,
  element,
}: {
  /** `null` 이면 빈 자리 — 시각을 모르는 시주 */
  glyph: string | null;
  caption: string;
  emphasis: boolean;
  element: Element | null;
}) {
  const tone = element === null ? null : ELEMENT_TONE[element];
  return (
    <td className="px-2 py-1">
      <div
        className={`mx-auto flex w-full max-w-24 flex-col items-center gap-1 rounded-xl border py-3 ${
          glyph === null ? 'border-dashed border-border' : `${tone?.border} ${tone?.surface}`
        } ${emphasis ? 'ring-2 ring-foreground/15 ring-offset-2 ring-offset-surface' : ''}`}
      >
        <span
          className={`glyph text-4xl font-semibold leading-none ${glyph === null ? 'text-muted' : tone?.text}`}
        >
          {glyph ?? '?'}
        </span>
        <span className="text-[11px] text-secondary">{caption}</span>
      </div>
    </td>
  );
}

/**
 * 무엇이 세력을 옮겼고 무엇은 안 옮겼는가 — **한 줄로 선다.**
 *
 * 강약·억부·종격·격국·통관이 전부 **옮긴 뒤의 분포**에서 세력을 잰다. 그런데 무엇이
 * 옮겼는지는 유도 문장 여러 줄에 흩어져 있어서, 「왜 이 합은 반영하고 저 합은 안
 * 했나」를 알려면 그 줄을 다 읽고 역추적해야 했다.
 *
 * **옮기는 축은 국(局) 하나다.** 삼합·방합 계열만 무게를 기울인다 — 육합은 두 글자가
 * 묶이는 관계이지 세력을 만드는 축이 아니고, 천간합은 化했을 때만 옮긴다. 그 갈림을
 * 여기서 한 번에 보인다.
 *
 * 몫의 근거도 같은 줄에 적는다. 25% 는 자료에 맞춰 고른 값이 아니라 **완성된 국의
 * 절반**이고, 세 등급의 간격을 2배로 고정한 데서 나온다(`BUREAU_POLICY.pull`) — 등급
 * 사이의 비를 먼저 정하고 자료를 본다는 규율이다.
 */
function WeightShifts({ saju }: { saju: Saju }) {
  const { bureaus, effectiveElements } = saju.analysis;
  const { transformations, shifts } = effectiveElements;

  /*
    **같은 합이 두 줄로 서지 않게 묶는다.**

    한 글자를 둘이 물면 합도 둘로 세어진다(쟁합·투합). 그대로 나열하면 「정임합목 —
    합이불화」가 두 번 서고, 그것은 문장 층에서 방금 고친 것과 **같은 고장**이다.
    이름과 판정이 같은 것은 한 줄로 세우고 자리만 함께 든다.
  */
  const boundStems = [
    ...transformations
      .filter((one) => one.verdict !== 'transformed')
      .reduce((grouped, one) => {
        const key = `${one.ko}:${one.verdict}`;
        const seats = grouped.get(key)?.seats ?? [];
        grouped.set(key, {
          ko: one.ko,
          verdict: one.verdict,
          seats: [...new Set([...seats, ...one.participants.map((at) => at.position)])],
        });
        return grouped;
      }, new Map<string, { ko: string; verdict: StemTransformation['verdict']; seats: PillarPosition[] }>())
      .values(),
  ];
  const sixCombinations = saju.relations.filter(
    (relation) => relation.kind === 'branchSixCombination',
  );

  if (bureaus.length === 0 && boundStems.length === 0 && sixCombinations.length === 0) return null;

  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-sm font-medium">세력에 반영한 합과 안 한 합</h3>

      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {bureaus.map((bureau) => {
          const moved = shifts.filter((shift) => shift.cause === bureau.ko);
          return (
            <li key={`${bureau.kind}-${bureau.element}`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-accent">반영</span>
              <span className="font-medium">{bureau.ko}</span>
              <span className="text-secondary">
                → <span className="glyph">{bureau.element}</span> {ELEMENT_KO[bureau.element]}{' '}
                {percent(bureau.pull)} 만큼 기울임
                {moved.length > 0 && (
                  <span className="text-muted">
                    {' '}
                    ({moved
                      .map((shift) => `${shift.from}→${shift.to} ${shift.amount.toFixed(2)}`)
                      .join(' · ')})
                  </span>
                )}
              </span>
            </li>
          );
        })}

        {boundStems.map((transformation) => (
          <li key={`${transformation.ko}-${transformation.verdict}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">안 함</span>
            <span className="font-medium">{transformation.ko}</span>
            <span className="text-secondary">
              {transformation.seats.map((seat) => PILLAR_POSITION_KO[seat].replace('주', '간')).join('·')}
              {' '}— 천간합은 化했을 때만 옮깁니다({TRANSFORMATION_VERDICT_KO[transformation.verdict]} 자리)
            </span>
          </li>
        ))}

        {sixCombinations.length > 0 && (
          <li className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">안 함</span>
            <span className="font-medium">
              {sixCombinations.map((relation) => relation.ko).join(' · ')}
            </span>
            <span className="text-secondary">
              육합은 두 글자가 묶이는 관계이지 세력을 만드는 국(局)이 아닙니다
            </span>
          </li>
        )}
      </ul>

      <p className="mt-2 text-xs text-muted">
        무게를 기울이는 것은 <strong className="font-medium">국(삼합·방합) 하나</strong>입니다.
        몫은 완성된 국이 절반(50%), 왕지를 낀 두 글자가 그 절반(25%), 왕지가 빠진 붙은 두
        글자가 다시 그 절반(12.5%) — <strong className="font-medium">자료에 맞춰 고른 값이
        아니라</strong> 등급 사이의 비(2배)를 먼저 정하고 나온 이 엔진의 실험값입니다. 월령을
        잡았거나 화신이 투간했으면 깎지 않고, 왕지가 충을 맞으면 절반으로 깎습니다.
        글자를 바꾸지는 않습니다 — 辰이 수국에 들어도 그 안의 土가 0 이 되지는 않습니다.
      </p>
    </div>
  );
}

/**
 * 오행 분포 — 크기 비교가 일이므로 단일 색조 막대.
 * 값을 전부 옆에 적으므로 표 역할도 겸한다(툴팁 불필요).
 */
function ElementChart({ saju }: { saju: Saju }) {
  const { counts, scores, ratios, missing, strongest, glyphCount } = saju.analysis.elements;
  const needed = new Set(saju.analysis.strength.neededElements);
  const max = Math.max(...ELEMENTS.map((e) => ratios[e]), 0.0001);

  return (
    <section className={CARD}>
      <h2 className="text-base font-semibold">오행 분포</h2>
      <p className="mt-1 mb-4 text-xs text-secondary">
        개수는 {glyphCount === 8 ? '여덟' : '여섯'} 글자를 그대로 센 것(괄호 안은 그
        비중), 점수는 지장간을 사령 일수로 펼친 값입니다. 다른 만세력은 대개
        앞쪽 기준으로 %를 냅니다
        {glyphCount !== 8 && <span className="text-muted"> · 시주 제외</span>}
      </p>
      {/*
        **딱지 둘이 범례 없이 서 있었다.**

        「필요」는 억부가 가리키는 **방향**이라 신약이면 비겁·인성 둘 다 붙는다
        (`strength.neededElements`). 아래 억부 칸이 그중 **하나**를 후보로 고른 것이라,
        같은 낱말이 한 화면에서 두 넓이로 쓰인다 — 둘이 어긋난 것이 아닌데 범례가
        없으면 어긋나 보인다. 오신 배정에서 한신인 오행에 「필요」가 붙는 것도 이
        까닭이다.
      */}
      <p className="mb-4 text-xs text-muted">
        <span className="text-muted">최강</span> 은 점수가 가장 높은 오행,{' '}
        <span className="text-accent">필요</span> 는 억부가 가리키는 방향입니다 — 신약이면
        비겁·인성 둘, 신강이면 식상·재성·관성 셋이 함께 붙습니다. 아래 억부 칸은 그중
        하나를 후보로 고른 것입니다.
      </p>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">오행별 개수와 지장간 가중 점수</caption>
        <thead className="text-xs text-muted">
          <tr>
            <th className="pb-1.5 text-left font-normal whitespace-nowrap">오행</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">개수</th>
            <th className="pb-1.5 pl-3 text-right font-normal whitespace-nowrap">점수</th>
            <th className="w-full pb-1.5 pl-3 text-left font-normal whitespace-nowrap">비중</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((element) => (
            <tr key={element}>
              <td className="py-1 whitespace-nowrap">
                <span className={`glyph inline-grid size-7 place-items-center rounded-lg ${ELEMENT_TONE[element].surface} ${ELEMENT_TONE[element].text}`}>{element}</span>{' '}
                <span className="text-secondary">{ELEMENT_KO[element]}</span>
                {element === strongest && <span className="ml-1.5 text-xs text-muted">최강</span>}
                {needed.has(element) && <span className="ml-1.5 text-xs text-accent">필요</span>}
              </td>
              <td
                className={`py-1 pl-3 text-right tabular-nums whitespace-nowrap ${
                  counts[element] === 0 ? 'text-muted' : ''
                }`}
              >
                {/*
                  **「1」과 「13%」가 붙어 「113%」로 읽혔다.** 여백만 두고 구분자가
                  없었는데, 오른쪽 정렬에 `tabular-nums` 라 두 수가 한 수처럼 보인다.
                  괄호가 두 값을 가른다.
                */}
                {counts[element]}
                <span className="ml-1.5 text-xs text-muted">
                  ({Math.round((counts[element] / glyphCount) * 100)}%)
                </span>
              </td>
              <td className="py-1 pl-3 text-right tabular-nums text-secondary">
                {scores[element].toFixed(2)}
              </td>
              <td className="py-1 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 rounded-sm bg-track">
                    <div
                      className={`h-full rounded-full ${ELEMENT_TONE[element].bar}`}
                      style={{ width: `${(ratios[element] / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-secondary">
                    {Math.round(ratios[element] * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <WeightShifts saju={saju} />

      {/*
        **「없다」도 자를 밝힌다.** 이 줄은 개수 기준이라 지장간에만 있는 오행이 여기
        선다 — 바로 위 표에서 그 오행의 점수가 0 이 아닌 것을 함께 보게 된다. 대치 칸이
        같은 자리에서 「8.0%」와 「한 자도 없다」를 동시에 말하던 것과 같은 종류다.
      */}
      {missing.length > 0 && (
        <p className="mt-3 border-t border-border pt-3 text-xs text-secondary">
          여덟 글자에 없는 오행 {missing.map((e) => ELEMENT_KO[e]).join(', ')}
          <span className="text-muted"> (지장간에는 있을 수 있습니다 — 점수 칸을 보세요)</span>
          {glyphCount !== 8 && (
            <span className="text-muted"> · 시주에 있었을지는 알 수 없습니다</span>
          )}
        </p>
      )}
    </section>
  );
}

/** 신강·신약 — 임계값 대비 단일 비율이므로 메터. */
function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength, eokbu, johu, tonggwan, yongsinAgreement, precedence } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;

  return (
    <section className={`${CARD} flex flex-col`}>
      <h2 className="text-base font-semibold">신강 · 신약</h2>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {strength.verdict === 'strong' ? '신강' : '신약'}
        </span>
        <span className="text-sm text-secondary">세 기준 중 {strength.metCount}개 충족</span>
      </p>

      <div className="mt-4">
        <div className="relative h-3 rounded-sm bg-track">
          <div
            className="h-full rounded-r-[4px] bg-accent"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-[-3px] w-px bg-border-strong"
            style={{ left: `${threshold}%` }}
            aria-hidden
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-secondary">
          <span>
            보조 {strength.supportScore.toFixed(2)} · 소모 {strength.opposeScore.toFixed(2)}
          </span>
          <span className="tabular-nums">
            보조세력 {percent.toFixed(1)}%{' '}
            <span className="text-muted">(기준 {threshold}%)</span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        세력비에 태약·중화·태왕 같은 등급 이름은 붙이지 않습니다. 근거 있는 구간
        경계를 아직 확보하지 못했습니다. 아래 세 기준도 서로 겹칩니다 — 득세
        점수에 월지·일지가 이미 들어 있습니다.
      </p>

      <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        {strength.criteria.map((criterion) => (
          <li key={criterion.key} className="flex gap-2">
            <span className={criterion.met ? 'text-accent' : 'text-muted'}>
              {criterion.met ? '○' : '✕'}
            </span>
            <span className="w-8 shrink-0">{criterion.label}</span>
            <span className="text-secondary">{criterion.detail}</span>
          </li>
        ))}
      </ul>

      <RootingNote saju={saju} />

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            참고표
          </span>
          <span className="text-xs text-muted">조후 후보 천간</span>
          <span className="glyph text-lg font-medium">
            {(johu.halfStems ?? johu.stems).join(' · ')}
          </span>
          <span className="text-xs text-secondary">
            {johu.dayMaster}일간 · {johu.monthBranch}월
            {johu.half && (
              <>
                {' · '}
                {johu.half === 'first' ? '상반월' : '하반월'}
                {johu.midTerm && (
                  <span className="text-muted">
                    {' '}
                    ({johu.midTerm.name} {johu.half === 'first' ? '전' : '후'})
                  </span>
                )}
              </>
            )}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-secondary">{johu.note}</p>
        {johu.halfStems && (
          <p className="mt-1 text-xs text-secondary">
            이 칸은 상·하반월로 갈려서 그 절반의 후보만 위에 적었습니다. 전체 후보는{' '}
            <span className="glyph">{johu.stems.join(' · ')}</span> 입니다.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          《궁통보감》 120조합의 조건 요약입니다. 상·하반월만 판정합니다 — 경계가
          중기(절기 +15°)라 천문으로 정해지기 때문입니다. &lsquo;수가 왕하면 戊&rsquo;
          같은 세력 조건은 문턱을 지어내야 해서 판정하지 않으므로, 확정 용신이 아니라
          후보와 조건을 함께 읽어야 합니다.
        </p>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
            시험
          </span>
          <span className="text-xs text-muted">억부 관점의 후보</span>
          <span className="glyph text-lg font-medium">{eokbu.suggestedElement}</span>
          <span className="text-sm font-medium">{ELEMENT_KO[eokbu.suggestedElement]}</span>
          <span className="text-sm text-secondary">{ELEMENT_ROLE_KO[eokbu.role]}</span>
          {!eokbu.presentInChart && (
            <span className="text-xs text-muted">여덟 글자에 없는 오행</span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-secondary">{eokbu.reason}</p>

        {/*
          **두 칸이 서로 무슨 관계인지 말한다.**

          조후와 억부가 여태 나란히 서 있기만 했다. 하나는 「土를 쓰라」 하고 다른
          하나는 「壬·丙을 보라」 하는데, 그 둘이 같은 말인지는 읽는 사람이 오행 표를
          외워 맞춰 봐야 알 수 있었다 — 무작위 3000건에서 **어긋나는 명식이 43.2%** 다.

          **어느 쪽이 급한지는 여기서도 말하지 않는다.** 한랭·조열이 급하면 조후가
          억부를 제친다는 것이 여러 계통의 말이지만, 「얼마나 급해야」를 재는 자리가
          엔진에 없다(`YONGSIN_POLICY.johuAgainstEokbu`).
        */}
        <p className="mt-2 border-t border-border pt-2 text-xs text-secondary">
          <span className="font-medium">
            {yongsinAgreement.aligned ? '두 길이 같은 곳을 가리킵니다.' : '두 길이 다른 곳을 가리킵니다.'}
          </span>{' '}
          {yongsinAgreement.aligned ? (
            <>
              조후가 권한 글자 가운데{' '}
              <span className="glyph">{yongsinAgreement.sharedStems.join(' · ')}</span>
              {subjectParticle(yongsinAgreement.sharedStems[yongsinAgreement.sharedStems.length - 1])}{' '}
              억부와 같은 {ELEMENT_KO[yongsinAgreement.eokbuElement]}입니다.
            </>
          ) : (
            <>
              조후가 권한 <span className="glyph">{yongsinAgreement.johuStems.join(' · ')}</span> 중에는
              억부가 권한 {ELEMENT_KO[yongsinAgreement.eokbuElement]}
              {subjectParticle(ELEMENT_KO[yongsinAgreement.eokbuElement])} 없습니다.
            </>
          )}{' '}
          <span className="text-muted">
            어느 쪽을 먼저 보아야 하는지는 판정하지 않습니다 — 한랭·조열이 얼마나 급한지를
            재는 자리가 아직 없습니다.
          </span>
        </p>

        <p className="mt-2 text-xs text-muted">
          <strong className="font-medium">용신 확정값이 아닙니다.</strong> 억부는 용신을
          잡는 네 길 중 하나일 뿐이고, 아직 판정하지 않은 것이 남아 있습니다 —{' '}
          {eokbu.unresolved.map((factor) => UNRESOLVED_FACTOR_KO[factor]).join(', ')}.
          이 가운데 통근·투출은 <strong className="font-medium">사실만 위에 적어 두었고</strong>,
          그것이 쓸 만한 뿌리인지를 재는 판정만 아직 없습니다. 종격은 위 칸에서{' '}
          <strong className="font-medium">따로 판정하지만 이 후보에는 반영되지 않았습니다</strong> —
          문턱이 고전의 숫자가 아니라 이 엔진의 실험값이라, 억부와 정반대 답이 나오더라도
          뒤집지 않고 나란히 세웁니다. 위 조후표도 조건을 전부 자동 판정하지 않은
          참고값입니다.
          꺼리는 오행(기신)은 판정하지 않습니다 — 명식 전체에서 무엇이 병인지를 봐야
          정해지지 오행 상극표 한 줄로 나오는 것이 아니기 때문입니다. 다만 「이 후보를
          용신 자리에 놓으면 다섯 오행이 어디에 오는가」(희용기구한)는 표 조회라 계통이
          갈리지 않고, 그 배정은 화면에 세우지 않는 대신 AI 풀이 자료에 함께 실립니다.
        </p>
      </div>

      <TonggwanFacts tonggwan={tonggwan} />
      <PrecedenceTable precedence={precedence} />
    </section>
  );
}

/**
 * 판정 사이의 서열 — **어긋날 때 무엇을 보는가.**
 *
 * 이 칸이 없는 동안 화면은 답 넷을 나란히 세우고 아무 말도 안 했다. 「가종 후보」와
 * 「억부 木」을 함께 본 사람이 어느 쪽으로 읽을지는 그때그때 달랐고, 그것은 우리가
 * 정하지 않은 것이 아니라 **정해 놓고 안 알려 준 것**이다.
 *
 * 값은 엔진이 든다(`analysis.precedence`). 화면이 스위치를 다시 적으면 정책만 바뀌고
 * 이 표가 안 따라오는 날이 온다 — 바로 위 칸이 종격 대조 성적으로 그 일을 겪었다.
 */
function PrecedenceTable({ precedence }: { precedence: Saju['analysis']['precedence'] }) {
  const shaken = precedence.rows.filter((row) => row.disagrees === true);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">판정이 어긋날 때</span>
        <span className="text-sm font-medium">
          {JUDGEMENT_KO[precedence.primary]}를 봅니다
        </span>
        {shaken.length > 0 && (
          <span className="text-sm text-secondary">
            지금 어긋나는 것 {shaken.map((row) => row.ko).join(' · ')}
          </span>
        )}
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-xs">
        {precedence.rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className={`w-8 shrink-0 ${row.key === precedence.primary ? 'font-medium' : 'text-secondary'}`}>
              {row.ko}
            </span>
            <span className={row.overrides ? 'text-accent' : 'text-muted'}>
              {row.overrides ? '기준' : '안 뒤집음'}
            </span>
            <span className="text-muted">{PRECEDENCE_REASON_KO[row.reason]}</span>
            {/*
              **「어긋나지 않는다」와 「견줄 수 없다」를 가른다.** 격국은 상신을 오행으로
              내지 않고 통관은 판정이 없다 — 빈 값을 「같다」로 적으면 안 재 본 것이
              잰 것처럼 보인다.
            */}
            <span className="text-secondary">
              {row.disagrees === null
                ? '견줄 수 없음'
                : row.disagrees
                  ? '지금 억부와 어긋남'
                  : ''}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted">
        억부가 기준인 것은 <strong className="font-medium">용신을 잡는 네 길 중 유일하게
        외부 명조와 대조된 판정</strong>이기 때문입니다 — 그것도 시험값입니다. 이 서열은
        AI 풀이 자료에도 같이 실립니다.
      </p>
    </div>
  );
}

/**
 * 통관 재료 — **판정이 아니라 맞선 두 세력의 사실이다.**
 *
 * 억부는 언제나 답을 하나 낸다. 「무엇이 가장 무거운가」로 한쪽을 고르고 그 반대편을
 * 권하는데, **두 세력이 팽팽히 맞선 명식에서는 그 물음이 답을 못 낸다** — 어느 쪽을
 * 눌러도 나머지가 그대로 남는다. 고전이 그 자리에 쓰라고 한 것이 통관이고, 이 칸은
 * 그 자리인지 아닌지를 **읽는 사람이 판단할 재료**를 편다.
 *
 * 다섯 쌍을 다 내지 않고 가장 팽팽한 하나만 세운다. 다섯 줄을 세우면 이 칸이 화면에서
 * 가장 큰 자리를 차지하는데, 판정도 아닌 것이 그럴 자리는 아니다. 나머지 넷은 자료에
 * 그대로 실린다(`analysis.tonggwan`).
 */
function TonggwanFacts({ tonggwan }: { tonggwan: Saju['analysis']['tonggwan'] }) {
  const { tightest } = tonggwan;
  const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">가장 팽팽한 대치</span>
        <span className="glyph text-lg font-medium">
          {tightest.controller} → {tightest.controlled}
        </span>
        <span className="text-sm text-secondary">
          {ELEMENT_KO[tightest.controller]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controller)}</span> ↔{' '}
          {ELEMENT_KO[tightest.controlled]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controlled)}</span>
        </span>
        {/*
          **기준을 칸 안에 적는다.** 위의 오행 분포 표는 여덟 글자를 그대로 센 개수 %
          이고 여기는 지장간까지 편 점수 % 다. 한 페이지에서 같은 오행이 13% 와 15.4%
          로 두 번 나오는데 어느 자로 잰 것인지가 이 칸에는 없었다.
        */}
        <span className="text-xs text-muted">점수 기준(지장간·국 반영)</span>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        사이를 잇는 것은 <span className="glyph">{tightest.bridge}</span>{' '}
        {ELEMENT_KO[tightest.bridge]}입니다({percent(tightest.shares.bridge)}) —{' '}
        {tightest.controller}는 {tightest.bridge}를 낳고 {tightest.bridge}는{' '}
        {tightest.controlled}를 낳습니다.{' '}
        {tightest.bridgePresence === 'revealed'
          ? '이 오행은 여덟 글자에 드러나 있습니다.'
          : tightest.bridgePresence === 'hidden'
            ? '다만 여덟 글자에는 드러나지 않고 지장간에만 있습니다 — 위 몫은 그 지장간까지 편 점수입니다.'
            : '그런데 이 오행이 지장간까지 봐도 한 톨 없습니다 — 이을 손이 없다는 뜻입니다.'}
      </p>

      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">맞선 것인지는 판정하지 않습니다.</strong> 얼마나
        맞서야 대치(相戰)인지, 대치면 억부를 제치는지가 계통마다 갈리기 때문입니다 — 종격이
        먼저 지나온 자리와 같습니다. 가벼운 쪽이{' '}
        <span className="tabular-nums">{percent(tightest.facing)}</span> 인데, 무작위 3000건에서
        이 값이 30% 를 넘는 명식은 10.2% 입니다. 나머지 네 쌍도 자료에는 그대로 실립니다.
      </p>
    </div>
  );
}

/**
 * 통근·투출 — 판정이 아니라 그 재료다.
 *
 * 억부가 "아직 판정하지 않았다"고 적는 것들(종격 여부·투간과 통근의 질)이
 * 모두 이 두 사실 위에서 갈린다. 판정을 못 하더라도 재료는 보여줄 수 있고,
 * 보여주면 왜 판정을 미뤘는지도 눈에 보인다.
 *
 * 뿌리의 강약은 매기지 않는다. 어느 자리의 어느 지장간에 며칠치인지까지가
 * 사실이고, "이 정도면 통근으로 친다"는 선이 계통마다 다르다.
 */
function RootingNote({ saju }: { saju: Saju }) {
  const { dayMaster, emergences } = saju.analysis.rootedness;
  const seat = (position: PillarPosition) => PILLAR_POSITION_KO[position].charAt(0);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">일간 {dayMaster.stem} 의 뿌리</span>
        {dayMaster.rooted ? (
          <>
            <span className="text-sm text-secondary">
              {dayMaster.roots
                .map(
                  (root) =>
                    `${seat(root.position)}지 ${root.branch}의 ${root.stem}` +
                    `(${HIDDEN_STEM_ROLE_KO[root.role]} ${root.days}일)`,
                )
                .join(' · ')}
            </span>
            <span className="text-sm font-medium tabular-nums">합 {dayMaster.totalDays}일</span>
          </>
        ) : (
          <span className="text-sm font-medium">없음 — 지지 어디에도 통근하지 않았습니다</span>
        )}
      </div>

      {emergences.length > 0 && (
        <p className="mt-1.5 text-xs text-secondary">
          투출{' '}
          {emergences
            .map(
              (emergence) =>
                `${seat(emergence.position)}지 ${emergence.branch}의 ${emergence.stem} → ` +
                emergence.revealedAt.map((position) => `${seat(position)}간`).join('·'),
            )
            .join(' / ')}
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        뿌리의 강약은 매기지 않습니다. 음양이 다른 뿌리(甲이 卯의 乙에 두는 것)와
        고지(辰戌丑未)의 중기도 거르지 않고 그대로 셉니다 — 어디까지 통근으로 볼지가
        계통마다 갈리기 때문입니다. 합충으로 뿌리가 상했는지도 보지 않습니다.
      </p>

      <FollowingCandidacyNote saju={saju} />
    </div>
  );
}

/**
 * 종격 후보의 조건 — 판정이 아니라 재료다.
 *
 * "종격 여부를 아직 판정하지 않는다"고만 적어 두면 무엇이 막혔는지 알 수 없다.
 * 어느 계통이든 종을 말하려면 먼저 보는 넷을 그대로 보여주고, 여기에 어디서
 * 선을 긋느냐가 계통 선택이라는 것까지 적는다.
 */
function FollowingCandidacyNote({ saju }: { saju: Saju }) {
  const { followingCandidacy: candidacy, following } = saju.analysis;
  const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
  /** 문턱과 대조 성적은 **재는 자리가 들고 있는 값**을 그대로 읽는다 — 아래 주석 참조 */
  const { dominance } = FOLLOWING_PATTERN_POLICY;
  const { externalCheck } = dominance;
  const share = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          시험
        </span>
        <span className="text-xs text-muted">종격</span>
        <span className="text-lg font-medium">
          {FOLLOWING_PATTERN_STATUS_KO[following.verdict]}
        </span>
        <span className="text-sm text-secondary">
          자당(비겁·인성) 몫{' '}
          <span className="tabular-nums">{percent(following.selfShare)}</span>
          <span className="text-muted">
            {' '}
            (밖으로 종 ≤{share(dominance.outwardMaxSelfShare)} · 안으로 종 ≥
            {share(dominance.inwardMinSelfShare)})
          </span>
          {following.direction && (
            <span className="ml-1.5">{FOLLOWING_DIRECTION_KO[following.direction]}</span>
          )}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">
          사실
        </span>
        <span className="text-xs text-muted">판정의 재료</span>
        <span className="text-sm">
          일간 {candidacy.dayMasterRootless ? '무근' : '유근'}
          <span className="mx-1.5 text-muted">·</span>
          가장 무거운 세력 {ELEMENT_ROLE_KO[candidacy.dominant.role]}{' '}
          <span className="tabular-nums">{percent(candidacy.dominant.ratio)}</span>
          <span className="mx-1.5 text-muted">·</span>
          월령 {candidacy.monthCommandsDominant ? '그 세력이 잡음' : '다른 세력'}
          <span className="mx-1.5 text-muted">·</span>
          투간한 생부{' '}
          {candidacy.supportStems.length === 0 ? (
            '없음'
          ) : (
            <span className="glyph">
              {candidacy.supportStems.map((support) => support.stem).join(' ')}
            </span>
          )}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted">
        <strong className="font-medium">문턱은 고전이 정한 숫자가 아닙니다.</strong> 무작위
        3000건의 세력 분포를 재고 정한 이 엔진의 실험값입니다. 종에는 방향이 둘이라
        축 하나의 양끝으로 잽니다 — 일간을 도울 것이 없으면 <strong className="font-medium">밖으로</strong>
        (종재·종살), 일간 편이 극왕하면 <strong className="font-medium">안으로</strong> 따릅니다.{' '}
        {/*
          **수치를 손으로 적지 않는다.** 여기 「14건 중 4건」이 적혀 있었다 — 규칙이 v2 로
          가고 대조 자료가 늘어나는 동안 화면만 v1 의 숫자에 남아 있었다. 재는 자리가
          값으로 들고 있는 것을(`externalCheck`) 화면이 다시 적으면, 엔진이 나아질 때마다
          화면은 조용히 틀린 말을 하게 된다.
        */}
        외부 자료에서 종격이라고 밝힌 명조 {externalCheck.claimedFollowing}건과 대조해{' '}
        <strong className="font-medium">{externalCheck.caught}건을 잡았습니다</strong> — 여전히
        덜 잡는 쪽으로 틀리고, 아니라고 적힌 쪽에서도 {externalCheck.falsePositives}건을
        종격으로 봅니다. 그래서 이 판정은 억부 후보를 뒤집지 않습니다. 진종·가종 어느
        쪽으로도 밀기 어려운 명식은 &lsquo;종격 후보&rsquo;로 남겨 둡니다.
      </p>
    </div>
  );
}

function TimeCorrections({ saju }: { saju: Saju }) {
  const { meta, pillars } = saju;
  const civil = pillars.meta.civilTime;

  // 요청한 값이 아니라 실제로 적용된 보정에서 읽는다.
  const applied = new Set(meta.corrections.map((correction) => correction.kind));
  const basis = applied.has('equationOfTime')
    ? 'trueSolar'
    : applied.has('longitude')
      ? 'localMean'
      : 'record';

  return (
    <section id="corrections" className={`${CARD} scroll-mt-20`}>
      <h2 className="text-base font-semibold">
        적용된 보정
        <span className="ml-2 text-secondary normal-case">{TIME_BASIS[basis].label}</span>
      </h2>

      {meta.inputTime.hour === null ? (
        <p className="mt-2 mb-3 text-sm text-secondary">
          출생 시각을 몰라 정오를 기준으로 계산했습니다. 아래는 그 시각에 적용된 보정
          기록일 뿐입니다 — 시주는 뽑지 않았고, 연·월주는 절대 시각으로 판정하며,
          일주는 정오라 이 보정으로는 넘어가지 않습니다.
        </p>
      ) : (
        <p className="mt-2 mb-3 text-sm">
          <span className="tabular-nums">
            {pad(meta.inputTime.hour)}:{pad(meta.inputTime.minute)}
          </span>
          <span className="mx-2 text-muted">→</span>
          <span className="tabular-nums font-medium">
            {pad(civil.hour)}:{pad(civil.minute)}
          </span>
          <span className="ml-2 text-secondary">
            총 {signedMinutes(meta.totalCorrectionMinutes)}
          </span>
        </p>
      )}

      <table className="w-full border-collapse text-sm">
        <tbody>
          {meta.corrections.map((correction) => (
            <tr key={correction.kind} className="border-t border-border">
              <td className="py-1.5 pr-3 whitespace-nowrap">{correction.label}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap">
                {correction.minutes === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  signedMinutes(correction.minutes)
                )}
              </td>
              <td className="py-1.5 text-secondary">{correction.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Warnings({ saju }: { saju: Saju }) {
  if (saju.meta.warnings.length === 0) return null;

  return (
    <section className={`${CARD} bg-surface-sunken`}>
      <h2 className="text-base font-semibold">경계 주의</h2>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-secondary">
        {saju.meta.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
