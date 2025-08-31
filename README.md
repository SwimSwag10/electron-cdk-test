# Camera Control Test Application

## AWS Upload Integration

### Prerequisites
- AWS credentials must be provided via environment variables or AWS profile (never hardcoded).
- Required environment variables:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (default: us-east-2)

### How Upload Works
- After each recording, the Electron app automatically uploads the video file to the specified S3 bucket using the AWS SDK v3.
- Uploads are triggered programmatically in the middle of the app's headless run (not at exit).
- All upload activity is logged for debugging and traceability.
- If credentials or bucket are missing, upload is skipped and an error is logged.

### Security
- **Never** hardcode AWS credentials in code or config files.
- Use environment variables or AWS CLI profile for all sensitive information.

### Running the App
1. Set the required AWS environment variables.
2. Run `npm run start` as usual.
3. After recording, the app will upload the file to S3 automatically.

### Project directory structure - test project
```
test-project/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── apps/
├── dist/
├── cdk/
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── cdk.json
│   ├── tsconfig.json
│   ├── bin/
│   │   └── deploy.ts
│   └── stacks/
│       └── storage-stack.ts
├── src/
│   ├── main.ts
│   ├── controllers/
│   │   └── recordingOrchestrator.ts
│   ├── interfaces/
│   │   └── camera.ts
│   └── services/
│       ├── awsUploadService.ts
│       ├── cameraSettingsManager.ts
│       └── videoDeviceManager.ts
└── test/
    └── headless-test.ts
```