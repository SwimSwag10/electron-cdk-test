// src/models/Camera.ts
export interface CameraDevice {
  id: string;
  name: string;
  path?: string;
}

export interface RecordingOptions {
  duration?: number;
  outputPath: string;
  fps?: number;
  resolution?: string;
}