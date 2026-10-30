import { describe, expect, it } from 'vitest';

import { bodyPartsOf } from './links';

const links = (body: string) => bodyPartsOf(body).filter((part) => part.kind === 'link').map((part) => part.text);

describe('bodyPartsOf', () => {
  it('주소 없는 말은 글 한 조각이다', () => {
    expect(bodyPartsOf('안녕하세요\n반가워요')).toEqual([{ kind: 'text', text: '안녕하세요\n반가워요' }]);
    expect(bodyPartsOf('')).toEqual([]);
  });

  it('http · https 주소만 링크이고 앞뒤 글은 그대로 남는다', () => {
    expect(bodyPartsOf('여기 봐요 https://example.com/a?b=1 어때요')).toEqual([
      { kind: 'text', text: '여기 봐요 ' },
      { kind: 'link', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { kind: 'text', text: ' 어때요' },
    ]);
    expect(links('HTTP://EXAMPLE.com 과 http://a.kr')).toEqual(['HTTP://EXAMPLE.com', 'http://a.kr']);
  });

  it('다른 체계는 링크가 아니다', () => {
    for (const body of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://a.kr', 'www.example.com', 'mailto:a@b.kr']) {
      expect(bodyPartsOf(body)).toEqual([{ kind: 'text', text: body }]);
    }
    expect(links('javascript:alert("https://a.kr")')).toEqual(['https://a.kr']);
  });

  it('주소 뒤에 붙은 한글 · 문장부호는 글로 남는다', () => {
    expect(links('https://a.kr에서 봤어요')).toEqual(['https://a.kr']);
    expect(links('보세요: https://a.kr/x.')).toEqual(['https://a.kr/x']);
    expect(links('(https://a.kr/x)')).toEqual(['https://a.kr/x']);
    expect(links('https://ko.wikipedia.org/wiki/A_(B)')).toEqual(['https://ko.wikipedia.org/wiki/A_(B)']);
    expect(links('"https://a.kr", 그리고')).toEqual(['https://a.kr']);
  });

  it('호스트가 없는 주소는 링크가 아니다', () => {
    expect(links('https:// 띄어 씀')).toEqual([]);
    expect(links('http://')).toEqual([]);
  });

  it('조각을 이으면 본문 그대로다', () => {
    const body = 'a https://a.kr/x). b http://b.kr, c';
    expect(bodyPartsOf(body).map((part) => part.text).join('')).toBe(body);
  });
});
