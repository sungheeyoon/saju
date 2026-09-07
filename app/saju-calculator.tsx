'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { BirthFields } from './birth-form';
import { CARD } from './card';
import { CopyLinkButton } from './copy-link';
import { calculateChart } from '@/src/lib/input/chart';
import { useHashParams, writeParams } from './hash-query';
import { SavePersonForReading } from './save-for-reading';
import { SajuView, sajuViewModelOf } from './saju/view';
import {
  DEFAULT_QUERY,
  missingAnswer,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from '@/src/lib/input/query';

/**
 * 익명 계산기 — **엔진이 순수 함수라 서버 없이 브라우저에서 그대로 돈다.**
 *
 * 제출한 입력만 계산하므로, 타이핑 도중의 반쪽 날짜로 계산하지 않는다.
 *
 * ## 이 파일이 클라이언트인 까닭
 *
 * 폼 상태와 주소창(`#` 뒤)을 든다. 결과를 그리는 스물넷은 훅이 없어 `app/saju/` 에
 * 순수 컴포넌트로 살고, 저장한 사람 화면에서는 **서버에서 그려진다** — 브라우저로 가는
 * 것은 운 탭 하나뿐이다(`app/saju/fortune-tabs.tsx`).
 *
 * 여기서는 그 스물넷이 결국 번들에 실린다. `#` 뒤는 서버에 오지 않으므로(ADR 0007)
 * 계산도 조립도 브라우저에서 할 수밖에 없다 — 그것이 이 화면이 치르는 값이다.
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
        className={`${CARD} flex flex-col gap-4`}
      >
        <BirthFields value={form} onChange={setForm} idPrefix="natal" />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            aria-describedby={tried && missing !== null ? 'natal-missing' : undefined}
            className="h-11 w-full rounded-md bg-accent-strong px-5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 sm:h-10 sm:w-auto"
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
            <p id="natal-missing" role="alert" className="text-sm font-medium text-danger">
              {missing}
            </p>
          )}
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
          <SajuView {...model!} />
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
