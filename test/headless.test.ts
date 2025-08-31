import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { strict as assert } from 'assert';

describe('Headless Electron Camera Orchestration', function () {
  this.timeout(20000); // Allow up to 20s for orchestration

  const recordingsDir = path.resolve(__dirname, '../recordings');
  let beforeFiles: string[] = [];

  before(() => {
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir);
    }
    beforeFiles = fs.readdirSync(recordingsDir);
  });

  it('should create a mock recording file in test mode', (done) => {
    const electronPath = require('electron');
    const mainPath = path.resolve(__dirname, '../dist/main.js');
    const proc = spawn(electronPath, [mainPath], {
      env: { ...process.env, TEST_MODE: 'true' },
      stdio: 'ignore',
    });
    proc.on('exit', (code) => {
      const afterFiles = fs.readdirSync(recordingsDir);
      const newFiles = afterFiles.filter(f => !beforeFiles.includes(f));
      assert(newFiles.length > 0, 'No new recording file created');
      const createdFile = newFiles.find(f => f.startsWith('test_') && f.endsWith('.mp4'));
      assert(createdFile, 'Expected test_*.mp4 file not found');
      const filePath = path.join(recordingsDir, createdFile!);
      const stat = fs.statSync(filePath);
      assert(stat.size > 0, 'Created file is empty');
      done();
    });
  });
});
