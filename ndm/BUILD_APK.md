# Building the Android APK

## Prerequisites

1. **Java 21** - Install Eclipse Adoptium JDK 21
   - Location: `C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot`

2. **Android SDK** - Install via Android Studio
   - Location: `C:\Users\Steven\AppData\Local\Android\Sdk`

3. **Node.js** - Required for Metro bundler

## Build Commands

### 1. Navigate to project directory
```bash
cd C:\dev\ndm
```

### 2. Install dependencies (if needed)
```bash
npm install
```

### 3. Run Expo prebuild (generates android folder)
```bash
npx expo prebuild --platform android --clean
```

### 4. Build the APK
Run this PowerShell command:
```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'; Set-Location 'C:\dev\ndm\android'; .\gradlew.bat assembleRelease --no-daemon
```

Or from Command Prompt:
```cmd
cd C:\dev\ndm\android
set NODE_OPTIONS=--max-old-space-size=4096
gradlew.bat assembleRelease --no-daemon
```

## Output Location

The APK will be generated at:
```
C:\dev\ndm\android\app\build\outputs\apk\release\app-release.apk
```

## Configuration Files

### android/local.properties
```properties
sdk.dir=C:\\Users\\Steven\\AppData\\Local\\Android\\Sdk
```

### android/gradle.properties (key settings)
```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.9.10-hotspot
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=false
reactNativeArchitectures=arm64-v8a
newArchEnabled=true
```

## Troubleshooting

### Out of Memory Errors
- Use `--no-daemon` flag
- Set `org.gradle.parallel=false` in gradle.properties
- Build for single architecture: `reactNativeArchitectures=arm64-v8a`
- Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Java Version Issues
- Ensure `org.gradle.java.home` points to JDK 11 or higher
- Java 21 is recommended

### Clean Build
If build fails, try cleaning first:
```powershell
Set-Location 'C:\dev\ndm\android'
.\gradlew.bat clean
.\gradlew.bat assembleRelease --no-daemon
```
