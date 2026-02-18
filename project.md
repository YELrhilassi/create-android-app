# Project: create-android-app (CAA)

## 🎯 Mission Statement
Build a production-grade, CLI-first, IDE-agnostic Android project scaffolder. Like `npm create vite`, but for Android.
The tool must be fast, idempotent, and produce a modern, inspectable Android project without requiring Android Studio.
**Target Platforms:** Linux and macOS only.

## 🧠 Core Philosophy
1.  **Dependency Lite:** Only requires Node.js (>=18) and JDK (>=17).
2.  **No Magic:** Explicit configuration, standard Gradle files, no hidden scripts.
3.  **Local First:** SDK tools are installed locally to `~/.local/share/create-android-app/sdk` by default (unless `ANDROID_HOME` is set).
4.  **Modern Defaults:** Kotlin DSL (`.kts`), Version Catalogs (`libs.versions.toml`), Jetpack Compose, and Material 3.

## 🏗️ Architecture

### Tech Stack
-   **Runtime:** Node.js (>=18)
-   **Language:** TypeScript
-   **Package Manager:** npm (or pnpm/yarn via `npx`)
-   **Key Libraries:**
    -   `execa`: For robust shell execution.
    -   `prompts`: For interactive user input.
    -   `kleur`: For minimal, colorful terminal output.
    -   `fs-extra`: For filesystem operations.
    -   `tar` / `unzip`: Standard system tools for extraction.

### Directory Structure
```
create-android-app/
├── bin/
│   └── cli.js              # Executable entry point
├── src/
│   ├── index.ts            # Main orchestrator
│   ├── env/                # Environment checks (Java, Node)
│   ├── sdk/                # Android SDK management (POSIX paths only)
│   ├── gradle/             # Gradle wrapper & config generation
│   ├── template/           # Template copying and variable substitution
│   ├── utils/              # Logger, constants, helpers
│   └── types.ts            # Type definitions
├── templates/
│   ├── base/               # The "skeleton" (gradle files, manifest, gitignore)
│   ├── app-common/         # Common app code (Application class, theme)
│   ├── ui-compose/         # Compose-specific Activity and UI
│   └── ui-views/           # (Optional) View-based Activity and layouts
├── package.json
├── tsconfig.json
└── README.md
```

## 📦 Deliverables & Features

### 1. Environment Validation
-   [ ] **Check Node.js:** Verify version >= 18.
-   [ ] **Check Java:** verify `java -version` contains "17" or higher.
-   [ ] **Check OS:** Reject Windows.

### 2. Android SDK Bootstrapping
-   [ ] **Detection:** Check `ANDROID_HOME`.
-   [ ] **Fallback:** `~/.local/share/create-android-app/sdk`.
-   [ ] **Download:** Fetch `commandlinetools` zip from official Google source.
-   [ ] **Install:** Use `sdkmanager` (shell script) to install packages.
-   [ ] **Licenses:** Auto-accept licenses via `yes | sdkmanager --licenses`.

### 3. Template Generation
-   [ ] **Base:** Generates a root project with `settings.gradle.kts` and `build.gradle.kts`.
-   [ ] **App Module:** Creates `app/` directory with standard structure.
-   [ ] **Configuration:**
    -   Replace `{{PACKAGE_NAME}}` in files.
    -   Relocate source files to package path.

### 4. Gradle Integration
-   [ ] **Wrapper:** Download `gradle-wrapper.jar` and `gradlew` (shell script only).
-   [ ] **Permissions:** Ensure `chmod +x gradlew`.
-   [ ] **Verification:** Run `./gradlew assembleDebug --dry-run`.

## 📝 Configuration Constants (The "Truth")

```typescript
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
```

## 🚀 Execution Plan

1.  **Init:** Scaffolding the Node.js project (package.json, tsconfig).
2.  **Core:** Implement the `Command` class pattern and `Logger`.
3.  **Env:** Implement `EnvChecker`.
4.  **SDK:** Implement `SdkManager` (Download -> Extract -> Install).
5.  **Template:** Create the file assets for `templates/base` and `templates/ui-compose`.
6.  **Generator:** Implement the logic to copy and patch templates.
7.  **Integration:** Wire it all together in `index.ts`.
8.  **Verify:** Run the tool against itself to generate a sample app.
