// src/controllers/recordingOrchestrator.ts
import { CameraService } from '../services/videoDeviceManager';
import { RecordingOptions } from '../interfaces/camera';
import { AWSIntegrationService } from '../services/awsIntegrationService';
import { Logger } from '../utils/logger';

export class RecordingOrchestrator {
  private cameraService: CameraService;
  private awsIntegrationService: AWSIntegrationService;
  private logger: Logger;
  private _lastRecordingPath: string | null = null;
  private _cameras: any[] = [];
  private _selectedCamera: any = null;

  constructor() {
    this.cameraService = new CameraService();
    this.awsIntegrationService = new AWSIntegrationService();
    this.logger = new Logger('RecordingOrchestrator');
  }

  async startRecordingOrchestration(): Promise<void> {
    try {
      await this.awsIntegrationService.init(); // Ensure configured before proceeding
      await this.initializeCameras();
      await this.selectOptimalCamera();
      await this.executeRecordingSequence();
      this.handleUpload();
    } catch (error: any) {
      this.logger.error(`Orchestration failed: ${error.message}`);
    }
  }

  private async initializeCameras(): Promise<void> {
    const cameras = await this.cameraService.detectCameras();
    if (cameras.length === 0) throw new Error('No cameras found');
    this._cameras = cameras;
  }

  private async selectOptimalCamera(): Promise<void> {
    const brio = this._cameras.find(c => c.name.toLowerCase().includes('brio'));
    const selected = brio || this._cameras[0];
    this.cameraService.selectCamera(selected.id);
    this._selectedCamera = selected;
  }

  private async executeRecordingSequence(): Promise<void> {
    const options: RecordingOptions = {
      outputPath: `./recordings/test_${Date.now()}.mp4`,
      duration: 5,
      fps: 30,
      resolution: '1920x1080'
    };
    this._lastRecordingPath = options.outputPath;
    await this.cameraService.startRecording(options);
    await new Promise(resolve => setTimeout(resolve, (options.duration! + 1) * 1000));
  }

  private async handleUpload(): Promise<void> {
    if (!this._lastRecordingPath) return;
    const key = this._lastRecordingPath.replace(/^\.\/recordings\//, '');
    try {
      await this.awsIntegrationService.handlePostRecording(this._lastRecordingPath, key);
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`);
    }
  }
}