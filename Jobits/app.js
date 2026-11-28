// =====================================================================
// Jobits — app.js
// =====================================================================


// ===== Saving and loading habits (localStorage) =====
// localStorage is a small storage box inside the browser, on this device only.
// It can only store text, so we convert our list to text (JSON) when saving
// and back into a list when loading.

const STORAGE_KEY = "jobits.habits";
const COMPLETIONS_KEY = "jobits.completions";
const COMPLETED_DAYS_KEY = "jobits.completedDays";
const FILTERS_KEY = "jobits.filters";   // the Quests screen's last chosen filters
const NOTES_KEY = "jobits.notes";

// Read something from localStorage; if it's missing or broken, use the fallback
function loadFromStorage(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;   // nothing saved yet -> fallback
  } catch (error) {
    console.warn("Could not load " + key + ":", error);
    return fallback;
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function saveCompletions() {
  localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
}

function saveCompletedDays() {
  localStorage.setItem(COMPLETED_DAYS_KEY, JSON.stringify(completedDays));
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// The list of all habits, kept in memory while the app is open.
// Each habit looks like:
// { id, name, exp, date: "YYYY-MM-DD", repeat: null | "daily" | ..., timing: "morning" | ...,
//   category: null | "strength" | ..., standing: true | false }
// Standing quests have exp 0, repeat null, and date = their deadline, or null if none.
// (Quests made before a field existed simply don't have it, which counts as null/false.)
let habits = loadFromStorage(STORAGE_KEY, []);

// The log of ticked tasks: for each day, the ids of the tasks done that day.
// e.g. { "2026-11-20": ["id1", "id2"], "2026-11-21": ["id1"] }
let completions = loadFromStorage(COMPLETIONS_KEY, {});

// The record of fully completed days, e.g. { "2026-11-16": true, "2026-11-17": true }.
// Only today's entry is ever changed; once a day is over, its result is frozen.
// Level and ascension are both worked out from this record.
let completedDays = loadFromStorage(COMPLETED_DAYS_KEY, {});

// The notes on the Notes screen. Each looks like:
// { id, title, icon: null | "cart" | ..., kind: "text" | "checklist", text, items }
// Free-text notes use "text"; checklists use "items": [{ id, text, done }].
let notes = loadFromStorage(NOTES_KEY, []);


// ===== Small helpers =====

// Today's date as "YYYY-MM-DD" in *local* time.
// (We don't use toISOString(), because that gives the date in UTC,
//  which can be yesterday or tomorrow depending on your time zone.)
function todayString() {
  return dateToString(new Date());
}

// Turn a Date object into "YYYY-MM-DD" (local time)
function dateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // months start at 0
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Turn "2026-11-20" into a Date object at local midnight
// (new Date("2026-11-20") would use UTC, which can shift the day)
function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Turn "2026-11-20" into something friendlier like "20 Nov 2026"
// Short date with the weekday, for the top of the Main screen, e.g. "Sat 21 Nov"
function formatDayLabel(dateString) {
  return parseDate(dateString).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  }).replace(",", ""); // some browsers put a comma after the weekday
}

function formatDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// Whole days from date a to date b (both "YYYY-MM-DD").
// Done in UTC so summer/winter clock changes can't make a day 23 or 25 hours.
function daysBetween(a, b) {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000;
}

// A unique id for each habit, so we can find it later (for editing/deleting)
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Human-readable text for the stored values
const REPEAT_LABELS = {
  daily: "every day",
  workdays: "every work day",
  every2days: "every second day",
  weekly: "every week",
  monthly: "every month",
};

const TIMING_LABELS = {
  anytime: "any time",
  morning: "morning",
  noon: "noon",
  afternoon: "afternoon",
  evening: "evening",
};


// Order of the times of day, used to sort the day's tasks
const TIMING_ORDER = ["morning", "noon", "afternoon", "evening", "anytime"];


// ===== Popups and the phone's Back button =====
// Without help, the Back button leaves the page even when a popup is open.
// So each time a popup opens, we add an entry to the browser's history
// ("pushState"). Pressing Back then just removes that entry, and we close
// the popup instead of leaving. When a popup is closed in another way
// (Cancel, Save, Escape), we remove its history entry ourselves.

const popupStack = [];          // the open popups, the top one last
const popupClosers = new Map(); // popup element -> the function that closes it
let handlingBack = false;       // true while Back is closing a popup
let skipPops = 0;               // history entries we removed ourselves

// Show a popup. closeFn is its normal close function (which calls closePopup).
function openPopup(element, closeFn) {
  if (!element.hidden) return;  // already open
  element.hidden = false;
  popupStack.push(element);
  popupClosers.set(element, closeFn);
  history.pushState({ jobitsPopup: true }, "");
}

// Hide a popup, and remove its history entry unless Back already did
function closePopup(element) {
  element.hidden = true;
  const index = popupStack.indexOf(element);
  if (index === -1) return;     // it wasn't open
  popupStack.splice(index, 1);
  if (!handlingBack) {
    skipPops++;                 // the "popstate" this causes isn't a Back press
    history.back();
  }
}

function isAnyPopupOpen() {
  return popupStack.length > 0;
}

// Close the popup on top (used by Back and by the Escape key)
function closeTopPopup() {
  const top = popupStack[popupStack.length - 1];
  if (top) popupClosers.get(top)();
}

// "popstate" fires when the browser moves back through its history
window.addEventListener("popstate", () => {
  if (skipPops > 0) {           // caused by closePopup's history.back(): ignore
    skipPops--;
    return;
  }
  handlingBack = true;
  closeTopPopup();
  handlingBack = false;
});


// ===== Categories and their pixel icons =====

