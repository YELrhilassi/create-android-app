import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import readline from 'readline';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function getMdnsServices() {
    const output = runCommand(['mdns', 'services'], false);
    if (!output) return [];
    
    const lines = output.split('\n');
    const services = [];
    
    for (const line of lines) {
        if (!line.includes('_adb-tls-connect') && !line.includes('_adb._tcp')) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
             const ipPort = parts[parts.length - 1]; // last part is ip:port
             const name = parts[0];
             services.push({ name, ipPort });
        }
    }
    return services;
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
    console.log('\nScanning for devices via mDNS...');
    const services = await getMdnsServices();
    
    if (services.length > 0) {
        console.log('\nDiscovered Devices:');
        services.forEach((s, i) => console.log(`${i + 1}. ${s.name} (${s.ipPort})`));
        console.log(`${services.length + 1}. Enter manually`);
    } else {
        console.log('No mDNS devices found.');
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nSelect device number or enter IP:Port: ', async (answer) => {
        rl.close();
        
        let target = answer.trim();
        const idx = parseInt(target) - 1;
        
        if (!isNaN(idx) && idx >= 0 && idx < services.length) {
            target = services[idx].ipPort;
        }
        
        if (target) {
            console.log(`Connecting to ${target}...`);
            await runCommand(['connect', target]);
        }
        await pause();
        showMenu();
    });
}

async function handlePair() {
    console.log('\nScanning for devices via mDNS...');
    const services = await getMdnsServices();
    
    if (services.length > 0) {
        console.log('\nDiscovered Devices:');
        services.forEach((s, i) => console.log(`${i + 1}. ${s.name} (${s.ipPort})`));
        console.log(`${services.length + 1}. Enter manually`);
    } else {
        console.log('No mDNS devices found.');
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nSelect device number or enter IP:Port: ', (answer) => {
        let target = answer.trim();
        const idx = parseInt(target) - 1;
        
        if (!isNaN(idx) && idx >= 0 && idx < services.length) {
            target = services[idx].ipPort;
        }

        if (!target) {
            rl.close();
            showMenu();
            return;
        }

        rl.question(`Enter Pairing Code for ${target}: `, async (code) => {
            rl.close();
            if (code) {
                console.log(`Pairing with ${target}...`);
                await runCommand(['pair', target, code]);
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
