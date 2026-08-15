import { SajuCalculator } from './saju-calculator';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">만세력</h1>
        <p className="max-w-2xl text-sm text-secondary">
          생년월일시로 사주 8자를 도출합니다. 표준자오선 이력과 서머타임은 실제 기록대로
          자동 보정하고, 시간 기준(출생기록 시각·지방평균태양시·진태양시)만 골라 쓰도록
          했습니다. 적용한 규칙과 경계 케이스를 함께 표시합니다.
        </p>
      </header>

      <SajuCalculator />

      <footer className="mt-2 text-xs text-muted">
        절기는 천문 계산(태양 황경), 표준시 이력은 IANA tz 데이터에서 생성했습니다. 계산은
        전부 브라우저에서 실행됩니다.
      </footer>
    </main>
  );
}