// Turn a little text picture into an SVG icon: every "X" becomes one pixel.
// The icon uses the current text colour (fill: currentColor in the CSS).
// Pictures can be any size; the CSS sets the height and the width follows.
function pixelIcon(rows) {
  const width = rows[0].length;
  const height = rows.length;
  let rects = "";
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === "X") rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    });
  });
  return `<svg viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// The three categories. "short" is shown on the small labels.
const CATEGORIES = {
  strength: {
    name: "Strength",
    short: "STR",
    icon: pixelIcon([   // a flexed arm: fist up top, bicep bulge on the right
      "..XX....",
      ".XXX....",
      ".XX.....",
      ".XX..XX.",
      ".XXXXXXX",
      ".XXXXXXX",
      "..XXXXX.",
      "........",
    ]),
  },
  mind: {
    name: "Mind",
    short: "MIND",
    icon: pixelIcon([   // a brain seen from the side (front on the left):
      "..XXXXXX..",     // folds as gaps, cerebellum at the back-bottom,
      ".X.XX.X.X.",     // brainstem underneath. 10 wide, since a brain
      "XX..X.XX.X",     // from the side is wider than it is tall.
      "X.XX.X..XX",
      "XXX..XXX.X",
      ".XXXX.XXXX",
      "....XX.XX.",
      ".....X....",
    ]),
  },
  constitution: {
    name: "Constitution",
    short: "CON",
    icon: pixelIcon([   // a heart
      ".XX..XX.",
      "XXXXXXXX",
      "XXXXXXXX",
      "XXXXXXXX",
      ".XXXXXX.",
      "..XXXX..",
      "...XX...",
      "........",
    ]),
  },
};

// The small coloured label for a quest's category, or null if it has none.
// (Quests made before categories existed have no category field at all.)
function makeCategoryChip(category) {
  if (!category || !CATEGORIES[category]) return null;
  const chip = document.createElement("span");
  chip.className = `category-chip cat-${category}`;
  chip.title = CATEGORIES[category].name;   // full name when hovering
  chip.innerHTML = CATEGORIES[category].icon; // fixed icon, no user text: safe
  chip.append(CATEGORIES[category].short);
  return chip;
}


// ===== When is a habit due? =====
// Note: "YYYY-MM-DD" strings can be compared with < and > directly,
// because they sort in the same order as the dates they stand for.

function isDueOn(habit, dateString) {
  // One-off task: due only on its own date
  if (habit.repeat === null) return habit.date === dateString;

  // Repeating habit: never before its start date
  if (dateString < habit.date) return false;

  const date = parseDate(dateString);
  const start = parseDate(habit.date);

  switch (habit.repeat) {
    case "daily":
      return true;
    case "workdays": {
      const weekday = date.getDay();           // 0 = Sunday ... 6 = Saturday
      return weekday >= 1 && weekday <= 5;
    }
    case "every2days":
      return daysBetween(habit.date, dateString) % 2 === 0;
    case "weekly":
      return date.getDay() === start.getDay();
    case "monthly": {
      // Same day of the month; in shorter months, the last day instead.
      // new Date(year, month + 1, 0) is "day 0 of next month" = last day of this month.
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return date.getDate() === Math.min(start.getDate(), lastDay);
    }
    default:
      return false;
  }
}


// ===== Ticking tasks off (the completion log) =====

// Was this task ticked on this specific day?
function isDoneOnDay(habitId, dateString) {
  return (completions[dateString] || []).includes(habitId);
}

// Was this task ticked on any day other than the given one?
function isDoneOnOtherDay(habitId, dateString) {
  return Object.keys(completions).some(
    (day) => day !== dateString && completions[day].includes(habitId)
  );
}

// Is this task done, as far as today's screen is concerned?
// Repeating habits: only today's tick counts. One-off tasks: a tick on any day.
function isDone(habit, today) {
  if (habit.repeat) return isDoneOnDay(habit.id, today);
  return isDoneOnDay(habit.id, today) || isDoneOnOtherDay(habit.id, today);
}

// Remove a task's id from every day in the log
function removeFromLog(habitId) {
  for (const day of Object.keys(completions)) {
    completions[day] = completions[day].filter((id) => id !== habitId);
    if (completions[day].length === 0) delete completions[day]; // tidy up empty days
  }
}

// Tick or un-tick a task for today
function toggleDone(habit) {
  const today = todayString();
  if (isDone(habit, today)) {
    // Un-tick. For one-off tasks this clears every tick, wherever it was.
    if (habit.repeat) {
      completions[today] = completions[today].filter((id) => id !== habit.id);
      if (completions[today].length === 0) delete completions[today];
    } else {
      removeFromLog(habit.id);
    }
  } else {
    // Tick: add the id to today's list
    completions[today] = completions[today] || [];
    completions[today].push(habit.id);
  }
  saveCompletions();
  renderAll();
}


// ===== Today's tasks and whether the day is complete =====

// Split today's tasks into carried-over ones and ones due today
function getTodayTasks(today) {
  // Carried over: one-off tasks from earlier days, not done on an earlier day.
  // (If ticked today, they stay visible, ticked, for the rest of today.)
  // Standing quests are left out here: they have their own rules (below).
  const carried = habits.filter(
    (h) => !h.standing && h.repeat === null && h.date < today && !isDoneOnOtherDay(h.id, today)
  );
  // Due today: everything whose date/repeat rule matches today
  const dueToday = habits.filter((h) => !h.standing && isDueOn(h, today));
  return { carried, dueToday };
}

// Standing quests to show on the Main screen: all not finished on an earlier
// day. (Ones ticked today stay visible, ticked, for the rest of today.)
function getStandingQuests(today) {
  return habits.filter((h) => h.standing && !isDoneOnOtherDay(h.id, today));
}

// Standing quests whose deadline is today (and weren't finished earlier).
// These count as one of today's tasks: the day isn't complete until they're ticked.
function getStandingDueToday(today) {
  return getStandingQuests(today).filter((h) => h.date === today);
}

// Total exp of today's tasks, and how much of it has been earned
function getTodayExp(today) {
  const { carried, dueToday } = getTodayTasks(today);
  const allTasks = [...carried, ...dueToday];
  const total = allTasks.reduce((sum, h) => sum + h.exp, 0);
  const earned = allTasks.filter((h) => isDone(h, today)).reduce((sum, h) => sum + h.exp, 0);
  return { total, earned };
}

// A day is complete when it has tasks and all of them are ticked.
// "Tasks" are the exp quests plus any standing quest whose deadline is today.
// (A day with no tasks at all counts as missed.)
function isTodayComplete(today) {
  const { total, earned } = getTodayExp(today);
  const standingDue = getStandingDueToday(today);
  const hasTasks = total > 0 || standingDue.length > 0;
  const standingDone = standingDue.every((h) => isDoneOnDay(h.id, today));
  return hasTasks && earned === total && standingDone;
}

// Keep today's entry in the completed-days record up to date.
// Adds it when the day becomes complete, removes it if a task is un-ticked
// (which undoes the level-up), or if a new task is added to today.
function updateTodayRecord() {
  const today = todayString();
  const complete = isTodayComplete(today);
  if (complete && !completedDays[today]) {
    completedDays[today] = true;
    saveCompletedDays();
  } else if (!complete && completedDays[today]) {
    delete completedDays[today];
    saveCompletedDays();
  }
}


// ===== Levels and ascension =====

const SWORDS = ["Wooden", "Stone", "Copper", "Iron", "Silver", "Golden", "Obsidian"];
const MAX_LEVEL = 7;

// The Monday of the week that a date falls in, as "YYYY-MM-DD"
function weekStart(dateString) {
  const date = parseDate(dateString);
  const daysSinceMonday = (date.getDay() + 6) % 7; // Mon = 0, ..., Sun = 6
  date.setDate(date.getDate() - daysSinceMonday);
  return dateToString(date);
}

// Level = 1 + completed days so far this week (Monday to today), at most 7.
// The Monday reset needs no extra code: a new week has no completed days yet.
function getLevel(today) {
  const monday = weekStart(today);
  const completedThisWeek = Object.keys(completedDays).filter(
    (day) => day >= monday && day <= today
  ).length;
  return Math.min(1 + completedThisWeek, MAX_LEVEL);
}

// Ascension = number of weeks with all 7 days completed.
// (Completing Monday-Saturday reaches level 7; completing Sunday too ascends.)
function getAscension() {
  const daysPerWeek = {};  // e.g. { "2026-11-16": 7, "2026-11-23": 3 }
  for (const day of Object.keys(completedDays)) {
    const monday = weekStart(day);
    daysPerWeek[monday] = (daysPerWeek[monday] || 0) + 1;
  }
  return Object.values(daysPerWeek).filter((count) => count === 7).length;
}

// The level and ascension shown last time, to notice when they go up.
// null = nothing shown yet (so opening the app doesn't trigger a message).
let shownLevel = null;
let shownAscension = null;
let levelUpTimer = null;

const levelLabel = document.getElementById("level-label");
const levelUpMessage = document.getElementById("level-up");
const adventurerButton = document.getElementById("adventurer");
const adventurerArt = document.getElementById("adventurer-art");
const ascensionLabel = document.getElementById("ascension-label");
const todayDateLabel = document.getElementById("today-date-text");

const LEVEL_UP_TIME = 3000; // how long the message stays, in milliseconds

// Show a message under the level for a few seconds
function showLevelUpMessage(text) {
  levelUpMessage.textContent = text;
  // Remove and re-add the class so the pop animation plays again each time
  levelUpMessage.classList.remove("show");
  void levelUpMessage.offsetWidth; // forces the browser to notice the removal
  levelUpMessage.classList.add("show");

  clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => levelUpMessage.classList.remove("show"), LEVEL_UP_TIME);
}

// ===== Category stats (STR / MIND / CON) =====
// Each category's stat goes up 1 level per 100 exp earned in that category
// in a calendar month, starting at level 1, and starts again each month.

const EXP_PER_STAT_LEVEL = 100;

// Total exp per category for a month, e.g. monthStats("2026-11")
// -> { strength: 240, mind: 430, constitution: 160 }.
// Worked out from the ticks log, using each quest's current exp and category.
function monthStats(month) {
  const totals = {};
  for (const category of Object.keys(CATEGORIES)) totals[category] = 0;

  const byId = new Map(habits.map((h) => [h.id, h])); // quick lookup by id
  for (const [day, ids] of Object.entries(completions)) {
    if (!day.startsWith(month)) continue;   // "2026-11-05" starts with "2026-11"
    for (const id of ids) {
      const habit = byId.get(id);
      // deleted quests, standing quests and quests without a category add nothing
      if (!habit || habit.standing || !CATEGORIES[habit.category]) continue;
      totals[habit.category] += habit.exp;
    }
  }
  return totals;
}

// 0-99 exp = level 1, 100-199 = level 2, ...
function statLevel(exp) {
  return 1 + Math.floor(exp / EXP_PER_STAT_LEVEL);
}

const statsRow = document.getElementById("stats");

// The three badges under the adventurer, e.g. [arm STR 3] [brain MIND 5] [heart CON 2]
function renderStats(today) {
  const totals = monthStats(today.slice(0, 7)); // "2026-11-22" -> "2026-11"
  statsRow.innerHTML = "";
  for (const [category, exp] of Object.entries(totals)) {
    const badge = makeCategoryChip(category); // same look as the quest labels
    badge.append(` ${statLevel(exp)}`);
    statsRow.append(badge);
  }
}

// ===== Adventurer artwork =====
// The adventurer is drawn pixel by pixel on a <canvas>, one canvas pixel per
// art pixel; CSS then scales it up (with "pixelated" so it stays sharp).
// Each piece of gear comes in the 7 sword materials:
//   sword = this week's level; shield = STR, helmet = MIND, armour = CON (this month).

// Light, mid and dark shade of each material (same names as SWORDS)
const MATERIALS = {
  Wooden:   ["#e3a868", "#ab6c3b", "#6b3d1f"],
  Stone:    ["#c2c3c7", "#8b8d94", "#5a5c63"],
  Copper:   ["#f6ad7b", "#d0703a", "#8a4220"],
  Iron:     ["#e4e8ef", "#a7aeba", "#6c7380"],
  Silver:   ["#ffffff", "#d6dde8", "#9aa6b8"],
  Golden:   ["#fff27a", "#ffcc1a", "#c08a00"],
  Obsidian: ["#8a63e8", "#3b2a6b", "#1a1230"],
};

// Colours that don't depend on the gear: skin, hair, clothes, plume, ground shadow
const ART_COLOURS = {
  s: "#f4c08f", S: "#d99b6a", e: "#1a1c2c", h: "#7a3b1d", m: "#b0574a",
  c: "#008751", C: "#005c35", p: "#5f574f", b: "#3b2a20", x: "#ff004d",
  G: "#5c3a1e", z: "#141c3a",
};
const ART_OUTLINE = "#1a1c2c";

// Pixel maps. "." or space = see-through. 1/2/3 = the gear's light/mid/dark
// shade; other letters are ART_COLOURS. Outlines are added automatically.
const ART_BODY = [
  "",
  "",
  "",
  "",
  "           hhhhhh",
  "          hhhhhhhh",
  "          hhhhhhhhh",
  "          hhssssss",
  "          hsssesse",
  "          hSssssss",
  "           SSssmss",
  "            SSSSS",
  "          cccccsscccc",
  "       ssccccccccccc",
  "      sssccccccccccc",
  "      ss ccccccccccc",
  "          cccccccccc",
  "          cccccccccc",
  "          cccccccccc",
  "          CCCCCCCCCC",
  "          pppppppppp",
  "         ppppp  ppppp",
  "        ppppp    ppppp",
  "       ppppp      ppppp",
  "       pppp        pppp",
  "      bbbbb        bbbbb",
  "     bbbbbb        bbbbbb",
  "",
  "    zzzzzzzzzzzzzzzzzzzzzzz",
];
const ART_ARMOUR = [
  "", "", "", "", "", "", "", "", "", "", "", "",
  "        1122222222211",
  "       112222222222211",
  "         12222222223",
  "         12222222223",
  "          1222222223",
  "          1222222223",
  "          2222222223",
  "          3333333333",
  "          2223  3222",
];
const ART_HELMET = [
  "              xxx",
  "             xx",
  "            1112",
  "          11122222",
  "         1122222222",
  "         2222222223",
  "         33333333333",
  "         33",
  "         33",
  "         33",
  "          3",
];
const ART_SHIELD = [
  "", "", "", "", "", "", "", "", "", "", "", "", "",
  "    1112",
  "   112222",
  "  11222222",
  "  122xx223",
  "  12xxxx23",
  "  12xxxx23",
  "  122xx223",
  "  12222223",
  "   222223",
  "    2333",
];

// Turn a pixel map into a list of [column, row, character]
function artCells(map) {
  const cells = [];
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "." && ch !== " ") cells.push([x, y, ch]);
  }));
  return cells;
}

// The raised arm and the sword are diagonal, so their cells are built in a
// loop instead. Rows can be negative (above the head): there's room up there.
const ART_ARM = [];
for (let i = 0; i <= 6; i++) {
  const colour = i < 2 ? "c" : "s";   // sleeve first, then bare arm
  ART_ARM.push([19 + i, 13 - i, colour], [20 + i, 13 - i, colour], [20 + i, 12 - i, colour]);
}
const ART_FIST = [[26, 5, "s"], [27, 5, "s"], [26, 6, "S"], [27, 6, "S"]];
const ART_SWORD = [[28, 4, "G"]];                                          // grip
ART_SWORD.push([27, 1, "3"], [28, 2, "2"], [29, 3, "2"], [30, 4, "2"], [31, 5, "3"]); // cross-guard
for (let i = 0; i <= 6; i++) {                                             // blade
  ART_SWORD.push([30 + i, 2 - i, "1"], [31 + i, 2 - i, i === 6 ? "3" : "2"]);
}
ART_SWORD.push([37, -5, "1"]);                                             // tip

// Canvas size in art pixels, and where the maps' column 0 / row 0 sit on it
const ART_WIDTH = 40;
const ART_HEIGHT = 37;
const ART_OFFSET_X = 1;
const ART_OFFSET_Y = 7;

// Paint one piece: first a dark outline around it, then its colours
function paintArt(ctx, cells, shades) {
  const filled = new Set(cells.map(([x, y]) => `${x},${y}`));
  const dot = (x, y, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x + ART_OFFSET_X, y + ART_OFFSET_Y, 1, 1);
  };
  // Outline: every empty neighbour of a coloured cell (the ground shadow has none)
  for (const [x, y, ch] of cells) {
    if (ch === "z") continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!filled.has(`${x + dx},${y + dy}`)) dot(x + dx, y + dy, ART_OUTLINE);
    }
  }
  for (const [x, y, ch] of cells) {
    dot(x, y, "123".includes(ch) ? shades[Number(ch) - 1] : ART_COLOURS[ch]);
  }
}

// The gear worn on a given day, e.g. { sword: "Iron", shield: "Copper", ... }
function gearOn(day) {
  const stats = monthStats(day.slice(0, 7));
  // Stat level 1 = Wooden ... level 7 or more = Obsidian
  const material = (exp) => SWORDS[Math.min(statLevel(exp), SWORDS.length) - 1];
  return {
    sword: SWORDS[getLevel(day) - 1],
    shield: material(stats.strength),
    helmet: material(stats.mind),
    armour: material(stats.constitution),
  };
}

// e.g. "Iron sword · Copper shield · Silver helmet · Stone armour"
function gearText(gear) {
  return `${gear.sword} sword · ${gear.shield} shield · ${gear.helmet} helmet · ${gear.armour} armour`;
}

// Draw the adventurer wearing the given gear. Later pieces are drawn on top.
function drawAdventurer(canvas, gear) {
  canvas.width = ART_WIDTH;
  canvas.height = ART_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, ART_WIDTH, ART_HEIGHT);
  paintArt(ctx, artCells(ART_BODY));
  paintArt(ctx, ART_ARM);                       // behind the armour's shoulder
  paintArt(ctx, artCells(ART_ARMOUR), MATERIALS[gear.armour]);
  paintArt(ctx, artCells(ART_HELMET), MATERIALS[gear.helmet]);
  paintArt(ctx, artCells(ART_SHIELD), MATERIALS[gear.shield]);
  paintArt(ctx, ART_SWORD, MATERIALS[gear.sword]);
  paintArt(ctx, ART_FIST);                      // the fist wraps around the grip
}

function renderLevel() {
  const today = todayString();
  renderStats(today);
  const level = getLevel(today);
  const ascension = getAscension();

  levelLabel.textContent = `Level ${level}`;
  // Draw the adventurer, and name the gear for screen readers / on hover
  const gear = gearOn(today);
  drawAdventurer(adventurerArt, gear);
  adventurerButton.title = gearText(gear);
  adventurerButton.setAttribute("aria-label", `Open stats. ${gearText(gear)}`);
  ascensionLabel.textContent = `Ascension: ${ascension}`;
  // Today's date; redrawn with everything else, so it also changes at midnight
  todayDateLabel.textContent = formatDayLabel(todayString());

  // Pop up a message only when something went up since the last redraw
  if (shownAscension !== null && ascension > shownAscension) {
    showLevelUpMessage("Ascension!");
  } else if (shownLevel !== null && level > shownLevel) {
    showLevelUpMessage("Level-up!");
  }
  shownLevel = level;
  shownAscension = ascension;
}


// ===== Main screen: today's tasks and the progress bar =====

const carriedSection = document.getElementById("carried-section");
const carriedList = document.getElementById("carried-list");
const todaySlots = document.getElementById("today-slots");
const standingSection = document.getElementById("standing-section");
const standingList = document.getElementById("standing-list");
const standingDueNote = document.getElementById("standing-due-note");
const firstQuestBox = document.getElementById("first-quest");
const todaySection = document.getElementById("today-section");

// Crossed swords, drawn on an 8x8 pixel grid, shown in the box of a ticked task.
// Each sword: blade (white) from a top corner to the middle, then guard, handle
// and pommel (yellow) towards the opposite bottom corner.
const CROSSED_SWORDS_SVG = `
  <svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
    <g class="sword-blade">
      <rect x="0" y="0" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/>
      <rect x="2" y="2" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/>
      <rect x="7" y="0" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/>
      <rect x="5" y="2" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/>
    </g>
    <g class="sword-hilt">
      <rect x="3" y="5" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/>
      <rect x="4" y="4" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/>
      <rect x="6" y="6" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/>
      <rect x="2" y="3" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/>
      <rect x="3" y="4" width="1" height="1"/><rect x="2" y="5" width="1" height="1"/>
      <rect x="1" y="6" width="1" height="1"/><rect x="0" y="7" width="1" height="1"/>
    </g>
  </svg>`;
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");

// Sort tasks morning -> ... -> any time (tasks with the same time keep their order)
function sortByTiming(tasks) {
  return tasks.sort((a, b) => TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing));
}

// Standing quests: soonest deadline first, "no deadline" last
function sortByDeadline(tasks) {
  const key = (h) => h.date || "9999-99-99"; // no deadline sorts after any date
  return tasks.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// The small text under a standing quest's name on the Main screen
function standingDetailsText(habit, today) {
  if (!habit.date) return "no deadline";
  if (habit.date === today) return "due today";
  if (habit.date < today) return formatDate(habit.date); // shown after "Overdue"
  return `by ${formatDate(habit.date)}`;
}

// Build one tappable task row.
// showTiming: whether to print the time of day (not needed inside a slot,
// since the slot's label already says it).
function makeTaskRow(habit, today, showTiming) {
  const done = isDone(habit, today);

  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = done ? "task done" : "task";
  button.setAttribute("aria-pressed", done); // tells screen readers it's ticked

  const box = document.createElement("span");
  box.className = "task-box";
  if (done) box.innerHTML = CROSSED_SWORDS_SVG; // fixed icon, no user text, so innerHTML is safe

  const text = document.createElement("span");
  text.className = "task-text";

  const name = document.createElement("span");
  name.className = "task-name";
  name.textContent = habit.name;

  const details = document.createElement("span");
  details.className = "task-details";
  if (habit.standing) {
    details.textContent = standingDetailsText(habit, today);
    // Past its deadline and not done: a pink "Overdue" label in front
    if (habit.date && habit.date < today && !done) {
      const overdue = document.createElement("span");
      overdue.className = "overdue";
      overdue.textContent = "Overdue";
      details.prepend(overdue);
    }
  } else {
    details.textContent = showTiming
      ? `${habit.exp} exp · ${TIMING_LABELS[habit.timing]}`
      : `${habit.exp} exp`;
  }
  const chip = makeCategoryChip(habit.category);
  if (chip) details.prepend(chip);   // category label goes first on the line

  text.append(name, details);
  button.append(box, text);
  button.addEventListener("click", () => toggleDone(habit));
  item.append(button);
  return item;
}

function renderMainScreen() {
  const today = todayString();

  const { carried, dueToday } = getTodayTasks(today);

  // Carried-over tasks: one list, sorted by time, each row says its time
  carriedList.innerHTML = "";
  for (const habit of sortByTiming(carried)) carriedList.append(makeTaskRow(habit, today, true));
  carriedSection.hidden = carried.length === 0;

  // No quests at all yet: show the "Add your first quest" button instead of
  // the empty time slots, so a new user knows where to start
  const noQuests = habits.length === 0;
  firstQuestBox.hidden = !noQuests;
  todaySection.hidden = noQuests;

  // Today's tasks: one slot per time of day, in order
  todaySlots.innerHTML = "";
  for (const timing of TIMING_ORDER) {
    const tasksInSlot = dueToday.filter((h) => h.timing === timing);

    // The four day slots are always shown; "any time" only if it has tasks
    if (timing === "anytime" && tasksInSlot.length === 0) continue;

    const slot = document.createElement("div");
    slot.className = "slot";

    const label = document.createElement("p");
    label.className = "slot-label";
    label.textContent = TIMING_LABELS[timing];

    const list = document.createElement("ul");
    list.className = "task-list";
    for (const habit of tasksInSlot) list.append(makeTaskRow(habit, today, false));

    slot.append(label, list);
    todaySlots.append(slot);
  }

  // Standing quests: their own list at the bottom, soonest deadline first
  const standing = getStandingQuests(today);
  standingList.innerHTML = "";
  for (const habit of sortByDeadline(standing)) standingList.append(makeTaskRow(habit, today, false));
  standingSection.hidden = standing.length === 0;

  // Under the bar: a reminder if a standing quest is due today and not ticked
  const standingDueLeft = getStandingDueToday(today).filter((h) => !isDoneOnDay(h.id, today));
  const n = standingDueLeft.length;
  standingDueNote.hidden = n === 0;
  standingDueNote.textContent = `${n} standing quest${n === 1 ? "" : "s"} due today`;

  // Progress bar: exp of ticked tasks out of the exp of all of today's tasks
  const { total, earned } = getTodayExp(today);

  if (total === 0) {
    progressFill.style.width = "0%";
    progressLabel.textContent = "No quests today";
  } else {
    progressFill.style.width = `${(earned / total) * 100}%`;
    progressLabel.textContent = `${earned} / ${total} exp`;
  }
}

// Redraw both screens (after any change to habits or ticks)
function renderAll() {
  updateTodayRecord();  // first: is today complete now? (this sets the level)
  renderLevel();
  renderMainScreen();
  renderHabitList();
  renderNotes();
}


// ===== Habits screen: drawing the list =====

const habitList = document.getElementById("habit-list");
const habitsEmpty = document.getElementById("habits-empty");
const habitsNoMatch = document.getElementById("habits-no-match");


// ===== Habits screen: filters =====

// The filters as they are when nothing has been chosen yet
const DEFAULT_FILTERS = {
  category: "all",      // "all" | "strength" | "mind" | "constitution" | "none"
  type: "all",          // "all" | "oneoff" | "repeating" | "standing"
  showCompleted: false, // show one-off quests that are already done?
};

// Load the last chosen filters. Spreading DEFAULT_FILTERS first fills in
// anything missing, e.g. if a future version adds a new filter.
let filters = { ...DEFAULT_FILTERS, ...loadFromStorage(FILTERS_KEY, {}) };

function saveFilters() {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
}

// Should this quest be shown with the current filters?
function matchesFilters(habit, today) {
  // Category: "none" means quests without a category (older ones have no field at all)
  if (filters.category === "none" && habit.category) return false;
  if (filters.category !== "all" && filters.category !== "none"
      && habit.category !== filters.category) return false;

  // Type: one-off tasks have repeat === null and aren't standing quests
  if (filters.type === "oneoff" && (habit.repeat || habit.standing)) return false;
  if (filters.type === "repeating" && !habit.repeat) return false;
  if (filters.type === "standing" && !habit.standing) return false;

  // Done one-off (and standing) quests are hidden unless "Show completed" is ticked.
  // (Repeating habits are never "finished", so they always pass this check.)
  if (!filters.showCompleted && !habit.repeat && isDone(habit, today)) return false;

  return true;
}

const filterButtons = document.querySelectorAll(".filter-option");
const showCompletedBox = document.getElementById("show-completed");

// Light up the chosen option in each row, and tick the box if needed
function renderFilterControls() {
  filterButtons.forEach((button) => {
    const isChosen = filters[button.dataset.group] === button.dataset.value;
    button.classList.toggle("selected", isChosen);
    button.setAttribute("aria-pressed", isChosen);
  });
  showCompletedBox.checked = filters.showCompleted;
}

// Tapping an option chooses it for its row (category or type)
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filters[button.dataset.group] = button.dataset.value;
    saveFilters();
    renderFilterControls();
    renderHabitList();
  });
});

showCompletedBox.addEventListener("change", () => {
  filters.showCompleted = showCompletedBox.checked;
  saveFilters();
  renderHabitList();
});

renderFilterControls(); // show the remembered filters at start-up


// ===== Habits screen: the list itself =====

function renderHabitList() {
  habitList.innerHTML = "";              // clear the old list
  habitsEmpty.hidden = habits.length > 0; // "No quests yet" only if empty

  const today = todayString();
  const shown = habits.filter((habit) => matchesFilters(habit, today));
  // "No quests match" only if there are quests, but the filters hide them all
  habitsNoMatch.hidden = habits.length === 0 || shown.length > 0;

  for (const habit of shown) {
    const item = document.createElement("li");
    item.className = "habit-item";

    const name = document.createElement("p");
    name.className = "habit-name";
    // textContent (not innerHTML) so a name like "<b>" is shown as plain text
    name.textContent = habit.name;

    // Repeating habits show their repeat type; one-off tasks show their date
    const details = document.createElement("p");
    details.className = "habit-details";
    if (habit.standing) {
      // Standing quests have no exp or time of day, just an optional deadline
      details.textContent = habit.date
        ? `Standing · by ${formatDate(habit.date)}`
        : "Standing · no deadline";
    } else {
      // Repeating habits show their repeat type; one-off tasks show their date
      const when = habit.repeat ? REPEAT_LABELS[habit.repeat] : formatDate(habit.date);
      details.textContent = `${habit.exp} exp · ${when} · ${TIMING_LABELS[habit.timing]}`;
    }
    const chip = makeCategoryChip(habit.category);
    if (chip) details.prepend(chip);

    // Edit and Delete buttons for this habit
    const actions = document.createElement("div");
    actions.className = "habit-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openForm(habit));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () =>
      confirmTwice(deleteButton, "Delete", "Sure?", () => deleteHabit(habit.id))
    );

    actions.append(editButton, deleteButton);
    item.append(name, details, actions);
    habitList.append(item);
  }
}

// Two-tap safety check, used by Delete and Reset everything.
// The first tap changes the button to askText (in pink); a second tap within
// 3 seconds runs onConfirm. Otherwise the button goes back to normalText.
const CONFIRM_TIME = 3000; // milliseconds

function confirmTwice(button, normalText, askText, onConfirm) {
  if (button.classList.contains("confirming")) {
    // Second tap: do it
    button.classList.remove("confirming");
    button.textContent = normalText;
    onConfirm();
    return;
  }

  // First tap: ask for confirmation
  button.classList.add("confirming");
  button.textContent = askText;
  setTimeout(() => {
    button.classList.remove("confirming");
    button.textContent = normalText;
  }, CONFIRM_TIME);
}

function deleteHabit(habitId) {
  habits = habits.filter((habit) => habit.id !== habitId); // keep all others
  removeFromLog(habitId);   // forget its ticks too
  saveHabits();
  saveCompletions();
  renderAll();              // today's goal changes right away
}


// ===== Reset everything (for testing) =====

const resetButton = document.getElementById("reset-button");

resetButton.addEventListener("click", () =>
  confirmTwice(resetButton, "Reset everything", "Sure? Tap again", resetEverything)
);

function resetEverything() {
  // Wipe the saved data...
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COMPLETIONS_KEY);
  localStorage.removeItem(COMPLETED_DAYS_KEY);
  localStorage.removeItem(NOTES_KEY);
  // ...and the copies in memory
  habits = [];
  completions = {};
  completedDays = {};
  notes = [];
  // Forget the last shown level, so no message pops up after the reset
  shownLevel = null;
  shownAscension = null;
  renderAll();
}


// ===== Backup: export and import =====
// A backup is a small JSON text file with everything the game needs:
// quests, ticks and completed days (level and ascension come from those),
// and notes. Backups from before notes existed simply have no notes.
// Filters are a display setting, so they aren't included.

const BACKUP_VERSION = 1; // bump if the file layout ever changes

const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const importFile = document.getElementById("import-file");
const backupMessage = document.getElementById("backup-message");
const importModal = document.getElementById("import-modal");
const importSummary = document.getElementById("import-summary");
const importReplaceButton = document.getElementById("import-replace");
const importMergeButton = document.getElementById("import-merge");
const importCancelButton = document.getElementById("import-cancel");

// The backup that was read from the file, waiting for Replace or Merge
let pendingBackup = null;

function showBackupMessage(text) {
  backupMessage.textContent = text;
}

// ----- Export -----
// Build the file in memory, then "click" a temporary download link for it.
exportButton.addEventListener("click", () => {
  const backup = {
    app: "jobits",              // so Import can recognise its own files
    version: BACKUP_VERSION,
    exported: new Date().toISOString(),
    habits: habits,
    completions: completions,
    completedDays: completedDays,
    notes: notes,
  };
  const text = JSON.stringify(backup, null, 2); // indented, readable by humans
  const file = new Blob([text], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `jobits-backup-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(link.href); // free the memory again

  showBackupMessage(`Saved ${link.download}`);
});

