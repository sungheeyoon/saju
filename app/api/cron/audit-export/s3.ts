import { createHash } from 'node:crypto';

import { PutObjectCommand, S3Client, type PutObjectCommandInput } from '@aws-sdk/client-s3';

import type { Bundle } from './bundle';
import type { ExportConfig, Upload } from './export';

/**
 * 묶음 하나를 S3 에 **한 객체로** 올린다 (G-23 ⑩, ADR 0105).
 *
 * 보존은 **버킷이 정한다** — 버킷의 Object Lock 기본 보존(처음엔 Governance 로 재고, 운영은 Compliance 400일,
 * runbook 「운영자 접속기록 — 반출」). 여기서 객체마다 보존을 적지 않는 것은, 적으면 Governance → Compliance
 * 로 옮기는 것이 코드 배포가 되고 반출 키에 `s3:PutObjectRetention` 까지 줘야 하기 때문이다. 반출 키는
 * `s3:PutObject` 하나면 된다.
 *
 * Object Lock 버킷은 올릴 때 무결성 검사값을 요구한다 — 본문의 SHA-256 을 `ChecksumSHA256` 으로 싣는다. S3 가
 * 받은 본문과 대어 보고 다르면 거절한다.
 */

export function putInputOf(config: ExportConfig, bundle: Bundle): PutObjectCommandInput {
  return {
    Bucket: config.bucket,
    Key: bundle.key,
    Body: bundle.body,
    ContentType: 'application/x-ndjson; charset=utf-8',
    ChecksumSHA256: createHash('sha256').update(bundle.body, 'utf8').digest('base64'),
    Metadata: {
      rows: String(bundle.head.rows),
      'first-id': String(bundle.head.first_id),
      'last-id': String(bundle.head.last_id),
      'after-id': String(bundle.head.after_id),
      'rows-sha256': bundle.head.sha256,
    },
  };
}

export function s3Upload(config: ExportConfig): Upload {
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return async (bundle) => {
    await client.send(new PutObjectCommand(putInputOf(config, bundle)));
  };
}
