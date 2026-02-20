import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface AddonStep {
    type: 'toml_version' | 'toml_library' | 'toml_plugin' | 'gradle_plugin_root' | 'gradle_plugin_module' | 'gradle_implementation' | 'gradle_ksp' | 'patch_file' | 'create_file';
    key?: string;
    value?: string;
    file?: string;
    pattern?: string;
    replacement?: string;
    content?: string;
}

export interface AddonRecipe {
    name: string;
    description: string;
    dependencies?: string[];
    steps: AddonStep[];
}

export class AddonManager {
    constructor(
        private projectPath: string, 
        private moduleName: string, 
        private packageName: string,
        private versions: Record<string, string> = {}
    ) {}

    async install(recipeName: string) {
        const recipe = await this.resolveRecipe(recipeName);
        if (!recipe) {
            logger.error(`Recipe not found: ${recipeName}`);
            return;
        }

        logger.info(`Installing addon: ${recipe.name}...`);
        
        if (recipe.dependencies) {
            for (const dep of recipe.dependencies) {
                await this.install(dep);
            }
        }

        for (const step of recipe.steps) {
            try {
                // Apply version patches to step values
                const patchedStep = { ...step };
                if (patchedStep.value) patchedStep.value = this.applyPatches(patchedStep.value);
                if (patchedStep.replacement) patchedStep.replacement = this.applyPatches(patchedStep.replacement);
                if (patchedStep.content) patchedStep.content = this.applyPatches(patchedStep.content);

                await this.executeStep(patchedStep);
            } catch (e: any) {
                logger.warn(`Failed to execute step for ${recipe.name}: ${e.message}`);
            }
        }
    }

    private applyPatches(val: string): string {
        let result = val;
        for (const [key, version] of Object.entries(this.versions)) {
            const placeholder = key.startsWith('{{') ? key : `{{${key}}}`;
            result = result.replaceAll(placeholder, version);
        }
        return result;
    }

    private async executeStep(step: AddonStep) {
        const tomlPath = path.join(this.projectPath, 'gradle', 'libs.versions.toml');
        const buildFile = path.join(this.projectPath, this.moduleName, 'build.gradle.kts');
        const rootBuildFile = path.join(this.projectPath, 'build.gradle.kts');

        switch (step.type) {
            case 'toml_version':
                await this.updateTomlSection(tomlPath, '[versions]', `${step.key} = "${step.value}"`);
                break;
            case 'toml_library':
                await this.updateTomlSection(tomlPath, '[libraries]', `${step.key} = ${this.formatTomlValue(step.value!)}`);
                break;
            case 'toml_plugin':
                await this.updateTomlSection(tomlPath, '[plugins]', `${step.key} = ${this.formatTomlValue(step.value!)}`);
                break;
            case 'gradle_plugin_root':
                await this.patchFile(rootBuildFile, 'plugins {', `plugins {\n    alias(libs.plugins.${step.key!.replace(/-/g, '.')}) apply false`);
                break;
            case 'gradle_plugin_module':
                await this.patchFile(buildFile, 'plugins {', `plugins {\n    alias(libs.plugins.${step.key!.replace(/-/g, '.')})`);
                break;
            case 'gradle_implementation':
                await this.patchFile(buildFile, 'dependencies {', `dependencies {\n    implementation(${step.value})`);
                break;
            case 'gradle_ksp':
                await this.patchFile(buildFile, 'dependencies {', `dependencies {\n    ksp(${step.value})`);
                break;
            case 'patch_file':
                const targetFile = path.join(this.projectPath, this.resolvePath(step.file!));
                await this.patchFile(targetFile, step.pattern!, step.replacement!);
                break;
            case 'create_file':
                const newFilePath = path.join(this.projectPath, this.resolvePath(step.file!));
                const content = step.content!.replace(/{{PACKAGE_NAME}}/g, this.packageName);
                await fs.ensureDir(path.dirname(newFilePath));
                await fs.writeFile(newFilePath, content);
                break;
        }
    }