// ----- Import, part 1: pick and check a file -----
// The Import button opens the hidden file picker
importButton.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = ""; // so picking the same file again still works
  if (!file) return;     // the picker was closed without choosing

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    showBackupMessage("That file isn't a Jobits backup.");
    return;
  }
  if (!isValidBackup(backup)) {
    showBackupMessage("That file isn't a Jobits backup.");
    return;
  }

  pendingBackup = backup;
  const questCount = backup.habits.length;
  const dayCount = Object.keys(backup.completions).length;
  const noteCount = (backup.notes || []).length;
  importSummary.textContent =
    `This backup has ${questCount} quest${questCount === 1 ? "" : "s"}, ` +
    `${dayCount} day${dayCount === 1 ? "" : "s"} of ticks ` +
    `and ${noteCount} note${noteCount === 1 ? "" : "s"}.`;
  showBackupMessage("");
  openPopup(importModal, closeImport);
});

// Check the file really is a Jobits backup with the expected pieces,
// so a wrong or damaged file can't break the app's data.
function isValidBackup(backup) {
  const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  if (!isObject(backup) || backup.app !== "jobits") return false;
  if (!Array.isArray(backup.habits)) return false;
  if (!isObject(backup.completions) || !isObject(backup.completedDays)) return false;

  // Every quest needs at least an id, a name, an exp value and a date
  const questsOk = backup.habits.every((habit) =>
    isObject(habit) &&
    typeof habit.id === "string" &&
    typeof habit.name === "string" &&
    typeof habit.exp === "number" &&
    // a date, except standing quests, which may have no deadline (null)
    (typeof habit.date === "string" || (habit.standing === true && habit.date === null))
  );
  // Every day of ticks must be a list of quest ids
  const ticksOk = Object.values(backup.completions).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string")
  );
  // Notes are optional (older backups have none); if there, each needs an id and title
  const notesOk = backup.notes === undefined || (
    Array.isArray(backup.notes) &&
    backup.notes.every((note) =>
      isObject(note) && typeof note.id === "string" && typeof note.title === "string"
    )
  );
  return questsOk && ticksOk && notesOk;
}

