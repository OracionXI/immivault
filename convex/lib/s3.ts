"use node";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Client(): S3Client {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing required AWS environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) throw new Error("Missing AWS_S3_BUCKET_NAME environment variable");
  return bucket;
}

/** Constructs the S3 object key for a document. */
export function buildS3Key(organisationId: string, documentId: string): string {
  return `orgs/${organisationId}/${documentId}`;
}

/**
 * Returns a pre-signed PUT URL for direct browser-to-S3 upload.
 * ContentType and ContentLength are locked to prevent substitution attacks.
 * SSE-KMS is enforced; upload fails if the browser omits the encryption header.
 * Expires in 5 minutes.
 */
export async function presignPutUrl(
  s3Key: string,
  mimeType: string,
  fileSizeBytes: number
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
    ContentLength: fileSizeBytes,
    ServerSideEncryption: "aws:kms",
  });

  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * Returns a pre-signed GET URL for viewing/downloading a document.
 * Expires in 15 minutes.
 */
export async function presignGetUrl(s3Key: string): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  return getSignedUrl(client, command, { expiresIn: 900 });
}

/** Permanently deletes an object from S3. Used by the purge cron. */
export async function deleteS3Object(s3Key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    })
  );
}
