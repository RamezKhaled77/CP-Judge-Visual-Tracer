# Summary of the Last 7 Fix Prompts

A plain-English recap of the last 7 prompt files created for the local AI model, what problem each one targeted, what we asked it to do, and where things stand now.

---

## 1. Editor Light Theme
**File:** `local-model-prompt-editor-light-theme.md`

**The problem:** The code editor only had a dark theme. We wanted a light theme too, with a way to switch between them.

**What we asked for:**
- Figure out which editor library the app actually uses first (don't guess).
- Add a proper light color theme, not just an inverted dark theme.
- Add a small sun/moon toggle button in the editor's top bar to switch themes.
- Remember the user's choice so it stays after a page reload.
- Keep the toggle limited to just the editor, not the whole app, unless a global theme system already existed.

**Status:** ⏳ Sent, no completion report yet.

---

## 2. Trace Player Fixes
**File:** `local-model-prompt-trace-player-fixes.md`

**The problem:** The step-by-step execution viewer ("trace player") had real bugs, not just ugly styling:
- Variables were showing up in the "Locals" panel *before* they were even declared in the code, with random garbage numbers that looked like real values.
- The array/vector visualization showed data before the array was even created.
- Arrays had no index numbers and overflowed the screen with no way to scroll properly.
- The list of execution steps on the left (39+ steps) was one long list with no way to manage it as programs get bigger.

**What we asked for:**
- Only show a variable once the line that declares it has actually run.
- Only show an array/data structure once it's actually been built.
- Add index numbers to array cells, fix the scrolling, and cap huge arrays with a "+N more" label.
- Make the step list handle hundreds of steps smoothly (don't render every single row at once).
- Check if the search/filter box for steps actually works.
- Add a way to highlight which array index is being used at each step.

**Status:** ✅ Done and verified. The AI found the root cause (it was showing all variables in a function regardless of whether their line had run yet), fixed it, added index highlighting, and confirmed everything with real before/after examples.

---

## 3. Shadowing Verification
**File:** `local-model-prompt-shadowing-verification.md`

**The problem:** After fixing issue #2 above, we suspected two things weren't tested yet:
- What happens when the *same variable name* is used in two different parts of the same function (like two separate loops both using a variable called `i`)?
- What happens with data structures other than arrays, like maps, sets, and stacks?

**What we asked for:**
- Test a program with two loops that each declare their own `i` and confirm the app doesn't get confused about which `i` is which.
- Test map, set, and stack data structures and make sure they display correctly, not just arrays.
- Also double-check that some generated code files weren't hand-edited instead of properly regenerated (a shortcut that could cause hidden bugs later).

**Status:** ✅ Done and verified. It found and fixed a real bug (the app was picking the wrong variable declaration when the same name was reused), fixed how maps and stacks display, and confirmed a set of generated files had been hand-edited and properly regenerated them instead.

---

## 4. Final Regression Check
**File:** `local-model-prompt-final-regression-check.md`

**The problem:** After all the fixes in #2 and #3, we wanted to make sure nothing that used to work got broken, and that maps/stacks actually *look* right in the interface (not just technically correct).

**What we asked for:**
- Re-test the three original example problems to confirm they still work exactly as before.
- Actually look at how a map and a stack render on screen, since they don't have a natural "index" like an array does.

**Status:** ✅ Done and verified. No regressions found. It also noticed that maps and stacks were incorrectly showing array-style index numbers (like "0, 1, 2...") even though that doesn't make sense for those data types, and fixed it by adding a flag so only real arrays show index numbers.

---

## 5. Error-Handling Middleware
**File:** `local-model-prompt-error-middleware.md`

**The problem:** We believed the app had no proper error handling — meaning a bad request (like missing data) might crash the server and show a raw, ugly error instead of a clean message.

**What we asked for:**
- Add centralized error handling so all mistakes (bad input, missing data, server problems) come back as clean, consistent error messages instead of crashes.
- Make sure normal results (like "your code is wrong" — a WA verdict) are never mistaken for a server error, since those are valid outcomes, not failures.

**Status:** ✅ Done — but with a twist. The AI checked first and discovered proper error handling *already existed* in the code (likely added quietly during earlier fixes). It verified this with real test requests instead of just trusting the code, found everything already worked correctly, and only needed to add missing documentation for it.

---

## 6. Error-Handling Follow-Up
**File:** `local-model-prompt-error-handling-followup.md`

**The problem:** Two small gaps were left over from #5:
- A "file too large" error was returning the wrong type of error code.
- We hadn't actually tested what happens when Docker (the sandboxing tool) is unavailable — we'd only assumed it would work based on reading the code.

**What we asked for:**
- Fix the "too large" error to return the correct, standard error code.
- Actually turn off access to Docker for one test and confirm the app fails safely and clearly, then turn it back on and confirm everything recovers.

**Status:** ✅ Done and verified. Both fixed. The Docker-unavailable case was tested for real (not just assumed) and worked correctly, then normal operation was confirmed to come back afterward.

---

## 7. Compile-Once Fix
**File:** `local-model-prompt-compile-once-fix.md`

**The problem:** When checking a solution against multiple test cases, the app was recompiling the code from scratch for *every single test case* instead of compiling once and reusing it. This wastes time — especially since compiling now happens inside a secure sandbox, which has its own overhead.

**What we asked for:**
- Compile the code once per submission, not once per test case.
- Still run each test case separately (that part was already correct).
- If the code fails to compile, show that error once and skip running any test cases (don't try compiling repeatedly for something already known to be broken).
- Measure and report the actual time saved.

**Status:** ⏳ Sent, no completion report yet.

---

## Quick Overview Table

| # | Prompt | What it fixed | Status |
|---|--------|---------------|--------|
| 1 | Editor Light Theme | Add a light color theme + toggle for the code editor | ⏳ Pending |
| 2 | Trace Player Fixes | Fake/garbage data shown too early in the execution viewer | ✅ Done |
| 3 | Shadowing Verification | Same variable name reused in two places confusing the tracer | ✅ Done |
| 4 | Final Regression Check | Confirm nothing broke + fix map/stack display | ✅ Done |
| 5 | Error-Handling Middleware | Bad requests crashing instead of clean error messages | ✅ Already existed, verified |
| 6 | Error-Handling Follow-Up | Wrong error code + untested Docker-failure case | ✅ Done |
| 7 | Compile-Once Fix | Code recompiled for every test case instead of once | ⏳ Pending |

**Two things worth following up on later (noted, not urgent):**
- The execution tracer doesn't fully expand both sides of recursive calls like `fib(n-1) + fib(n-2)` — it only steps into the first one in detail.
- One backend route (`/api/run`) still handles its own errors separately instead of going through the shared error-handling system. It works fine, just isn't unified with the rest.
