// src/main.ts
import * as dotenv from 'dotenv';
import { app } from 'electron';
import { RecordingOrchestrator } from './controllers/recordingOrchestrator';

dotenv.config({ override: true });

app.on('ready', async () => {
  const orchestrator = new RecordingOrchestrator();  // Triggers config in AWSIntegrationService constructor
  while (true) {
    await orchestrator.startRecordingOrchestration();
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
});