// ----- Import, part 2: replace or merge -----

function closeImport() {
  closePopup(importModal);
  pendingBackup = null;
}

// Save everything, forget the last shown level (so no "Level-up!" pops up
// just because the data changed), redraw, and say what happened.
function finishImport(message) {
  saveHabits();
  saveCompletions();
  saveCompletedDays();
  saveNotes();
  shownLevel = null;
  shownAscension = null;
  closeImport();
  renderAll();
  showBackupMessage(message);
}

// Replace: throw away this phone's data and use the backup's (two taps)
importReplaceButton.addEventListener("click", () =>
  confirmTwice(importReplaceButton, "Replace", "Sure?", () => {
    habits = pendingBackup.habits;
    completions = pendingBackup.completions;
    completedDays = pendingBackup.completedDays;
    notes = pendingBackup.notes || [];
    finishImport("Backup loaded (replaced).");
  })
);

// Merge: combine the backup with this phone's data
importMergeButton.addEventListener("click", () => {
  const backup = pendingBackup;

  // Quests: add the ones this phone doesn't have yet. If a quest is in both,
  // keep this phone's version (it's probably the newer one).
  const knownIds = new Set(habits.map((habit) => habit.id));
  const newQuests = backup.habits.filter((habit) => !knownIds.has(habit.id));
  habits = habits.concat(newQuests);

  // Ticks: a quest counts as ticked on a day if it was ticked in either copy
  for (const [day, ids] of Object.entries(backup.completions)) {
    const merged = new Set([...(completions[day] || []), ...ids]);
    completions[day] = [...merged];
  }

  // Completed days: a day counts as completed if it was in either copy
  for (const [day, done] of Object.entries(backup.completedDays)) {
    if (done) completedDays[day] = true;
  }

  // Notes: like quests, add the missing ones; if in both, keep this phone's
  const knownNoteIds = new Set(notes.map((note) => note.id));
  notes = notes.concat((backup.notes || []).filter((note) => !knownNoteIds.has(note.id)));

  finishImport(`Backup merged (${newQuests.length} new quest${newQuests.length === 1 ? "" : "s"}).`);
});

