// src/services/awsIntegrationService.ts
import crossSpawn from 'cross-spawn';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { join, dirname } from 'path';
import { createReadStream, existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { Logger } from '../utils/logger';

export class AWSIntegrationService {
  private logger: Logger;
  private cdkDir: string;
  private region: string;
  private bucket?: string;
  private s3: S3Client;
  private configFile: string = resolve('./config/aws.json');

  constructor() {
    this.logger = new Logger('AWSIntegrationService');
    this.cdkDir = join(__dirname, '../../cdk');
    this.region = process.env.AWS_REGION || 'us-east-2';
    this.s3 = new S3Client({ region: this.region });
  }

  async init(): Promise<void> {
    if (this.bucket) return;
    this.bucket = await this.loadOrConfigureBucket();
  }

  private validateEnv(key: string): string {
    const value = process.env[key];
    if (!value) throw new Error(`Missing env var: ${key}`);
    return value;
  }

  private async loadOrConfigureBucket(): Promise<string> {
    if (existsSync(this.configFile)) {
      const config = JSON.parse(readFileSync(this.configFile, 'utf8'));
      return config.bucketName;
    }
    this.logger.info('No config found; starting auto-configuration');
    await this.runCdkBootstrapSync();
    await this.runCdkDeploySync();
    const outputsPath = join(this.cdkDir, 'outputs.json');
    if (!existsSync(outputsPath)) throw new Error('outputs.json not generated after deploy');
    const outputs = JSON.parse(readFileSync(outputsPath, 'utf8'));
    const bucketName = outputs.CameraStorageStack.TestCameraBucketNameOutput; // Exact match from your CfnOutput ID and log
    if (!bucketName) throw new Error('Failed to get BucketName from outputs');
    mkdirSync(dirname(this.configFile), { recursive: true }); // Create config/ dir if missing
    writeFileSync(this.configFile, JSON.stringify({ bucketName }), 'utf8');
    unlinkSync(outputsPath); // Clean up
    this.logger.info(`Configured bucket: ${bucketName}`);
    return bucketName;
  }

  private async runCdkBootstrapSync(): Promise<void> {
    this.logger.info('Running CDK bootstrap');
    await this.runSubprocessSync('npx', ['cdk', 'bootstrap']);
  }

  private async runCdkDeploySync(): Promise<void> {
    this.logger.info('Running CDK deploy');
    const outputsFile = join(this.cdkDir, 'outputs.json');
    await this.runSubprocessSync('npx', ['cdk', 'deploy', '--all', '--require-approval', 'never', '--outputs-file', outputsFile]);
  }

  private async runSubprocessSync(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = crossSpawn(command, args, {
        cwd: this.cdkDir,
        env: this.getAwsEnv(),
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
        console.log(data.toString());
      });
      proc.stderr?.on('data', (data) => {
        output += data.toString();
        console.error(data.toString());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} failed with code ${code}. Output: ${output}`));
        }
      });
      proc.on('error', reject);
    });
  }

  private getAwsEnv() {
    return {
      ...process.env,
      AWS_ACCESS_KEY_ID: this.validateEnv('AWS_ACCESS_KEY_ID'),
      AWS_SECRET_ACCESS_KEY: this.validateEnv('AWS_SECRET_ACCESS_KEY'),
      AWS_REGION: this.region,
    };
  }

  private async uploadToS3(filePath: string, key: string): Promise<void> {
    if (!this.bucket) throw new Error('Service not initialized');
    try {
      const fileStream = createReadStream(resolve(filePath));
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: fileStream }));
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }

  async handlePostRecording(filePath: string, key: string): Promise<void> {
    try {
      await this.uploadToS3(filePath, key);
    } catch (error: any) {
      this.logger.error(`Post-recording failed: ${error.message}`);
      throw error;
    }
  }
}