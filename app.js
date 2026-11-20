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

// The list of all habits, kept in memory while the app is open.
// Each habit looks like:
// { id, name, exp, date: "YYYY-MM-DD", repeat: null | "daily" | ..., timing: "morning" | ... }
let habits = loadFromStorage(STORAGE_KEY, []);

// The log of ticked tasks: for each day, the ids of the tasks done that day.
// e.g. { "2026-11-20": ["id1", "id2"], "2026-11-21": ["id1"] }
let completions = loadFromStorage(COMPLETIONS_KEY, {});

// The record of fully completed days, e.g. { "2026-11-16": true, "2026-11-17": true }.
// Only today's entry is ever changed; once a day is over, its result is frozen.
// Level and ascension are both worked out from this record.
let completedDays = loadFromStorage(COMPLETED_DAYS_KEY, {});


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
  const carried = habits.filter(
    (h) => h.repeat === null && h.date < today && !isDoneOnOtherDay(h.id, today)
  );
  // Due today: everything whose date/repeat rule matches today
  const dueToday = habits.filter((h) => isDueOn(h, today));
  return { carried, dueToday };
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
// (A day with no tasks counts as missed.)
function isTodayComplete(today) {
  const { total, earned } = getTodayExp(today);
  return total > 0 && earned === total;
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
const swordName = document.getElementById("sword-name");
const ascensionLabel = document.getElementById("ascension-label");

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

function renderLevel() {
  const today = todayString();
  const level = getLevel(today);
  const ascension = getAscension();

  levelLabel.textContent = `Level ${level}`;
  swordName.textContent = `${SWORDS[level - 1]} sword`;
  ascensionLabel.textContent = `Ascension: ${ascension}`;

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
  details.textContent = showTiming
    ? `${habit.exp} exp · ${TIMING_LABELS[habit.timing]}`
    : `${habit.exp} exp`;

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
}


// ===== Habits screen: drawing the list =====

const habitList = document.getElementById("habit-list");
const habitsEmpty = document.getElementById("habits-empty");

function renderHabitList() {
  habitList.innerHTML = "";              // clear the old list
  habitsEmpty.hidden = habits.length > 0; // "No habits yet" only if empty

  for (const habit of habits) {
    const item = document.createElement("li");
    item.className = "habit-item";

    const name = document.createElement("p");
    name.className = "habit-name";
    // textContent (not innerHTML) so a name like "<b>" is shown as plain text
    name.textContent = habit.name;

    // Repeating habits show their repeat type; one-off tasks show their date
    const when = habit.repeat ? REPEAT_LABELS[habit.repeat] : formatDate(habit.date);

    const details = document.createElement("p");
    details.className = "habit-details";
    details.textContent = `${habit.exp} exp · ${when} · ${TIMING_LABELS[habit.timing]}`;

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
    deleteButton.addEventListener("click", () => handleDeleteClick(deleteButton, habit.id));

    actions.append(editButton, deleteButton);
    item.append(name, details, actions);
    habitList.append(item);
  }
}

// Delete needs two taps: the first asks "Sure?", the second deletes.
// If there's no second tap within 3 seconds, the button goes back to normal.
const DELETE_CONFIRM_TIME = 3000; // milliseconds

function handleDeleteClick(button, habitId) {
  if (button.classList.contains("confirming")) {
    // Second tap: keep every habit except this one
    habits = habits.filter((habit) => habit.id !== habitId);
    removeFromLog(habitId);   // forget its ticks too
    saveHabits();
    saveCompletions();
    renderAll();              // today's goal changes right away
    return;
  }

  // First tap: ask for confirmation
  button.classList.add("confirming");
  button.textContent = "Sure?";
  setTimeout(() => {
    button.classList.remove("confirming");
    button.textContent = "Delete";
  }, DELETE_CONFIRM_TIME);
}


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
const repeatingCheckbox = document.getElementById("habit-repeating");
const repeatOptions = document.getElementById("repeat-options");
const repeatSelect = document.getElementById("habit-repeat");
const formError = document.getElementById("form-error");

function isFormOpen() {
  return !modal.hidden;
}

// Open the form. With no habit given, it's a blank "New habit" form;
// with a habit given, its fields are filled in for editing.
function openForm(habit = null) {
  form.reset();                       // empty all fields
  formError.textContent = "";

  if (habit) {
    editingId = habit.id;
    formTitle.textContent = "Edit quest";
    nameInput.value = habit.name;
    expInput.value = habit.exp;
    dateInput.value = habit.date;
    timingSelect.value = habit.timing;
    repeatingCheckbox.checked = habit.repeat !== null;
    if (habit.repeat) repeatSelect.value = habit.repeat;
  } else {
    editingId = null;
    formTitle.textContent = "New quest";
    dateInput.value = todayString();  // default date: today
  }

  // Show the repeat options only if "Repeating" is ticked
  repeatOptions.hidden = !repeatingCheckbox.checked;
  modal.hidden = false;
  nameInput.focus();                  // put the cursor in the name field
}

function closeForm() {
  modal.hidden = true;
}

// (Wrapped in a function so the click event isn't passed in as a "habit")
document.getElementById("add-button").addEventListener("click", () => openForm());
document.getElementById("cancel-button").addEventListener("click", closeForm);

// Show or hide the repeat options when "Repeating" is ticked/unticked
repeatingCheckbox.addEventListener("change", () => {
  repeatOptions.hidden = !repeatingCheckbox.checked;
});

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
  };

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
});


// ===== Screen switching =====
// Screen 0 = Main (today), screen 1 = Habits.

const track = document.getElementById("track");
const dots = document.querySelectorAll(".dot");
const SCREEN_COUNT = 2;

let currentScreen = 0;

// Show the screen with the given number (0 or 1).
function showScreen(index) {
  // Don't go past the first or last screen
  if (index < 0 || index >= SCREEN_COUNT) return;
  currentScreen = index;

  // Slide the track. Each screen is 50% of the track's width,
  // so screen 1 means moving the track 50% to the left.
  track.style.transform = `translateX(-${index * 50}%)`;

  // Highlight the matching dot in the indicator
  dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
}

// ----- Keyboard (computer) -----
document.addEventListener("keydown", (event) => {
  // While the form is open, arrow keys are for moving the cursor in text
  // fields, not for switching screens. Escape closes the form.
  if (isFormOpen()) {
    if (event.key === "Escape") closeForm();
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

track.addEventListener("touchstart", (event) => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
});

track.addEventListener("touchend", (event) => {
  if (isFormOpen()) return; // no swiping while the form is open

  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;

  // Ignore mostly-vertical movements (those are scrolling, not swiping)
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;

  // Finger moved left (dx negative) -> go to the next screen (Habits).
  // Finger moved right (dx positive) -> go back (Main).
  if (dx < 0) showScreen(currentScreen + 1);
  else showScreen(currentScreen - 1);
});


// ===== Start-up =====
showScreen(0);      // start on the Main screen
renderAll();        // draw both screens from the saved data