    private resolvePath(p: string): string {
        return p.replace('{{MODULE}}', this.moduleName)
                .replace('{{PACKAGE_PATH}}', this.packageName.replace(/\./g, '/'));
    }

    private async updateTomlSection(filePath: string, section: string, line: string) {
        if (!fs.existsSync(filePath)) return;
        let content = await fs.readFile(filePath, 'utf-8');
        const key = line.split('=')[0].trim();
        
        const sectionIndex = content.indexOf(section);
        if (sectionIndex === -1) return;
        
        const nextSectionIndex = content.indexOf('[', sectionIndex + section.length);
        const sectionContent = nextSectionIndex === -1 
            ? content.substring(sectionIndex) 
            : content.substring(sectionIndex, nextSectionIndex);
            
        const keyRegex = new RegExp(`^${key}\\s*=`, 'm');
        if (keyRegex.test(sectionContent)) return;

        content = content.replace(section, `${section}\n${line}`);
        await fs.writeFile(filePath, content);
    }

    private async patchFile(filePath: string, pattern: string, replacement: string) {
        if (!fs.existsSync(filePath)) return;
        let content = await fs.readFile(filePath, 'utf-8');
        if (content.includes(replacement.trim())) return;

        content = content.replace(pattern, replacement);
        await fs.writeFile(filePath, content);
    }

    private formatTomlValue(val: string): string {
        if (val.startsWith('{')) return val;
        return `"${val}"`;
    }

    private async resolveRecipe(name: string): Promise<AddonRecipe | null> {
        if (BUILTIN_RECIPES[name]) return BUILTIN_RECIPES[name];
        
        try {
            const url = `https://raw.githubusercontent.com/YELrhilassi/create-android-app/main/addons/${name}.json`;
            const response = await fetch(url);
            if (response.ok) {
                return await response.json() as AddonRecipe;
            }
        } catch (e) {}
        
        return null;
    }
}

