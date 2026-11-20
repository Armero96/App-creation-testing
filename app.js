// =====================================================================
// Jobits — app.js
// =====================================================================


// ===== Saving and loading habits (localStorage) =====
// localStorage is a small storage box inside the browser, on this device only.
// It can only store text, so we convert our list to text (JSON) when saving
// and back into a list when loading.

const STORAGE_KEY = "jobits.habits";

function loadHabits() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : [];   // nothing saved yet -> empty list
  } catch (error) {
    // Storage blocked or data unreadable: start with an empty list
    console.warn("Could not load habits:", error);
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// The list of all habits, kept in memory while the app is open.
// Each habit looks like:
// { id, name, exp, date: "YYYY-MM-DD", repeat: null | "daily" | ..., timing: "morning" | ... }
let habits = loadHabits();


// ===== Small helpers =====

// Today's date as "YYYY-MM-DD" in *local* time.
// (We don't use toISOString(), because that gives the date in UTC,
//  which can be yesterday or tomorrow depending on your time zone.)
function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // months start at 0
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Turn "2026-11-20" into something friendlier like "20 Nov 2026"
function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local date, no time-zone shift
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

    item.append(name, details);
    habitList.append(item);
  }
}


// ===== "New habit" form =====

const modal = document.getElementById("habit-modal");
const form = document.getElementById("habit-form");
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

function openForm() {
  form.reset();                       // empty all fields
  dateInput.value = todayString();    // default date: today
  repeatOptions.hidden = true;        // repeat options start hidden
  formError.textContent = "";
  modal.hidden = false;
  nameInput.focus();                  // put the cursor in the name field
}

function closeForm() {
  modal.hidden = true;
}

document.getElementById("add-button").addEventListener("click", openForm);
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

  habits.push({
    id: makeId(),
    name: name,
    exp: exp,
    date: date,
    repeat: repeatingCheckbox.checked ? repeatSelect.value : null, // null = one-off task
    timing: timingSelect.value,
  });

  saveHabits();
  renderHabitList();
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
renderHabitList();  // draw any habits saved from earlier visits
