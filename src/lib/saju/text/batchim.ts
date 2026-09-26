/**
 * 낱말의 마지막 음절에 받침이 있는가 — 조사(`과`/`와` · `은`/`는`)를 값을 아는 쪽이 고를 때 쓴다.
 *
 * 같은 세 줄이 조립기(`assemble.ts` 의 `joinNames`)와 프롬프트(`reading/prompt.ts` 의 `particleOf`)에
 * 따로 적혀 있었다(2026-09-26). 한글 음절(가~힣) 밖의 글자로 끝나면 받침이 없다고 본다 — 한자는 읽는
 * 소리로 바꾼 뒤에 묻는다.
 */
export const endsWithBatchim = (word: string): boolean => {
  const last = word.charCodeAt(word.length - 1) - 0xac00;

  return last >= 0 && last <= 11171 && last % 28 !== 0;
};
