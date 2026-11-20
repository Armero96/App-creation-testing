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
    saveHabits();
    renderHabitList();
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
    formTitle.textContent = "Edit habit";
    nameInput.value = habit.name;
    expInput.value = habit.exp;
    dateInput.value = habit.date;
    timingSelect.value = habit.timing;
    repeatingCheckbox.checked = habit.repeat !== null;
    if (habit.repeat) repeatSelect.value = habit.repeat;
  } else {
    editingId = null;
    formTitle.textContent = "New habit";
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
