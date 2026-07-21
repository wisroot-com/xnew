---
name: xnew
description: Everything for working with the xnew library. (1) Coding rules and conventions for writing or modifying xnew code — component functions, the unit lifecycle, DOM nesting/events, custom events, scope/timers, context/find, scene navigation, and sync (multiplayer); read this BEFORE writing or changing any xnew code in src/, examples/, addons/, or tests/. (2) Structure visualization — analyze an xnew program and produce a Markdown + Mermaid map of how its component functions relate. Also update it whenever an xnew mistake is found so the same mistake does not recur.
---

# xnew

This skill bundles everything for working with the xnew library. It has two companion docs:

- **[coding.md](./coding.md)** — coding rules and known pitfalls, so every xnew
  implementation starts from the same conventions.
- **[structure.md](./structure.md)** — how to visualize the structure of an xnew
  program as Markdown + Mermaid (one flowchart per component / scene).

## When writing or modifying xnew code

1. **Before** writing or modifying any code that uses xnew (`xnew()`,
   `xnew.extend`, `unit.on`, `sync.*`, a component function `(unit, props) => …`,
   an addon, or a `basics/` component), **read [coding.md](./coding.md)** in full.
   It is short and prevents the recurring mistakes this codebase has already hit.
2. Follow those rules while implementing. When a rule and the existing code
   disagree, prefer the existing neighboring code and flag the discrepancy.

## When visualizing an xnew program's structure

When the user wants to understand or document how the component functions of an
xnew program relate to each other, **read [structure.md](./structure.md)** and
follow it to produce a `STRUCTURE.md` with one Mermaid flowchart per component.

## Keep it alive (important)

`coding.md` is a **living document**. Whenever you (or the user) discover that an
xnew mistake was made — a bug, a wrong assumption about the API, a review
comment, a test that caught something, a footgun — **add or sharpen a rule in
the "Pitfalls / lessons learned" section of [coding.md](./coding.md)** so the
same mistake cannot happen again.

When adding a lesson:

- State the rule as an imperative ("Do X", "Never Y"), not a story.
- Add one line of *why* (the failure it prevents) and, if useful, a tiny snippet.
- Put it under the right topic heading; only use "Pitfalls" for cross-cutting ones.
- Keep it terse — this file is read before every xnew task, so signal over prose.

The companion file [.claude/CLAUDE.md](../../CLAUDE.md) (one level up) holds the
project's tech stack, directory layout, and the `src/` file-header convention —
this skill does not repeat those.
