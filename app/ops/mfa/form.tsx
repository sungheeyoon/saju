'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { CARD } from '../../ui/surfaces';
import { confirmTotpCode, startTotpEnrollment } from './actions';
import { SECOND_FACTOR_COPY as COPY } from './copy';

const FIELD =
  'min-h-12 w-40 rounded-2xl border border-border-strong bg-surface px-4 font-mono text-[18px] tracking-[0.3em] outline-none focus:border-foreground focus:ring-2 focus:ring-accent-soft';

/**
 * 두 번째 요소 — **등록**(QR · 설정 키 → 코드)과 **확인**(코드만) 두 갈래다(ADR 0123).
 *
 * 등록은 누를 때 연다. 화면을 그릴 때 열면 미리 받기 · 새로고침마다 확인 전 요소가 생긴다. QR 은 Auth 가 내준
 * SVG 의 `data:` 주소라 최적화기를 안 지난다(`unoptimized`, CSP 의 `img-src` 가 `data:` 를 연다).
 */
export function SecondFactorForm({ enrolled, next }: { enrolled: boolean; next: string }) {
  const [enrollment, setEnrollment] = useState<{ qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [starting, startStarting] = useTransition();
  const [confirming, startConfirming] = useTransition();

  const start = () => {
    setFailure(null);
    startStarting(async () => {
      const opened = await startTotpEnrollment();
      if (opened.ok) setEnrollment({ qrCode: opened.qrCode, secret: opened.secret });
      else setFailure(opened.message);
    });
  };

  const confirm = () => {
    setFailure(null);
    startConfirming(async () => {
      /* 성공하면 이 줄 아래로 안 온다 — 액션이 돌아갈 운영 화면으로 보낸다 */
      const failed = await confirmTotpCode({ code, next });
      setFailure(failed.message);
    });
  };

  const asking = enrolled || enrollment !== null;

  return (
    <section className={`${CARD} flex flex-col gap-5`}>
      {!asking && (
        <>
          <p className="text-sm text-secondary">{COPY.enrollNote}</p>
          <div>
            <button type="button" onClick={start} disabled={starting} className={BUTTON_SECONDARY}>
              {starting ? COPY.enrollStarting : COPY.enrollStart}
            </button>
          </div>
        </>
      )}

      {enrollment !== null && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-secondary">{COPY.scanNote}</p>
          <Image
            src={enrollment.qrCode}
            alt={COPY.qrAlt}
            width={176}
            height={176}
            unoptimized
            className="rounded-xl bg-white p-2"
          />
          <dl className="flex flex-col gap-1">
            <dt className="text-xs font-semibold text-muted">{COPY.secretLabel}</dt>
            <dd className="break-all font-mono text-sm">{enrollment.secret}</dd>
          </dl>
        </div>
      )}

      {asking && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          {enrolled && <p className="text-sm text-secondary">{COPY.challengeNote}</p>}
          <label htmlFor="second-factor-code" className="text-[15px] font-semibold">
            {COPY.codeLabel}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="second-factor-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className={FIELD}
            />
            <button type="submit" disabled={confirming || code.length !== 6} className={BUTTON_PRIMARY}>
              {confirming ? COPY.confirming : COPY.confirm}
            </button>
          </div>
        </form>
      )}

      {failure !== null && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </section>
  );
}
