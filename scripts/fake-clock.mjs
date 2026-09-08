/**
 * **시계를 앞당긴다 — 훑기 전용.**
 *
 * `/closed` 는 종료일이 지난 뒤에만 서는 화면이라, 찍으려면 그날이 지나 있어야 한다.
 * 일정 줄의 날짜를 옛날로 옮겨 끝낼 수도 있지만 그러면 화면이 **약속하지 않은 날짜**를
 * 찍는다 — `/privacy` 와 `/signup` 이 「10월 31일 종료 · 11월 30일 파기」라고 적는데
 * 「끝났습니다」 화면만 딴 날을 들면, 훑는 사람이 문구가 아니라 씨앗을 읽게 된다.
 *
 * 그래서 **날짜는 그대로 두고 시계를 옮긴다.** `UI_FAKE_NOW` 가 있을 때만 돈다.
 *
 *     NODE_OPTIONS='--import ./scripts/fake-clock.mjs' UI_FAKE_NOW='2026-11-01T09:00:00+09:00'
 */
const at = process.env.UI_FAKE_NOW;

if (at) {
  const Real = Date;
  const offset = new Real(at).getTime() - Real.now();
  if (Number.isNaN(offset)) throw new Error(`UI_FAKE_NOW 를 못 읽었습니다 — ${at}`);

  /* 흐르는 시계를 옮긴다. 멈춰 세우면 타임아웃과 폴링이 영영 안 끝난다 */
  class Shifted extends Real {
    constructor(...args) {
      if (args.length === 0) super(Real.now() + offset);
      else super(...args);
    }
    static now() {
      return Real.now() + offset;
    }
  }

  /*
    **상속만으로는 모자란다.** `proxy.ts` 는 Next 의 샌드박스 안에서 도는데, 그 안으로
    건너가는 것은 **직접 가진 속성뿐**이라 물려받은 `Date.parse`·`Date.UTC` 가 사라진다
    — 첫 요청이 `Date.parse is not a function` 으로 500 이 됐다. 손으로 옮겨 심는다.
  */
  for (const key of Object.getOwnPropertyNames(Real)) {
    if (Object.hasOwn(Shifted, key)) continue;
    Object.defineProperty(Shifted, key, Object.getOwnPropertyDescriptor(Real, key));
  }

  globalThis.Date = Shifted;
}
