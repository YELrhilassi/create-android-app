// The "Truth" - Pinned versions for stability (and fallbacks)

export const CONSTANTS = {
  // Tooling
  JAVA_VERSION_REQ: 17,
  NODE_VERSION_REQ: 18,
  
  // Android SDK
  CMDLINE_TOOLS_URL_LINUX: "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip",
  CMDLINE_TOOLS_URL_MAC: "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip",
  
  SDK_PACKAGES: [
    "platform-tools",
    "platforms;android-35",
    "build-tools;35.0.0",
    "cmdline-tools;latest"
  ],

  // Default dependency versions (used as fallbacks if resolution fails)
  DEFAULTS: {
    AGP_VERSION: "8.8.0",
    KOTLIN_VERSION: "2.1.0",
    CORE_KTX_VERSION: "1.15.0",
    JUNIT_VERSION: "4.13.2",
    JUNIT_ANDROIDX_VERSION: "1.2.1",
    ESPRESSO_CORE_VERSION: "3.6.1",
    LIFECYCLE_RUNTIME_KTX_VERSION: "2.8.7",
    ACTIVITY_COMPOSE_VERSION: "1.10.0",
    COMPOSE_BOM_VERSION: "2025.02.00",
    APPCOMPAT_VERSION: "1.7.0",
    MATERIAL_VERSION: "1.12.0",
    NAVIGATION_COMPOSE_VERSION: "2.8.7",
    TV_FOUNDATION_VERSION: "1.0.0-alpha12",
    TV_MATERIAL_VERSION: "1.0.0",
    CONSTRAINTLAYOUT_VERSION: "2.2.0",
    COMPILE_SDK: "35",
    TARGET_SDK: "35",
    MIN_SDK: "24",
    GRADLE_VERSION: "8.12",
  }
};
