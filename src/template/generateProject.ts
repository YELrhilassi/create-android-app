import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

interface ProjectOptions {
  projectPath: string;
  projectName: string;
  uiType: 'compose' | 'views';
  sdkPath: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateProject(options: ProjectOptions) {
  const { projectPath, projectName, uiType, sdkPath } = options;
  
  // 1. Ensure target directory
  await fs.ensureDir(projectPath);

  // 2. Resolve template paths
  const templateRoot = path.resolve(__dirname, '../../templates');
  const baseTemplate = path.join(templateRoot, 'base');
  const uiTemplateName = uiType === 'compose' ? 'ui-compose' : 'ui-views';
  const uiTemplate = path.join(templateRoot, uiTemplateName);

  if (!fs.existsSync(baseTemplate)) {
    throw new Error(`Template not found at ${baseTemplate}`);
  }

  // 3. Copy Base
  logger.info(`Copying base template from ${baseTemplate}...`);
  await fs.copy(baseTemplate, projectPath);
  
  // Rename _gitignore to .gitignore
  const gitignorePath = path.join(projectPath, '_gitignore');
  if (fs.existsSync(gitignorePath)) {
      await fs.move(gitignorePath, path.join(projectPath, '.gitignore'));
  }

  // 4. Copy UI specific files
  if (fs.existsSync(uiTemplate)) {
    logger.info(`Applying ${uiType} template...`);
    await fs.copy(uiTemplate, projectPath, { overwrite: true });
  }

  // 5. Patch Configuration
  logger.info(`Patching configuration...`);
  
  const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Replace in settings.gradle.kts
  await patchFile(path.join(projectPath, 'settings.gradle.kts'), {
    '{{PROJECT_NAME}}': projectName,
  });

  // Replace in app/build.gradle.kts
  await patchFile(path.join(projectPath, 'app/build.gradle.kts'), {
    '{{APPLICATION_ID}}': packageName,
    '{{COMPILE_SDK}}': CONSTANTS.COMPILE_SDK.toString(),
    '{{MIN_SDK}}': CONSTANTS.MIN_SDK.toString(),
    '{{TARGET_SDK}}': CONSTANTS.TARGET_SDK.toString(),
  });
  
  // Replace in app/src/main/res/values/strings.xml
  await patchFile(path.join(projectPath, 'app/src/main/res/values/strings.xml'), {
    '{{PROJECT_NAME}}': projectName,
  });

  // Handle Source Code Relocation
  const srcBase = path.join(projectPath, 'app/src/main/java');
  const oldPackagePath = path.join(srcBase, 'com/example/template');
  const newPackagePath = path.join(srcBase, ...packageName.split('.'));

  if (fs.existsSync(oldPackagePath)) {
    await fs.move(oldPackagePath, newPackagePath, { overwrite: true });
    
    // Recursive file patching for package statement
    await patchSourceFiles(newPackagePath, packageName);
    
    // Clean up empty dirs (com/example/template -> com/example -> com)
    // Only if empty.
    await cleanEmptyDirs(srcBase);
  }

  // Create local.properties with SDK location
  const localProperties = `sdk.dir=${sdkPath}`;
  await fs.writeFile(path.join(projectPath, 'local.properties'), localProperties);

  // 6. Setup NPM Scripts (The "Vite-like" experience)
  logger.info('Adding npm convenience scripts...');
  const packageJson = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: "0.1.0",
    private: true,
    scripts: {
      "dev": "./gradlew -t installDebug",
      "start": "npm run dev",
      "build": "./gradlew assembleRelease",
      "build:debug": "./gradlew assembleDebug",
      "test": "./gradlew test",
      "lint": "./gradlew lint",
      "clean": "./gradlew clean",
      "help": "./gradlew --help"
    }
  };
  await fs.writeJSON(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });

  // 7. Initialize Git
  try {
    logger.info('Initializing git repository...');
    await execa('git', ['init'], { cwd: projectPath });
    await execa('git', ['add', '.'], { cwd: projectPath });
    await execa('git', ['commit', '-m', 'Initial commit via create-droid'], { cwd: projectPath });
    logger.success('Git repository initialized.');
  } catch (e) {
    logger.warn('Failed to initialize git repository. You may need to run "git init" manually.');
  }
}

async function patchFile(filePath: string, replacements: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;
  let content = await fs.readFile(filePath, 'utf-8');
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(key, value);
  }
  await fs.writeFile(filePath, content);
}

async function patchSourceFiles(dir: string, packageName: string) {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            await patchSourceFiles(fullPath, packageName);
        } else if (file.endsWith('.kt') || file.endsWith('.java')) {
            await patchFile(fullPath, {
                '{{PACKAGE_NAME}}': packageName
            });
        }
    }
}

async function cleanEmptyDirs(dir: string) {
    // Basic cleanup: remove com/example/template if empty
    // We moved content from com/example/template to new path.
    // So we check if com/example/template is empty, then com/example, then com.
    
    // This is tricky because we don't know the exact depth of the old structure easily without hardcoding.
    // Hardcoded for "com/example/template":
    const oldPath = path.join(dir, 'com/example/template');
    try {
        if (fs.existsSync(oldPath) && (await fs.readdir(oldPath)).length === 0) {
            await fs.rmdir(oldPath);
            const parent = path.dirname(oldPath);
            if ((await fs.readdir(parent)).length === 0) {
                await fs.rmdir(parent);
                const grandParent = path.dirname(parent);
                if ((await fs.readdir(grandParent)).length === 0) {
                    await fs.rmdir(grandParent);
                }
            }
        }
    } catch (e) {
        // Ignore errors during cleanup
    }
}
