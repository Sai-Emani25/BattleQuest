# Battle Quest

First-person on-rails adventure inspired by Nintendo Land’s *The Legend of Zelda: Battle Quest*. You ride a forest rail with a companion: one of you swings a sword, the other looses arrows. Original setting (Forest of Echoes) — not Nintendo IP.

## Folders

| Path | What it is |
| --- | --- |
| `web/` | Playable website (desktop + phone browser) |
| `apk/` | Android Studio project that packages the same game as an `.apk` |
| `scripts/` | Copies `web/` into the APK assets |

The parent folder is **BattleQuest** (renamed from *New folder*). Cursor may still show the old empty folder until that window is closed; use this directory.

## Play in a browser

From this folder:

```powershell
python -m http.server 8080 --directory web
```

Then open [http://localhost:8080](http://localhost:8080).

### Controls

**Phone (landscape)**  
Look stick · swipe the sword pad · hold **BOW** and release. Champion can **SWAP**.

**Desktop**  
Mouse look (click the game) · click / Space to slash · hold right-click or **F** to draw the bow · **Q** / **E** to swap on Champion · **Esc** pause.

Pick **Knight**, **Ranger**, or **Champion**. Your companion uses the other weapon and fights on the rail with you.

## Phone APK

See `apk/README.md`. Run `.\scripts\sync-web-to-apk.ps1` before building so the Android app matches the website.
