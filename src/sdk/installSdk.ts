import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { execa } from 'execa';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import AdmZip from 'adm-zip';

export async function installSdk(): Promise<string> {
  const isMac = process.platform === 'darwin';
  
  // 1. Determine SDK Path
  const sdkPath = process.env.ANDROID_HOME || path.join(os.homedir(), '.local', 'share', 'create-android-app', 'sdk');
  
  if (process.env.ANDROID_HOME) {
    logger.info(`Using ANDROID_HOME: ${sdkPath}`);
  } else {
    logger.info(`Using local SDK path: ${sdkPath}`);
  }

  await fs.ensureDir(sdkPath);

  // 2. Check for cmdline-tools
  const cmdlineToolsRoot = path.join(sdkPath, 'cmdline-tools');
  const cmdlineToolsLatest = path.join(cmdlineToolsRoot, 'latest');
  const sdkManagerPath = path.join(cmdlineToolsLatest, 'bin', 'sdkmanager');

  if (!fs.existsSync(sdkManagerPath)) {
    logger.step('Android Command Line Tools not found. Downloading...');
    await downloadCmdlineTools(sdkPath, cmdlineToolsLatest, isMac);
  } else {
    logger.success('Command Line Tools found.');
  }

  // 3. Accept Licenses (Robust Approach: File Injection)
  // Instead of piping 'yes', we write known hashes.
  // These hashes correspond to standard Android SDK licenses.
  // Source: common knowledge in Android community + verification.
  const licensesDir = path.join(sdkPath, 'licenses');
  await fs.ensureDir(licensesDir);

  const androidSdkLicense = [
    '8933bad161af4178b1185d1a37fbf41ea5269c55',
    'd56f5187479451eabf01fb78af6dfcb131a6481e',
    '24333f8a63b6825ea9c5514f83c2829b004d1fee',
  ].join('\n');

  const androidSdkPreviewLicense = '84831b9409646a918e30573bab4c9c91346d8abd';

  logger.step('Writing license files...');
  await fs.writeFile(path.join(licensesDir, 'android-sdk-license'), androidSdkLicense);
  await fs.writeFile(path.join(licensesDir, 'android-sdk-preview-license'), androidSdkPreviewLicense);

  // 4. Install Packages
  logger.step('Installing SDK packages (this may take a while)...');
  const packages = CONSTANTS.SDK_PACKAGES;
  
  try {
    // With licenses pre-accepted, we just run sdkmanager directly.
    // Use --verbose to verify output if needed, but keep it clean for user unless debug.
    
    // Check if packages are already installed to skip slow process?
    // sdkmanager is slow. If platforms/android-34 exists, maybe skip?
    const platformCheck = path.join(sdkPath, 'platforms', 'android-34');
    const buildToolsCheck = path.join(sdkPath, 'build-tools', '34.0.0');

    if (fs.existsSync(platformCheck) && fs.existsSync(buildToolsCheck)) {
        logger.success('SDK packages appear to be installed. Skipping redundant install.');
    } else {
        await execa(sdkManagerPath, [`--sdk_root=${sdkPath}`, ...packages], {
            stdio: 'inherit', // Let user see progress bars from sdkmanager
            env: {
                ANDROID_HOME: sdkPath,
                // Ensure JAVA_HOME is picked up if set, usually execa inherits env
            }
        });
        logger.success('SDK packages installed.');
    }
  } catch (e: any) {
    logger.error('Failed to install SDK packages.');
    logger.error(e.message);
    throw e; // Fail hard if SDK setup fails
  }

  return sdkPath;
}

async function downloadCmdlineTools(sdkPath: string, targetDir: string, isMac: boolean) {
  const url = isMac ? CONSTANTS.CMDLINE_TOOLS_URL_MAC 
            : CONSTANTS.CMDLINE_TOOLS_URL_LINUX;
            
  const zipPath = path.join(sdkPath, 'cmdline-tools.zip');
  
  logger.info(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download SDK: ${response.statusText}`);
  if (!response.body) throw new Error('No body in response');
  
  await pipeline(response.body as any, createWriteStream(zipPath));
  
  logger.info('Extracting (using adm-zip)...');
  
  // Extract to temp folder
  const tempDir = path.join(sdkPath, 'temp_extract');
  await fs.ensureDir(tempDir);
  
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempDir, true); // overwrite: true

  // Structure: tempDir/cmdline-tools/...
  // We need to find the root folder inside tempDir
  const extractedContents = await fs.readdir(tempDir);
  const rootFolder = extractedContents.find(f => fs.statSync(path.join(tempDir, f)).isDirectory());
  
  if (!rootFolder) throw new Error('Unknown zip structure');
  
  const source = path.join(tempDir, rootFolder); // usually 'cmdline-tools'
  
  // Move to targetDir (which is sdk/cmdline-tools/latest)
  // Ensure parent exists
  await fs.ensureDir(path.dirname(targetDir));
  
  if (fs.existsSync(targetDir)) {
      await fs.remove(targetDir);
  }
  
  await fs.move(source, targetDir);
  
  // Cleanup
  await fs.remove(tempDir);
  await fs.remove(zipPath);
}
