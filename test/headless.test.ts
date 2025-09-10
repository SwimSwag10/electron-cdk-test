// test/headless-test.ts
import { DualVideoManager } from '../src/services/dualVideoManager';
import * as path from 'path';
import * as fs from 'fs';

(async function main() {
  console.log('Running duel/headless test...');
  const manager = new DualVideoManager();

  const probe = await manager.probe();
  console.log('Probe result:', JSON.stringify(probe, null, 2));

  if (probe.nativeProbeUsed && probe.canDualCapture) {
    console.log('Native probe reports dual capture support — attempting a short capture test...');
    const outDir = path.resolve(__dirname, '..', 'recordings', `duel_test_${Date.now()}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    try {
      await manager.startDualCapture({ outDir, durationSeconds: 5 });
      console.log('Native dual capture finished. Check output directory:', outDir);
    } catch (err) {
      console.error('Native dual capture failed:', err);
    }
  } else {
    console.log('Dual native capture not available. The manager will attempt FFmpeg two-device approach or fall back to single camera.');
    const outDir = path.resolve(__dirname, '..', 'recordings', `ffmpeg_test_${Date.now()}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    try {
      await manager.startDualCapture({ outDir, durationSeconds: 5 });
      console.log('FFmpeg capture/fallback finished. Check output directory:', outDir);
    } catch (err) {
      console.error('FFmpeg capture attempt failed:', err);
    }
  }

  console.log('Headless test complete.');
  process.exit(0);
})();
