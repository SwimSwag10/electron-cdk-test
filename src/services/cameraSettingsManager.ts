// cameraSettingsManager.ts
// Service for advanced camera parameter manipulation (exposure, ISO, white balance)
import { spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

export class CameraSettingsManager {
  // produce this exe via C# build
  private helperExe = process.env.CAMERA_HELPER_PATH || path.resolve(__dirname, '../apps/camera-control.exe'); 

  // This may have to be delted / changed.
  async setExposure(cameraId: string, value: number): Promise<void> {
    if (this.isLogitechBrio(cameraId)) {
      return this.setBrioExposure(cameraId, value);
    }
    console.warn(`[CameraSettingsManager] Exposure control not implemented for camera: ${cameraId}`);
  }

  // Set ISO for a given camera (stub)
  setISO(cameraId: string, value: number): Promise<void> {
    // TODO: Implement hardware-specific logic
    if (this.isLogitechBrio(cameraId)) {
      // Placeholder for Brio-specific ISO control
      return this.setBrioISO(cameraId, value);
    }
    return Promise.resolve();
  }

  // Set white balance for a given camera (stub)
  setWhiteBalance(cameraId: string, value: number): Promise<void> {
    // TODO: Implement hardware-specific logic
    return Promise.resolve();
  }

  // --- Private helpers ---
  private isLogitechBrio(cameraId: string): boolean {
    // TODO: Implement actual detection logic | Look insside of videoDeviceManager.ts to see how
    // we are doing it there. Make sure that we verify the model of camera we want: Logitech Brio 4K.
    return cameraId.toLowerCase().includes('brio');
  }

  private async setBrioExposure(cameraId: string, value: number): Promise<void> {
    // prefer native helper
    if (!existsSync(this.helperExe)) {
      console.warn('[CameraSettingsManager] native helper missing:', this.helperExe);
      // Optional: attempt an FFmpeg fallback (not reliable). We log and resolve to avoid crashing orchestrator.
      await this.tryFfmpegFallback(cameraId, value);
      return;
    }

    // call helper: camera-control.exe set-exposure --device "Logitech BRIO" --value 123
    await new Promise<void>((resolve, reject) => {
      const args = ['set-exposure', '--device', cameraId, '--value', String(value)];
      const child = spawn(this.helperExe, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', d => (stdout += d.toString()));
      child.stderr?.on('data', d => (stderr += d.toString()));

      child.on('error', err => {
        console.error('[CameraSettingsManager] helper spawn failed:', err);
        reject(err);
      });

      child.on('close', code => {
        if (code === 0) {
          try {
            // helper should emit JSON status (optional)
            const parsed = stdout ? JSON.parse(stdout) : { success: true };
            if (parsed && parsed.success) {
              console.info('[CameraSettingsManager] exposure set successfully', parsed);
              return resolve();
            } else {
              console.warn('[CameraSettingsManager] helper returned failure:', parsed, stderr);
              return reject(new Error('helper-reported-failure'));
            }
          } catch (e) {
            // if non-json, assume success when exit 0
            console.info('[CameraSettingsManager] helper exit=0 (no JSON)');
            return resolve();
          }
        } else {
          console.error('[CameraSettingsManager] helper failed, code=', code, 'stderr=', stderr);
          return reject(new Error(`helper-exit-${code}`));
        }
      });
    });
  }

  private async tryFfmpegFallback(cameraId: string, value: number): Promise<void> {
    console.warn('[CameraSettingsManager] Attempting FFmpeg fallback (likely ineffective for hardware exposure).');
    // We'll just log: implementing a real FFmpeg-based hack (eq filter) is not hardware exposure.
    // Keep orchestration running: do not throw for non-critical fallback.
    return Promise.resolve();
  }

  private setBrioISO(cameraId: string, value: number): Promise<void> {
    // TODO: Implement Logitech Brio-specific ISO control
    return Promise.resolve();
  }
}