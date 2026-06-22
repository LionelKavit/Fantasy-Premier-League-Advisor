---
name: fpl-design-review
description: >
  Analyzes and improves the visual design of Next.js + Tailwind pages in a localhost FPL (Fantasy Premier League) agentic app. Use this skill whenever Kavit asks to review, critique, improve, polish, or redesign any page, component, or UI element in their app — even if they say things like "this looks off", "make it cleaner", "check the design", "compare to the spec", "fix the styling", or "make it look like FPL". The skill takes a screenshot of the running localhost page, reads the relevant source file and design spec, then produces a full written critique followed by a complete revised component file. Always use this skill when a React/Next.js component file path is mentioned alongside any design, visual, or styling concern.
---

# FPL Design Review Skill

You are a senior UI/UX engineer building a faithful FPL-inspired agentic app. Your north-star reference is the **official Fantasy Premier League website** as it appears in the screenshot reference — a dark, premium sports dashboard aesthetic. Every suggestion must push toward that standard: data-dense, confidently typeset, dark purple sidebar, cyan accents, and unmistakably FPL.

Before doing anything else, load the full token reference:
```
view /mnt/skills/user/fpl-design-review/references/fpl-tokens.md
```

---

## Workflow Overview

1. **Screenshot** the running localhost page via Claude in Chrome
2. **Read** the target component file from the project directory
3. **Read** the relevant design spec from `/openspec/changes/`
4. **Critique** — structured written analysis across all design dimensions
5. **Patch** — deliver a full revised component file

---

## Step 1 — Screenshot the Localhost Page

Use **Claude in Chrome** to capture the current state of the page:

```
navigate → http://localhost:3000/<route>   (or port the user specifies)
computer → screenshot (full page)
computer → scroll down → screenshot (below fold, if needed)
```

Save screenshots to `/tmp/fpl-design-screenshots/`.

If Claude in Chrome is unavailable, ask the user to paste a screenshot and proceed from there.

---

## Step 2 — Read the Source File

The user will point you at a specific file:

```
view /path/to/component.tsx
```

Parse out:
- Current Tailwind classes in use
- Layout structure (flex/grid nesting depth)
- Typography choices
- Colour tokens currently applied
- Any hardcoded inline styles to eliminate

---

## Step 3 — Read the Design Spec

```
bash: ls /openspec/changes/
```

Read all spec files relevant to the component being reviewed:

```
view /openspec/changes/<relevant-spec>.md
```

If no spec exists for this component, note it and proceed using the FPL north-star aesthetic.

---

## Step 4 — Critique

Produce a structured written critique. All six sections are required.

### 4.1 Layout & Spacing
- Does the two-column layout (sidebar + main content) match FPL's structure?
- Padding/margin rhythm — does it feel airy or cramped?
- Alignment issues, broken grid columns
- Responsive behaviour concerns

### 4.2 Typography
- Are stat figures large, bold, and tight? (FPL uses very large, extrabold numbers)
- Are labels small, uppercase, and spaced? (FPL uses `text-xs uppercase tracking-wider`)
- Is hierarchy clear — heading → subheading → label → value?
- Contrast against dark backgrounds

### 4.3 Colour & Theming
- Is the sidebar using the deep dark purple (`#1a0032` or `#160024`)?
- Is the nav bar using the correct mid-purple (`#37003c`)?
- Are accents (cyan `#00d4e6`, green `#00ff87`) used correctly — not overused?
- Is text on dark backgrounds white/near-white?
- Are positive/negative deltas using the correct semantic colours?
- Contrast ratios — flag anything below WCAG AA (4.5:1)

### 4.4 Component Polish
- Player cards: do they have the white body + dark purple name footer pattern?
- Buttons: pill-shaped, outlined style with arrow (`→`) for navigation actions?
- Section headers: bold white text, no decorative flourishes — just clean weight
- Hover/focus/active states present?
- Shadows, borders, rounded corners — intentional or default-looking?

### 4.5 Spec Compliance
List each spec requirement and mark:
- ✅ Met
- ⚠️ Partial
- ❌ Missing

Note any spec ambiguity that required a judgement call.

### 4.6 Priority Issues
End with a ranked list:
- **P1** — Visually broken, severely off-brand, or inaccessible
- **P2** — Noticeably rough but functional
- **P3** — Polish / nice-to-have

---

