
// 일부러 어긴 줄 — 타입 오류 하나와 Metro 만 잡는 require 하나. CI 의 mobile 차선이 붉은 것을 본 뒤 걷는다.
export const deliberateTypeError: number = 'not a number';
export const deliberateBundleError = () => require('./no-such-file');
