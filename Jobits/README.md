# Jobits ⚔️

**Jobits** ("Jorge's habits") is a small **gamified habit tracker** with an 8-bit look. You plan your habits and to-dos as **quests**, tick them off each day, and every fully completed day levels up your adventurer's sword, from wood all the way to obsidian. Finish a whole week and you earn an **ascension**.

It's a Progressive Web App (PWA): it runs in the browser, can be installed on a phone's home screen, and works offline.

**▶ Open it:** https://armero96.github.io/App-creation-testing/Jobits/

---

## How it works

- **Quests:** each quest has a name, an exp value (how much it's worth), a date, an optional time of day (morning, noon, afternoon, evening), and can repeat: every day, every work day, every second day, every week or every month.
- **Today's quests** are shown in time-of-day slots. Tick one and its exp fills the day's progress bar. Ticked quests show crossed swords.
- **Unfinished one-off quests carry over** to the next day and still count towards that day's goal.
- **Levels:** completing *all* of a day's quests gives +1 level and a better sword:

  | Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |-------|---|---|---|---|---|---|---|
  | Sword | Wooden | Stone | Copper | Iron | Silver | Golden | Obsidian |

- **Missed days** give no level-up; you just continue from the same level the next day.
- **Weekly reset:** every Monday the level goes back to 1.
- **Ascension:** complete every day from Monday to Sunday for +1 ascension. The ascension counter never resets.
- **Reset everything** (at the bottom of the Quests screen) wipes all data. It's meant for testing.

Swipe left/right to switch between **Today** and **Quests** on a phone, or use the arrow keys on a computer.

## Install it on your phone

- **Android (Chrome):** open the link above, tap **⋮** → **Install app** (or *Add to Home screen*).
- **iPhone (Safari):** open the link above, tap **Share** → **Add to Home Screen**.

## Your data

Everything is saved in your browser's local storage, **on your device only**. Nothing is sent anywhere, there are no accounts, and each device keeps its own separate data. Clearing the browser's site data (or uninstalling the app) erases it.

## Run it locally

You only need Python (for a simple local web server):

```
cd Jobits
python -m http.server 8000
```

Then open http://localhost:8000. After changing code, use a hard reload (**Ctrl + Shift + R**) so the browser doesn't use an old copy.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure: the two screens and the quest form |
| `style.css` | 8-bit look and layout |
| `app.js` | All the app logic: quests, repeat rules, ticking, levels, saving |
| `sw.js` | Service worker: keeps a copy of the app for offline use |
| `manifest.json` | App name, colours and icons, for installing |
| `icons/` | Home-screen icons |
| `fonts/` | The pixel font |
| `CLAUDE.md` | Full specification, used when building the app with Claude |
| `spec_page.md` | The original first draft of the idea |

Built with plain HTML, CSS and JavaScript. No frameworks and no build step.

## Credits

- Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38, licensed under the SIL Open Font License (see `fonts/OFL.txt`).
- Built step by step with [Claude Code](https://claude.com/claude-code) as a learning project.
