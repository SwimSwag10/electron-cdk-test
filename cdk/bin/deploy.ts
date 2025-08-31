#!/usr/bin/env node
// cdk/bin/deploy.ts
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CameraStorageStack } from '../stacks/storage-stack';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
const app = new cdk.App();

new CameraStorageStack(app, 'CameraStorageStack');
