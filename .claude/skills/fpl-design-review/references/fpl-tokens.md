# FPL Design Tokens — Full Reference
# Derived from official FPL screenshots (fantasy.premierleague.com/entry/*/event/*)

---

## Colour System

### Layout Backgrounds
| Role                  | Hex / Tailwind         | Where Used |
|----------------------|------------------------|-----------|
| Sidebar background   | `#1a0032` / `bg-[#1a0032]` | Left panel — very deep dark purple, almost black |
| Nav bar              | `#37003c` / `bg-[#37003c]` | Top navigation strip |
| Page background      | `#f7f7f7` / `bg-gray-100`  | Main content area (light grey) |
| Player card name bar | `#37003c`              | Dark purple footer bar on each player card |
| Pitch green          | `#00a651` → `#008a45`  | Football pitch gradient (top to bottom) |
| Substitutes strip    | `#007a3d`              | Slightly darker green bench area |
| Total Points card    | `rgba(0,212,230,0.15)` | Highlighted cyan-tinted stats card |

### Brand & Accent
| Token         | Hex       | Tailwind Class        | Usage |
|--------------|-----------|----------------------|-------|
| FPL green    | `#00ff87` | `bg-[#00ff87]`       | Active nav underline, Captain badge fill, CTAs |
| FPL cyan     | `#00d4e6` | `bg-[#00d4e6]`       | Total Points card border/tint, links, highlights |
| FPL purple   | `#37003c` | `bg-[#37003c]`       | Nav bar, player card footer, section headers |
| FPL dark     | `#1a0032` | `bg-[#1a0032]`       | Sidebar, deep backgrounds |

### Text
| Role              | Hex/Class                     | Notes |
|------------------|-------------------------------|-------|
| Primary on dark   | `#ffffff` / `text-white`      | All main text on sidebar/nav |
| Secondary on dark | `#9ca3af` / `text-gray-400`   | Labels, metadata, secondary info on dark bg |
| Muted on dark     | `#6b7280` / `text-gray-500`   | Tertiary text on dark bg |
| Body on light     | `#374151` / `text-gray-700`   | Content text on light grey page |
| Heading on light  | `#1f2937` / `text-gray-800`   | Section titles on light bg |

### Semantic
| Token       | Hex       | Tailwind              | Usage |
|------------|-----------|----------------------|-------|
| Positive   | `#00c851` | `text-[#00c851]`     | Rank up ▲, price rise, positive delta |
| Negative   | `#e90052` | `text-[#e90052]`     | Rank down ▼, price drop, negative delta |
| Neutral    | `#6b7280` | `text-gray-500`      | No change — (dash) |
| Warning    | `#f5a623` | `text-[#f5a623]`     | Injury doubt, yellow card |

---

## Typography Scale

### On Dark Backgrounds (sidebar, nav, pitch area)

| Role                | Classes |
|--------------------|---------|
| Page / section title | `text-white text-xl font-bold tracking-tight` |
| Sidebar section header | `text-white text-base font-bold` |
| Stat — XL (Total Points) | `text-5xl font-extrabold text-white tabular-nums tracking-tighter` |
| Stat — LG (GW Rank etc.) | `text-2xl font-extrabold text-white tabular-nums` |
| Stat label (below number) | `text-xs text-gray-400 uppercase tracking-wide mt-0.5` |
| Sidebar row label | `text-gray-300 text-sm` |
| Sidebar row value | `text-white text-sm font-bold text-right tabular-nums` |
| Player name (card footer) | `text-white text-xs font-bold truncate text-center` |
| Player points (card footer) | `text-white text-sm font-extrabold text-center tabular-nums` |
| Nav item | `text-gray-200 text-sm font-medium` |
| Nav item (active) | `text-white text-sm font-bold` |
| League name | `text-white text-sm` |
| League rank | `text-white text-sm font-bold tabular-nums` |

### On Light Backgrounds (main content area)

| Role               | Classes |
|-------------------|---------|
| Page heading       | `text-gray-800 text-2xl font-extrabold tracking-tight` |
| Card heading       | `text-gray-800 text-base font-bold` |
| Body text          | `text-gray-700 text-sm` |
| Caption / label    | `text-gray-500 text-xs uppercase tracking-wider font-semibold` |

---

## Component Patterns

### Two-Column Page Layout
```tsx
<div className="min-h-screen flex flex-col">
  {/* Nav bar */}
  <nav className="bg-[#37003c] px-6 flex items-center gap-6 sticky top-0 z-10">
    {navItems.map(item => (
      <a key={item} className={`py-4 text-sm font-medium border-b-2 transition-colors ${
        active === item
          ? 'text-white font-bold border-[#00ff87]'
          : 'text-gray-300 border-transparent hover:text-white'
      }`}>{item}</a>
    ))}
  </nav>

  <div className="flex flex-1">
    {/* Sidebar */}
    <aside className="w-80 bg-[#1a0032] flex-shrink-0 px-5 py-6 space-y-6">
      {/* sidebar content */}
    </aside>

    {/* Main content */}
    <main className="flex-1 bg-gray-100 p-6">
      {/* main content */}
    </main>
  </div>
</div>
```