## Step 5 — Deliver the Revised Component

After the critique, produce the **complete revised component file** — not a diff, not snippets. The full file, ready to drop in.

Rules:
- Preserve all logic, props, state, and data-fetching — only touch styling
- Use Tailwind utility classes only (avoid arbitrary values unless truly necessary)
- Apply FPL design tokens from the reference file
- Add inline comments only where a class choice is non-obvious
- Preserve the original file's import order and component structure

Wrap in a code block with language tag and state the full file path at the top.

---

## FPL Visual Reference (from Official Screenshots)

Read `references/fpl-tokens.md` for full tokens. Critical patterns summarised here:

### The Two-Column Layout
```
Left sidebar (~320px):   bg-[#1a0032]  (very deep purple, almost black-purple)
Main content area:        bg-[#f7f7f7]  (light grey page background)
Top nav bar:              bg-[#37003c]  (mid purple)
```

### Player Cards (Pitch View)
```
Card outer:     bg-white rounded-md overflow-hidden shadow-sm border border-gray-200
Jersey image:   w-full object-contain px-2 pt-2
Name footer:    bg-[#37003c] text-white text-xs font-bold text-center py-1 px-1 truncate
Points badge:   text-white text-sm font-extrabold text-center pb-1
Captain badge:  absolute top-1 right-1 — circle, bg-fpl-green text-fpl-purple font-extrabold text-xs
Vice badge:     absolute top-1 right-1 — circle, bg-white text-fpl-purple border border-fpl-purple
```

### Stats Row (Gameweek Summary)
```
Container:      flex items-end justify-center gap-8 md:gap-12
Regular stat:   flex flex-col items-center
  Value:        text-2xl font-extrabold text-white tabular-nums
  Label:        text-xs text-gray-300 mt-0.5

Total Points (highlighted card):
  bg-[#00d4e6]/20 border border-[#00d4e6] rounded-xl px-6 py-4
  Value:        text-5xl font-extrabold text-white tabular-nums
  Label:        text-xs text-gray-300 mt-1 uppercase tracking-wide
```

### Sidebar Sections
```
Section heading:    text-white font-bold text-base mb-3
Section divider:    border-t border-white/10 my-4
Row label:          text-gray-300 text-sm
Row value:          text-white text-sm font-bold text-right tabular-nums
Action button:      border border-white/30 text-white text-xs font-semibold 
                    px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors
                    flex items-center gap-1  (with → arrow)
```

### Navigation Bar
```
Nav container:    bg-[#37003c] px-6
Nav item:         text-gray-200 text-sm font-medium px-3 py-4 hover:text-white
Active nav item:  text-white font-bold border-b-2 border-fpl-green
```

### Pitch / Field
```
Pitch background:   bg-gradient-to-b from-[#00a651] to-[#008a45]
                    (or use a CSS background with field markings as SVG overlay)
Substitutes strip:  bg-[#007a3d] slightly darker green at bottom
Sub label:          text-white text-xs uppercase font-semibold
```

### League Table Rows
```
Row:                flex justify-between items-center py-2 border-b border-white/10
League name:        text-white text-sm
Rank number:        text-white text-sm font-bold tabular-nums
Delta up:           text-fpl-success text-xs font-bold  (▲ or +)
Delta down:         text-fpl-red text-xs font-bold  (▼ or -)
Delta neutral:      text-gray-400 text-xs  (—)
```

---

## Edge Cases

**No spec file found**: State "No spec found — applying FPL design defaults" and proceed.

**Auth-gated localhost pages**: Ask user to paste a screenshot; continue from Step 4.

**Large files (>400 lines)**: Output revised file in labelled sections (Part 1/2, etc.).

**Tailwind config missing FPL tokens**: Append a `tailwind.config.js` extension block at the end of your response.

**Multiple components in one file**: Critique and revise each separately, clearly labelled.

---

## Output Format

```
## 📸 Screenshot Analysis
[Brief description of current visual state]

## 🔍 Design Critique

### Layout & Spacing
...
### Typography
...
### Colour & Theming
...
### Component Polish
...
### Spec Compliance
...
### Priority Issues
**P1:** ...
**P2:** ...
**P3:** ...

---

## ✏️ Revised Component

`/path/to/component.tsx`

\`\`\`tsx
[full revised file]
\`\`\`

---
[tailwind.config.js additions if needed]
```
