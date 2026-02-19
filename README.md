# create-droid 🤖

The fastest way to start an Android project. No Studio required.

[![npm version](https://img.shields.io/npm/v/create-droid.svg)](https://www.npmjs.com/package/create-droid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

Most Android tutorials assume you want to download a 2GB IDE just to write "Hello World".
Modern web developers are used to tools like `create-react-app` or `vite` – simple, fast, and CLI-first.

**`create-droid` brings that DX to Android.**

*   **⚡️ Fast:** Scaffolds a project in seconds.
*   **🚫 No Studio Required:** Fully functional Gradle builds out of the box.
*   **🛠 Local SDK Management:** Auto-downloads and configures the Android SDK locally (no global pollution).
*   **💎 Modern Stack:** Kotlin DSL, Version Catalogs (`libs.versions.toml`), Jetpack Compose, and Material 3 by default.
*   **🐧 Linux & Mac First:** Designed for terminal-centric workflows.

## Prerequisites

*   **Node.js**: >= 18.0.0
*   **Java (JDK)**: >= 17 (Run `java -version` to check)

## Usage

Simply run:

```bash
npm create droid my-app
# or
npx create-droid my-app
```

Follow the interactive prompts:
1.  **Project Name**: Defaults to directory name.
2.  **Template Selection**:
    *   **Jetpack Compose (Mobile)**: Modern phone/tablet starter.
    *   **Compose with Navigation**: Includes Navigation, BottomBar, and multi-screen setup.
    *   **Compose for TV**: Optimized for Android TV with `tv-material`.
    *   **Compose Library**: Foundation for publishing reusable UI components.
    *   **XML Views (Legacy)**: For maintenance or classic development.

### After Scaffolding

```bash
cd my-app

# Start "Live Reload" mode (Continuous Build)
# Edits will auto-compile and install on your connected device!
npm run dev

# Or build manually
npm run build
```

## What's Inside?

The generated project is **clean** and follows modern best practices. It includes a `package.json` with convenience scripts:

*   `npm run dev`: High-speed development loop. Watches code and auto-deploys via `--continuous` and `--configuration-cache`.
*   `npm run build`: Generates a production release APK.
*   `npm run clean:deep`: Purges all build artifacts and Gradle cache to reclaim disk space.
*   `npm test`: Runs unit tests.

### 📱 ADB Scripts (Wireless Debugging)

We include a robust `adb` wrapper that works even if `adb` is not in your PATH (uses the local SDK):

*   `npm run adb:devices`: List connected devices.
*   `npm run adb:connect <ip>`: Connect to a device via Wi-Fi.
*   `npm run adb:pair <ip> <code>`: Pair a new device (Android 11+).
*   `npm run adb:logcat`: View device logs.

```text
my-app/
├── app/
│   ├── src/main/java/com/example/  # Your Kotlin source code
│   └── build.gradle.kts            # App module configuration
├── gradle/
│   └── libs.versions.toml          # Central dependency management
├── build.gradle.kts                # Root project configuration
├── settings.gradle.kts             # Module inclusion
├── gradlew                         # The Gradle wrapper (runs builds)
└── local.properties                # SDK location (auto-generated)
```

## Advanced

### Customizing the SDK Location

By default, the SDK is installed to `~/.local/share/create-android-app/sdk`.
If you already have an SDK installed, simply set the environment variable:

```bash
export ANDROID_HOME=/path/to/existing/sdk
npm create droid my-app
```

## License

MIT © YELrhilassi
