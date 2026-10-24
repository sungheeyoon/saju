import { NoSuchKey, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { s3PhotoStore } from './s3-store';

/**
 * **없는 객체는 「없음」, 권한 오류는 던진다** — 열람 라우트가 앞을 404, 뒤를 500 으로 낸다(`photo-response.ts`, ADR 0203).
 *
 * S3 는 `ListBucket` 권한이 없으면 없는 객체의 GetObject 에 404(NoSuchKey) 대신 403(AccessDenied)을 준다
 * (https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html). 그래서 앱 역할에 이 버킷의 `ListBucket` 을 둔다
 * (`docs/ops/runbook/photo-store.md` 「마법사가 쓸 값」의 `PhotoListForNotFound`). 403 을 「없음」으로 바꾸지 않는다 — 권한 장애를 숨긴다.
 */

const store = s3PhotoStore({
  bucket: 'saju-photos-test',
  region: 'ap-northeast-2',
  credentials: { kind: 'keys', accessKeyId: 'AKIATEST', secretAccessKey: 'secret-for-tests' },
});

afterEach(() => vi.restoreAllMocks());

describe('s3PhotoStore.get', () => {
  it('NoSuchKey(404)는 null 이다 — 라우트가 없는 장과 같은 404 로 낸다', async () => {
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
      new NoSuchKey({ message: 'The specified key does not exist.', $metadata: { httpStatusCode: 404 } }),
    );

    await expect(store.get('photos/a/b/large')).resolves.toBeNull();
  });

  it('AccessDenied(403)는 던진다 — 「없음」으로 숨기지 않는다, 라우트가 500 으로 낸다', async () => {
    const denied = new S3ServiceException({
      name: 'AccessDenied',
      $fault: 'client',
      message: 'Access Denied',
      $metadata: { httpStatusCode: 403 },
    });
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(denied);

    await expect(store.get('photos/a/b/large')).rejects.toBe(denied);
  });
});
