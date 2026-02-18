import prompts from 'prompts';
import { logger } from './utils/logger.js';
import { checkEnv } from './env/checkEnv.js';
import { installSdk } from './sdk/installSdk.js';
import { generateProject } from './template/generateProject.js';
import { setupGradle } from './gradle/setupGradle.js';
import path from 'path';
export async function run(args) {
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
            message: 'Select UI Framework:',
            choices: [
                { title: 'Jetpack Compose (Recommended)', value: 'compose' },
                { title: 'XML Views (Legacy)', value: 'views' }
            ],
            initial: 0
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
        sdkPath
    });
    // 5. Setup Gradle Wrapper
    logger.step('Configuring Gradle...');
    await setupGradle(projectPath);
    logger.success(`Project created at ${projectPath}`);
    logger.info('To get started:');
    console.log(`  cd ${projectName}`);
    console.log(`  ./gradlew installDebug`);
}
