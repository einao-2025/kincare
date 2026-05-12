import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Thin wrapper around the S3 client used for storing uploaded report
 * attachments. Mirrors the configuration used by the PDF worker so a single
 * bucket holds all generated and uploaded report artefacts.
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;

  constructor(private readonly cfg: ConfigService) {
    this.client = new S3Client({
      endpoint: this.cfg.get<string>('S3_ENDPOINT'),
      region: this.cfg.get<string>('S3_REGION') ?? 'us-east-1',
      forcePathStyle: this.cfg.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      credentials: this.cfg.get<string>('S3_ACCESS_KEY')
        ? {
            accessKeyId: this.cfg.getOrThrow<string>('S3_ACCESS_KEY'),
            secretAccessKey: this.cfg.get<string>('S3_SECRET_KEY') ?? '',
          }
        : undefined,
    });
  }

  get reportsBucket(): string {
    return this.cfg.get<string>('S3_BUCKET_REPORTS') ?? 'kincare-reports';
  }

  async putObject(params: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }
}
