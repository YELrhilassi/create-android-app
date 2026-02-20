import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { AddonManager } from './addonManager.js';
import { VersionResolver } from '../utils/versionResolver.js';

interface ProjectOptions {
  projectPath: string;
  projectName: string;
  uiType: 'compose' | 'views' | 'mobile-compose-navigation' | 'tv-compose' | 'compose-library';
  sdkPath: string;
  libraries?: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateProject(options: ProjectOptions) {
  const { projectPath, projectName, uiType, sdkPath, libraries = [] } = options;
  const isLibrary = uiType === 'compose-library';
  const moduleName = isLibrary ? 'library' : 'app';
  
  await fs.ensureDir(projectPath);

  logger.info("Resolving dependency versions...");
  const artifacts = {
    'AGP_VERSION': { group: 'com.android.tools.build', name: 'gradle' },
    'KOTLIN_VERSION': { group: 'org.jetbrains.kotlin', name: 'kotlin-gradle-plugin' },
    'CORE_KTX_VERSION': { group: 'androidx.core', name: 'core-ktx' },
    'JUNIT_VERSION': { group: 'junit', name: 'junit' },
    'JUNIT_ANDROIDX_VERSION': { group: 'androidx.test.ext', name: 'junit' },
    'ESPRESSO_CORE_VERSION': { group: 'androidx.test.espresso', name: 'espresso-core' },
    'LIFECYCLE_RUNTIME_KTX_VERSION': { group: 'androidx.lifecycle', name: 'lifecycle-runtime-ktx' },
    'ACTIVITY_COMPOSE_VERSION': { group: 'androidx.activity', name: 'activity-compose' },
    'COMPOSE_BOM_VERSION': { group: 'androidx.compose', name: 'compose-bom' },
    'APPCOMPAT_VERSION': { group: 'androidx.appcompat', name: 'appcompat' },
    'MATERIAL_VERSION': { group: 'com.google.android.material', name: 'material' },
    'NAVIGATION_COMPOSE_VERSION': { group: 'androidx.navigation', name: 'navigation-compose' },
    'TV_FOUNDATION_VERSION': { group: 'androidx.tv', name: 'tv-foundation', stableOnly: false },
    'TV_MATERIAL_VERSION': { group: 'androidx.tv', name: 'tv-material', stableOnly: false },
    'CONSTRAINTLAYOUT_VERSION': { group: 'androidx.constraintlayout', name: 'constraintlayout' },
    'RETROFIT_VERSION': { group: 'com.squareup.retrofit2', name: 'retrofit' },
    'KTOR_VERSION': { group: 'io.ktor', name: 'ktor-client-core' },
  };

  const resolvedMaven = await VersionResolver.resolveAll(artifacts);
  const remoteDefaults = await VersionResolver.getRemoteDefaults();
  
  const versionPatches: Record<string, string> = {};
  const allKeys = [...Object.keys(artifacts), 'COMPILE_SDK', 'TARGET_SDK', 'MIN_SDK', 'GRADLE_VERSION'];
  
  // Critical build infrastructure keys - ALWAYS prefer GitHub (vetted) or Local Fallback
  const buildInfraKeys = ['AGP_VERSION', 'KOTLIN_VERSION', 'GRADLE_VERSION', 'COMPILE_SDK', 'TARGET_SDK', 'MIN_SDK', 
                         'CORE_KTX_VERSION', 'ACTIVITY_COMPOSE_VERSION', 'APPCOMPAT_VERSION', 'MATERIAL_VERSION', 
                         'NAVIGATION_COMPOSE_VERSION', 'LIFECYCLE_RUNTIME_KTX_VERSION'];

  for (const key of allKeys) {
      const isBuildInfra = buildInfraKeys.includes(key);
      const value = isBuildInfra 
          ? (remoteDefaults[key] || (CONSTANTS.DEFAULTS as any)[key]) // Ignore Maven for infra
          : (resolvedMaven[key] || remoteDefaults[key] || (CONSTANTS.DEFAULTS as any)[key]);
          
      versionPatches[`{{${key}}}`] = value;
  }

  // Resolve KSP separately as it depends on Kotlin version
  const kotlinVersion = versionPatches['{{KOTLIN_VERSION}}'];
  const kspVersion = await VersionResolver.getLatestKspVersion(kotlinVersion) || `${kotlinVersion}-1.0.29`;
  versionPatches['{{KSP_VERSION}}'] = kspVersion;

  const templateRoot = path.resolve(__dirname, '../../templates');
  const baseTemplate = path.join(templateRoot, 'base');
  const uiTemplate = path.join(templateRoot, uiType);

  if (!fs.existsSync(baseTemplate)) {
    throw new Error(`Base template not found at ${baseTemplate}`);
  }

  logger.info(`Copying base template...`);
  await fs.copy(baseTemplate, projectPath);
  
  if (isLibrary) {
      await fs.remove(path.join(projectPath, 'app'));
  }

  const gitignorePath = path.join(projectPath, '_gitignore');
  if (fs.existsSync(gitignorePath)) {
      await fs.move(gitignorePath, path.join(projectPath, '.gitignore'));
  }

  if (fs.existsSync(uiTemplate)) {
    logger.info(`Applying ${uiType} template...`);
    await fs.copy(uiTemplate, projectPath, { overwrite: true });
  } else {
      throw new Error(`UI template not found: ${uiType} at ${uiTemplate}`);
  }

  logger.info(`Patching configuration...`);
  const safeProjectName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '');
  const packageName = `com.example.${safeProjectName || 'androidapp'}`;

