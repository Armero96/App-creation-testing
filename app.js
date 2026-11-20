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

// ----- Arrow keys (computer) -----
document.addEventListener("keydown", (event) => {
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
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;

  // Ignore mostly-vertical movements (those are scrolling, not swiping)
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;

  // Finger moved left (dx negative) -> go to the next screen (Habits).
  // Finger moved right (dx positive) -> go back (Main).
  if (dx < 0) showScreen(currentScreen + 1);
  else showScreen(currentScreen - 1);
});

// Start on the Main screen
showScreen(0);
