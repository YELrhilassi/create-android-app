import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { AddonManager } from './addonManager.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function generateProject(options) {
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
    }
    else {
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
        const addonManager = new AddonManager(projectPath, moduleName, packageName);
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
    }
    catch (e) {
        logger.warn('Failed to initialize git repository.');
    }
}
async function patchFile(filePath, replacements) {
    if (!fs.existsSync(filePath))
        return;
    let content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    for (const [key, value] of Object.entries(replacements)) {
        if (content.includes(key)) {
            content = content.replaceAll(key, value);
            modified = true;
        }
    }
    if (modified)
        await fs.writeFile(filePath, content);
}
async function patchSourceFiles(dir, packageName, projectName) {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if ((await fs.stat(fullPath)).isDirectory()) {
            await patchSourceFiles(fullPath, packageName, projectName);
        }
        else if (file.endsWith('.kt') || file.endsWith('.java') || file.endsWith('.xml')) {
            await patchFile(fullPath, {
                '{{PACKAGE_NAME}}': packageName,
                '{{PROJECT_NAME}}': projectName,
                '{{APPLICATION_ID}}': packageName
            });
        }
    }
}
async function cleanEmptyDirs(dir) {
    let currentDir = dir;
    while (currentDir && currentDir !== path.dirname(currentDir)) {
        try {
            if (fs.existsSync(currentDir) && (await fs.readdir(currentDir)).length === 0) {
                await fs.remove(currentDir);
                currentDir = path.dirname(currentDir);
            }
            else
                break;
        }
        catch (e) {
            break;
        }
    }
}
