// src/services/duelVideoManager.ts
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { CameraService } from './videoDeviceManager';
import type { CameraDevice, RecordingOptions } from '../interfaces/camera';

export interface ProbeResult {
  success: boolean;
  probeOutput?: any;
  error?: string;
  nativeProbeUsed: boolean;
  canDualCapture?: boolean;
  details?: string;
}

export interface DuelCaptureOptions {
  outDir: string;
  durationSeconds?: number;
  colorFileName?: string; // not used by native helper (it writes PNGs)
  infraFileName?: string;
}

const DEFAULT_NATIVE_PATH = path.resolve(__dirname, '..', 'native', 'media_probe', 'publish');

export class DuelVideoManager {
  private ffmpegService: CameraService;
  private nativePublishPath: string;

  constructor(nativePublishPath?: string) {
    this.ffmpegService = new CameraService();
    this.nativePublishPath = nativePublishPath || DEFAULT_NATIVE_PATH;
  }

  private resolveNativeExecutable(): { type: 'exe' | 'dll' | 'none'; fullPath?: string } {
    // check for exe first (MediaProbe.exe)
    const exePath = path.join(this.nativePublishPath, 'MediaProbe.exe');
    if (fs.existsSync(exePath)) return { type: 'exe', fullPath: exePath };

    // check for dll (MediaProbe.dll) and dotnet runner
    const dllPath = path.join(this.nativePublishPath, 'MediaProbe.dll');
    if (fs.existsSync(dllPath)) return { type: 'dll', fullPath: dllPath };

    return { type: 'none' };
  }

  private runNative(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const exe = this.resolveNativeExecutable();
      let cmd: string;
      let spawnArgs: string[];

      if (exe.type === 'exe' && exe.fullPath) {
        cmd = exe.fullPath;
        spawnArgs = args;
      } else if (exe.type === 'dll' && exe.fullPath) {
        // run via dotnet <dll> ...
        cmd = 'dotnet';
        spawnArgs = [exe.fullPath, ...args];
      } else {
        return reject(new Error('No native helper found (MediaProbe.exe or MediaProbe.dll missing)'));
      }

      const proc = spawn(cmd, spawnArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      proc.stdout?.on('data', (d: Buffer) => (out += d.toString()));
      proc.stderr?.on('data', (d: Buffer) => (err += d.toString()));
      proc.on('error', (e) => reject(e));
      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Native process exited ${code}. stderr=${err}`));
        }
        resolve(out.trim());
      });
    });
  }

  async probe(): Promise<ProbeResult> {
    // prefer native helper if present
    const exe = this.resolveNativeExecutable();
    if (exe.type !== 'none') {
      try {
        const raw = await this.runNative(['probe']);
        const parsed = JSON.parse(raw);
        return {
          success: true,
          nativeProbeUsed: true,
          canDualCapture: parsed?.canDualCapture === true,
          probeOutput: parsed,
          details: parsed?.details
        };
      } catch (err: any) {
        return { success: false, nativeProbeUsed: true, error: String(err) };
      }
    }

    // fallback to ffmpeg/DirectShow enumeration
    try {
      const cams: CameraDevice[] = await this.ffmpegService.detectCameras();
      const canDual = cams.length >= 2;
      return {
        success: true,
        nativeProbeUsed: false,
        probeOutput: cams,
        canDualCapture: canDual,
        details: `Detected ${cams.length} device(s) via FFmpeg/DirectShow.`
      };
    } catch (err: any) {
      return { success: false, nativeProbeUsed: false, error: String(err) };
    }
  }

  async startDualCapture(opts: DuelCaptureOptions): Promise<void> {
    // ensure out dir exists
    fs.mkdirSync(opts.outDir, { recursive: true });

    const p = await this.probe();
    if (p.nativeProbeUsed && p.canDualCapture) {
      // call native helper capture
      const duration = opts.durationSeconds || 5;
      try {
        const out = await this.runNative(['capture', `--outDir=${opts.outDir}`, `--duration=${duration}`]);
        // native helper prints JSON summary to stdout
        try {
          const summary = JSON.parse(out);
          if (summary.success) {
            console.log('Native capture succeeded:', summary);
            return;
          } else {
            console.warn('Native capture returned non-success:', summary);
          }
        } catch {
          console.log('Native output:', out);
        }
      } catch (err) {
        console.warn('Native capture failed:', String(err));
      }
    }

    // If native not available or capture failed, try FFmpeg two-device approach via CameraService detect
    if (!p.nativeProbeUsed && Array.isArray(p.probeOutput) && (p.probeOutput as CameraDevice[]).length >= 2) {
      const cams = p.probeOutput as CameraDevice[];
      const d1 = cams[0].name;
      const d2 = cams[1].name;
      console.log('Attempting two-ffmpeg streams for devices:', d1, d2);
      try {
        // simple spawn of two ffmpeg procs — reusing the earlier approach
        await this.spawnTwoFfmpegStreams(d1, d2, opts);
        return;
      } catch (err) {
        console.warn('Two-ffmpeg attempt failed:', String(err));
      }
    }

    // final fallback: single camera via CameraService
    console.warn('Falling back to single-camera recording (existing CameraService).');
    const singleOut = path.resolve(opts.outDir, `fallback_color_${Date.now()}.mp4`);
    const singleOpts: RecordingOptions = { outputPath: singleOut, duration: opts.durationSeconds || 5, fps: 30, resolution: '1920x1080' };
    const cams = await this.ffmpegService.detectCameras();
    if (cams.length > 0) this.ffmpegService.selectCamera(cams[0].id);
    await this.ffmpegService.startRecording(singleOpts);
  }

  private spawnTwoFfmpegStreams(deviceA: string, deviceB: string, opts: DuelCaptureOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const colorOut = path.join(opts.outDir, 'ffmpeg_color.mp4');
      const infraOut = path.join(opts.outDir, 'ffmpeg_infra.mp4');
      const duration = opts.durationSeconds || 5;

      const argsA = ['-f', 'dshow', '-i', `video=${deviceA}`, '-t', `${duration}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-y', colorOut];
      const argsB = ['-f', 'dshow', '-i', `video=${deviceB}`, '-t', `${duration}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-y', infraOut];

      const pA = spawn('ffmpeg', argsA, { stdio: ['ignore', 'pipe', 'pipe'] });
      const pB = spawn('ffmpeg', argsB, { stdio: ['ignore', 'pipe', 'pipe'] });

      let pAExited = false;
      let pBExited = false;
      let err = '';

      pA.stderr?.on('data', d => err += d.toString());
      pB.stderr?.on('data', d => err += d.toString());

      pA.on('close', (c) => { pAExited = true; if (pAExited && pBExited) { if (err) console.warn(err); resolve(); } });
      pB.on('close', (c) => { pBExited = true; if (pAExited && pBExited) { if (err) console.warn(err); resolve(); } });

      pA.on('error', e => reject(e));
      pB.on('error', e => reject(e));
    });
  }
}
