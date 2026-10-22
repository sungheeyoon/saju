/**
 * 저장소에 사는 사진의 **두 벌** — 작은 자리(아바타 · 편집 칸 · 궤도 지도)의 `card` 와 큰 자리(인연 카드 · 상대 시트)의
 * `large`(G-120). 저장소를 켰을 때만 쓴다 — 꺼져 있으면 사진은 지금처럼 긴 변 512px 한 벌이 DB 에 산다(`PHOTO_MAX_EDGE`).
 *
 * 변의 길이는 우리 화면이 실제로 그리는 크기에서 왔다 — 셈과 출처는 `docs/product/gaps/records/g-120.md`. 상한은 두 벌을
 * 한 번에 보내는 서버 액션의 본문 한도(1MB)에 들게 잡았다. **이 수는 브라우저와 서버가 함께 본다** — 브라우저가 굽고, 서버가
 * 머리를 읽어 다시 잰다. 서버는 브라우저를 믿지 않는다(액션은 주소만 알면 부를 수 있다).
 */

export type PhotoVariant = 'card' | 'large';

export type VariantSpec = {
  /** 긴 변의 상한(px) — 작은 사진은 키우지 않는다 */
  readonly edge: number;
  /** 한 벌의 바이트 상한 */
  readonly maxBytes: number;
};

export const PHOTO_VARIANTS: Readonly<Record<PhotoVariant, VariantSpec>> = {
  card: { edge: 480, maxBytes: 160 * 1024 },
  large: { edge: 1440, maxBytes: 720 * 1024 },
};

/** 이 둘이 받는 형식 — DB 의 `check_photo_content_type` 과 같은 목록 */
export type StoredPhotoType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ImageHead = { readonly type: StoredPhotoType; readonly width: number; readonly height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** JPEG 의 프레임 머리(SOF0..SOF15, DHT · JPG · DAC 를 뺀다)에서 크기를 읽는다 */
function jpegHead(b: Uint8Array): ImageHead | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { type: 'image/jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) };
    i += 2 + length;
  }
  return null;
}

function webpHead(b: Uint8Array): ImageHead | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return { type: 'image/webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { type: 'image/webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  return null;
}

/**
 * 바이트의 **머리만** 읽어 형식과 크기를 낸다 — 모르는 형식 · 깨진 머리면 `null`.
 *
 * 그림을 풀지 않는다. 올린 사람이 적은 형식(`Content-Type`)이 아니라 바이트가 말하는 형식을 본다 — 형식을 속인 파일이
 * 저장소에 `image/webp` 로 서면 브라우저가 그것을 무엇으로 읽을지 우리가 모른다.
 */
export function imageHeadOf(bytes: Uint8Array): ImageHead | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return jpegHead(bytes);
  if (bytes.length >= 24 && u32be(bytes, 0) === 0x89504e47 && ascii(bytes, 12, 4) === 'IHDR') {
    return { type: 'image/png', width: u32be(bytes, 16), height: u32be(bytes, 20) };
  }
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webpHead(bytes);
  return null;
}

/** 두 벌 가운데 하나가 맞지 않는다 — 사용자에게 서는 한 줄. 화면이 굽은 것이 틀린 것이라 다시 고르게 한다 */
export const VARIANTS_REFUSED = '사진을 올리지 못했어요. 다른 사진을 골라 주세요.';

/** 두 벌의 형식이 받는 목록 밖이다 — 바이트 길과 같은 말 */
export const VARIANT_TYPE_REFUSED = 'JPG · PNG · WebP 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.';

export type CheckedVariants =
  | { readonly ok: true; readonly type: StoredPhotoType; readonly card: ImageHead; readonly large: ImageHead }
  | { readonly ok: false; readonly message: string; readonly reason: string };

/**
 * 두 벌을 잰다 — 형식이 같고, 변 · 바이트가 상한 안이고, `card` 가 `large` 를 줄인 크기인가.
 *
 * 줄인 크기가 아니면 두 벌이 서로 다른 사진일 수 있다 — 작은 자리와 큰 자리에 다른 얼굴이 선다. 바이트가 같은 그림인지는
 * 못 잰다(그림을 풀지 않는다). `reason` 은 기록에만 쓰는 이름이다.
 */
export function checkVariants(card: Uint8Array, large: Uint8Array): CheckedVariants {
  const refused = (reason: string, message = VARIANTS_REFUSED): CheckedVariants => ({ ok: false, message, reason });

  const small = imageHeadOf(card);
  const big = imageHeadOf(large);
  if (small === null || big === null) return refused('unreadable', VARIANT_TYPE_REFUSED);
  if (small.type !== big.type) return refused('type-mismatch');

  for (const [name, head, size] of [
    ['card', small, card.length],
    ['large', big, large.length],
  ] as const) {
    const spec = PHOTO_VARIANTS[name];
    if (head.width < 1 || head.height < 1) return refused(`${name}-empty`);
    if (Math.max(head.width, head.height) > spec.edge) return refused(`${name}-edge`);
    if (size > spec.maxBytes) return refused(`${name}-bytes`);
  }

  if (Math.max(small.width, small.height) > Math.max(big.width, big.height)) return refused('card-larger');
  if (!sameShape(small, big)) return refused('ratio');

  return { ok: true, type: big.type, card: small, large: big };
}

/** 작은 벌이 큰 벌을 줄인 크기인가 — 반올림으로 한 변이 1px 어긋나는 것까지 같다고 본다 */
function sameShape(small: ImageHead, big: ImageHead): boolean {
  const scale = Math.max(small.width, small.height) / Math.max(big.width, big.height);
  return Math.abs(Math.round(big.width * scale) - small.width) <= 1 && Math.abs(Math.round(big.height * scale) - small.height) <= 1;
}

/**
 * 한 장의 열쇠(접두사) 아래 한 벌의 객체 키 — `photos/{user}/{upload}/card` · `…/large`.
 *
 * 열쇠는 DB 가 짓는다(`begin_my_photo_upload`). 확장자를 안 붙인다 — 형식은 객체의 `Content-Type` 이 든다.
 */
export function variantKey(objectKey: string, variant: PhotoVariant): string {
  return `${objectKey}/${variant}`;
}

/** DB 의 검사식과 같은 모양 — 남이 지은 문자열을 열쇠로 쓰기 전에 본다 */
const OBJECT_KEY =
  /^photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isPhotoObjectKey = (key: string): boolean => OBJECT_KEY.test(key);

/** 두 벌의 크기 — 긴 변을 그 벌의 상한에 맞춘다. 비율을 지키고 키우지 않는다(`shrunkSize` 와 같은 셈) */
export function variantSize(variant: PhotoVariant, width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, PHOTO_VARIANTS[variant].edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