export const BUILTIN_RECIPES: Record<string, AddonRecipe> = {
    coil: {
        name: 'coil',
        description: 'Image loading for Compose',
        steps: [
            { type: 'toml_version', key: 'coil', value: '2.6.0' },
            { type: 'toml_library', key: 'androidx-coil', value: 'io.coil-kt:coil-compose:2.6.0' },
            { type: 'gradle_implementation', value: 'libs.androidx.coil' }
        ]
    },
    hilt: {
        name: 'hilt',
        description: 'Dependency Injection',
        dependencies: ['ksp'],
        steps: [
            { type: 'toml_version', key: 'hilt', value: '2.51.1' },
            { type: 'toml_plugin', key: 'hilt', value: '{ id = "com.google.dagger.hilt.android", version = "2.51.1" }' },
            { type: 'toml_library', key: 'hilt-android', value: '{ group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }' },
            { type: 'toml_library', key: 'hilt-compiler', value: '{ group = "com.google.dagger", name = "hilt-compiler", version.ref = "hilt" }' },
            { type: 'gradle_plugin_root', key: 'hilt' },
            { type: 'gradle_plugin_module', key: 'hilt' },
            { type: 'gradle_implementation', value: 'libs.hilt.android' },
            { type: 'gradle_ksp', value: 'libs.hilt.compiler' },
            {
                type: 'create_file',
                file: '{{MODULE}}/src/main/kotlin/{{PACKAGE_PATH}}/MainApplication.kt',
                content: 'package {{PACKAGE_NAME}}\n\nimport android.app.Application\nimport dagger.hilt.android.HiltAndroidApp\n\n@HiltAndroidApp\nclass MainApplication : Application()'
            },
            {
                type: 'patch_file',
                file: '{{MODULE}}/src/main/AndroidManifest.xml',
                pattern: '<application',
                replacement: '<application\n        android:name=".MainApplication"'
            },
            {
                type: 'patch_file',
                file: '{{MODULE}}/src/main/kotlin/{{PACKAGE_PATH}}/MainActivity.kt',
                pattern: 'import android.os.Bundle',
                replacement: 'import android.os.Bundle\nimport dagger.hilt.android.AndroidEntryPoint'
            },
            {
                type: 'patch_file',
                file: '{{MODULE}}/src/main/kotlin/{{PACKAGE_PATH}}/MainActivity.kt',
                pattern: 'class MainActivity',
                replacement: '@AndroidEntryPoint\nclass MainActivity'
            }
        ]
    },
    ksp: {
        name: 'ksp',
        description: 'Kotlin Symbol Processing',
        steps: [
            { type: 'toml_version', key: 'ksp', value: '{{KSP_VERSION}}' },
            { type: 'toml_plugin', key: 'ksp', value: '{ id = "com.google.devtools.ksp", version.ref = "ksp" }' },
            { type: 'gradle_plugin_root', key: 'ksp' },
            { type: 'gradle_plugin_module', key: 'ksp' }
        ]
    },
    retrofit: {
        name: 'retrofit',
        description: 'HTTP Client',
        steps: [
            { type: 'toml_version', key: 'retrofit', value: '{{RETROFIT_VERSION}}' },
            { type: 'toml_library', key: 'retrofit', value: 'com.squareup.retrofit2:retrofit:{{RETROFIT_VERSION}}' },
            { type: 'toml_library', key: 'converter-gson', value: 'com.squareup.retrofit2:converter-gson:{{RETROFIT_VERSION}}' },
            { type: 'gradle_implementation', value: 'libs.retrofit' },
            { type: 'gradle_implementation', value: 'libs.converter.gson' }
        ]
    },
    ktor: {
        name: 'ktor',
        description: 'Multiplatform HTTP Client',
        steps: [
            { type: 'toml_version', key: 'ktor', value: '{{KTOR_VERSION}}' },
            { type: 'toml_library', key: 'ktor-client-core', value: 'io.ktor:ktor-client-core:{{KTOR_VERSION}}' },
            { type: 'toml_library', key: 'ktor-client-okhttp', value: 'io.ktor:ktor-client-okhttp:{{KTOR_VERSION}}' },
            { type: 'gradle_implementation', value: 'libs.ktor.client.core' },
            { type: 'gradle_implementation', value: 'libs.ktor.client.okhttp' }
        ]
    },
    serialization: {
        name: 'serialization',
        description: 'Kotlin Serialization',
        steps: [
            { type: 'toml_plugin', key: 'kotlin-serialization', value: '{ id = "org.jetbrains.kotlin.plugin.serialization", version = "{{KOTLIN_VERSION}}" }' },
            { type: 'toml_library', key: 'kotlinx-serialization-json', value: 'org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3' },
            { type: 'gradle_plugin_root', key: 'kotlin-serialization' },
            { type: 'gradle_plugin_module', key: 'kotlin-serialization' },
            { type: 'gradle_implementation', value: 'libs.kotlinx.serialization.json' }
        ]
    },
    datastore: {
        name: 'datastore',
        description: 'DataStore Preferences',
        steps: [
            { type: 'toml_version', key: 'datastore', value: '1.1.1' },
            { type: 'toml_library', key: 'androidx-datastore-preferences', value: 'androidx.datastore:datastore-preferences:1.1.1' },
            { type: 'gradle_implementation', value: 'libs.androidx.datastore.preferences' }
        ]
    },
    room: {
        name: 'room',
        description: 'Room Database',
        dependencies: ['ksp'],
        steps: [
            { type: 'toml_version', key: 'room', value: '2.6.1' },
            { type: 'toml_library', key: 'androidx-room-runtime', value: '{ group = "androidx.room", name = "room-runtime", version.ref = "room" }' },
            { type: 'toml_library', key: 'androidx-room-compiler', value: '{ group = "androidx.room", name = "room-compiler", version.ref = "room" }' },
            { type: 'toml_library', key: 'androidx-room-ktx', value: '{ group = "androidx.room", name = "room-ktx", version.ref = "room" }' },
            { type: 'gradle_implementation', value: 'libs.androidx.room.runtime' },
            { type: 'gradle_implementation', value: 'libs.androidx.room.ktx' },
            { type: 'gradle_ksp', value: 'libs.androidx.room.compiler' }
        ]
    }
};
