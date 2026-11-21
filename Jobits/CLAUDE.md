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

The app has **two main screens** (*(Version 3)* three, with the Notes screen). You switch between them by **swiping left/right** on a phone, or with the **left/right arrow keys** on a computer.

### Screen 1 — Main screen (today)

From top to bottom:
1. **Ascension counter**: small, in the top-right corner.
   *(Version 3)* **Today's date** is shown at the top of the screen (e.g. "Sat 21 Nov").
2. **The adventurer**: in version 1, this is a **placeholder showing the current sword** (see *Levels and gear*).
3. **Day progress bar**: fills up with the exp earned today, out of today's total.
4. **Carried-over tasks**: one-off tasks from earlier days that weren't completed, shown at the top of the list.
5. **Today's tasks**: each one can be ticked as completed, which adds its exp to the day bar.
   Tasks are grouped into **time-of-day slots** (morning, noon, afternoon, evening), each with a small label and a faint horizontal separator, so the list reads like a timeline of the day. All four slots are always shown, even when empty; an "any time" slot is added at the end only if it has tasks. Ticked tasks show **two crossed swords** in their box.
   *(Version 2)* Each task shows its **category label** (see *Categories*), if it has one.
6. *(Version 3)* **Standing quests**: a section at the bottom with all unfinished standing quests (see *Standing quests*), which can be ticked there. They never count towards the day's progress bar.
   If an unfinished standing quest has its **deadline today**, a line under the progress bar says so (e.g. "1 standing quest due today"), and the day can't be completed until it's ticked.

### Screen 2 — Quests (habits and tasks; reached by swiping left)

- A list of **all planned habits and tasks**.
- Each one can be **edited** (name, exp, date, time of day, category, repetition) or **deleted**.
- *(Version 2)* Each quest shows its **category label**, if it has one.
- *(Version 2)* **Filters** above the list, as two rows of tappable options that combine (e.g. *Mind + Repeating*):
  - **Category:** All · Strength · Mind · Constitution · None
  - **Type:** All · One-off · Repeating · *(Version 3)* Standing
  - The last chosen filters are remembered.
