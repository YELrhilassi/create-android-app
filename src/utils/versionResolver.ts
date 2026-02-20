import { logger } from './logger.js';

interface Artifact {
    group: string;
    name: string;
    stableOnly?: boolean;
}

export class VersionResolver {
    private static GOOGLE_MAVEN = 'https://dl.google.com/dl/android/maven2';
    private static MAVEN_CENTRAL = 'https://repo1.maven.org/maven2';

    static async getLatestVersion(artifact: Artifact): Promise<string | null> {
        const path = `${artifact.group.replace(/\./g, '/')}/${artifact.name}/maven-metadata.xml`;
        
        // Try Google Maven first, then Maven Central
        let version = await this.fetchFromRepo(this.GOOGLE_MAVEN, path, artifact.stableOnly);
        if (!version) {
            version = await this.fetchFromRepo(this.MAVEN_CENTRAL, path, artifact.stableOnly);
        }

        return version;
    }

    static async getRemoteDefaults(): Promise<Record<string, string>> {
        const url = 'https://raw.githubusercontent.com/YELrhilassi/create-android-app/main/versions-fallback.json';
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            // Silently fail, will use local constants
        }
        return {};
    }

    static async getLatestKspVersion(kotlinVersion: string): Promise<string | null> {
        const group = 'com.google.devtools.ksp';
        const name = 'com.google.devtools.ksp.gradle.plugin';
        const path = `${group.replace(/\./g, '/')}/${name}/maven-metadata.xml`;
        
        // Try Maven Central for KSP, then Google Maven
        let version = await this.fetchFromRepo(this.MAVEN_CENTRAL, path, true, kotlinVersion);
        if (!version) {
            version = await this.fetchFromRepo(this.GOOGLE_MAVEN, path, true, kotlinVersion);
        }

        return version;
    }

    private static async fetchFromRepo(repo: string, path: string, stableOnly: boolean = true, prefix?: string): Promise<string | null> {
        try {
            const response = await fetch(`${repo}/${path}`);
            if (!response.ok) return null;

            const text = await response.text();
            const versionsMatch = text.match(/<version>([^<]+)<\/version>/g);
            if (!versionsMatch) return null;

            let versions = versionsMatch
                .map(v => v.replace(/<\/?version>/g, ''))
                .filter(v => !stableOnly || this.isStable(v));

            if (prefix) {
                versions = versions.filter(v => v.startsWith(prefix));
            }

            if (versions.length === 0 && stableOnly) {
                // Fallback to latest even if not stable if no stable found
                return this.fetchFromRepo(repo, path, false, prefix);
            }

            return versions[versions.length - 1] || null;
        } catch (e) {
            return null;
        }
    }

    private static isStable(version: string): boolean {
        const lower = version.toLowerCase();
        return !lower.includes('alpha') && 
               !lower.includes('beta') && 
               !lower.includes('rc') && 
               !lower.includes('dev') && 
               !lower.includes('snapshot');
    }

    static async resolveAll(artifacts: Record<string, Artifact>): Promise<Record<string, string>> {
        const results: Record<string, string> = {};
        const promises = Object.entries(artifacts).map(async ([key, artifact]) => {
            const version = await this.getLatestVersion(artifact);
            if (version) {
                results[key] = version;
            } else {
                logger.warn(`Failed to resolve version for ${artifact.group}:${artifact.name}`);
            }
        });

        await Promise.all(promises);
        return results;
    }
}
