'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading';

import {
  SETTINGS_PRIMARY,
  SETTINGS_QUIET,
  SETTINGS_ROW,
  SettingsCard,
  SettingsRow,
} from '../settings/card';
import {
  hideCandidate,
  refreshDiscoveryBoard,
  requestMatch,
  savePreferGender,
  setDiscoveryParticipation,
  unhideAllCandidates,
} from './actions';
import { PREFER_GENDER_KO, PREFER_GENDER_ORDER, type PreferGender } from './profile';

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
    <SettingsCard title="어떤 상대를 만나볼까요?">
      {/*
        **셋을 한 번에 보인다.** 접힌 고르는 칸이었는데, 고를 것이 셋뿐이고 그중 하나가
        기본값이라 **열어 보지 않으면 무엇을 고를 수 있는지 모르는** 자리였다.

        **한 덩이 토글로 세운다.** 앱의 다른 두 갈래 고르기와 같은 모양이다
        (`compat-picker.tsx` 의 「저장한 사람 / 직접 입력」) — 떨어진 동그라미 셋보다
        「이 중 하나」가 눈에 먼저 온다. 라디오는 그대로 있고(`sr-only`) 화살표로도
        고를 수 있다.

        **묻는 것의 이름을 적는다**(「성별」). 제목이 「어떤 상대를」이라고만 말하므로,
        고르는 값이 무엇에 대한 것인지는 줄이 들어야 한다 — 나이·거리 칸이 생기는 날
        이 이름이 그 자리를 가른다.
      */}
      <fieldset className={SETTINGS_ROW}>
        <legend className="contents">
          <span className="text-sm font-semibold sm:flex-1">성별</span>
        </legend>
        {/*
          **칸 셋이 같은 폭이다.** 글자 길이대로 두면 「상관없음」이 「남성」의 두 배가
          되어, 고를 것이 셋인데 하나가 더 중요한 것처럼 보인다. 격자로 나누면 가장 긴
          글자가 폭을 정하고 나머지가 그것을 따른다.
        */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-sunken p-1 sm:shrink-0">
          {PREFER_GENDER_ORDER.map((value) => (
            <label
              key={value}
              className="flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-medium text-secondary transition-colors hover:text-foreground has-checked:bg-surface has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent"
            >
              <input
                type="radio"
                name="prefer-gender"
                className="sr-only"
                checked={preferGender === value}
                onChange={() => setPreferGender(value)}
              />
              <span>{PREFER_GENDER_KO[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 마지막 줄이 이 카드의 꼬리다 — 왼쪽은 지켜 주는 약속, 오른쪽은 시작하는 누름 */}
      <SettingsRow note="내 출생 정보는 다른 사람에게 공개되지 않아요.">
        {saved && !changed && <span className="text-xs text-muted">저장했습니다</span>}
        <button type="button" onClick={save} disabled={saving || !changed} className={SETTINGS_PRIMARY}>
          {saving ? '저장하는 중…' : '저장'}
        </button>
      </SettingsRow>

      {failure !== null && (
        <p role="alert" className="border-t border-border pt-4 text-sm text-danger">
          저장하지 못했습니다 — {failure}
        </p>
      )}
    </SettingsCard>
  );
}

/**
 * 매칭 참여를 켜고 끄는 자리 — **이제 여기가 켜는 자리가 아니다.**
 *
 * 참여는 기본으로 켜져 있고(PRD §4.1), 무엇이 나가는지는 가입 관문이 읽힌다
 * (`notice-v4`). 여기 남은 일은 **끄는 것과, 껐던 것을 되돌리는 것** 둘이다.
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
      <SettingsCard title="인연 찾기">
        {/*
          **제목은 기능의 이름이고, 상태는 줄이 든다.** 「인연 찾기 참여 중」·「인연 찾기
          쉬는 중」으로 제목이 갈려 있었다. 같은 칸이 상태마다 다른 이름을 쓰니 설정을
          찾아온 사람이 **두 개의 다른 칸**으로 읽는다.
        */}
        <SettingsRow
          help="현재 다른 사람에게 내 프로필이 소개되고 있어요."
          note="내 프로필과 오행 요약이 인연을 찾는 다른 사람에게 보여요."
        >
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={working}
            className={SETTINGS_QUIET}
          >
            {working ? '끄는 중…' : '인연 찾기 쉬기'}
          </button>
        </SettingsRow>
        {failure !== null && (
          <p role="alert" className="border-t border-border pt-4 text-sm text-danger">
            {failure}
          </p>
        )}
      </SettingsCard>
    );
  }

  /*
    **쉬는 중인 사람에게만 서는 자리다.** 「아직 안 켠 사람」이 없어졌으므로 여기 설 수
    있는 것은 직접 끈 사람뿐이고, 그래서 문장이 권유가 아니라 **지금 상태의 설명**이다.
  */
  return (
    <SettingsCard title="인연 찾기">
      <SettingsRow
        help="지금은 다른 사람에게 내 프로필이 소개되지 않고 있어요."
        note="다시 시작하면 내 프로필과 오행 요약이 인연을 찾는 다른 사람에게 보여요."
      >
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={working}
          className={SETTINGS_PRIMARY}
        >
          {working ? '켜는 중…' : '인연 찾기 다시 시작'}
        </button>
      </SettingsRow>
      {failure !== null && (
        <p role="alert" className="border-t border-border pt-4 text-sm text-danger">
          {failure}
        </p>
      )}
    </SettingsCard>
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
    /*
      **남은 시간은 버튼 옆이 아니라 아래다.** 옆에 두면 그 줄이 화면 폭에 따라 접히면서
      버튼과 시간이 갈라섰다(빈 목록 카드에서 그게 제일 크게 보였다). 세로로 쌓으면 폭이
      좁아져도 차례가 그대로다.
    */
    <span className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={refresh}
        disabled={working || left > 0}
        className="h-10 rounded-lg border border-border px-3.5 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
      >
        {working ? '새로 고치는 중…' : '목록 새로 고치기'}
      </button>
      {left > 0 && (
        <span className="text-xs leading-5 text-muted">
          {left >= 60 ? `${Math.ceil(left / 60)}분` : `${left}초`} 후 다시 시도할 수 있어요.
        </span>
      )}
      {failure !== null && <span className="text-xs leading-5 text-muted">{failure}</span>}
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
 * 요청은 바로 보내지 않는다. 버튼을 누르면 풀이권의 임시 차감과 현재 제공 범위를
 * 확인하는 팝업이 먼저 열린다.
 */
export function PreviewScorePanel({
  candidateUserId,
  nickname,
  previewScore,
}: {
  candidateUserId: string;
  /** 확인 창이 **누구에게** 보내는지를 말해야 한다 — 카드가 부르는 그 이름으로 */
  nickname: string;
  previewScore: number;
}) {
  const router = useRouter();
  const confirming = useRef<HTMLDialogElement>(null);
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
          이 카드의 주된 누름이므로 모서리의 「다시 보지 않기」보다 강하게 보인다.

          **「상세 궁합 보기」가 아니다.** 이 누름이 여는 것은 요청이고, 상대가 수락할
          때까지 볼 것은 생기지 않는다 — 확인 창의 제목도 버튼도 줄곧 「요청」이라고
          말하고 있었는데 정작 들어오는 문에만 「보기」가 적혀 있었다.
        */}
        <button
          type="button"
          onClick={() => confirming.current?.showModal()}
          className="mt-0.5 h-9 w-full rounded-lg bg-accent px-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
        >
          상세 궁합 요청하기
        </button>
        {failure !== null && <p className="text-xs text-muted">{failure}</p>}
      </div>

      <dialog
        ref={confirming}
        aria-labelledby={`request-match-${candidateUserId}`}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/40"
      >
        <h3 id={`request-match-${candidateUserId}`} className="text-base font-bold">
          {nickname} 님에게 상세 궁합을 요청할까요?
        </h3>
        <p className="mt-2 text-sm leading-6 text-secondary">{REQUEST_RESERVES_NOTE}</p>
        <p className="mt-3 text-sm leading-6 text-secondary">{MATCH_PILLARS_DISCLOSURE}</p>
        <p className="mt-3 rounded-xl bg-surface-sunken p-3 text-sm leading-6 text-secondary">
          현재는 두 사람이 궁합풀이를 함께 보는 기능까지만 제공됩니다. 채팅이나 연락처
          교환 등 상대와 연락할 수 있는 기능은 아직 지원하지 않습니다.
        </p>
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
