# CLAUDE.md — Jobits

This file gives Claude the context for the Jobits app. Read it fully before starting any task on it.
It replaces `spec_page.md` (the original draft). If the two disagree, follow this file.
How I like to work (plan first, small steps, etc.) is in the **top-level `CLAUDE.md`** of this repository; those rules apply here too.

---

## Project overview

**Jobits** ("Jorge's habits") is a **gamified habit tracker**, built as a **PWA** (Progressive Web App) for my phone.
I add habits and tasks, tick them off each day, and earn experience (exp). Completing all of a day's tasks levels up an adventurer, who gets better gear through the week.

**Naming:** in the app's visible text, habits and tasks are called **quests** (e.g. "Quests", "New quest", "Today's quests"). The code and stored data keep the word "habit".

## Tech stack

- **Plain HTML, CSS and vanilla JavaScript.** No frameworks (no React, Vue, etc.) and no build step.
- **PWA basics:** a `manifest.json` and a simple service worker, so the app can be installed on a phone's home screen.
- **Storage:** the browser's `localStorage`, on the device only.
- **Local testing:** inside the `Jobits` folder, run `python -m http.server 8000` and open `http://localhost:8000`. After changing JS/CSS, use a hard reload (Ctrl+Shift+R) so the browser doesn't use an old copy.
- **Hosting:** GitHub Pages, at https://armero96.github.io/App-creation-testing/Jobits/ (installed on my Android phone from there).
- **Service worker (`sw.js`):** "network first". If app files are added or renamed, update its `APP_FILES` list and bump `CACHE_NAME`.
- All paths in the app are **relative** (`./`), so it works both locally and from the GitHub Pages sub-folder.

---

## Screens

The app has **two main screens**. You switch between them by **swiping left/right** on a phone, or with the **left/right arrow keys** on a computer.

### Screen 1 — Main screen (today)

From top to bottom:
1. **Ascension counter**: small, in the top-right corner.
2. **The adventurer**: in version 1, this is a **placeholder showing the current sword** (see *Levels and gear*).
3. **Day progress bar**: fills up with the exp earned today, out of today's total.
4. **Carried-over tasks**: one-off tasks from earlier days that weren't completed, shown at the top of the list.
5. **Today's tasks**: each one can be ticked as completed, which adds its exp to the day bar.
   Tasks are grouped into **time-of-day slots** (morning, noon, afternoon, evening), each with a small label and a faint horizontal separator, so the list reads like a timeline of the day. All four slots are always shown, even when empty; an "any time" slot is added at the end only if it has tasks. Ticked tasks show **two crossed swords** in their box.

### Screen 2 — Quests (habits and tasks; reached by swiping left)

- A list of **all planned habits and tasks**.
- Each one can be **edited** (name, exp, date, time of day, repetition) or **deleted**.
- A **+ button** opens a form to add a new one, with:
  - **Name**
  - **Exp value**: how much it's worth (e.g. brushing teeth = 5, cleaning the kitchen = 25)
  - **Date**: when it's due (for repeating habits, the start date)
  - **Time of day** (optional): morning, noon, afternoon, evening, or "any time" (the default). Used to order the day's tasks.
  - **"Repeating" checkbox**: when ticked, shows the repeat options:
    - every day
    - every work day (Mon–Fri)
    - every second day (counted from the start date)
    - every week (same weekday as the start date)
    - every month (same day of the month as the start date; if that month is shorter, e.g. the 31st in November, it's due on the **last day of the month** instead)

---

## Game rules

1. **Exp per task:** each task gives the exp value set when it was created.
2. **Daily goal:** a day's exp goal is the **sum of the exp of all tasks due that day, plus any carried-over one-off tasks**. The day counts as **completed** only when all of them are done. (So an old unfinished task blocks level-ups until it's done or deleted. That's intended.)
   - **Un-ticking:** a ticked task can be un-ticked; its exp is removed from the day's bar again.
   - **Changes during the day:** adding, editing or deleting a task changes **today's** goal right away.
   - **No tasks:** a day with no tasks due counts as **missed** (no level-up).
3. **Level-up:** completing a day gives **+1 level** immediately, and the gear upgrades. The level is shown as "Level N" under the adventurer, and a short **"Level-up!"** message pops up under it. If a task is un-ticked so the day is no longer complete, the **level-up is undone**.
4. **Missed day:** if a day isn't completed by midnight, there's no level-up. The next day starts at the same level with an empty bar.
5. **Days end at midnight**, local time.
6. **Levels run from 1 to 7.** The week starts at level 1.
7. **Sunday and ascension:** completing **Sunday while at level 7** (which means a fully completed week) gives **+1 ascension**.
8. **Weekly reset:** every **Monday**, the level resets to 1. Repeating habits are kept, and **the ascension counter is never reset**.
9. **Reset everything:** a button (for testing) that wipes all data: habits, level and ascension.

### Levels and gear (version 1 placeholder)

| Level | Sword    | Reached by completing |
|-------|----------|-----------------------|
| 1     | Wooden   | (start of the week)   |
| 2     | Stone    | Monday                |
| 3     | Copper   | Tuesday               |
| 4     | Iron     | Wednesday             |
| 5     | Silver   | Thursday              |
| 6     | Golden   | Friday                |
| 7     | Obsidian | Saturday              |
| —     | +1 Ascension | Sunday (at level 7) |

> If a day is missed, the levels shift: e.g. missing Tuesday means Saturday only reaches level 6, and that week gives no ascension.

### Important technical note

The app might not be open at midnight or on Monday. **Every time the app opens, it must check what happened since it was last used**: which days were missed, whether a new week started, and which one-off tasks need to carry over. The app should never rely on being open at a specific time.

---

## Example scenarios (use these to test)

1. **Normal day:** On Tuesday I'm at level 2 with 3 tasks (5 + 10 + 25 = 40 exp). I complete two of them, so the bar shows 15/40 and I'm still level 2. I complete the third, so the bar is 40/40 and I go to **level 3 (copper sword)**.
2. **Missed day:** On Wednesday I'm at level 3 and complete 1 of 2 tasks. Midnight passes. On Thursday I'm **still at level 3** with an empty bar.
3. **Carry-over:** A one-off task due Wednesday isn't done. On Thursday it appears **at the top of the list, under the adventurer**.
4. **Perfect week:** I complete every day from Monday to Saturday and reach level 7. I complete Sunday, so **ascension goes from 0 to 1**. On Monday the level is back to 1 and ascension stays at 1.
5. **Closed app:** I don't open the app from Friday to Monday. When I open it on Monday, it shows level 1, with ascension unchanged and Friday–Sunday counted as missed.

---

## Open questions (ask me before building these parts)

- None right now. Add new ones here as they come up.
---

## Scope

**Version 1 must have:**
- Habit and task tracking, with the daily progress bar
- The leveling and ascension system described above
- Adding, editing and deleting habits and tasks
- The sword placeholder for the adventurer
- Swiping between screens, plus arrow keys on a computer
- The "reset everything" button

**Later (don't build yet):**
- Adventurer artwork, with gear visible on the character
- A calendar view
- More screens or tabs
- Export and backup of data
- A more developed ascension system

**Out of scope:** user accounts, syncing between devices, notifications or reminders, an app store release, multiple users.

---

## Look and feel

- A simple **8-bit / pixel-art style** with a **bright colour palette**. A pixel-style font is welcome.
- Designed for a **phone in portrait mode** first, but usable in a desktop browser for testing.
- Big, easy-to-tap buttons and checkboxes.
