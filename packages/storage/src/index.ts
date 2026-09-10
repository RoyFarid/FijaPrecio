/**
 * @fijaprecio/storage — envoltura mínima sobre S3 (Cloudflare R2 en prod,
 * MinIO en local). Framework-agnóstica: recibe la config, no lee env.
 */
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** MinIO y algunos gateways necesitan path-style; R2 no. */
  forcePathStyle?: boolean;
}

export interface Storage {
  put(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  signedGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function createStorage(config: StorageConfig): Storage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? !/\br2\.cloudflarestorage\.com/.test(config.endpoint),
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async get(key) {
      const out = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      if (!out.Body) throw new Error(`objeto vacío: ${key}`);
      return streamToBuffer(out.Body as Readable);
    },

    signedGetUrl(key, expiresInSeconds = 300) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
