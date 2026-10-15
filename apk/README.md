# Battle Quest — Android APK

This folder is a standalone Android Studio project. It wraps the same game as `web/` in a full-screen landscape WebView.

## Build an installable APK

1. Copy the latest website into the app assets (from the BattleQuest root):

```powershell
.\scripts\sync-web-to-apk.ps1
```

2. Open **this `apk` folder** in [Android Studio](https://developer.android.com/studio).
3. Let Gradle sync, then **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. The APK lands at `apk/app/build/outputs/apk/debug/app-debug.apk`.
5. Copy that file to a phone and install it (enable *Install unknown apps* for your file manager).

Command line, if you have the Android SDK:

```powershell
cd apk
.\gradlew.bat assembleDebug
```

`gradlew` appears after Android Studio first opens the project (or after you generate a wrapper).

The game does not need internet. Three.js is vendored inside `web/vendor`.
