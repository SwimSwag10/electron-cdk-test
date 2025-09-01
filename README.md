# Camera Control Test Application

## AWS Upload Integration

### Setup Guide
- This is program is Windows specific. Make sure you are running on a Windows 64x machine.
- Required IAM user. You need to create a new IAM user inside of the AWS console. Make sure you give it CLI access.
- Create an access key for the IAM user. Make sure to copy the secret key, and the public key.
- Create a .env file in the root, and copy from the `.example.env`.
- Make sure to install ffmpeg. Visit the official page to do so.
- Install dependencies:
```shell
npm i
cd cdk
npm i
```


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