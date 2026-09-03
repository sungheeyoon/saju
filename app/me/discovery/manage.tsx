'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { DISCOVERY_DISCLOSURE } from '@/src/lib/discovery';
import { REQUEST_INTRO } from '@/src/lib/consent';

import { CARD } from '../../card';
import { MatchScope } from '../requests/manage';
import {
  hideCandidate,
  requestMatch,
  saveDiscoveryProfile,
  setDiscoveryParticipation,
  unhideAllCandidates,
} from './actions';
import {
  INTRO_MAX,
  NICKNAME_MAX,
  PREFER_GENDERS,
  PREFER_GENDER_KO,
  missingInProfile,
  type DiscoveryProfileInput,
  type PreferGender,
} from './profile';

const FIELD =
  'h-11 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash sm:h-10';

const BUTTON =
  'h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * 공개용 프로필 — **Person 입력도 부를 이름도 아니다.**
 *
 * 「엄마」는 내가 그 사람을 부르는 말이고, 후보 카드에 서는 것은 내가 고른 별명이다
 * (US 28). 두 값을 한 칸으로 합치면 남의 목록에 내 가족 호칭이 선다.
 */
export function ProfileForm({ current }: { current: DiscoveryProfileInput }) {
  const router = useRouter();
  const [profile, setProfile] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const missing = missingInProfile(profile);
  const changed =
    profile.nickname.trim() !== current.nickname.trim() ||
    profile.intro.trim() !== current.intro.trim() ||
    profile.preferGender !== current.preferGender;

  const save = () => {
    setFailure(null);
    setSaved(false);
    startSaving(async () => {
      const result = await saveDiscoveryProfile(profile);
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
        <h2 className="text-base font-semibold">인연 찾기 프로필</h2>
        <p className="text-sm text-secondary">
          다른 사람의 인연 목록에 표시되는 정보입니다. 저장한 출생 정보나 가족·친구에게
          붙인 이름은 공개되지 않습니다.
        </p>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-secondary">별명</span>
        <input
          type="text"
          value={profile.nickname}
          onChange={(event) =>
            setProfile({ ...profile, nickname: event.target.value.slice(0, NICKNAME_MAX) })
          }
          maxLength={NICKNAME_MAX}
          placeholder="인연 목록에 보일 이름"
          className={`${FIELD} w-40`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-secondary">소개 (선택)</span>
        <textarea
          value={profile.intro}
          onChange={(event) => setProfile({ ...profile, intro: event.target.value.slice(0, INTRO_MAX) })}
          maxLength={INTRO_MAX}
          rows={3}
          placeholder="사주와 무관한 소개입니다"
          className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-secondary">보고 싶은 상대</span>
        <select
          value={profile.preferGender}
          onChange={(event) =>
            setProfile({ ...profile, preferGender: event.target.value as PreferGender })
          }
          className={`${FIELD} w-40`}
        >
          {PREFER_GENDERS.map((value) => (
            <option key={value} value={value}>
              {PREFER_GENDER_KO[value]}
            </option>
          ))}
        </select>
      </label>

      {/*
        나이·거리 칸이 없는 이유는 **화면이 말하지 않는다.**

        한동안 「나이 조건은 두지 않았습니다…」를 세 줄로 적어 두었다. 없는 것을 비워
        두면 「빠뜨렸나」로 읽힐까 봐였는데, 칸이 셋뿐인 폼에서는 그렇게 읽히지 않고
        **없는 기능을 변호하는 문단**이 폼 한가운데에 서서 오히려 덜 만든 화면으로
        보이게 했다. 나이를 못 쓰는 이유는 ADR 0005 가 든다 — 실제로 나이·거리 칸이
        생기는 날 그 설명은 칸과 함께 선다.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={missing !== null || saving || !changed} className={BUTTON}>
          {saving ? '저장하는 중…' : '프로필 저장'}
        </button>
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
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
 * 매칭 참여를 켜고 끄는 자리 — **켜기 전에 무엇이 나가는지 적는다.**
 *
 * 후보 카드만 본 것은 궁합 동의가 아니고(`prd-archive`), 참여를 켜는 것도 명식 공개가 아니다.
 * 무엇이 나가고 무엇이 안 나가는지를 버튼 위에 적는다.
 */
export function ParticipationToggle({
  optedIn,
  needsNickname,
}: {
  optedIn: boolean;
  /** 별명이 없으면 아직 켤 수 없다 — 후보 카드에 설 이름이 없으면 설 자리가 없다 */
  needsNickname: boolean;
}) {
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

  if (optedIn) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className="text-base font-semibold">인연 찾기 참여 중</h2>
        {/*
          열거를 **목록에 맡긴다.** 여기 「상대에게 보이는 것은 별명·소개와… 생년월일시·
          출생지·전체 명식·전체 오행 개수표·숫자 점수는 보이지 않습니다」가 손으로 적혀
          있었다. 아래 목록이 같은 것을 항목으로 다시 펴므로 한 칸에 두 벌이었고, 두 벌은
          갈린다. 문단은 「어디에 서는가」만 말하고 무엇이 나가는지는 정책이 든다.
        */}
        <p className="text-sm text-secondary">
          다른 참여자의 인연 목록에 표시될 수 있습니다. 상대에게 공개되는 정보와 공개되지
          않는 정보는 아래와 같습니다.
        </p>
        <Disclosure />
        <p className="text-sm text-secondary">
          언제든 끌 수 있고, 끄면 매칭 풀에 내놓은 오행 요약도 거둡니다. 내 사주와 저장한
          사람들은 그대로 남습니다. 이미 주고받은 요청과 함께 보기로 한 궁합도 그대로입니다 —
          참여를 끄는 것은 새로 보이지 않겠다는 뜻이지 지난 일을 지우는 것이 아닙니다.
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

  return (
    <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className="text-base font-semibold">인연 찾기 참여</h2>
      <p className="text-sm text-secondary">
        참여하면 내 사주를 기준으로 다른 참여자의 인연 목록에 표시될 수 있습니다.
        내가 대신 등록한 가족·친구는 공개되지 않습니다.
      </p>

      <Disclosure />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={working || needsNickname}
          className={BUTTON}
        >
          {working ? '켜는 중…' : '인연 찾기 시작'}
        </button>
        {/* 왜 눌리지 않는지 버튼 옆에서 말한다 */}
        {needsNickname && (
          <span className="text-xs text-muted">공개용 별명을 먼저 저장해 주세요.</span>
        )}
      </div>
      {failure !== null && <p className="text-sm text-muted">{failure}</p>}
    </section>
  );
}

/** 이 사람은 그만 본다 — 되돌릴 수 있으므로 한 번 더 묻지 않는다 */
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
        className="text-sm text-secondary underline underline-offset-2 disabled:opacity-60"
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
 * 상세 궁합 요청 — **보내기 전에 무엇이 열리는지 읽힌다.**
 *
 * 바로 보내지 않는다. 후보 카드만 본 것은 궁합 동의가 아니고(`prd-archive`), 무엇이 열리는지
 * 모른 채 누른 요청은 상대에게도 설명할 수 없는 요청이다. 수락 화면과 **같은 목록**을
 * 읽는다 — 두 곳에 따로 적으면 보내는 쪽과 받는 쪽이 다른 약속을 읽게 된다.
 */
export function RequestButton({ candidateUserId }: { candidateUserId: string }) {
  const router = useRouter();
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

  if (!reading) {
    return (
      <button
        type="button"
        onClick={() => setReading(true)}
        className="text-sm text-accent underline underline-offset-2"
      >
        상세 궁합 요청하기
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <MatchScope intro={REQUEST_INTRO} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={send} disabled={working} className={BUTTON}>
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
  );
}
