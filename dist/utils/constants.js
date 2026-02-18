// The "Truth" - Pinned versions for stability
export const CONSTANTS = {
    // Tooling
    JAVA_VERSION_REQ: 17,
    NODE_VERSION_REQ: 18,
    // Android SDK
    CMDLINE_TOOLS_URL_LINUX: "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip",
    CMDLINE_TOOLS_URL_MAC: "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip",
    SDK_PACKAGES: [
        "platform-tools",
        "platforms;android-34",
        "build-tools;34.0.0",
        "cmdline-tools;latest"
    ],
    // Template Defaults
    COMPILE_SDK: 34,
    TARGET_SDK: 34,
    MIN_SDK: 24,
    KOTLIN_VERSION: "1.9.23",
    COMPOSE_COMPILER_EXTENSION_VERSION: "1.5.11",
    AGP_VERSION: "8.3.2",
    // Gradle
    GRADLE_VERSION: "8.7"
};
