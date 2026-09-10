'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { DISCOVERY_DISCLOSURE } from '@/src/lib/discovery';
import { REQUEST_INTRO } from '@/src/lib/consent';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading';

import { FIELD, SelectShell } from '../../birth-form';
import { CARD } from '../../card';
import { MatchScope } from '../requests/manage';
import {
  hideCandidate,
  refreshDiscoveryBoard,
  requestMatch,
  savePreferGender,
  setDiscoveryParticipation,
  unhideAllCandidates,
} from './actions';
import { PREFER_GENDERS, PREFER_GENDER_KO, type PreferGender } from './profile';

const BUTTON =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * 보고 싶은 상대 — **이 화면에 남은 유일한 칸.**
 *
 * 별명과 소개는 계정으로 옮겨 갔다(§5.2). 그 둘이 여기 있었을 때는 「인연 찾기에
 * 참여해야 이름이 생기는」 상태였고, 참여하지 않는 사람은 이름 없는 사람이었다.
 *
 * 나이·거리 칸이 없는 이유는 **화면이 말하지 않는다.** 한동안 「나이 조건은 두지
 * 않았습니다…」를 세 줄로 적어 두었는데, 칸이 하나뿐인 폼에서 그것은 **없는 기능을
 * 변호하는 문단**이다. 나이를 못 쓰는 이유는 ADR 0005 가 든다 — 실제로 그 칸이 생기는
 * 날 설명도 칸과 함께 선다.
 */
