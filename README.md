# Camera Control Test Application

## Setup Guide
- This is program is Windows specific. Make sure you are running on a Windows 64x machine.
- Required IAM user. You need to create a new IAM user inside of the AWS console. Make sure you give it CLI access.
- Create an access key for the IAM user. Make sure to copy the secret key, and the public key.
- Create a .env file in the root, and copy from the `.example.env`.
- Make sure to install ffmpeg. Visit the official page to do so.
- Install dotnet SDK. Go to Microsoft official site to do so.
- Install dependencies:
```shell
npm i
cd cdk
npm i
```
- You need to run the dotnet media capture. To do so:
```
cd .\src\native\media_probe\
dotnet restore
dotnet publish -c Release -r win-x64 --self-contained false -o ./publish
```
- Finally, run:
```
cd .\publish\
dotnet .\MediaProbe.dll capture --duration 10
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

```
{"canDualCapture":true,"groups":[{"group":{"id":"\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_00#6\u00266399fd8\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL",

"displayName":"Integrated Webcam","sourceInfos":[{"id":"Source#0@\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_00#6\u00266399fd8\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL","kind":"Color","mediaStreamType":"VideoRecord"}]},"canDualCapture":false},{"group":{"id":"\\\\?\\SWD#SGDEVAPI#7D0C6EF062837E4692941F6D36900239E2D42C7FC2F1DB853701EE9A3DC2DC1C#{669c7214-0a88-4311-a7f3-4e79820e33bd}\\7D0C6EF062837E4692941F6D36900239E2D42C7FC2F1DB853701EE9A3DC2DC1C",

"displayName":"YourCameraGroup","sourceInfos":[{"id":"Source#0@\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_00#6\u00266399fd8\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL","kind":"Color","mediaStreamType":"VideoRecord"},{"id":"Source#1@\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_02#6\u00266399fd8\u00260\u00260002#{24e552d7-6523-47f7-a647-d3465bf1f5ca}\\GLOBAL","kind":"Infrared","mediaStreamType":"VideoRecord"}]},"canDualCapture":true},{"group":{"id":"\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_02#6\u00266399fd8\u00260\u00260002#{24e552d7-6523-47f7-a647-d3465bf1f5ca}\\GLOBAL",

"displayName":"Integrated IR Webcam","sourceInfos":[{"id":"Source#0@\\\\?\\USB#VID_0C45\u0026PID_6732\u0026MI_02#6\u00266399fd8\u00260\u00260002#{24e552d7-6523-47f7-a647-d3465bf1f5ca}\\GLOBAL","kind":"Infrared","mediaStreamType":"VideoRecord"}]},"canDualCapture":false},{"group":{"id":"\\\\?\\USB#VID_046D\u0026PID_085E\u0026MI_00#8\u002628bf0d49\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL",

"displayName":"Logitech BRIO","sourceInfos":[{"id":"Source#0@\\\\?\\USB#VID_046D\u0026PID_085E\u0026MI_00#8\u002628bf0d49\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL","kind":"Color","mediaStreamType":"VideoRecord"},{"id":"Source#1@\\\\?\\USB#VID_046D\u0026PID_085E\u0026MI_00#8\u002628bf0d49\u00260\u00260000#{e5323777-f976-4f5b-9b55-b94699c46e44}\\GLOBAL","kind":"Infrared","mediaStreamType":"VideoRecord"}]},"canDualCapture":false}],"details":"Found a group that can open Color\u002BInfrared concurrently"}
```