importCancelButton.addEventListener("click", closeImport);


// ===== "New habit" / "Edit habit" form =====
// The same form is used for both. editingId tells us which mode we're in:
// null = adding a new habit, otherwise = the id of the habit being edited.

let editingId = null;

const modal = document.getElementById("habit-modal");
const form = document.getElementById("habit-form");
const formTitle = document.getElementById("form-title");
const nameInput = document.getElementById("habit-name");
const expInput = document.getElementById("habit-exp");
const dateInput = document.getElementById("habit-date");
const timingSelect = document.getElementById("habit-timing");
const standingCheckbox = document.getElementById("habit-standing");
const expField = document.getElementById("exp-field");
const dateLabel = document.getElementById("date-label");
const noDeadlineButton = document.getElementById("no-deadline");
const timingField = document.getElementById("timing-field");
const repeatField = document.getElementById("repeat-field");
const repeatingCheckbox = document.getElementById("habit-repeating");
const repeatOptions = document.getElementById("repeat-options");
const repeatSelect = document.getElementById("habit-repeat");
const formError = document.getElementById("form-error");
const categoryButtons = document.querySelectorAll(".category-option");

// The category chosen in the form (null = none)
let selectedCategory = null;

// Draw each sticker's pixel icon once, at start-up
categoryButtons.forEach((button) => {
  button.querySelector(".category-icon").innerHTML = CATEGORIES[button.dataset.category].icon;
});

// Choose a category in the form, and highlight only that sticker
function selectCategory(category) {
  selectedCategory = category;
  categoryButtons.forEach((button) => {
    const isChosen = button.dataset.category === category;
    button.classList.toggle("selected", isChosen);
    button.setAttribute("aria-pressed", isChosen);
  });
}

// Tapping a sticker chooses it; tapping the chosen one again clears it
categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    selectCategory(selectedCategory === category ? null : category);
  });
});

// Save stays greyed out until the quest has a name
const saveButton = document.getElementById("habit-save");

function updateSaveButton() {
  saveButton.disabled = nameInput.value.trim() === "";
}

nameInput.addEventListener("input", updateSaveButton);

// Open the form. With no habit given, it's a blank "New habit" form;
// with a habit given, its fields are filled in for editing.
function openForm(habit = null) {
  form.reset();                       // empty all fields
  formError.textContent = "";

  if (habit) {
    editingId = habit.id;
    formTitle.textContent = "Edit quest";
    nameInput.value = habit.name;
    standingCheckbox.checked = habit.standing === true;
    expInput.value = habit.standing ? "" : habit.exp;
    setFormDate(habit.date || "");       // standing quests may have no deadline
    timingSelect.value = habit.timing;
    repeatingCheckbox.checked = habit.repeat !== null;
    if (habit.repeat) repeatSelect.value = habit.repeat;
    selectCategory(habit.category || null); // older quests have no category
  } else {
    editingId = null;
    formTitle.textContent = "New quest";
    setFormDate(todayString());       // default date: today
    selectCategory(null);
  }

  updateFormFields(); // show only the fields that fit this kind of quest
  updateSaveButton();
  openPopup(modal, closeForm);
  // For a new quest, put the cursor in the name field (you always type one).
  // When editing, don't: on a phone that would pop up the keyboard and cover
  // the form, even if you only wanted to change e.g. the category.
  if (!habit) nameInput.focus();
}

function closeForm() {
  closePopup(modal);
  document.activeElement.blur(); // take the cursor out of the hidden form
}

// (Wrapped in a function so the click event isn't passed in as a "habit")
document.getElementById("add-button").addEventListener("click", () => openForm());
document.getElementById("first-quest-button").addEventListener("click", () => openForm());
document.getElementById("cancel-button").addEventListener("click", closeForm);

// Show or hide the repeat options when "Repeating" is ticked/unticked
repeatingCheckbox.addEventListener("change", updateFormFields);

// Show or hide form fields depending on the kind of quest
function updateFormFields() {
  const standing = standingCheckbox.checked;
  // Standing quests have no exp, time of day or repeat
  expField.hidden = standing;
  timingField.hidden = standing;
  repeatField.hidden = standing;
  // ...and their date is an optional deadline
  dateLabel.textContent = standing ? "Deadline (optional)" : "Date";
  noDeadlineButton.hidden = !standing;
  // Repeat options only if "Repeating" is ticked
  repeatOptions.hidden = !repeatingCheckbox.checked;
}

standingCheckbox.addEventListener("change", () => {
  if (standingCheckbox.checked && editingId === null) {
    setFormDate("");                       // new standing quest: no deadline to start with
  } else if (!standingCheckbox.checked && dateInput.value === "") {
    setFormDate(todayString());            // normal quests need a date: default today
  } else {
    setFormDate(dateInput.value);          // just update the button's wording
  }
  updateFormFields();
});

noDeadlineButton.addEventListener("click", () => setFormDate(""));

