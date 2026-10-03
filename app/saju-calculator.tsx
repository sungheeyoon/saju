'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { BirthFields } from './birth-form';
import { CopyLinkButton } from './copy-link';
import { calculateChart } from '@/src/lib/input/chart';
import { useHashParams, writeParams } from './hash-query';
import { SavePersonForReading } from './save-for-reading';
import { useSessionKnown, useSignedIn } from './signed-in';
import { BUTTON_SEAL, Seal } from './ui/danja';
import { SajuView, sajuViewModelOf, type SajuViewModel } from './saju/view';
import { Taste } from './taste';
import {
  DEFAULT_QUERY,
  missingAnswer,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from '@/src/lib/input/query';
import { CARD, PAPER_BOTTOM } from './ui/surfaces';

/** 로그인 전 결과를 서버가 쓰는 데 무엇이 가는가 — 운영자가 정한 문구 그대로(ADR 0143 의 6, 문구 대장) */
const TASTE_PRIVACY_NOTE =
  '입력한 생년월일시는 우리 서버에서 사주를 계산하는 데만 쓰고 저장하지 않아요. 풀이를 쓰는 OpenAI에는 정확한 생년월일시와 출생지 대신 계산된 사주와 분석값만 보내요.';

/**
 * 계산기 — **엔진이 순수 함수라 명식은 서버 없이 브라우저에서 그대로 돈다.**
 *
 * 제출한 입력만 계산하므로, 타이핑 도중의 반쪽 날짜로 계산하지 않는다.
 *
 * ## 이 파일이 클라이언트인 까닭
 *
 * 폼 상태와 주소창(`#` 뒤)을 든다. 결과를 그리는 스물넷은 훅이 없어 `app/saju/` 에
 * 순수 컴포넌트로 살고, 저장한 사람 화면에서는 **서버에서 그려진다** — 브라우저로 가는
 * 것은 운 탭 하나뿐이다(`app/saju/fortune-tabs.tsx`).
 *
 * 여기서는 그 스물넷이 결국 번들에 실린다. `#` 뒤는 페이지 요청으로는 서버에 오지 않으므로(ADR 0007)
 * 명식 계산도 조립도 브라우저에서 한다 — 그것이 이 화면이 치르는 값이다.
 *
 * **로그인하지 않은 사람의 입력만은 서버로 간다**(ADR 0143) — 결과의 첫머리인 로그인 전 사주 문단을 서버가 쓰므로, 그
 * 문단(`taste.tsx`)이 서버 액션으로 입력을 보낸다. 서버는 그것으로 명식을 다시 계산할 뿐 저장하지 않는다. 회원의 입력은
 * 안 간다 — 세션을 알기 전에는 그 문단을 안 세우고(`useSessionKnown`), 서버도 로그인한 요청이면 닫는다.
 *
 * ## 누구의 사주를 넣고 있나
 *
 * 세션은 문을 여는 값이 아니라 **화면이 누구를 부를지**를 정한다. 로그인하지
 * 않은 사람이 `/` 에서 넣는 것은 대개 자기 것이다 — 현관이 그렇게 묻는다. 회원이
 * 여기 넣는 것은 대개 **남의 것**이다: 자기 사주는 이미 저장돼 있고 「내 사주」가 열며,
 * 이 화면은 홈의 「다른 사람 사주 보기」로 따로 걸어와야 닿는다(`home-hero.tsx`).
 *
 * **그래도 버튼은 갈리지 않는다.** 한동안 갈렸다 — 회원에게 「사주 보기」, 그 밖에는
 * 「내 사주 먼저 살펴보기」. 사람 지칭을 버튼에서 걷으면 남는 것은 이 누름이 하는 일
 * 하나이고, 그것은 양쪽이 같다: **적은 것을 제출하고 결과를 본다.** 이름을 버튼에서
 * 뺀 자리는 바로 위 폼이 이미 들고 있다.
 *
 * 무엇을 보는지도 한 낱말로 적는다. 「이 사람 명식 보기」였던 시절에는 누구인지(「이
 * 사람」)와 무엇인지(「명식」)를 한 버튼에 다 욱여넣었는데, 화면이 내내 부르는 말은
 * 「명식」이 아니라 **「사주」**다. 두 사람 쪽도 같은 규칙을 쓴다(`compat-picker.tsx`
 * 의 「궁합 보기」).
 */
export function SajuCalculator({ outline }: { outline: readonly string[] }) {
  const signedIn = useSignedIn();
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

  /**
   * **눌러 본 적이 있는가** — 빠진 칸을 말할 시점을 정하는 값.
   *
   * 버튼을 잠가 두었다. 그러면 왜 안 눌리는지 묻게 되고, 옆에 답을 적어 두어도 그것은
   * **아직 아무것도 안 한 사람에게 하는 말**이라 회색으로 늘 서 있었다. 잠긴 버튼은
   * 키보드 포커스도 안 받아서, 화면을 못 보는 사람에게는 이유가 있는 자리 자체가 없다.
   *
   * 그래서 누르게 두고 **누른 뒤에** 말한다. 그때의 문장은 안내가 아니라 실제로 일어난
   * 거절이므로 경고 색으로 선다 — 「경고는 되돌릴 수 없는 누름 직전에 선다」와 같은
   * 규율의 다른 쪽 면이다(ADR 0028). 채워지면 스스로 사라진다.
   */
  const [tried, setTried] = useState(false);

  // 주소가 밖에서 바뀌면(뒤로가기·앞으로가기·링크로 들어옴) 폼도 그 값으로 되돌린다.
  // 화면은 주소가 가리키는 사주를 보여주는데 폼만 옛 입력을 들고 있으면,
  // '입력이 바뀌었습니다' 가 사용자가 바꾼 적 없는데도 떠 있게 된다.
  const shown = useRef(searchParams.toString());
  useEffect(() => {
    const current = searchParams.toString();
    if (current === shown.current) return;
    shown.current = current;
    setForm(queryFromSearchParams(searchParams) ?? DEFAULT_QUERY);
  }, [searchParams]);

  const result = useMemo(() => (query === null ? null : calculateChart(query)), [query]);

  /**
   * **타이핑마다 다시 세지 않는다.**
   *
   * 이 화면은 폼 상태를 들고 있어 글자 하나마다 결과 트리를 다시 그린다. 그 안에서
   * `assembleText` 가 매번 도는 것은 눈에 보이는 느려짐이라 여기서 한 번만 세어
   * 넘긴다. 세는 법은 서버 화면과 **같은 함수**다(`sajuViewModelOf`).
   */
  const model = useMemo(
    () => (result?.ok ? sajuViewModelOf(result.saju, viewedAt) : null),
    [result, viewedAt],
  );
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
          /*
            **거절은 여기서 한 번만 한다.** 버튼의 잠금이 아니라 제출이 막으므로,
            엔터로 보내든 버튼을 누르든 같은 답을 받는다.
          */
          if (missing !== null) {
            setTried(true);
            return;
          }
          setTried(false);
          submit(form);
        }}
        // 로그인 전에는 첫 화면 종이의 아래 토막이다 — 머리(`home-hero.tsx`)와 한 장으로 선다(ADR 0132)
        className={signedIn ? `${CARD} flex flex-col gap-5` : `${PAPER_BOTTOM} flex flex-col gap-3`}
      >
        <BirthFields value={form} onChange={setForm} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            aria-describedby={tried && missing !== null ? 'natal-missing' : undefined}
            className={`${BUTTON_SEAL} w-full ${signedIn ? 'sm:w-auto' : 'mt-1'}`}
          >
            {/*
              **로그인 전에는 무엇이 무료인지 버튼이 말한다**(흐름 시안 g, ADR 0131) — 사주 · 오행 · 로그인 전 사주 문단은 로그인 없이
              바로 선다. 회원이 여기 넣는 것은 대개 남의 사주라 「내」를 안 붙인다(위 머리말).
            */}
            {query !== null ? '수정하고 다시 보기' : signedIn ? '사주 보기' : '무료로 내 사주 보기'}
            <Seal glyph="命" />
          </button>

          {/*
            **링크 복사는 제출 버튼 옆이다.**

            결과 맨 위에 따로 한 줄로 서 있었다. 그런데 이 버튼이 복사하는 것은 **지금 폼이
            내놓은 주소**라, 그 주소를 만드는 버튼 옆이 그것이 사는 자리다. 결과 위에 두면
            무엇의 링크인지 한 번 더 생각하게 된다.

            **저장한 사람 화면에서는 함께 사라진다.** 거기서도 결과 화면 부품을 그대로 쓰는데
            (`SajuResult`), 그 주소(`/me/people/…`)에는 출생 정보가 안 실린다 — 버튼 옆
            문장이 거기서는 참이 아니었고, 남에게 보내도 열리지 않는 링크였다.
          */}
          {query !== null && <CopyLinkButton />}

          {/* 눌렀는데 못 간 이유를 버튼 옆에서 말한다 — 누르기 전에는 이 자리가 비어 있다 */}
          {tried && missing !== null && (
            <p
              id="natal-missing"
              role="alert"
              className="border-l-2 border-danger py-0.5 pl-3 font-myeongjo text-[14.5px] font-bold text-danger"
            >
              {missing}
            </p>
          )}
        </div>

        {/*
          **무엇이 어디로 가는지 누르기 전에 말한다**(ADR 0143 의 6, 운영자가 정한 문구) — 로그인하지 않은 사람에게는 결과의
          첫머리를 서버가 쓴다. 회원이 여기 넣는 사주는 서버로 안 가므로(브라우저가 계산하고, 로그인 전 사주 문단은 회원에게
          안 서며 서버도 회원의 요청을 닫는다) 이 줄이 참이 아니다.
        */}
        {!signedIn && <p className="text-xs leading-5 text-secondary">{TASTE_PRIVACY_NOTE}</p>}

        {/*
          **사주와 사주풀이를 가르던 한 줄은 걷었다.** 「로그인 없이 사주와 오행을 확인할 수 있어요. 자세한 사주풀이는
          로그인 후 받을 수 있어요.」가 폼 아래 서 있었다. 이제 로그인하지 않은 사람에게는 결과의 첫머리(로그인 전 사주 문단)가 잠긴
          목차와 로그인 단추로 그 일을 한다(`taste.tsx`) — 입력 전에 같은 말을 한 번 더 할 까닭이 없다.
        */}
        {dirty && (
          <p className="text-sm text-secondary">
            입력이 바뀌었어요. &lsquo;수정하고 다시 보기&rsquo;를 누르면 결과에 반영돼요.
          </p>
        )}
      </form>

      {/*
        **입력 전에는 아무것도 안 세운다.** 한동안 「생년월일시를 입력해 주세요」라는
        빈 칸이 서 있었는데, 바로 위의 폼이 이미 같은 말을 하고 있다 — 폼을 보고 있는
        사람에게 폼을 채우라고 한 번 더 말하는 자리였다. 예시 사주를 안 채우는 규율은
        그대로다(`query.ts`).
      */}
      {result === null ? null : result.ok ? (
        <>
          {/*
            **AI 로 가는 길은 저장 하나다.** 이 화면은 대상을 안 만들므로 시도도 잠금도
            풀이권도 걸 자리가 없다(ADR 0013·0030). 저장하면 그 사람의 화면으로 가고,
            거기가 저장한 사람의 풀이가 사는 자리다.

            공개 계산기만 afterChart 슬롯에 입구를 넘긴다. 저장한 사람의 화면에는
            이 입구가 나오지 않는다.

            **맨 아래에 같은 입구를 한 번 더 세우지 않는다.** 입구가 사주 위에 서 있던
            동안에는 결과 끝에 「↑」 링크가 하나 더 있었다. 입구가 사주 바로 아래로
            내려온 지금 그 링크는 4천 픽셀 위로 되돌려 보내는 화살표다 — 가까운 곳을
            가리키는 얼굴로 먼 곳을 가리킨다.

            `query` 를 넘긴다. 폼(`form`)은 사용자가 지금 고치고 있는 값이라, 그것을
            저장하면 화면에 서 있는 사주와 다른 사람이 목록에 남는다.
          */}
          <CalculatorResult model={model!} query={query} signedIn={signedIn} outline={outline} />
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
 * 계산이 선 뒤의 결과 — **로그인하지 않은 사람에게는 로그인 전 결과가 먼저 선다**(흐름 시안 g, ADR 0131).
 *
 * 내 사주 카드 · 짧은 로그인 전 사주 문단 · 잠긴 목차가 서고, 만세력은 지우지 않고 「사주 자세히 보기」에 접힌다. 회원은 전과 같다:
 * 표가 펴져 서고 사주 아래에 저장 입구가 선다(돌아온 사람의 「이 사주가 내 사주 맞나요?」도 그 자리다).
 */
function CalculatorResult({
  model,
  query,
  signedIn,
  outline,
}: {
  model: SajuViewModel;
  query: Query | null;
  signedIn: boolean;
  outline: readonly string[];
}) {
  const sessionKnown = useSessionKnown();
  if (signedIn || query === null) {
    return <SajuView {...model} afterChart={query !== null ? <SavePersonForReading query={query} /> : null} />;
  }
  /*
    **세션을 알기 전에는 로그인 전 결과를 안 세운다.** 그 결과는 서서 곧바로 입력을 서버로 보낸다(`taste.tsx`) — 모르는
    동안 세우면 회원의 입력이 로그인 전 사주 문단의 예약과 모델 호출로 한 번 간다. 그동안 이 자리는 빈다(폼은 그대로 서 있다).
  */
  if (!sessionKnown) return null;
  return (
    <Taste
      query={query}
      saju={model.saju}
      outline={outline}
      detail={<SajuView {...model} />}
    />
  );
}
