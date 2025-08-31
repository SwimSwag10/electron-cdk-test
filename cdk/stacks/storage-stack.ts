// cdk/stacks/storage-stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class CameraStorageStack extends Stack {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, 'TestCameraBucket', { /* your config */ });
    new CfnOutput(this, 'TestCameraBucketNameOutput', { value: this.bucket.bucketName });
  }
}