### Sidebar Section
```tsx
<section>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-white font-bold text-base">Points & Rankings</h2>
    <button className="flex items-center gap-1 border border-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">
      Gameweek History <span>›</span>
    </button>
  </div>
  <div className="space-y-2">
    {rows.map(row => (
      <div key={row.label} className="flex justify-between items-center">
        <span className="text-gray-300 text-sm">{row.label}</span>
        <span className="text-white text-sm font-bold tabular-nums">{row.value}</span>
      </div>
    ))}
  </div>
</section>
```

### Sidebar Divider
```tsx
<hr className="border-t border-white/10" />
```

### Gameweek Stats Row
```tsx
<div className="flex items-end justify-center gap-8">
  {/* Regular stat */}
  <div className="flex flex-col items-center">
    <span className="text-2xl font-extrabold text-white tabular-nums">41</span>
    <span className="text-xs text-gray-400 mt-0.5">Average Points</span>
  </div>

  {/* Total Points — highlighted */}
  <div className="flex flex-col items-center border border-[#00d4e6] bg-[#00d4e6]/15 rounded-xl px-6 py-4">
    <span className="text-5xl font-extrabold text-white tabular-nums">48</span>
    <span className="text-xs text-gray-300 uppercase tracking-wide mt-1">Total Points</span>
  </div>

  {/* Regular stat with link */}
  <div className="flex flex-col items-center">
    <span className="text-2xl font-extrabold text-white tabular-nums">4,183,646</span>
    <span className="text-xs text-gray-400 mt-0.5">GW Rank →</span>
  </div>
</div>
```

### Player Card (Pitch View)
```tsx
<div className="relative w-24 flex flex-col bg-white rounded-md overflow-hidden shadow border border-gray-200">
  {/* Captain/Vice badge */}
  {isCaptain && (
    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#00ff87] text-[#37003c] text-xs font-extrabold flex items-center justify-center z-10">
      C
    </span>
  )}
  {/* Jersey */}
  <div className="pt-2 px-2 flex items-center justify-center">
    <img src={jerseyUrl} alt={playerName} className="w-16 h-16 object-contain" />
  </div>
  {/* Name + Points footer */}
  <div className="bg-[#37003c] px-1 py-1 text-center">
    <p className="text-white text-xs font-bold truncate leading-tight">{playerName}</p>
    <p className="text-white text-sm font-extrabold tabular-nums leading-tight">{points}</p>
  </div>
</div>
```

### League Table Row
```tsx
<div className="flex justify-between items-center py-2 border-b border-white/10">
  <span className="text-white text-sm">{leagueName}</span>
  <div className="flex items-center gap-2">
    <span className="text-white text-sm font-bold tabular-nums">{rank}</span>
    {delta > 0 && <span className="text-[#00c851] text-xs font-bold">▲</span>}
    {delta < 0 && <span className="text-[#e90052] text-xs font-bold">▼</span>}
    {delta === 0 && <span className="text-gray-500 text-xs">—</span>}
  </div>
</div>
```

### Pill / Outlined Button (Sidebar)
```tsx
<button className="flex items-center gap-1 border border-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">
  View League <span className="text-gray-400">›</span>
</button>
```

### Primary CTA (Light Background)
```tsx
<button className="bg-[#00ff87] text-[#37003c] font-bold px-6 py-2 rounded-full text-sm hover:brightness-105 transition-all">
  Confirm
</button>
```

### Team of the Week Link
```tsx
<a className="flex items-center gap-2 text-white text-sm font-semibold hover:underline">
  <span className="text-[#00ff87]">★</span>
  Team of the Week →
</a>
```

---

## Tailwind Config Extension

Add to `tailwind.config.js` / `tailwind.config.ts`:

```js
theme: {
  extend: {
    colors: {
      fpl: {
        purple:   '#37003c',   // nav, card footer
        dark:     '#1a0032',   // sidebar
        green:    '#00ff87',   // accents, captain badge
        cyan:     '#00d4e6',   // total points card, links
        grey:     '#63606b',   // secondary text
        red:      '#e90052',   // negative delta
        success:  '#00c851',   // positive delta
        warning:  '#f5a623',   // injury doubt
        bg:       '#f7f7f7',   // page background
        border:   '#e6e6e6',   // card borders
        pitch:    '#00a651',   // pitch green
      },
    },
  },
},
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Fix |
|---|---|---|
| Using generic `bg-purple-900` for sidebar | Wrong shade, looks Bootstrap-purple | Use `bg-[#1a0032]` |
| Using generic `bg-purple-800` for nav | Off-brand | Use `bg-[#37003c]` |
| `text-green-400` for accents | Not FPL green | Use `text-[#00ff87]` |
| Missing `tabular-nums` on stat figures | Layout jitter as values change | Always add to number cells |
| Shadows larger than `shadow-sm` on cards | Looks heavy / generic | Use `shadow-sm` or `shadow` |
| `font-light` on any stat number | Too thin on dark bg | Use `font-bold` or `font-extrabold` |
| Coloured section dividers | FPL uses subtle white/10 opacity lines | `border-white/10` on dark, `border-gray-200` on light |
| Centre-aligning sidebar row values in a `flex-col` | Breaks the label/value alignment | Use `flex justify-between` rows |
| `rounded-2xl` on player cards | Too soft | Use `rounded-md` |
| Omitting `truncate` on player names | Long names break card layout | Always add `truncate` |
