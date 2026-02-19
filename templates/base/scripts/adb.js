const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

// --- Configuration ---
const projectRoot = path.resolve(__dirname, '..');
const localPropertiesPath = path.join(projectRoot, 'local.properties');
let sdkPath = process.env.ANDROID_HOME;

// --- 1. Resolve ADB Path ---
if (fs.existsSync(localPropertiesPath)) {
  const content = fs.readFileSync(localPropertiesPath, 'utf8');
  const match = content.match(/^sdk\.dir=(.*)$/m);
  if (match) {
    sdkPath = match[1].trim().replace(/\\\\/g, '\\');
  }
}

const isWin = os.platform() === 'win32';
const adbBinary = isWin ? 'adb.exe' : 'adb';
const localAdbPath = sdkPath ? path.join(sdkPath, 'platform-tools', adbBinary) : null;
const finalAdbPath = (localAdbPath && fs.existsSync(localAdbPath)) ? localAdbPath : 'adb';

// --- 2. Helper Functions ---
function runCommand(args, inherit = true) {
  if (inherit) {
    const child = spawn(finalAdbPath, args, { stdio: 'inherit' });
    return new Promise((resolve) => {
        child.on('close', (code) => resolve(code));
    });
  } else {
    try {
        return execSync(`"${finalAdbPath}" ${args.join(' ')}`, { encoding: 'utf8' }).trim();
    } catch (e) {
        return null;
    }
  }
}

function clearScreen() {
    process.stdout.write('\x1Bc');
}

// --- 3. Interactive Menu ---
async function showMenu() {
    clearScreen();
    console.log('\x1b[36m%s\x1b[0m', '🤖 Android Debug Bridge (ADB) Manager');
    console.log('-----------------------------------');
    console.log('1. 📱 List Connected Devices');
    console.log('2. 📡 Connect to Device (Wi-Fi)');
    console.log('3. 🔗 Pair Device (Android 11+)');
    console.log('4. 🔄 Reverse Port 8081 (React Native/Metro)');
    console.log('5. 📜 Stream Logcat');
    console.log('6. 💀 Kill ADB Server');
    console.log('0. 🚪 Exit');
    console.log('-----------------------------------');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Select option: ', async (answer) => {
        rl.close();
        switch (answer.trim()) {
            case '1':
                await runCommand(['devices', '-l']);
                await pause();
                showMenu();
                break;
            case '2':
                await handleConnect();
                break;
            case '3':
                await handlePair();
                break;
            case '4':
                console.log('Reversing tcp:8081...');
                await runCommand(['reverse', 'tcp:8081', 'tcp:8081']);
                await pause();
                showMenu();
                break;
            case '5':
                console.log('Starting Logcat (Ctrl+C to stop)...');
                await runCommand(['logcat']);
                // Logcat blocks, so we won't return easily loop unless killed
                break;
            case '6':
                await runCommand(['kill-server']);
                console.log('Server killed.');
                await pause();
                showMenu();
                break;
            case '0':
                process.exit(0);
                break;
            default:
                showMenu();
        }
    });
}

async function handleConnect() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter Device IP:Port (e.g., 192.168.1.5:5555): ', async (ip) => {
        rl.close();
        if (ip) {
            console.log(`Connecting to ${ip}...`);
            await runCommand(['connect', ip]);
        }
        await pause();
        showMenu();
    });
}

async function handlePair() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter Device IP:Port (from "Wireless debugging"): ', (ip) => {
        rl.question('Enter Pairing Code: ', async (code) => {
            rl.close();
            if (ip && code) {
                console.log(`Pairing with ${ip}...`);
                await runCommand(['pair', ip, code]);
            }
            await pause();
            showMenu();
        });
    });
}

function pause() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('\nPress Enter to continue...', () => {
            rl.close();
            resolve();
        });
    });
}

// --- 4. Main Execution ---
const args = process.argv.slice(2);

if (args.length > 0) {
    // Pass-through mode (e.g., npm run adb connect ...)
    const child = spawn(finalAdbPath, args, { stdio: 'inherit' });
    child.on('close', (code) => process.exit(code));
} else {
    // Interactive mode
    if (!sdkPath && !process.env.ANDROID_HOME) {
        console.warn('⚠️  ANDROID_HOME not set. Trying global ADB...');
    }
    showMenu();
}
