import { execa } from 'execa';
import { CONSTANTS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
export async function checkEnv() {
    // 1. Check Node
    const nodeVersion = process.version;
    const majorNodeVersion = parseInt(nodeVersion.replace(/^v/, ''), 10);
    if (majorNodeVersion < CONSTANTS.NODE_VERSION_REQ) {
        logger.error(`Node.js ${CONSTANTS.NODE_VERSION_REQ}+ required. Found ${nodeVersion}`);
        process.exit(1);
    }
    logger.success(`Node.js ${nodeVersion}`);
    // 2. Check Java
    try {
        const { stdout, stderr } = await execa('java', ['-version']);
        const output = stdout || stderr;
        // Matches "1.8.0_...", "11.0.1", "17.0.1", "21", etc.
        const versionMatch = output.match(/(?:version\s+"?|(\d+)\.)(\d+)/i);
        let majorVersion = 0;
        if (versionMatch) {
            if (versionMatch[1] === '1') {
                majorVersion = parseInt(versionMatch[2], 10); // Handle 1.8.x
            }
            else {
                majorVersion = parseInt(versionMatch[1] || versionMatch[0].match(/\d+/)?.[0] || "0", 10);
            }
        }
        // Fallback simple match if regex above is too complex
        if (majorVersion === 0) {
            const simpleMatch = output.match(/(\d+)\.\d+\.\d+/);
            if (simpleMatch)
                majorVersion = parseInt(simpleMatch[1], 10);
        }
        if (majorVersion >= CONSTANTS.JAVA_VERSION_REQ) {
            logger.success(`Java version ${majorVersion} detected.`);
        }
        else {
            logger.error(`Java ${CONSTANTS.JAVA_VERSION_REQ}+ required. Found version ${majorVersion || 'unknown'}.`);
            logger.info(`Output: ${output.split('\n')[0]}`);
            process.exit(1);
        }
    }
    catch (e) {
        logger.error(`Java runtime not found. Please install JDK ${CONSTANTS.JAVA_VERSION_REQ}+.`);
        logger.info(`Download: https://adoptium.net/temurin/releases/`);
        process.exit(1);
    }
    // 3. Check Git
    try {
        await execa('git', ['--version']);
        logger.success('Git detected.');
    }
    catch (e) {
        logger.warn('Git not found. Project will be generated without git initialization.');
    }
}
