# Android build and development guide

The mobile client reuses the existing React application and Go API. Tauri compiles the Rust layer into an Android native library, while Gradle packages that library, the WebView runtime, Kotlin code, and frontend assets into an APK.

## Toolchain used by this project

| Component | Version or path | Purpose |
| --- | --- | --- |
| JDK | 17 | Runs Gradle and the Android Gradle Plugin |
| Android platform | API 36 | Compiles and targets current Android APIs |
| Build Tools | 36.0.0 | Packages, aligns, and verifies APK files |
| NDK | 29.0.13846066 | Compiles and links Rust native code for Android |
| Rust targets | aarch64, armv7, i686, x86_64 | Supports phones and emulators |
| Tauri CLI | 2.11.4 | Coordinates frontend, Rust, and Gradle builds |

This machine is configured with:

```text
JAVA_HOME=C:\Program Files\Java\jdk-17
ANDROID_HOME=C:\Users\tbs12\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=C:\Users\tbs12\AppData\Local\Android\Sdk
NDK_HOME=C:\Users\tbs12\AppData\Local\Android\Sdk\ndk\29.0.13846066
```

`platform-tools` and `cmdline-tools\latest\bin` are also present in the current user's `PATH`. Open a new terminal after changing user environment variables.

## Recreate the environment

1. Install a 64-bit JDK 17 and set `JAVA_HOME`.
2. Extract Google's Android command-line tools to:

   ```text
   %LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest
   ```

3. Accept licenses and install the pinned packages:

   ```powershell
   sdkmanager.bat --licenses
   sdkmanager.bat "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;29.0.13846066"
   ```

4. Install Rust Android standard libraries:

   ```powershell
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

5. Install JavaScript dependencies:

   ```powershell
   Set-Location desktop
   npm.cmd ci
   ```

The Android Gradle project is committed under `src-tauri/gen/android`, so normal clones do not need to run `tauri android init` again.

## Build an installable test APK

Run from `desktop`:

```powershell
npm.cmd run android:build:test
```

The script performs these steps:

1. Builds the React/Vite frontend.
2. Compiles optimized Rust for `aarch64-linux-android`.
3. Uses an ASCII-only Cargo cache because the repository path contains Chinese characters.
4. Copies the native library when Windows Developer Mode is disabled.
5. Cleans stale Gradle APK output before packaging, preventing incremental builds from retaining invalid trailing data.
6. Packages and signs an ARM64 test APK with Gradle's local Debug certificate.
7. Copies the final APK to:

   ```text
   desktop\output\Personal-Blog-v1.2.1-arm64-test.apk
   ```

The test APK supports Android 7.0 or later on ARM64 devices. It uses optimized native code but Android's standard Debug certificate, so it is suitable for direct installation and local testing, not public releases.
The current v1.2.1 APK is approximately 17 MB. A much larger result usually indicates stale Gradle output; the build helper now cleans that output automatically.

For a large build with full Rust debugging symbols, use:

```powershell
npm.cmd run android:build:debug
```

## Install on a phone

Enable Developer options and USB debugging on the phone, connect it by USB, and approve the computer fingerprint.

```powershell
adb devices
adb install -r ".\output\Personal-Blog-v1.2.1-arm64-test.apk"
```

You can also send the APK to the phone and enable installation from that file manager. Existing app data is preserved by `adb install -r` only when the installed APK uses the same signing certificate.

View runtime logs with:

```powershell
adb logcat | Select-String -Pattern "personalwebsite|tauri|chromium"
```

## Test against a local API

Production uses the configured HTTPS server and needs no MySQL, Redis, or Docker changes. For local Android debugging, forward the phone's loopback port to the computer:

```powershell
adb reverse tcp:8080 tcp:8080
```

Then set the client server URL to `http://127.0.0.1:8080`. Only Debug builds permit loopback HTTP. Release builds require HTTPS.

## Configure a signed Release APK

Create one long-lived upload key. Losing it prevents future APK updates signed with the same identity.

```powershell
keytool -genkeypair -v -keystore C:\Users\tbs12\keys\personal-blog-upload.jks -keyalg RSA -keysize 4096 -validity 10000 -alias upload
```

Copy `src-tauri/gen/android/keystore.properties.example` to `keystore.properties` and fill in the real paths and passwords:

```properties
storeFile=C:/Users/tbs12/keys/personal-blog-upload.jks
storePassword=use-a-strong-unique-password
keyAlias=upload
keyPassword=use-a-strong-unique-password
```

`keystore.properties` and JKS files are ignored by Git and must never be committed. Back up the JKS and passwords offline. Then build:

```powershell
npm.cmd run android:build:release
```

The signed output is copied to `desktop/output/Personal-Blog-v1.2.1-arm64-release.apk`.

## Security design

- Android login tokens are encrypted with AES-256-GCM.
- The encryption key is non-exportable and stored in Android Keystore.
- SharedPreferences contains only an IV and ciphertext.
- Application backup is disabled so encrypted sessions are not copied to another device without their key.
- Release builds reject remote plaintext HTTP.
- External URLs still pass through the existing Rust URL validation.

## Common problems

- `sdkmanager` not found: verify the `cmdline-tools\latest\bin` directory structure and reopen the terminal.
- Wrong Java version: `java -version` must report JDK 17 through `JAVA_HOME`.
- NDK version mismatch: install exactly `29.0.13846066` and update `NDK_HOME`.
- `adb` shows `unauthorized`: unlock the phone and approve the USB debugging prompt.
- APK update reports signature conflict: uninstall the old Debug build or sign both builds with the same key.
- Release build stops before compilation: configure `keystore.properties`; unsigned release artifacts are intentionally blocked.
