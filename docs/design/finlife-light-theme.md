# FinLife Tracker — Light theme spec: "Paper Ledger"

Apply this palette to the app's EXISTING light mode only. Dark mode must stay exactly as it is.

## 1. Tokens

| Token | Hex | Used for |
|---|---|---|
| `--bg` | `#F5F2EC` | Page background (warm paper) |
| `--surface` | `#FFFFFF` | Cards, top nav bar, segmented control background |
| `--surface-2` | `#EEE9E0` | Nested boxes inside cards, selected segment, progress-bar tracks, chip backgrounds |
| `--border` | `#E0D8CB` | Card borders, dividers, nav bottom border, unfilled mood dots |
| `--text` | `#1E1A15` | Primary text, big numbers |
| `--text-muted` | `#675F53` | Labels, dates, secondary text, subtitles |
| `--accent` | `#4338CA` | Primary button bg, links, "Kept" bar, filled mood dots, outline-button border + text |
| `--accent-hover` | `#3730A3` | Hover/pressed state of accent elements |
| `--on-accent` | `#FFFFFF` | Text/icon on accent background |
| `--accent-tint` | `#ECE8FB` | "Left over" hero card bg, active nav tab bg (with `--accent` text) |
| `--accent-tint-border` | `#D9D2F5` | Border of the hero card |
| `--income` | `#0E7A52` | Income amounts, debt "paid off" % and progress fill |
| `--expense` | `#C0362C` | Spending amounts, negative values, "Spent" bar, "Needed this month" |
| `--warning` | `#B45309` | Due-soon / warning states |
| `--cat-1` | `#D97706` | Category color 1 (ซื้อของทั่วไป) |
| `--cat-2` | `#DB2777` | Category color 2 (ค่าข้าว) |
| `--cat-3` | `#2563EB` | Category color 3 (บิล & ค่าบริการ) |
| `--cat-4` | `#8A6D46` | Category color 4 (บุหรี่) |
| `--cat-5` | `#7C3AED` | Category color 5 (เสื้อผ้า) |

Category colors are assigned by index, not by name: keep whatever category-to-color logic the app already has and just swap the light-mode values.

## 2. CSS variables (reference)

```css
/* light mode only: put under whatever selector the app already uses for light mode */
:root[data-theme="light"] {
  --bg: #F5F2EC;
  --surface: #FFFFFF;
  --surface-2: #EEE9E0;
  --border: #E0D8CB;
  --text: #1E1A15;
  --text-muted: #675F53;
  --accent: #4338CA;
  --accent-hover: #3730A3;
  --on-accent: #FFFFFF;
  --accent-tint: #ECE8FB;
  --accent-tint-border: #D9D2F5;
  --income: #0E7A52;
  --expense: #C0362C;
  --warning: #B45309;
  --cat-1: #D97706;
  --cat-2: #DB2777;
  --cat-3: #2563EB;
  --cat-4: #8A6D46;
  --cat-5: #7C3AED;
}
```

## 3. Component mapping

- **Top nav:** `--surface` bg, `--border` bottom border. Active tab: `--accent-tint` bg + `--accent` text (semibold). Inactive tabs: `--text-muted`.
- **"Add entry" button:** `--accent` bg, `--on-accent` text, hover `--accent-hover`.
- **Period switcher (Today / This week / Past 30 days / All time):** `--surface` container + `--border`; selected segment `--surface-2` bg + `--text`.
- **Hero "Left over" card:** `--accent-tint` bg, `--accent-tint-border` border. Sparkline stroke `--accent`. Spent/Kept bar: spent = `--expense`, kept = `--accent`.
- **Income / Spending cards:** `--surface`; amounts in `--income` / `--expense`.
- **Spending by category:** donut and dots use `--cat-1..5`; donut hole = `--surface`. Comparison box uses `--surface-2`.
- **Debt payoff:** % and progress fill `--income`, track `--surface-2`; "Needed this month" box `--bg` or `--surface-2` with amount in `--expense`; debt rows' negative balance `--expense`. "Make a repayment" = outline button: transparent bg, `--accent` border + text.
- **Recent activity:** date header rows `--surface-2`; expense icon tile uses `--expense` at ~10% opacity bg + `--expense` icon; transfer uses `--cat-3` the same way; category chips `--surface-2` bg + colored dot.
- **Net worth / wallets:** wallet bar segments use category-style colors; debt figure `--expense`.
- **Mood and spending:** day tiles `--bg`; filled mood dots `--accent`, empty `--border`; amounts `--expense` (0 in `--text-muted`).
- **Links ("Details", "All debts", "View all", "Transfer"):** `--accent`, hover `--accent-hover`.

## 4. Rules

- Do not change dark mode values or layout, spacing, radii or typography.
- No hard-coded hex in components: everything goes through the theme tokens.
- Text contrast must stay ≥ 4.5:1 (all pairs above already pass on `--bg`, `--surface` and `--surface-2`).
- Income vs expense must also be distinguishable by sign (+/−), not color alone (already the case: keep it).
