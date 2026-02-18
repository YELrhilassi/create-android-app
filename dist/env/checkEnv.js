import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
export async function checkEnv() {
    // 1. Check Node
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v' + CONSTANTS.NODE_VERSION_REQ) && parseInt(nodeVersion.substring(1)) < CONSTANTS.NODE_VERSION_REQ) {
        logger.error(`Node.js ${CONSTANTS.NODE_VERSION_REQ}+ required. Found ${nodeVersion}`);
        process.exit(1);
    }
    logger.success(`Node.js ${nodeVersion}`);
    // 2. Check Java (Robust Regex)
    try {
        const { stdout, stderr } = await execa('java', ['-version']);
        const output = stdout || stderr; // Java version often prints to stderr
        // Regex to capture major version: "version \"17.0.1\"" or "17.0.1"
        const versionMatch = output.match(/version\s+"?(\d+)/i);
        if (versionMatch && versionMatch[1]) {
            const majorVersion = parseInt(versionMatch[1], 10);
            if (majorVersion >= CONSTANTS.JAVA_VERSION_REQ) {
                logger.success(`Java version ${majorVersion} detected.`);
                return;
            }
            else {
                logger.error(`Java ${CONSTANTS.JAVA_VERSION_REQ}+ required. Found version ${majorVersion}.`);
            }
        }
        else {
            logger.warn(`Could not parse Java version from output: ${output}`);
            logger.warn(`Assuming compatible if "17" or "21" is present...`);
            if (!output.includes('17') && !output.includes('21')) {
                logger.error(`Java 17+ required. Please verify your installation.`);
                process.exit(1);
            }
        }
    }
    catch (e) {
        logger.error(`Java runtime not found. Please install JDK 17+.`);
        logger.info(`Download: https://adoptium.net/temurin/releases/`);
        process.exit(1);
    }
}
