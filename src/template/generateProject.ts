import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

interface ProjectOptions {
  projectPath: string;
  projectName: string;
  uiType: 'compose' | 'views' | 'mobile-compose-navigation' | 'tv-compose' | 'compose-library';
  sdkPath: string;
  libraries?: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_CONFIGS: Record<string, any> = {
    coil: {
        versions: { coil: "2.6.0" },
        libraries: { 'androidx-coil': 'io.coil-kt:coil-compose:{{coil}}' },
        implementations: ['libs.androidx.coil']
    },
    retrofit: {
        versions: { retrofit: "2.11.0" },
        libraries: { 
            'retrofit': 'com.squareup.retrofit2:retrofit:{{retrofit}}',
            'converter-gson': 'com.squareup.retrofit2:converter-gson:{{retrofit}}'
        },
        implementations: ['libs.retrofit', 'libs.converter.gson']
    },
    hilt: {
        versions: { hilt: "2.51.1", ksp: "2.1.0-1.0.29" },
        plugins: { 
            'hilt': { id: "com.google.dagger.hilt.android", version: "2.51.1" },
            'ksp': { id: "com.google.devtools.ksp", version: "2.1.0-1.0.29" }
        },
        libraries: { 
            'hilt-android': 'com.google.dagger:hilt-android:{{hilt}}',
            'hilt-compiler': 'com.google.dagger:hilt-compiler:{{hilt}}'
        },
        implementations: ['libs.hilt.android'],
        ksp: ['libs.hilt.compiler']
    },
    ktor: {
        versions: { ktor: "2.3.11" },
        libraries: { 
            'ktor-client-core': 'io.ktor:ktor-client-core:{{ktor}}',
            'ktor-client-okhttp': 'io.ktor:ktor-client-okhttp:{{ktor}}',
            'ktor-client-content-negotiation': 'io.ktor:ktor-client-content-negotiation:{{ktor}}',
            'ktor-serialization-kotlinx-json': 'io.ktor:ktor-serialization-kotlinx-json:{{ktor}}'
        },
        implementations: ['libs.ktor.client.core', 'libs.ktor.client.okhttp', 'libs.ktor.client.content.negotiation', 'libs.ktor.serialization.kotlinx.json']
    },
    serialization: {
        plugins: { 'kotlin-serialization': { id: "org.jetbrains.kotlin.plugin.serialization", version: "2.1.0" } },
        libraries: { 'kotlinx-serialization-json': 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3' },
        implementations: ['libs.kotlinx.serialization.json']
    },
    datastore: {
        versions: { datastore: "1.1.1" },
        libraries: { 'androidx-datastore-preferences': 'androidx.datastore:datastore-preferences:{{datastore}}' },
        implementations: ['libs.androidx.datastore.preferences']
    }
};

export async function generateProject(options: ProjectOptions) {
  const { projectPath, projectName, uiType, sdkPath, libraries = [] } = options;
  const isLibrary = uiType === 'compose-library';
  const moduleName = isLibrary ? 'library' : 'app';
  
  await fs.ensureDir(projectPath);

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

  const moduleBuildFile = path.join(projectPath, moduleName, 'build.gradle.kts');
  await patchFile(moduleBuildFile, {
    '{{APPLICATION_ID}}': packageName,
    '{{COMPILE_SDK}}': CONSTANTS.COMPILE_SDK.toString(),
    '{{MIN_SDK}}': CONSTANTS.MIN_SDK.toString(),
    '{{TARGET_SDK}}': CONSTANTS.TARGET_SDK.toString(),
  });
  
  if (fs.existsSync(path.join(projectPath, moduleName, 'src/main/res/values/strings.xml'))) {
      await patchFile(path.join(projectPath, moduleName, 'src/main/res/values/strings.xml'), {
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

  if (libraries.length > 0) {
      logger.info(`Installing selected libraries...`);
      await injectLibraries(projectPath, moduleName, libraries, packageName);
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
      "start": "npm run dev",
      "build": `./gradlew assembleRelease`,
      "build:debug": `./gradlew assembleDebug`,
      "test": `./gradlew test`,
      "lint": `./gradlew lint`,
      "clean": `./gradlew clean`,
      "clean:deep": "rm -rf .gradle app/build build library/build",
      "lsp:sync": `./gradlew :${moduleName}:compileDebugKotlin :${moduleName}:classes`,
      "help": `./gradlew --help`,
      "adb": "node scripts/adb.js",
      "adb:devices": "npm run adb devices",
      "adb:connect": "npm run adb connect",
      "adb:pair": "npm run adb pair",
      "adb:logcat": "npm run adb logcat",
      "adb:reverse": "npm run adb reverse tcp:8081 tcp:8081"
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

async function injectLibraries(projectPath: string, moduleName: string, selected: string[], packageName: string) {
    const tomlPath = path.join(projectPath, 'gradle', 'libs.versions.toml');
    const buildFile = path.join(projectPath, moduleName, 'build.gradle.kts');
    const rootBuildFile = path.join(projectPath, 'build.gradle.kts');
    const manifestFile = path.join(projectPath, moduleName, 'src/main/AndroidManifest.xml');
    
    let toml = await fs.readFile(tomlPath, 'utf-8');
    let build = await fs.readFile(buildFile, 'utf-8');
    let rootBuild = await fs.readFile(rootBuildFile, 'utf-8');

    for (const libId of selected) {
        const config = LIBRARY_CONFIGS[libId];
        if (!config) continue;

        if (config.versions) {
            for (const [vId, vVal] of Object.entries(config.versions)) {
                if (!toml.includes(`${vId} =`)) {
                    toml = toml.replace('[versions]', `[versions]\n${vId} = "${vVal}"`);
                }
            }
        }

        if (config.libraries) {
            for (const [lId, lVal] of Object.entries(config.libraries)) {
                if (!toml.includes(`${lId} =`)) {
                    let valStr = toToml(lVal);
                    if (typeof lVal === 'string') {
                        valStr = valStr.replace(/\{\{([^}]+)\}\}/g, (_, p1) => config.versions?.[p1] || p1);
                    }
                    toml = toml.replace('[libraries]', `[libraries]\n${lId} = ${valStr}`);
                }
            }
        }

        if (config.plugins) {
            for (const [pId, pVal] of Object.entries(config.plugins)) {
                if (!toml.includes(`${pId} =`)) {
                    toml = toml.replace('[plugins]', `[plugins]\n${pId} = ${toToml(pVal)}`);
                    const pluginAlias = pId.replace(/-/g, '.');
                    if (!rootBuild.includes(`alias(libs.plugins.${pluginAlias})`)) {
                        rootBuild = rootBuild.replace('plugins {', `plugins {\n    alias(libs.plugins.${pluginAlias}) apply false`);
                    }
                    if (!build.includes(`alias(libs.plugins.${pluginAlias})`)) {
                        build = build.replace('plugins {', `plugins {\n    alias(libs.plugins.${pluginAlias})`);
                    }
                }
            }
        }

        if (config.implementations) {
            let depsInject = '';
            for (const imp of config.implementations) {
                if (!build.includes(imp)) {
                    depsInject += `    implementation(${imp})\n`;
                }
            }
            build = build.replace('dependencies {', `dependencies {\n${depsInject}`);
        }

        if (config.ksp) {
            let depsInject = '';
            for (const imp of config.ksp) {
                if (!build.includes(`ksp(${imp})`)) {
                    depsInject += `    ksp(${imp})\n`;
                }
            }
            build = build.replace('dependencies {', `dependencies {\n${depsInject}`);
        }

        // Specific Hilt setup
        if (libId === 'hilt') {
            await configureHilt(projectPath, moduleName, packageName, manifestFile);
        }
    }

    await fs.writeFile(tomlPath, toml);
    await fs.writeFile(buildFile, build);
    await fs.writeFile(rootBuildFile, rootBuild);
}

async function configureHilt(projectPath: string, moduleName: string, packageName: string, manifestFile: string) {
    const srcBase = path.join(projectPath, moduleName, 'src/main/kotlin', ...packageName.split('.'));
    const appClassPath = path.join(srcBase, 'MainApplication.kt');
    
    // 1. Create Application Class
    const appClassContent = `package ${packageName}

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MainApplication : Application()
`;
    await fs.writeFile(appClassPath, appClassContent);

    // 2. Patch AndroidManifest
    if (fs.existsSync(manifestFile)) {
        let manifest = await fs.readFile(manifestFile, 'utf-8');
        if (!manifest.includes('android:name=".MainApplication"')) {
            manifest = manifest.replace('<application', '<application\n        android:name=".MainApplication"');
            await fs.writeFile(manifestFile, manifest);
        }
    }

    // 3. Patch MainActivity
    const mainActivityPath = path.join(srcBase, 'MainActivity.kt');
    if (fs.existsSync(mainActivityPath)) {
        let content = await fs.readFile(mainActivityPath, 'utf-8');
        if (!content.includes('@AndroidEntryPoint')) {
            content = content.replace('import android.os.Bundle', 'import android.os.Bundle\nimport dagger.hilt.android.AndroidEntryPoint');
            content = content.replace('class MainActivity', '@AndroidEntryPoint\nclass MainActivity');
            await fs.writeFile(mainActivityPath, content);
        }
    }
}

function toToml(val: any): string {
    if (typeof val === 'string') return `"${val}"`;
    const entries = Object.entries(val).map(([k, v]) => `${k} = "${v}"`);
    return `{ ${entries.join(', ')} }`;
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
