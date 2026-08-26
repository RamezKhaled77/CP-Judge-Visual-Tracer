---
name: GDB MI tracing
description: Runtime details needed for reliable recursive C++ traces in this workspace.
---

GDB MI tracing must run the inferior with GDB console redirection (`run < stdin-file`); setting the inferior tty to a regular file causes stdin to behave like EOF in this environment.

**Why:** Recursive programs otherwise appear to receive zero input, produce only a few steps, and never build the expected call stack.

**How to apply:** Keep `-exec-step` for user-code calls, parse balanced nested MI frame objects, skip source-less library stops, and surface any other GDB stop failure instead of synthesizing a trace.