- *(Version 2)* **Completed one-off quests are hidden** (*(Version 3)* and completed standing quests) from the list by default. A **"Show completed"** toggle shows them again.
- *(Version 2)* **Export / Import** buttons for backing up all data (see *Data backup*).
- A **+ button** opens a form to add a new one. *(Version 3)* The cursor goes into the name field (opening the phone's keyboard) only for a **new** quest; when **editing**, the keyboard only opens after tapping a text field. The form has:
  - **Name**
  - **Exp value**: how much it's worth (e.g. brushing teeth = 5, cleaning the kitchen = 25)
  - **Date**: when it's due (for repeating habits, the start date)
  - **Time of day** (optional): morning, noon, afternoon, evening, or "any time" (the default). Used to order the day's tasks.
  - *(Version 2)* **Category** (optional): picked by tapping one of three big "stickers"; tapping the chosen one again clears it. At most **one** category per quest.
  - **"Repeating" checkbox**: when ticked, shows the repeat options:
    - every day
    - every work day (Mon–Fri)
    - every second day (counted from the start date)
    - every week (same weekday as the start date)
    - every month (same day of the month as the start date; if that month is shorter, e.g. the 31st in November, it's due on the **last day of the month** instead)
  - *(Version 3)* **"Standing" option**: makes it a standing quest. The exp, time of day and repeat fields are hidden, and the date becomes an optional **deadline**.

### Standing quests (version 3)

A standing quest is a to-do for "at some point", not for a specific day.
- It gives **no exp**, never repeats, and can have a category.
- It can have an optional **deadline**. Without one, it never blocks anything.
- It's shown in the *Standing quests* section of the Main screen until it's ticked, and can be ticked on any day.
- **On its deadline day**, if it's still unfinished, it counts as one of that day's tasks: the day can't be completed (no level-up) until it's ticked.
- **After the deadline**, if it's still unfinished, it stays in the Standing section **marked as overdue**, but it doesn't block any more days. Only the deadline day was lost.
- Once ticked, it's done for good (like a one-off quest), and is hidden on the Quests screen unless "Show completed" is ticked.

### Screen 0 — Notes (version 3; reached by swiping right from the Main screen)

A screen **to the left of the Main screen** for quick free-form notes (e.g. a grocery list). Each note can have an **icon**, chosen from a small set of pixel icons. Details: see *Open questions*.

### Calendar view (version 3)

Shows which days were **completed** and which were **missed**. Weeks start on **Monday**. Details: see *Open questions*.

The quest form's date field also gets **Jobits' own pixel-style date picker**, built from the same month grid, so its weeks start on **Monday** too. (The phone's built-in picker follows the phone's region settings, which the app can't change.)

### Categories (version 2)

Each quest can have **at most one** category, or none. The category is shown as a small coloured label with a pixel icon:

| Category     | Colour | Pixel icon  |
|--------------|--------|-------------|
| Strength     | Red    | Strong arm  |
| Mind         | Blue   | Brain       |
| Constitution | Green  | Heart       |

For now, categories are only for organizing and filtering; they don't change the game rules. Existing quests start with no category.

### Data backup (version 2)

All data lives only in the phone's browser, so clearing site data or resetting the phone would erase it.
- **Export** saves all data (quests, ticks, completed days, and therefore level and ascension) as a small file.
- **Import** loads such a file back, e.g. on a new phone or after a reset. Files that aren't Jobits backups are refused, without changing anything. After picking a file, a popup says what it contains and asks:
  - **Replace** (two taps, like Delete): wipe this phone's data and load the backup.
  - **Merge:** add the backup to this phone's data. Quests missing from the phone are added; if a quest is in both, **the phone's version is kept**. A quest counts as ticked on a day, and a day as completed, if it was in either copy.
  - **Cancel:** do nothing.
- Filter choices are a display setting and aren't part of the backup.

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

- **Notes screen:** one big free-text box, or a list of separate items that can be ticked off and deleted? Which pixel icons should be offered for notes (e.g. shopping cart, book, star…)? (Ask before building it.)
- **Calendar view:** where does it live (a new screen, or a popup from the Main screen), and what does it show for each day (completed / missed only, or also the exp earned)? (Ask before building it.)

---

## Scope

**Version 1 (done):**
- Habit and task tracking, with the daily progress bar
- The leveling and ascension system described above
- Adding, editing and deleting habits and tasks
- The sword placeholder for the adventurer
- Swiping between screens, plus arrow keys on a computer
- The "reset everything" button
- Installable PWA, hosted on GitHub Pages

**Version 2 (done):**
1. **Categories** (Strength, Mind, Constitution), with coloured pixel labels
2. **Filters** on the Quests screen, plus hiding completed one-off quests behind a "Show completed" toggle
3. **Export / import** backup of all data

**Version 3 (now), built in this order:**
1. **Quick fixes:** no automatic keyboard when editing a quest; today's date on the Main screen
2. **Standing quests**, with optional deadlines
3. **Notes screen**, to the left of the Main screen
4. **Calendar view** of completed and missed days, plus a matching **date picker** for the quest form (both with Monday as the first day)

**Later (don't build yet):**
- **Category stats / a more developed ascension system:** e.g. exp earned per category builds up STR / MIND / CON stats for the adventurer
- **Adventurer artwork**, with gear visible on the character

**Out of scope:** user accounts, syncing between devices, notifications or reminders, an app store release, multiple users.

---

## Look and feel

- A simple **8-bit / pixel-art style** with a **bright colour palette**. A pixel-style font is welcome.
- Designed for a **phone in portrait mode** first, but usable in a desktop browser for testing.
- Big, easy-to-tap buttons and checkboxes.
