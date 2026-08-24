'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { CARD } from '../../card';
import {
  hideCandidate,
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
        <h2 className="text-base font-semibold">공개용 프로필</h2>
        <p className="text-sm text-secondary">
          후보 목록에 설 때 보이는 것입니다. 저장된 출생정보나 가족·친구에게 붙인 이름은
          여기에 쓰이지 않습니다.
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
          placeholder="후보 목록에 설 이름"
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
        나이·거리 칸이 없는 이유를 적어 둔다. 없는 것을 그냥 비워 두면 「빠뜨렸나」로
        읽히고, 나이는 실제로 못 쓰는 값이다(ADR 0005).
      */}
      <p className="text-xs text-muted">
        나이 조건은 두지 않았습니다. 저장된 생년월일은 사주 입력이지 신원 정보가 아니라
        연령 자격의 근거로 쓸 수 없습니다. 거리 조건도 없습니다 — 출생지는 사는 곳이
        아닙니다.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={missing !== null || saving || !changed} className={BUTTON}>
          {saving ? '저장하는 중…' : '프로필 저장'}
        </button>
        {missing !== null && <span className="text-xs text-muted">{missing}</span>}
        {saved && !changed && <span className="text-xs text-muted">저장했습니다.</span>}
      </div>

      {failure !== null && <p className="text-sm text-muted">저장하지 못했습니다 — {failure}</p>}
    </section>
  );
}

/**
 * 매칭 참여를 켜고 끄는 자리 — **켜기 전에 무엇이 나가는지 적는다.**
 *
 * 후보 카드만 본 것은 궁합 동의가 아니고(PRD), 참여를 켜는 것도 명식 공개가 아니다.
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
        <h2 className="text-base font-semibold">매칭 참여 중</h2>
        <p className="text-sm text-secondary">
          다른 참여자의 후보 목록에 설 수 있습니다. 언제든 끌 수 있고, 끄면 매칭 풀에
          내놓은 오행 요약도 거둡니다. 내 사주와 저장한 사람들은 그대로 남습니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={working}
            className="h-11 rounded-lg border border-border px-4 text-sm text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60 sm:h-10"
          >
            {working ? '끄는 중…' : '매칭 참여 끄기'}
          </button>
        </div>
        {failure !== null && <p className="text-sm text-muted">{failure}</p>}
      </section>
    );
  }

  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <h2 className="text-base font-semibold">매칭 참여</h2>
      <p className="text-sm text-secondary">
        켜면 내 <strong className="font-medium">selfPerson</strong> 이 다른 참여자의 후보
        목록에 설 수 있습니다. 내가 대신 등록한 가족·친구는 후보가 되지 않습니다.
      </p>

      <dl className="flex flex-col gap-2 rounded-md border border-border bg-surface-sunken p-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">상대에게 보이는 것</dt>
          <dd>공개용 별명과 소개, 그리고 왜 그 자리에 섰는지 한 줄.</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">순서를 정하는 데 쓰이는 것</dt>
          <dd>
            저장된 사주에서 뽑은 <strong className="font-medium">오행 요약</strong>(다섯
            오행의 개수와 비중). 참여를 켜는 순간 매칭 풀에 올라가고, 상대의 순서도 같은
            방식으로 정해집니다.
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">보이지 않는 것</dt>
          <dd>생년월일시·출생지·전체 명식, 그리고 내가 저장한 사람들과 그 메모.</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={working || needsNickname}
          className={BUTTON}
        >
          {working ? '켜는 중…' : '매칭 참여 켜기'}
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