// "Save" pressed (or Enter in a field)
form.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the browser from reloading the page

  const name = nameInput.value.trim(); // trim() removes spaces at the ends
  const exp = Number(expInput.value);
  const date = dateInput.value;

  // Check the input; show a message and stop if something is wrong
  if (name === "") {
    formError.textContent = "Please enter a name.";
    return;
  }

  // Standing quest: only the name is required
  if (standingCheckbox.checked) {
    saveQuest({
      name: name,
      exp: 0,               // standing quests give no exp
      date: date || null,   // the deadline, or null for "no deadline"
      repeat: null,
      timing: "anytime",
      category: selectedCategory,
      standing: true,
    });
    return;
  }

  if (!Number.isInteger(exp) || exp < 1) {
    formError.textContent = "Exp must be a whole number of 1 or more.";
    return;
  }
  if (date === "") {
    formError.textContent = "Please pick a date.";
    return;
  }

  // The values from the form (everything except the id)
  const fields = {
    name: name,
    exp: exp,
    date: date,
    repeat: repeatingCheckbox.checked ? repeatSelect.value : null, // null = one-off task
    timing: timingSelect.value,
    category: selectedCategory, // null = no category
    standing: false,
  };
  saveQuest(fields);
});

// Add a new quest, or overwrite the one being edited, then save and redraw
function saveQuest(fields) {
  if (editingId === null) {
    // New habit: give it a fresh id and add it to the end of the list
    habits.push({ id: makeId(), ...fields });
  } else {
    // Editing: find the habit and overwrite its fields (the id stays the same)
    const habit = habits.find((h) => h.id === editingId);
    Object.assign(habit, fields);
  }

  saveHabits();
  renderAll();   // today's goal changes right away
  closeForm();
}


// ===== Notes screen =====
// Notes are separate from quests: they don't give exp or affect the game.

// The pixel icons a note can have. Same text-picture method as the category
// icons: every "X" is one pixel.
const NOTE_ICONS = {
  cart: pixelIcon([      // shopping cart
    "XX......",
    ".X......",
    ".XXXXXXX",
    ".X.X.X.X",
    ".XXXXXXX",
    ".X......",
    ".XXXXXX.",
    "..X...X.",
  ]),
  book: pixelIcon([      // closed book, pages on the right
    "XXXXXX..",
    "X....XX.",
    "X.XX.XX.",
    "X....XX.",
    "X.XX.XX.",
    "X....XX.",
    "XXXXXXX.",
    ".XXXXXX.",
  ]),
  star: pixelIcon([
    "...XX...",
    "...XX...",
    "XXXXXXXX",
    ".XXXXXX.",
    "..XXXX..",
    ".XXXXXX.",
    ".XX..XX.",
    "X......X",
  ]),
  bulb: pixelIcon([      // light bulb, for ideas
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    "XXXXXXXX",
    ".XXXXXX.",
    "..X..X..",
    "..XXXX..",
    "...XX...",
  ]),
  house: pixelIcon([
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    ".XXXXXX.",
    ".XX..XX.",
    ".XX..XX.",
    ".XX..XX.",
  ]),
  gift: pixelIcon([      // present with a bow; the gap is the ribbon
    "..X..X..",
    "...XX...",
    "XXXXXXXX",
    "XXX..XXX",
    ".XX..XX.",
    ".XX..XX.",
    ".XX..XX.",
    ".XXXXXX.",
  ]),
  music: pixelIcon([     // two beamed music notes
    "..XXXXXX",
    "..X....X",
    "..X....X",
    "..X....X",
    ".XX...XX",
    "XXX..XXX",
    "XXX..XXX",
    ".X....X.",
  ]),
  pin: pixelIcon([       // push pin
    "..XXXX..",
    "..XXXX..",
    "..XXXX..",
    ".XXXXXX.",
    "XXXXXXXX",
    "...XX...",
    "...XX...",
    "...X....",
  ]),
};

// The Notes dot in the bottom indicator: a page with lines of text
document.getElementById("notes-dot").innerHTML = pixelIcon([
  "XXXXXX..",
  "X....XX.",
  "X.XX..X.",
  "X.....X.",
  "X.XXX.X.",
  "X.....X.",
  "X.XX..X.",
  "XXXXXXX.",
]);

const noteList = document.getElementById("note-list");
const notesEmpty = document.getElementById("notes-empty");

// A check mark for ticked checklist items
const CHECK_SVG = pixelIcon([
  "........",
  ".......X",
  "......XX",
  "X....XX.",
  "XX..XX..",
  ".XXXX...",
  "..XX....",
  "........",
]);

// The icon and title line of a note card (plus "2/5" for checklists)
function makeNoteHeader(note) {
  const header = document.createElement("span");
  header.className = "note-header";
  if (note.icon && NOTE_ICONS[note.icon]) {
    const icon = document.createElement("span");
    icon.className = "note-icon";
    icon.innerHTML = NOTE_ICONS[note.icon]; // fixed icon, no user text: safe
    header.append(icon);
  }
  const title = document.createElement("span");
  title.className = "note-title";
  title.textContent = note.title; // textContent: user text shown as plain text
  header.append(title);

  if (note.kind === "checklist") {
    const items = note.items || [];
    const count = document.createElement("span");
    count.className = "note-count";
    count.textContent = `${items.filter((i) => i.done).length}/${items.length}`;
    header.append(count);
  }
  return header;
}

// Free-text note: the whole card is one button that opens the form
function makeTextNoteCard(note) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "note-card";
  card.append(makeNoteHeader(note));

  if (note.text) {
    const preview = document.createElement("span");
    preview.className = "note-preview";
    preview.textContent = note.text;
    card.append(preview);
  }
  card.addEventListener("click", () => openNoteForm(note));
  return card;
}

// Checklist note: the header opens the form (title, icon, delete), and the
// items can be ticked, deleted and added right on the card.
// (Buttons can't contain other buttons, so here the card itself is a <div>.)
function makeChecklistCard(note) {
  const card = document.createElement("div");
  card.className = "note-card";

  const headerButton = document.createElement("button");
  headerButton.type = "button";
  headerButton.className = "note-header-button";
  headerButton.append(makeNoteHeader(note));
  headerButton.addEventListener("click", () => openNoteForm(note));

  const list = document.createElement("ul");
  list.className = "check-list";
  for (const entry of note.items || []) {
    const row = document.createElement("li");
    row.className = entry.done ? "check-item done" : "check-item";

    // Tap the item to tick or un-tick it
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "check-toggle";
    toggle.setAttribute("aria-pressed", entry.done);
    const box = document.createElement("span");
    box.className = "check-box";
    if (entry.done) box.innerHTML = CHECK_SVG; // fixed icon: safe
    const text = document.createElement("span");
    text.className = "check-text";
    text.textContent = entry.text;
    toggle.append(box, text);
    toggle.addEventListener("click", () => {
      entry.done = !entry.done;
      saveNotes();
      renderNotes();
    });

    // The ✕ deletes the item straight away (it's quick to add back)
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "check-remove";
    remove.setAttribute("aria-label", `Delete ${entry.text}`);
    remove.textContent = "✕";
    remove.addEventListener("click", () => {
      note.items = note.items.filter((i) => i.id !== entry.id);
      saveNotes();
      renderNotes();
    });

    row.append(toggle, remove);
    list.append(row);
  }

  // "Add item": a small form, so the phone's Enter key also adds the item
  const addForm = document.createElement("form");
  addForm.className = "check-add";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 60;
  input.placeholder = "Add item";
  input.autocomplete = "off";
  input.dataset.noteId = note.id; // to find this field again after redrawing
  input.setAttribute("aria-label", `Add item to ${note.title}`);
  const addButton = document.createElement("button");
  addButton.type = "submit";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", "Add");
  // Greyed out while the field is empty, so it's clear there's nothing to add
  addButton.disabled = true;
  input.addEventListener("input", () => {
    addButton.disabled = input.value.trim() === "";
  });
  addForm.append(input, addButton);
  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const itemText = input.value.trim();
    if (itemText === "") return;
    note.items = note.items || [];
    note.items.push({ id: makeId(), text: itemText, done: false });
    saveNotes();
    renderNotes();
    // Redrawing replaced the field; put the cursor back so you can keep adding
    noteList.querySelector(`input[data-note-id="${note.id}"]`).focus();
  });

  card.append(headerButton, list, addForm);
  return card;
}

// One card per note, in the order they were made
function renderNotes() {
  noteList.innerHTML = "";
  notesEmpty.hidden = notes.length > 0;

  for (const note of notes) {
    const item = document.createElement("li");
    item.append(note.kind === "checklist" ? makeChecklistCard(note) : makeTextNoteCard(note));
    noteList.append(item);
  }
}

// ----- The note form -----

const noteModal = document.getElementById("note-modal");
const noteForm = document.getElementById("note-form");
const noteFormTitle = document.getElementById("note-form-title");
const noteTitleInput = document.getElementById("note-title");
const noteTextInput = document.getElementById("note-text");
const noteFormError = document.getElementById("note-form-error");
const noteDeleteButton = document.getElementById("note-delete");
const iconPicker = document.getElementById("icon-picker");
const addNoteButton = document.getElementById("add-note-button");
const noteKindField = document.getElementById("note-kind-field");
const noteTextField = document.getElementById("note-text-field");
const kindButtons = document.querySelectorAll(".kind-picker button");

let editingNoteId = null;   // null = new note, otherwise the id being edited
let selectedNoteIcon = null; // null = no icon
let selectedNoteKind = "text"; // "text" or "checklist"

