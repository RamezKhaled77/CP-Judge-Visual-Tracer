---
name: GDB MI tracing
description: Runtime details needed for reliable recursive C++ traces in this workspace.
---

GDB MI tracing must run the inferior with GDB console redirection (`run < stdin-file`); setting the inferior tty to a regular file causes stdin to behave like EOF in this environment.

**Why:** Recursive programs otherwise appear to receive zero input, produce only a few steps, and never build the expected call stack. Additionally, libstdc++'s Python pretty-printers (`-enable-pretty-printing` + `-var-list-children`) **hang GDB forever** when a container's backing memory is not yet initialized — e.g. stopped on its declaration line — because the printer loops dereferencing wild `_M_start/_M_finish` pointers (only an injected KeyboardInterrupt frees it).

**How to apply:** Keep `-exec-step` for user-code calls, parse balanced nested MI frame objects, skip source-less library stops, and surface any other GDB stop failure instead of synthesizing a trace. Do NOT enable Python pretty-printing for extraction; use python-free techniques instead:
- `std::vector`: read `_M_impl._M_start/_M_finish` as numbers via quoted `-data-evaluate-expression "(unsigned long)v._M_impl._M_start"` (quotes are mandatory — commas in template args split MI args otherwise), derive stride via address arithmetic `(&v._M_impl._M_start[1]) - (&v._M_impl._M_start[0])`, then read elements as plain expressions `v._M_impl._M_start[k]`. Invalid reads return `^error` quickly instead of hanging.
- `std::array<T, N>`: evaluate `${name}._M_elems[k]` for k<N parsed from the type string; child varobj ids like `T.public._M_elems` are NOT reliably addressable across GDB versions ("Variable object not found").
- Struct/class members: one-level listing of the parent works (values arrive inline with `--all-values`), but deeper sub-object traversal by constructed names must be avoided.
- When stopped inside STL internals (headers compile with debug info into the user TU so `-exec-step` enters them): pop out with `-exec-finish` rather than line-stepping through them; record only main-source stops.