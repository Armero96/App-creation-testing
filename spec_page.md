# Spec page for app creation
App name: Jobits (Jorge's habits)

App type: PWA

Main concept: The app will consits of a habit tracker, with the intention of helping the user easily visualize, keep track, add and remove habits. It should also help the user accomplish those tasks, by "Gamifying them", meaning, it will provide a sense of development each time a task is accomplished, that will be reflected by some visual cue. 

Screens: it will contain two screens, which will be easily switched from by swiping left and right. 
- Screen 1: this will be the main screen. It will include a picture of an adventurer with no gear and a wooden sword and shield to begin the week. And, progressively as he levels up, he will acquire better gear, which will be visible each progressively each time a goal is obtained, and each time a full day is accomplished (level-up). It will have a tracker under the adventurer, to track the progress during that one day, which will be completed once all the assigned tasks are completed. The overview of the tasks still to accomplish in the day will be visible right under, and it will be possible to mark which ones have been completed, then progressing the days bar. Each week on monday, the progress is re-set, and an ascencion counter is provided at the top right (smaller than the rest).  

- Screen 2: reachable by swiping left. It will allow the user to add new routines/habits and see that ones that are already planned. It should provide the option to add them either as a single day goal, or as a repeating objective (e.g every day, every second day, every week). There will be a + button, which will open a new screen which will prompt the user to introduce the name of the habit, how much exp it should give, when should it be completed (date). It should also provide a clickable box, to indicate if it is a repeating goal, and after selecting it, it should open a menu, where repeating options are provided: every day, every work day, every second day, every week and every montrh. It will also allow to modify them: their description, how much exp they give, their repetition schedule etc. One-off tasks that are not completed should carry over to the next day, and show up at the top, just under the graphical representation. 

Rules:
1) Daily goal completion will fill the level bar. An option will be given during habit addition to determine how much experience (exp) an accomplished task provides, depending on its difficulty (e.g brushing teeth could be 5 points, whereas cleaning the kitchen could be 25).
2) Each day will have an exp goal equal to the sum of the tasks to be done in the day, so that a full level is only obtained if all the goals are achieved. 
3) If a day is not accomplished, a level-up is not obtained, and thus you start from the same level the next day with an empty bar
4) Since a week has 7 days, the maximum level will be 7
5) Days end at midnight.
6) On a week start (monday), the level is reset to 1, but re-ocurring goals are kept. 


Must-have features vs. later: 
    1. Must have: 
        1) The habit tracking, and leveling-up system, and process to add and remove habits/routines.
        2) On version one, we can put a place holder just being a wooden sword, which then improves to a stone sword, to a copper sword, to an iron sword, to a silver sword, to a golden sword and last to an obsidian sword
        3) An option to reset everything back to 0, for testing purposes
        4) Swiping left and right should work, but for testing in the computer, pressing left or right should also achieve the same function

    2. To be added later: 
        1) The visuals of the adventurer.
        2) A calendar view
        3) Some other screen tabs of use 
        4) Export and backup features

Data storage: store data in the phones browser

Out of scope: no user accounts, no syncing between devices, no notifications or reminders, no app store release, single user only. 

Example: 

Look and feel: it should have simple 8-bit style, with a bright colour palette. 