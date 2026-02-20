import prompts from 'prompts';
import { logger } from './utils/logger.js';
import { checkEnv } from './env/checkEnv.js';
import { installSdk } from './sdk/installSdk.js';
import { generateProject } from './template/generateProject.js';
import { setupGradle } from './gradle/setupGradle.js';
import { AddonManager } from './template/addonManager.js';
import path from 'path';
import fs from 'fs-extra';
export async function run(args) {
    const command = args[0];
    if (command === 'install' || command === 'add') {
        const pkgName = args[1];
        await handleInstall(pkgName);
        return;
    }
    logger.banner();
    // 1. Collect Input
    let targetDir = args[0];
    const defaultProjectName = targetDir || 'android-app';
    const response = await prompts([
        {
            type: targetDir ? null : 'text',
            name: 'projectName',
            message: 'Project name:',
            initial: defaultProjectName
        },
        {
            type: 'select',
            name: 'uiType',
            message: 'Select Template:',
            choices: [
                { title: 'Jetpack Compose (Mobile)', value: 'compose', description: 'Recommended for phone/tablet apps' },
                { title: 'Compose with Navigation', value: 'mobile-compose-navigation', description: 'Includes Navigation, BottomBar, Screens' },
                { title: 'Compose for TV', value: 'tv-compose', description: 'Optimized for Android TV (Leanback)' },
                { title: 'Compose Library', value: 'compose-library', description: 'Scaffold for publishing UI libraries' },
                { title: 'XML Views (Legacy)', value: 'views', description: 'Classic View-based Android development' }
            ],
            initial: 0
        },
        {
            type: 'multiselect',
            name: 'libraries',
            message: 'Select Additional Libraries:',
            choices: [
                { title: 'Coil', value: 'coil', description: 'Image loading for Compose' },
                { title: 'Hilt', value: 'hilt', description: 'Dependency Injection (includes KSP & App setup)' },
                { title: 'Retrofit', value: 'retrofit', description: 'Type-safe HTTP client' },
                { title: 'Ktor Client', value: 'ktor', description: 'Multiplatform HTTP client' },
                { title: 'Kotlinx Serialization', value: 'serialization', description: 'Kotlin JSON serialization' },
                { title: 'Room Database', value: 'room', description: 'SQLite object mapping library' },
                { title: 'DataStore', value: 'datastore', description: 'Modern alternative to SharedPreferences' }
            ],
            instructions: false
        }
    ], {
        onCancel: () => {
            logger.error('Operation cancelled');
            process.exit(0);
        }
    });
    const projectName = response.projectName || targetDir;
    const projectPath = path.resolve(process.cwd(), projectName);
    const uiType = response.uiType;
    const selectedLibs = response.libraries || [];
    // 2. Validate Environment
    logger.step('Checking Environment...');
    await checkEnv();
    // 3. Setup Android SDK
    logger.step('Setting up Android SDK...');
    const sdkPath = await installSdk();
    // 4. Generate Project Files
    logger.step(`Scaffolding project in ${projectName}...`);
    await generateProject({
        projectPath,
        projectName,
        uiType,
        sdkPath,
        libraries: selectedLibs
    });
    // 5. Setup Gradle Wrapper
    logger.step('Configuring Gradle...');
    await setupGradle(projectPath);
    logger.success(`Project created at ${projectPath}`);
    logger.info('To get started:');
    console.log(`  cd ${projectName}`);
    console.log(`  ./gradlew installDebug`);
    console.log(`  npm run add  # to add more libraries`);
}
async function handleInstall(pkgName) {
    const projectPath = process.cwd();
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        logger.error('Not a create-droid project (no package.json found).');
        process.exit(1);
    }
    const packageJson = await fs.readJSON(packageJsonPath);
    const projectName = packageJson.name;
    // Determine module name (check if 'library' or 'app' dir exists)
    const moduleName = fs.existsSync(path.join(projectPath, 'library')) ? 'library' : 'app';
    // Resolve package name from build.gradle.kts
    const buildFile = path.join(projectPath, moduleName, 'build.gradle.kts');
    if (!fs.existsSync(buildFile)) {
        logger.error(`Could not find build.gradle.kts in ${moduleName} module.`);
        process.exit(1);
    }
    const buildContent = await fs.readFile(buildFile, 'utf-8');
    const namespaceMatch = buildContent.match(/namespace = "(.*)"/);
    if (!namespaceMatch) {
        logger.error('Could not determine project package name from build.gradle.kts.');
        process.exit(1);
    }
    const packageName = namespaceMatch[1];
    const addonManager = new AddonManager(projectPath, moduleName, packageName);
    if (!pkgName) {
        // Interactive selection if no package name provided
        const response = await prompts({
            type: 'select',
            name: 'pkg',
            message: 'Select package to install:',
            choices: [
                { title: 'Coil', value: 'coil' },
                { title: 'Hilt', value: 'hilt' },
                { title: 'Retrofit', value: 'retrofit' },
                { title: 'Ktor', value: 'ktor' },
                { title: 'Serialization', value: 'serialization' },
                { title: 'Room', value: 'room' },
                { title: 'DataStore', value: 'datastore' }
            ]
        });
        if (response.pkg)
            await addonManager.install(response.pkg);
    }
    else {
        await addonManager.install(pkgName);
    }
}
