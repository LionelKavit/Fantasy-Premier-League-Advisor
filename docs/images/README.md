# Media assets

Screenshots and the demo video referenced from the root `README.md`.

**Current set** (conversation-first UI) — capture on the same manager so the set reads as one coherent
story. **For this branch, capture on a squad holding 3+ free transfers** so the multi-move plan shows.

| File | Used as | Shows |
|---|---|---|
| `fpl-advisor-hero.png` | README hero | The landing: the **glanceable verdict bar** across the top (multi-move summary "… +N more transfers" · captain · chip + Open FPL Transfers), the header **0–5 free-transfer field**, pitch (left) + Ask The Scout hero with the proactive brief and starter chips (right). |
| `fpl-advisor-free-transfers.png` | Screenshots — free transfers | A close-up of the header **free-transfer field (0–5)** with the inline **"Enter a value between 0 and 5"** guard — the personalization + guardrail beat. |
| `fpl-advisor-scout-chat-1.png` | Screenshots — grounded chat | Ask The Scout giving a **tool-grounded answer citing real numbers**, anchored to the committed plan and knowledge base (no invented stats). |
| `fpl-advisor-scout-chat-2.png` | Screenshots — grounded chat | The Scout **holding the line** — refusing to drift from the facts / panels on an off-topic or prompt-injection attempt. Together with `scout-chat-1` this makes the "expert, grounded, no-hallucination, no-injection" point. |
| `fpl-advisor-this-week.png` | Screenshots — This Week | Breakdown on **This Week**: **Transfer · Captaincy · Chip · Restructure** — the Transfer headline reads **"Make N free transfers"** with several `out → in` lines, and the **Restructure** row reads **"net pts gain +X · −N pts"**. |
| `fpl-advisor-player-dialog.png` | Screenshots — player dialog | The player detail dialog (opened from a pitch token / This-Week name): age, nationality + flag, form, last-week mins/pts, exp. next pts, and the **View on Premier League** button. |
| `fpl-advisor-login.png` | Screenshots — entry | The entry screen: manager-ID form with the **"Explore without a team"** CTA. |
| `fpl-advisor-demo-mode.png` | Screenshots — demo mode | The Explore-without-a-team view: the **DEMO** header badge, the season-aware banner ("dream XV — built from last season's returns"), the sample XI with armbands + 0–10 ratings, and the demo starter chips. |
| `fpl-advisor-demo.mov` | demo video — see note below | Flow: squad load → pitch → proactive brief → breakdown tabs → Ask The Scout. **Not committed** (supply via GitHub's web UI for an inline player) and a re-record for this UI is a noted follow-up. |

## Demo video — inline player on GitHub

A repo-committed `.mov` renders as a **download link**, not a player, and the 32 MB file bloats
the repo. For an **inline player**, upload it through GitHub's web UI instead of committing it:

1. Edit the root `README.md` on github.com.
2. Drag `fpl-advisor-demo.mov` into the editor — GitHub uploads it to its CDN and inserts a
   `https://github.com/user-attachments/assets/…` URL that renders as a player.
3. Replace the "Watch the 90-second demo" link in the README with that URL.

(If you'd rather keep the repo self-contained, commit the `.mov` and the existing download link
works — just heavier.)