export function PreferenceForm({ current }: { current: PreferGender }) {
  const router = useRouter();
  const [preferGender, setPreferGender] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const changed = preferGender !== current;

  const save = () => {
    setFailure(null);
    setSaved(false);
    startSaving(async () => {
      const result = await savePreferGender(preferGender);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">보고 싶은 상대</h2>
        <p className="text-sm text-secondary">
          사주와 무관한 조건입니다. 저장한 출생 정보나 가족·친구에게 붙인 이름은 공개되지
          않습니다.
        </p>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="sr-only">보고 싶은 상대</span>
        {/* 고르는 칸은 앱에 하나다 — 껍데기를 안 씌우면 이 자리만 브라우저 기본 화살표로 선다 */}
        <SelectShell className="w-40">
          <select
            value={preferGender}
            onChange={(event) => setPreferGender(event.target.value as PreferGender)}
            className={`${FIELD} w-full appearance-none pr-8`}
          >
            {PREFER_GENDERS.map((value) => (
              <option key={value} value={value}>
                {PREFER_GENDER_KO[value]}
              </option>
            ))}
          </select>
        </SelectShell>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !changed} className={BUTTON}>
          {saving ? '저장하는 중…' : '조건 저장'}
        </button>
        {saved && !changed && <span className="text-xs text-muted">저장했습니다</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
    </section>
  );
}

/**
 * 무엇이 나가고 무엇이 안 나가는가 — **화면이 문장을 짓지 않는다.**
 *
 * 정책이 값으로 들고(`DISCOVERY_DISCLOSURE`), ADR 0003 과 `prd-archive` 가 같은 문장을 든다.
 * 세 곳에 따로 적으면 한 곳만 고쳐지고, 그때 사용자가 읽은 약속과 실제 동작이 갈린다.
 *
 * 켜기 전과 켠 뒤가 **같은 목록을 본다.** 켠 뒤에는 이 열거가 문단으로 한 벌 더 적혀
 * 있었다 — 한 칸에 두 벌이면 갈리고, 갈리면 어느 쪽이 약속인지 알 수 없다.
 */
function Disclosure() {
  return (
    <dl className="flex flex-col gap-3 rounded-md border border-border bg-surface-sunken p-3 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-muted">상대에게 보이는 것</dt>
        {DISCOVERY_DISCLOSURE.shown.map((line) => (
          <dd key={line}>{line}</dd>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-muted">보이지 않는 것</dt>
        {DISCOVERY_DISCLOSURE.hidden.map((line) => (
          <dd key={line}>{line}</dd>
        ))}
      </div>
    </dl>
  );
}

/**
 * 매칭 참여를 켜고 끄는 자리 — **이제 여기가 켜는 자리가 아니다.**
 *
 * 참여는 기본으로 켜져 있고(PRD §4.1), 무엇이 나가는지는 가입 관문이 읽힌다
 * (`notice-v3`). 여기 남은 일은 **끄는 것과, 껐던 것을 되돌리는 것** 둘이다.
 *
 * 그래도 목록은 양쪽에 그대로 선다. 끄기 직전에도 무엇을 거두는지 보여야 하고, 되돌리기
 * 직전에도 무엇이 다시 나가는지 보여야 한다 — 두 누름 다 남에게 보이는 범위를 바꾼다.
 */
export function ParticipationToggle({ resting }: { resting: boolean }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const toggle = (on: boolean) => {
    setFailure(null);
    startWorking(async () => {
      const result = await setDiscoveryParticipation(on);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  if (!resting) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className="text-base font-semibold">인연 찾기 참여 중</h2>
        {/*
          열거를 **목록에 맡긴다.** 여기 「상대에게 보이는 것은 별명·소개와… 생년월일시·
          출생지·전체 명식·전체 오행 개수표는 보이지 않습니다」가 손으로 적혀
          있었다. 아래 목록이 같은 것을 항목으로 다시 펴므로 한 칸에 두 벌이었고, 두 벌은
          갈린다. 문단은 「어디에 서는가」만 말하고 무엇이 나가는지는 정책이 든다.
        */}
        <p className="text-sm text-secondary">
          내 사주를 저장하시면 인연 찾기에 자동으로 참여합니다. 다른 참여자의 인연 목록에
          표시될 수 있고, 상대에게 공개되는 정보와 공개되지 않는 정보는 아래와 같습니다.
        </p>
        <Disclosure />
        <p className="text-sm text-secondary">
          언제든 끌 수 있습니다. 끄면 내 프로필과 오행 요약이 다른 참여자에게 더 이상
          공개되지 않습니다. 내 사주와 저장한 사람, 이미 주고받은 요청과 함께 보기로 한 궁합은
          그대로 남습니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={working}
            className="h-11 rounded-lg border border-border px-4 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10"
          >
            {working ? '끄는 중…' : '인연 찾기 쉬기'}
          </button>
        </div>
        {failure !== null && <p className="text-sm text-muted">{failure}</p>}
      </section>
    );
  }

  /*
    **쉬는 중인 사람에게만 서는 자리다.** 「아직 안 켠 사람」이 없어졌으므로 여기 설 수
    있는 것은 직접 끈 사람뿐이고, 그래서 문장이 권유가 아니라 **지금 상태의 설명**이다.
  */
  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <h2 className="text-base font-semibold">인연 찾기 쉬는 중</h2>
      <p className="text-sm text-secondary">
        지금은 다른 참여자의 인연 목록에 서지 않습니다. 다시 시작하시면 내 사주를 기준으로
        표시되고, 내가 대신 등록한 가족·친구는 그때도 공개되지 않습니다.
      </p>

      <Disclosure />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => toggle(true)} disabled={working} className={BUTTON}>
          {working ? '켜는 중…' : '인연 찾기 다시 시작'}
        </button>
      </div>
      {failure !== null && <p className="text-sm text-muted">{failure}</p>}
    </section>
  );
}

/**
 * 목록을 새로 받는다 — **얼마나 기다려야 하는지는 DB 가 말한다**(ADR 0037).
 *
 * `waitSeconds` 는 DB 가 센 값이다(`my_discovery_snapshot`). 여기서 5분을 다시 세지 않는
 * 것은 그 수가 두 곳에 적히면 갈리기 때문이고, 남은 초를 시각에서 직접 빼지 않는 것은
 * **브라우저 시계가 서버와 다를 수 있어서**다 — 그러면 눌리는 시점이 사람마다 달라진다.
 * 받은 수만큼만 세어 내려간다.
 *
 * 눌리지 않는 이유를 버튼 자리에서 말한다. 아무 말 없이 흐린 버튼은 고장으로 읽힌다.
 */
export function RefreshBoard({ waitSeconds }: { waitSeconds: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(waitSeconds);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  useEffect(() => {
    if (left <= 0) return;
    const tick = setInterval(() => setLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(tick);
  }, [left]);

  const refresh = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await refreshDiscoveryBoard();
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={working || left > 0}
        className="h-9 rounded-lg border border-border px-3 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
      >
        {working ? '받는 중…' : '목록 새로 받기'}
      </button>
      {left > 0 && (
        <span className="text-xs text-muted">
          {left >= 60 ? `${Math.ceil(left / 60)}분` : `${left}초`} 뒤에 다시 받을 수 있습니다
        </span>
      )}
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </span>
  );
}

/**
 * 이 사람은 그만 본다 — 되돌릴 수 있으므로 한 번 더 묻지 않는다.
 *
 * **카드 아래에서 점수 위로 옮겼다.** 아래에 있을 때는 「상세 궁합 요청하기」와 같은
 * 줄에 같은 크기로 서서, 되돌릴 수 있는 정리 하나가 이 카드의 유일한 목적과 나란히
 * 놓였다. 무게가 다른 두 누름은 같은 줄에 세우지 않는다.
 */
export function HideButton({ candidateUserId }: { candidateUserId: string }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const hide = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await hideCandidate(candidateUserId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={hide}
        disabled={working}
        className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-secondary disabled:opacity-60"
      >
        {working ? '감추는 중…' : '다시 보지 않기'}
      </button>
      {failure !== null && <span className="text-xs text-muted">{failure}</span>}
    </span>
  );
}

/**
 * 감춘 사람 되돌리기 — **누구인지는 적지 않는다.**
 *
 * 감춘 뒤에는 그 사람의 프로필을 읽을 이유가 없어서 별명을 붙들고 있지 않다. 그래서
 * 화면은 몇 명인지까지만 말한다.
 */
export function UnhideAll({ count }: { count: number }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  if (count === 0) return null;

  const unhide = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await unhideAllCandidates();
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span>다시 보지 않기로 한 사람 {count}명. 누구인지는 여기 적지 않습니다.</span>
      <button
        type="button"
        onClick={unhide}
        disabled={working}
        className="text-accent underline underline-offset-2 disabled:opacity-60"
      >
        {working ? '되돌리는 중…' : '모두 되돌리기'}
      </button>
      {failure !== null && <span>{failure}</span>}
    </p>
  );
}

/**
 * 예측 점수와 상세 궁합 요청 — **한 장이다.**
 *
 * ## 왜 점수까지 여기서 그리나
 *
 * 점수는 화면(`board.tsx`)에 있었고 버튼만 여기 있었다. 둘을 한 테두리 안에 넣기로
 * 하면서 합쳤다 — 나눠 두면 「같은 한 장으로 보이게」가 두 파일의 클래스 문자열이
 * 맞아떨어질 때만 참인 약속이 된다.
 *
 * 더 큰 이유는 **펴질 때 모양이 갈리기 때문이다.** 접히면 점수 아래 버튼 하나가 좁은
 * 칸에 서고, 펴지면 동의 안내가 카드 폭을 다 써야 한다(10rem 안에서는 못 읽는다).
 * 그 두 모양을 아는 것은 접혔는지 펴졌는지 아는 이 컴포넌트뿐이라, 격자에 두 조각으로
 * 내놓는 일도 여기서 한다.
 *
 * ## 보내기 전에 무엇이 열리는지 읽힌다
 *
 * 바로 보내지 않는다. 후보 카드만 본 것은 궁합 동의가 아니고(`prd-archive`), 무엇이 열리는지
 * 모른 채 누른 요청은 상대에게도 설명할 수 없는 요청이다. 수락 화면과 **같은 목록**을
 * 읽는다 — 두 곳에 따로 적으면 보내는 쪽과 받는 쪽이 다른 약속을 읽게 된다.
 */
export function PreviewScorePanel({
  candidateUserId,
  previewScore,
}: {
  candidateUserId: string;
  previewScore: number;
}) {
  const router = useRouter();
  const confirming = useRef<HTMLDialogElement>(null);
  const [reading, setReading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const send = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await requestMatch(candidateUserId);
      if (result.ok) router.refresh();
      else setFailure(result.message);
    });
  };

  return (
    <>
      {/*
        **색은 이 한 장만 든다.** 전에는 추천 이유와 점수를 한 덩이의 물감 위에 같이
        올렸는데, 그러면 물감이 무엇을 묶는 것인지 읽히지 않는다 — 카드 안의 모든 글이
        배경을 갖는 셈이라 강조가 아니라 얼룩이 된다.

        **왼쪽 글만큼 늘어난다.** 격자 칸이라 높이를 따로 안 적어도 옆 칸을 따라가고,
        안의 것은 가운데에 머문다.
      */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent-wash px-3 py-3 text-center">
        <p className="text-xs font-semibold text-accent">예측 궁합 점수</p>
        <p className="text-2xl font-bold leading-none tabular-nums text-accent">
          {previewScore}
          <span className="ml-0.5 text-sm font-semibold">점</span>
        </p>

        {/*
          **이 카드가 있는 이유가 이 누름이다.** 밑줄 친 글자로 서 있었는데, 그러면
          모서리의 「다시 보지 않기」와 같은 무게로 읽힌다 — 앱의 다른 화면에서 이만한
          누름은 전부 채운 버튼을 입는다(조건 저장, 인연 찾기 다시 시작).

          펴진 뒤에는 이 자리에서 사라진다. 같은 일을 시키는 버튼이 한 카드에 둘 서면
          어느 것이 지금 누를 것인지 알 수 없다 — 아래 안내가 「요청 보내기」를 든다.
        */}
        {!reading && (
          <button
            type="button"
            onClick={() => setReading(true)}
            className="mt-0.5 h-9 w-full rounded-lg bg-accent px-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
          >
            상세 궁합 보기
          </button>
        )}
      </div>

      {/*
        **펴지면 카드 폭을 다 쓴다.** 격자의 두 칸에 걸치게 두는 것은, 이 안내가 무엇이
        열리고 무엇이 안 열리는지를 항목으로 펴기 때문이다 — 10rem 안에서는 못 읽고,
        못 읽는 동의는 동의가 아니다.
      */}
      {reading && (
        <div className="col-span-full flex w-full flex-col gap-3">
          <MatchScope intro={REQUEST_INTRO} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => confirming.current?.showModal()}
              disabled={working}
              className={BUTTON}
            >
              {working ? '보내는 중…' : '요청 보내기'}
            </button>
            <button
              type="button"
              onClick={() => setReading(false)}
              disabled={working}
              className="text-sm text-secondary underline underline-offset-2"
            >
              그만두기
            </button>
          </div>
          {failure !== null && <p className="text-sm text-muted">{failure}</p>}
        </div>
      )}

      <dialog
        ref={confirming}
        aria-labelledby={`request-match-${candidateUserId}`}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
      >
        <h3 id={`request-match-${candidateUserId}`} className="text-base font-bold">
          풀이권 1회를 예약할까요?
        </h3>
        <p className="mt-2 text-sm leading-6 text-secondary">{REQUEST_RESERVES_NOTE}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => {
              confirming.current?.close();
              send();
            }}
            disabled={working}
            className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong sm:h-10"
          >
            요청 보내기
          </button>
          <button
            type="button"
            onClick={() => confirming.current?.close()}
            disabled={working}
            className="h-11 rounded-xl border border-border px-5 text-sm text-secondary hover:border-border-strong hover:text-foreground sm:h-10"
          >
            취소
          </button>
        </div>
      </dialog>
    </>
  );
}