// Choose the kind of a new note; checklists have no text box
function selectNoteKind(kind) {
  selectedNoteKind = kind;
  kindButtons.forEach((button) => {
    const isChosen = button.dataset.kind === kind;
    button.classList.toggle("selected", isChosen);
    button.setAttribute("aria-pressed", isChosen);
  });
  noteTextField.hidden = kind === "checklist";
}

kindButtons.forEach((button) =>
  button.addEventListener("click", () => selectNoteKind(button.dataset.kind))
);

// One button per icon in the picker, made once at start-up
for (const [name, svg] of Object.entries(NOTE_ICONS)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-option";
  button.dataset.icon = name;
  button.setAttribute("aria-label", name);
  button.innerHTML = svg;
  // Tapping an icon chooses it; tapping the chosen one again clears it
  button.addEventListener("click", () =>
    selectNoteIcon(selectedNoteIcon === name ? null : name)
  );
  iconPicker.append(button);
}

// Choose an icon in the form, and highlight only that button
function selectNoteIcon(icon) {
  selectedNoteIcon = icon;
  iconPicker.querySelectorAll(".icon-option").forEach((button) => {
    const isChosen = button.dataset.icon === icon;
    button.classList.toggle("selected", isChosen);
    button.setAttribute("aria-pressed", isChosen);
  });
}

// Like the quest form: Save stays greyed out until the note has a title
const noteSaveButton = document.getElementById("note-save");

function updateNoteSaveButton() {
  noteSaveButton.disabled = noteTitleInput.value.trim() === "";
}

noteTitleInput.addEventListener("input", updateNoteSaveButton);

// Open the form, empty for a new note, or filled in to edit one
function openNoteForm(note = null) {
  noteForm.reset();
  noteFormError.textContent = "";

  if (note) {
    editingNoteId = note.id;
    noteFormTitle.textContent = "Edit note";
    noteTitleInput.value = note.title;
    noteTextInput.value = note.text || "";
    selectNoteIcon(note.icon || null);
    selectNoteKind(note.kind === "checklist" ? "checklist" : "text");
  } else {
    editingNoteId = null;
    noteFormTitle.textContent = "New note";
    selectNoteIcon(null);
    selectNoteKind("text");
  }
  // The kind can only be chosen when creating a note
  noteKindField.hidden = note !== null;
  noteDeleteButton.hidden = note === null; // can only delete existing notes
  updateNoteSaveButton();
  openPopup(noteModal, closeNoteForm);
  // Like quests: the keyboard only pops up by itself for a new note
  if (!note) noteTitleInput.focus();
}

function closeNoteForm() {
  closePopup(noteModal);
  document.activeElement.blur(); // take the cursor out of the hidden form
}

// (Wrapped in a function so the click event isn't passed in as a "note")
addNoteButton.addEventListener("click", () => openNoteForm());
document.getElementById("note-cancel").addEventListener("click", closeNoteForm);

noteForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the browser from reloading the page

  const title = noteTitleInput.value.trim();
  if (title === "") {
    noteFormError.textContent = "Please enter a title.";
    return;
  }

  const fields = {
    title: title,
    icon: selectedNoteIcon,  // null = no icon
  };
  if (selectedNoteKind === "text") fields.text = noteTextInput.value;

  if (editingNoteId === null) {
    // New note: free text, or an empty checklist to fill on its card
    const kindFields = selectedNoteKind === "checklist"
      ? { kind: "checklist", text: "", items: [] }
      : { kind: "text", items: [] };
    notes.push({ id: makeId(), ...kindFields, ...fields });
  } else {
    Object.assign(notes.find((n) => n.id === editingNoteId), fields);
  }
  saveNotes();
  renderNotes();
  closeNoteForm();
});

// Delete needs two taps, like deleting a quest
noteDeleteButton.addEventListener("click", () =>
  confirmTwice(noteDeleteButton, "Delete note", "Sure? Tap again", () => {
    notes = notes.filter((n) => n.id !== editingNoteId);
    saveNotes();
    renderNotes();
    closeNoteForm();
  })
);


// ===== Month grid =====
// Draws one month as a grid of days, weeks starting on Monday.
// Shared by the calendar (and, later, the date picker): each one decides
// what a day looks like by passing in its own makeDay function.

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// month: 0 = January ... 11 = December (like JavaScript's Date)
function buildMonthGrid(container, year, month, makeDay) {
  container.innerHTML = "";

  for (const name of WEEKDAY_HEADERS) {
    const header = document.createElement("span");
    header.className = "month-weekday";
    header.textContent = name;
    container.append(header);
  }

  // Empty squares before the 1st, so it lands under the right weekday.
  // getDay() counts from Sunday (0); "+ 6) % 7" makes Monday 0 instead.
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let i = 0; i < blanks; i++) {
    container.append(document.createElement("span"));
  }

  // "Day 0 of next month" is the last day of this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    container.append(makeDay(dateToString(new Date(year, month, day))));
  }
}

// e.g. "November 2026"
function formatMonthTitle(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}


// ===== Calendar popup =====

const calendarModal = document.getElementById("calendar-modal");
const calendarTitle = document.getElementById("calendar-title");
const calendarGrid = document.getElementById("calendar-grid");
const calendarDetails = document.getElementById("calendar-details");

let calendarYear = 0;
let calendarMonth = 0;
let calendarSelected = null; // the tapped day, "YYYY-MM-DD"

// The small calendar icon next to today's date
document.getElementById("today-date-icon").innerHTML = pixelIcon([
  ".X....X.",
  "XXXXXXXX",
  "XXXXXXXX",
  "X......X",
  "X.X.X.XX",
  "X......X",
  "X.X.X..X",
  "XXXXXXXX",
]);

// The first day anything was ticked. The app never stored when you started
// using it, so days before this aren't counted as missed.
function firstTrackedDay() {
  const days = [...Object.keys(completions), ...Object.keys(completedDays)].sort();
  return days.length > 0 ? days[0] : null;
}

// How did a day go? "completed", "missed", "today", "future" or "untracked"
function dayStatus(day, today) {
  if (completedDays[day]) return "completed";
  if (day > today) return "future";
  if (day === today) return "today";
  const first = firstTrackedDay();
  if (first === null || day < first) return "untracked";
  return "missed";
}

const STATUS_LABELS = {
  completed: "Completed",
  missed: "Missed",
  today: "In progress",
  untracked: "Not tracked",
};

// One square in the calendar
function makeCalendarDay(day) {
  const today = todayString();
  const status = dayStatus(day, today);

  const button = document.createElement("button");
  button.type = "button";
  button.className = `calendar-day ${status}`;
  if (day === today) button.classList.add("is-today");
  if (day === calendarSelected) button.classList.add("selected");
  button.textContent = Number(day.slice(8)); // "2026-11-05" -> 5
  button.setAttribute("aria-label", `${formatDayLabel(day)}: ${STATUS_LABELS[status] || "future"}`);

  if (status === "future") {
    button.disabled = true; // nothing to show yet
  } else {
    button.addEventListener("click", () => {
      calendarSelected = day;
      renderCalendar();
    });
  }
  return button;
}

// Under the grid: the tapped day's result and the quests ticked that day
function renderCalendarDetails() {
  calendarDetails.innerHTML = "";
  if (!calendarSelected) return;

  const today = todayString();
  const title = document.createElement("p");
  title.className = "calendar-details-title";
  title.textContent = `${formatDayLabel(calendarSelected)} · ${STATUS_LABELS[dayStatus(calendarSelected, today)]}`;
  calendarDetails.append(title);

  // The quests ticked that day (deleted quests have their ticks removed too)
  const ticked = (completions[calendarSelected] || [])
    .map((id) => habits.find((h) => h.id === id))
    .filter((h) => h !== undefined);

  if (ticked.length === 0) {
    const none = document.createElement("p");
    none.className = "placeholder";
    none.textContent = "Nothing ticked";
    calendarDetails.append(none);
    return;
  }
  const list = document.createElement("ul");
  list.className = "calendar-ticked";
  for (const habit of ticked) {
    const item = document.createElement("li");
    item.textContent = habit.name; // textContent: user text shown as plain text
    list.append(item);
  }
  calendarDetails.append(list);
}

function renderCalendar() {
  calendarTitle.textContent = formatMonthTitle(calendarYear, calendarMonth);
  buildMonthGrid(calendarGrid, calendarYear, calendarMonth, makeCalendarDay);
  renderCalendarDetails();
}

// Move a month back (-1) or forward (+1). new Date() handles the year change:
// e.g. month 12 of 2026 becomes January 2027.
function changeCalendarMonth(step) {
  const date = new Date(calendarYear, calendarMonth + step, 1);
  calendarYear = date.getFullYear();
  calendarMonth = date.getMonth();
  renderCalendar();
}

function openCalendar() {
  const today = parseDate(todayString());
  calendarYear = today.getFullYear();
  calendarMonth = today.getMonth();
  calendarSelected = todayString(); // show today's details to start with
  renderCalendar();
  openPopup(calendarModal, closeCalendar);
}

function closeCalendar() {
  closePopup(calendarModal);
}

document.getElementById("today-date").addEventListener("click", openCalendar);
document.getElementById("calendar-close").addEventListener("click", closeCalendar);
document.getElementById("calendar-prev").addEventListener("click", () => changeCalendarMonth(-1));
document.getElementById("calendar-next").addEventListener("click", () => changeCalendarMonth(1));


// ===== Stats popup =====
// Tapping the adventurer shows this month's stats in detail,
// with arrows to look back at previous months.

