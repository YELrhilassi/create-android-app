const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// 1. Find SDK Location from local.properties
const projectRoot = path.resolve(__dirname, '..');
const localPropertiesPath = path.join(projectRoot, 'local.properties');
let sdkPath = process.env.ANDROID_HOME;

if (fs.existsSync(localPropertiesPath)) {
  const content = fs.readFileSync(localPropertiesPath, 'utf8');
  const match = content.match(/^sdk\.dir=(.*)$/m);
  if (match) {
    sdkPath = match[1].trim().replace(/\\\\/g, '\\'); // Handle Windows escaping if present
  }
}

if (!sdkPath) {
  console.error('❌ Could not find SDK location. Set ANDROID_HOME or create local.properties.');
  process.exit(1);
}

// 2. Resolve ADB binary
const isWin = os.platform() === 'win32';
const adbBinary = isWin ? 'adb.exe' : 'adb';
const adbPath = path.join(sdkPath, 'platform-tools', adbBinary);

if (!fs.existsSync(adbPath)) {
    // Fallback to global adb if local not found
    console.warn(`⚠️  Local ADB not found at ${adbPath}. Trying global 'adb'...`);
}

// 3. Run ADB with arguments
const args = process.argv.slice(2);
const finalAdbPath = fs.existsSync(adbPath) ? adbPath : 'adb';

const child = spawn(finalAdbPath, args, { stdio: 'inherit' });

child.on('error', (err) => {
  console.error(`❌ Failed to start ADB: ${err.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});
