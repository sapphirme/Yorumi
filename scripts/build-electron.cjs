const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const packageJson = require(path.join(root, 'package.json'));
const outputDir = packageJson.build?.directories?.output || 'dist';
const appOutDir = path.resolve(root, outputDir, 'win-unpacked');
const tempAppOutDir = `${appOutDir}.tmp`;
const electronBuilderCli = require.resolve('electron-builder/cli.js');

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch path outside project: ${resolved}`);
  }
  return resolved;
}

function removeIfExists(target) {
  const resolved = assertInsideRoot(target);
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameWithRetry(source, destination) {
  const resolvedSource = assertInsideRoot(source);
  const resolvedDestination = assertInsideRoot(destination);
  let lastError;

  if (process.platform === 'win32') {
    const psQuote = (value) => `'${value.replace(/'/g, "''")}'`;
    const command = [
      `$src = ${psQuote(resolvedSource)}`,
      `$dst = ${psQuote(resolvedDestination)}`,
      'if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Recurse -Force }',
      'Move-Item -LiteralPath $src -Destination $dst',
    ].join('; ');

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        cwd: root,
        stdio: 'inherit',
        shell: false,
      });
      if (result.status === 0) return;
      lastError = result.error || new Error(`PowerShell Move-Item failed with status ${result.status}`);
      sleep(500);
    }

    throw lastError;
  }

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      fs.renameSync(resolvedSource, resolvedDestination);
      return;
    } catch (error) {
      lastError = error;
      sleep(500);
    }
  }

  throw lastError;
}

function runElectronBuilder(args) {
  return spawnSync(process.execPath, [electronBuilderCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
}

removeIfExists(tempAppOutDir);

const firstRun = runElectronBuilder([]);
if (firstRun.error) {
  throw firstRun.error;
}
if (firstRun.status === 0) {
  process.exit(0);
}

if (!fs.existsSync(tempAppOutDir)) {
  process.exit(firstRun.status || 1);
}

console.warn('[build-electron] electron-builder left a complete win-unpacked.tmp; retrying via --prepackaged.');
removeIfExists(appOutDir);
renameWithRetry(tempAppOutDir, appOutDir);

const retry = runElectronBuilder(['--prepackaged', appOutDir]);
if (retry.error) {
  throw retry.error;
}
process.exit(retry.status || 0);