const statsModal = document.getElementById("stats-modal");
const statsTitle = document.getElementById("stats-title");
const statsDetail = document.getElementById("stats-detail");
const statsPrev = document.getElementById("stats-prev");
const statsNext = document.getElementById("stats-next");
const statsArt = document.getElementById("stats-art");
const statsGear = document.getElementById("stats-gear");

let statsYear = 0;
let statsMonth = 0; // 0 = January, like JavaScript dates

// e.g. (2026, 10) -> "2026-11"  (JavaScript counts months from 0)
function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// One block per stat: label, level, exp, and a bar towards the next level
function makeStatBlock(category, exp) {
  const level = statLevel(exp);
  const intoLevel = exp % EXP_PER_STAT_LEVEL;        // exp earned since the last level
  const toNext = EXP_PER_STAT_LEVEL - intoLevel;     // exp still needed for the next one

  const block = document.createElement("div");
  block.className = `stat-block cat-${category}`;

  const header = document.createElement("div");
  header.className = "stat-header";
  const name = document.createElement("span");
  name.textContent = CATEGORIES[category].name;
  name.prepend(makeCategoryChip(category));
  const levelText = document.createElement("span");
  levelText.className = "stat-level";
  levelText.textContent = `Level ${level}`;
  header.append(name, levelText);

  // The bar fills up from one level to the next (0 to 100 exp)
  const bar = document.createElement("div");
  bar.className = "progress stat-bar";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${(intoLevel / EXP_PER_STAT_LEVEL) * 100}%`;
  bar.append(fill);

  const expText = document.createElement("p");
  expText.className = "stat-exp";
  expText.textContent = `${exp} exp · ${toNext} to level ${level + 1}`;

  block.append(header, bar, expText);
  return block;
}

function renderStatsPopup() {
  statsTitle.textContent = formatMonthTitle(statsYear, statsMonth);
  const key = monthKey(statsYear, statsMonth);

  // The adventurer at the end of that month (today, for the current month).
  // "Day 0 of next month" is the last day of this month.
  const today = todayString();
  const lastDay = dateToString(new Date(statsYear, statsMonth + 1, 0));
  const gear = gearOn(lastDay < today ? lastDay : today);
  drawAdventurer(statsArt, gear);
  statsGear.textContent = gearText(gear);

  statsDetail.innerHTML = "";
  for (const [category, exp] of Object.entries(monthStats(key))) {
    statsDetail.append(makeStatBlock(category, exp));
  }

  // No going into the future, or back before the first month anything was ticked
  // ("YYYY-MM" strings sort like dates, so < and >= compare them correctly)
  const thisMonth = todayString().slice(0, 7);
  const first = firstTrackedDay();
  const firstMonth = first ? first.slice(0, 7) : thisMonth;
  statsNext.disabled = key >= thisMonth;
  statsPrev.disabled = key <= firstMonth;
}

// Move a month back (-1) or forward (+1)
function changeStatsMonth(step) {
  const date = new Date(statsYear, statsMonth + step, 1);
  statsYear = date.getFullYear();
  statsMonth = date.getMonth();
  renderStatsPopup();
}

function openStats() {
  const today = parseDate(todayString());
  statsYear = today.getFullYear();
  statsMonth = today.getMonth();
  renderStatsPopup();
  openPopup(statsModal, closeStats);
}

function closeStats() {
  closePopup(statsModal);
}

document.getElementById("adventurer").addEventListener("click", openStats);
document.getElementById("stats-close").addEventListener("click", closeStats);
statsPrev.addEventListener("click", () => changeStatsMonth(-1));
statsNext.addEventListener("click", () => changeStatsMonth(1));


// ===== Date picker (quest form) =====
// Jobits' own date picker, so weeks start on Monday whatever the phone's
// settings. The chosen date lives in the hidden #habit-date field; the
// button in the form shows it in words.

const dateButton = document.getElementById("habit-date-button");
const pickerModal = document.getElementById("picker-modal");
const pickerTitle = document.getElementById("picker-title");
const pickerGrid = document.getElementById("picker-grid");

let pickerYear = 0;
let pickerMonth = 0;

// e.g. "Sat 21 Nov 2026"
function formatLongDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).replace(",", ""); // some browsers put a comma after the weekday
}

// Set the form's date ("" = none) and update the button's text
function setFormDate(dateString) {
  dateInput.value = dateString;
  if (dateString) {
    dateButton.textContent = formatLongDate(dateString);
  } else {
    // Standing quests may have no deadline; other quests need a date
    dateButton.textContent = standingCheckbox.checked ? "No deadline" : "Pick a date";
  }
  dateButton.classList.toggle("empty", !dateString);
}

// One day in the picker: today outlined, the chosen day filled in
function makePickerDay(day) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "calendar-day picker-day";
  if (day === todayString()) button.classList.add("is-today");
  if (day === dateInput.value) button.classList.add("chosen");
  button.textContent = Number(day.slice(8)); // "2026-11-05" -> 5
  button.setAttribute("aria-label", formatLongDate(day));
  button.addEventListener("click", () => {
    setFormDate(day);
    closePicker();
  });
  return button;
}

function renderPicker() {
  pickerTitle.textContent = formatMonthTitle(pickerYear, pickerMonth);
  buildMonthGrid(pickerGrid, pickerYear, pickerMonth, makePickerDay);
}

function changePickerMonth(step) {
  const date = new Date(pickerYear, pickerMonth + step, 1);
  pickerYear = date.getFullYear();
  pickerMonth = date.getMonth();
  renderPicker();
}

// Open on the month of the chosen date (or this month, if none yet)
function openPicker() {
  const start = parseDate(dateInput.value || todayString());
  pickerYear = start.getFullYear();
  pickerMonth = start.getMonth();
  renderPicker();
  openPopup(pickerModal, closePicker);
}

function closePicker() {
  closePopup(pickerModal);
}

dateButton.addEventListener("click", openPicker);
document.getElementById("picker-prev").addEventListener("click", () => changePickerMonth(-1));
document.getElementById("picker-next").addEventListener("click", () => changePickerMonth(1));
document.getElementById("picker-cancel").addEventListener("click", closePicker);
document.getElementById("picker-today").addEventListener("click", () => {
  setFormDate(todayString());
  closePicker();
});


// ===== Screen switching =====
// Screen 0 = Notes, screen 1 = Main (today), screen 2 = Quests (habits).

const track = document.getElementById("track");
const dots = document.querySelectorAll(".dot");
const SCREEN_COUNT = 3;
const MAIN_SCREEN = 1;

let currentScreen = MAIN_SCREEN;

// Show the screen with the given number (0, 1 or 2).
function showScreen(index) {
  // Don't go past the first or last screen
  if (index < 0 || index >= SCREEN_COUNT) return;
  currentScreen = index;

  // If the cursor is in a text box (e.g. "Add item" on a checklist), take it
  // out, so the phone's keyboard closes instead of staying up on the new screen.
  if (document.activeElement.matches("input, textarea")) document.activeElement.blur();

  // Slide the track. Each screen is a third of the track's width,
  // so screen 1 means moving the track a third of the way to the left.
  track.style.transform = `translateX(-${(index * 100) / SCREEN_COUNT}%)`;

  // Highlight the matching dot in the indicator
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));

  // The "add note" button only belongs on the Notes screen
  addNoteButton.hidden = index !== 0;
}

// ----- Keyboard (computer) -----
document.addEventListener("keydown", (event) => {
  // While a popup is open, arrow keys are for moving the cursor in text
  // fields, not for switching screens. Escape closes the popup on top
  // (e.g. just the date picker, which sits on top of the quest form).
  if (isAnyPopupOpen()) {
    if (event.key === "Escape") closeTopPopup();
    return;
  }
  if (event.key === "ArrowRight") showScreen(currentScreen + 1);
  if (event.key === "ArrowLeft") showScreen(currentScreen - 1);
});

// ----- Swiping (phone) -----
// Remember where the finger touched down, then compare with where it lifted.
const SWIPE_MIN_DISTANCE = 50; // pixels the finger must move to count as a swipe
let touchStartX = 0;
let touchStartY = 0;
let touchStartedInField = false;

track.addEventListener("touchstart", (event) => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
  // A drag that starts in a text box is selecting text, not swiping
  touchStartedInField = event.target.closest("input, textarea, select") !== null;
});

track.addEventListener("touchend", (event) => {
  // no swiping while a popup is open
  if (isAnyPopupOpen()) return;
  if (touchStartedInField) return;

  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;

  // Ignore mostly-vertical movements (those are scrolling, not swiping)
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;

  // Finger moved left (dx negative) -> the screen to the right (e.g. Main -> Quests).
  // Finger moved right (dx positive) -> the screen to the left (e.g. Main -> Notes).
  if (dx < 0) showScreen(currentScreen + 1);
  else showScreen(currentScreen - 1);
});


// ===== A new day while the app is open =====
// Everything (level, carry-over, missed days, Monday reset) is worked out from
// the saved records and today's date, so when the date changes we only need to
// redraw. We check every 30 seconds, and also whenever the app comes back into
// view (phones pause timers while an app is in the background).

let shownDay = todayString();

function checkForNewDay() {
  const today = todayString();
  if (today === shownDay) return;
  shownDay = today;
  // A new day: don't treat the level change as a level-up message
  shownLevel = null;
  shownAscension = null;
  renderAll();
}

setInterval(checkForNewDay, 30 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForNewDay();
});


// ===== Start-up =====
showScreen(MAIN_SCREEN); // start on the Main screen
renderAll();        // draw all screens from the saved data

// Register the service worker (sw.js), which makes the app work offline
// and installable. Older browsers without support simply skip this.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker registration failed:", error);
  });
}