  await patchFile(path.join(projectPath, 'settings.gradle.kts'), {
    '{{PROJECT_NAME}}': projectName,
    'include(":app")': `include(":${moduleName}")`
  });

  await patchFile(path.join(projectPath, 'gradle', 'libs.versions.toml'), versionPatches);
  await patchFile(path.join(projectPath, 'gradle', 'wrapper', 'gradle-wrapper.properties'), versionPatches);

  const moduleBuildFile = path.join(projectPath, moduleName, 'build.gradle.kts');
  await patchFile(moduleBuildFile, {
    '{{APPLICATION_ID}}': packageName,
    ...versionPatches
  });
  
  const stringsPath = path.join(projectPath, moduleName, 'src/main/res/values/strings.xml');
  if (fs.existsSync(stringsPath)) {
      await patchFile(stringsPath, {
        '{{PROJECT_NAME}}': projectName,
      });
  }

  const srcBase = path.join(projectPath, moduleName, 'src/main/kotlin');
  const oldPackagePath = path.join(srcBase, 'com/example/template');
  const newPackagePath = path.join(srcBase, ...packageName.split('.'));

  if (fs.existsSync(oldPackagePath)) {
    await fs.move(oldPackagePath, newPackagePath, { overwrite: true });
    await patchSourceFiles(newPackagePath, packageName, projectName);
    await cleanEmptyDirs(oldPackagePath);
  }

  // Use AddonManager for libraries
  if (libraries.length > 0) {
      const addonManager = new AddonManager(projectPath, moduleName, packageName, versionPatches);
      for (const lib of libraries) {
          await addonManager.install(lib);
      }
  }

  const localProperties = `sdk.dir=${sdkPath}\n`;
  await fs.writeFile(path.join(projectPath, 'local.properties'), localProperties);

  logger.info('Adding npm convenience scripts...');
  const packageJson = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: "0.1.0",
    private: true,
    type: "module",
    license: "MIT",
    scripts: {
      "dev": `./gradlew installDebug --continuous --configuration-cache --parallel --offline`,
      "open": `node scripts/adb.js shell am start -n ${packageName}/.MainActivity`,
      "start": "npm run dev",
      "build": `./gradlew assembleRelease`,
      "build:debug": `./gradlew assembleDebug`,
      "test": `./gradlew test`,
      "lint": `./gradlew lint`,
      "clean": `./gradlew clean`,
      "clean:deep": "rm -rf .gradle app/build build library/build",
      "lsp:sync": `./gradlew :${moduleName}:compileDebugKotlin`,
      "help": `./gradlew --help`,
      "adb": "node scripts/adb.js",
      "adb:devices": "npm run adb devices",
      "adb:connect": "npm run adb connect",
      "adb:pair": "npm run adb pair",
      "adb:logcat": "npm run adb logcat",
      "adb:reverse": "npm run adb reverse tcp:8081 tcp:8081",
      "add": "npx create-droid@latest install"
    }
  };
  await fs.writeJSON(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });

  try {
    logger.info('Initializing git repository...');
    await execa('git', ['init'], { cwd: projectPath });
    await execa('git', ['add', '.'], { cwd: projectPath });
    await execa('git', ['commit', '-m', 'Initial commit via create-droid'], { cwd: projectPath });
    logger.success('Git repository initialized.');
  } catch (e) {
    logger.warn('Failed to initialize git repository.');
  }
}

async function patchFile(filePath: string, replacements: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;
  let content = await fs.readFile(filePath, 'utf-8');
  let modified = false;
  for (const [key, value] of Object.entries(replacements)) {
    if (content.includes(key)) {
        content = content.replaceAll(key, value);
        modified = true;
    }
  }
  if (modified) await fs.writeFile(filePath, content);
}

async function patchSourceFiles(dir: string, packageName: string, projectName: string) {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if ((await fs.stat(fullPath)).isDirectory()) {
            await patchSourceFiles(fullPath, packageName, projectName);
        } else if (file.endsWith('.kt') || file.endsWith('.java') || file.endsWith('.xml')) {
            await patchFile(fullPath, {
                '{{PACKAGE_NAME}}': packageName,
                '{{PROJECT_NAME}}': projectName,
                '{{APPLICATION_ID}}': packageName
            });
        }
    }
}

async function cleanEmptyDirs(dir: string) {
    let currentDir = dir;
    while (currentDir && currentDir !== path.dirname(currentDir)) {
        try {
            if (fs.existsSync(currentDir) && (await fs.readdir(currentDir)).length === 0) {
                await fs.remove(currentDir);
                currentDir = path.dirname(currentDir);
            } else break;
        } catch (e) { break; }
    }
}
