// src/services/videoDeviceManager.ts - Alternative using spawn
import { spawn } from 'child_process';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { CameraDevice, RecordingOptions } from '../interfaces/camera';
import * as fs from 'fs';

// Set FFmpeg path to help fluent-ffmpeg find it
ffmpeg.setFfmpegPath('ffmpeg'); // Use system PATH

export class CameraService {
  private activeRecording: any = null;
  private currentDevice: string | null = null;

  async detectCameras(): Promise<CameraDevice[]> {
    if (process.env.TEST_MODE === 'true') {
      // Return a mock camera for test mode
      return [
        { id: 'mock-camera', name: 'Mock Camera', path: 'mock-camera' }
      ];
    }
    return new Promise((resolve, reject) => {
      const cameras: CameraDevice[] = [];
      
      // Use spawn to capture stderr properly
      const ffmpegProcess = spawn('ffmpeg', ['-f', 'dshow', '-list_devices', 'true', '-i', 'dummy']);
      
      let errorOutput = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpegProcess.on('close', (code) => {
        console.log('FFmpeg stderr output:');
        console.log(errorOutput);
        
        const lines = errorOutput.split('\n');
        
        for (const line of lines) {
          // Look for video devices in format: [dshow @ address] "Device Name" (video)
          if (line.includes('(video)') && line.includes('"')) {
            const match = line.match(/"([^"]+)"/);
            if (match) {
              const deviceName = match[1];
              console.log('Found camera:', deviceName);
              cameras.push({
                id: deviceName,
                name: deviceName,
                path: deviceName
              });
            }
          }
        }
        
        console.log(`Total cameras detected: ${cameras.length}`);
        resolve(cameras);
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        resolve([]); // Return empty array instead of rejecting
      });
    });
  }

  selectCamera(deviceId: string): void {
    this.currentDevice = deviceId;
    console.log(`Selected camera: ${deviceId}`);
  }

  async startRecording(options: RecordingOptions): Promise<void> {
    if (this.activeRecording) {
      throw new Error('Recording already in progress');
    }

    if (!this.currentDevice) {
      throw new Error('No camera selected');
    }

    if (process.env.TEST_MODE === 'true') {
      // Simulate recording in test mode by creating a dummy file after a delay
      return new Promise((resolve) => {
        setTimeout(() => {
          fs.writeFileSync(path.resolve(options.outputPath), 'MOCK_VIDEO_DATA');
          this.activeRecording = null;
          resolve();
        }, (options.duration || 5) * 1000);
      });
    }

    return new Promise((resolve, reject) => {
      const outputPath = path.resolve(options.outputPath);
      
      // Use spawn directly instead of fluent-ffmpeg to avoid capability checks
      const ffmpegArgs = [
        '-f', 'dshow',
        '-framerate', (options.fps || 30).toString(),
        '-video_size', options.resolution || '1920x1080',
        '-i', `video=${this.currentDevice}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-y', // Overwrite output file
        outputPath
      ];

      if (options.duration) {
        ffmpegArgs.splice(-1, 0, '-t', options.duration.toString());
      }

      console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

      this.activeRecording = spawn('ffmpeg', ffmpegArgs);

      let hasResolved = false;

      this.activeRecording.stdout.on('data', (data: Buffer) => {
        // FFmpeg outputs progress to stderr usually, but let's capture both
      });

      this.activeRecording.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('FFmpeg:', output);
        
        // Check if recording actually started (FFmpeg outputs frame info)
        if (!hasResolved && (output.includes('frame=') || output.includes('fps='))) {
          hasResolved = true;
          console.log('Recording started successfully');
          resolve();
        }
      });

      this.activeRecording.on('close', (code: number) => {
        console.log(`Recording finished with code: ${code}`);
        this.activeRecording = null;
        
        // If we haven't resolved yet, resolve now (for short recordings)
        if (!hasResolved) {
          hasResolved = true;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Recording failed with exit code ${code}`));
          }
        }
      });

      this.activeRecording.on('error', (error: Error) => {
        this.activeRecording = null;
        if (!hasResolved) {
          hasResolved = true;
          reject(error);
        }
      });

      // Resolve after a short delay if FFmpeg starts without immediate output
      setTimeout(() => {
        if (!hasResolved && this.activeRecording) {
          hasResolved = true;
          console.log('Recording assumed started (no immediate error)');
          resolve();
        }
      }, 2000);
    });
  }

  stopRecording(): void {
    if (!this.activeRecording) {
      throw new Error('No active recording');
    }
    
    // Send SIGINT to gracefully stop FFmpeg
    this.activeRecording.kill('SIGINT');
    this.activeRecording = null;
    console.log('Recording stopped');
  }

  isRecording(): boolean {
    return this.activeRecording !== null;
  }
}