import prompts from 'prompts';
import { logger } from './utils/logger.js';
import { checkEnv } from './env/checkEnv.js';
import { installSdk } from './sdk/installSdk.js';
import { generateProject } from './template/generateProject.js';
import { setupGradle } from './gradle/setupGradle.js';
import path from 'path';

export async function run(args: string[]) {
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
            { title: 'Retrofit', value: 'retrofit', description: 'Type-safe HTTP client' },
            { title: 'Hilt', value: 'hilt', description: 'Dependency Injection (includes KSP & App setup)' },
            { title: 'Ktor Client', value: 'ktor', description: 'Multiplatform HTTP client' },
            { title: 'Kotlinx Serialization', value: 'serialization', description: 'Kotlin JSON serialization' },
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
}
