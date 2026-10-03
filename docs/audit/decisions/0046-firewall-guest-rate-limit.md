# 0046: One firewall rule limits guests to 30 AI requests a minute per IP; signed-in callers have no firewall cap

**Status:** Accepted. The rule is live in production: created and published by the owner in the Vercel dashboard on 2026-10-03, and verified from outside the same day. Recorded in `7ad29f8`, merged into `main` as `466469e` (PR #20).
- **Amends** ADR `0032`'s firewall section: of its two rules, only the guest rule exists. The "all callers 120/min per IP" rule is not created, because the Vercel Hobby plan allows one rate-limit rule.
- **Closes** T246 (open since Phase 58s): guests were unlimited until this rule.

**Date:** 2026-10-03

## Context

- **ADR `0032` planned two rules** on `/api/classify` and `/api/insights`, both keyed by IP over a fixed 60 s window, answering 429:
  - guests (no `Authorization` header): 30 a minute;
  - everyone: 120 a minute.

  Neither could be created in Phase 58s: the Vercel API answered `404 Seawall Config not found`, and the rules waited for the owner.
- **The API still cannot reach the configuration.** On 2026-10-03, after the owner enabled the firewall, and again after the owner published a rule:
  - GET (`configVersion: active`), PUT and PATCH (`firewallEnabled`) all answered `404 Seawall Config not found`;
  - by team slug and by team id.

  PUT is documented to create a configuration, so the 404 is not "none exists yet"; this connection cannot see the project's firewall. Rules are managed in the dashboard only.
- **Measured before the rule** (2026-10-03 05:25 UTC): 40 guest requests to `/api/classify` in 20 s, all 400, none 429. Guests were unlimited.
- **The plan allows one rate-limit rule** (Hobby, 1 of 1, reported by the owner from the dashboard). One of ADR `0032`'s two rules had to go.

## Decision

- **Keep the guest rule; drop the all-callers rule.** The guest path is the open one. A request with no header goes straight from the proxy's caller check to TypeSafe, with nothing but the firewall in the way. A request with a header must carry a token that Supabase's `/auth/v1/user` accepts (`checkCaller`, ADR `0032`); a malformed or refused one gets 401 before any TypeSafe call.
- **The rule, as published by the owner:**
  - **Name:** "AI proxy: guests 30/min per IP".
  - **If:** the path is `/api/classify` or `/api/insights`, **and** the `authorization` header does not exist.
  - **Then:** rate limit, fixed window, 60 s, 30 requests, keyed by IP.
  - **When exceeded:** 429.
- **One counter for both paths.** It is one rule, so a guest's classify and insights requests share the 30.
- **No code change.** The client already treats 429 as "no suggestion" for live typing, and as a backoff for the CSV classifier (`batchClassifier`); only a 404 switches the classifier off for the session (ADR `0011`, `0019`, `0032`).

## Verification

Every request in the bursts has an empty body (`{}`). The proxy answers 400 for it after the caller check and before the TypeSafe `fetch`, so the tests spend no TypeSafe credits. Logs: scratchpad `burst70-a.log`, `burst70-b.log`, `fallback70.log`.

- **The guest limit** (2026-10-03, 10:03:55 to 10:04:12 UTC): 40 sequential guest `POST {}` to `/api/classify`:
  - requests **1 to 30: 400**, in 0.36 to 1.1 s each (the function ran);
  - requests **31 to 40: 429**, in 0.12 to 0.14 s each (the edge answered; the function did not run).
- **Shared counter:** a guest `POST {}` to `/api/insights` straight after: **429**.
- **A request with a header is not limited by it:** `POST {}` with `Authorization: Basic x` straight after: **401**, from the proxy's own caller check.
- **The 429 is the firewall's:** `HTTP/1.1 429 Too Many Requests`, `X-Vercel-Mitigated: deny`, `Cache-Control: private, no-store, max-age=0`, body `{"error":{"code":"429","message":"Too Many Requests","id":"sin1::..."}}`. The client reads only the status.
- **The window rolls over:** 65 s later a guest `POST {}` got **400** again.
- **The app on production while limited** (scratchpad `runner/fallback70.mjs`, chromium at 1280, a fresh guest; this machine's guest window used up first), **13 of 13 checks:**
  - **A note no rule matches** ("Netflix subscription"):
    - the form asks `/api/classify` and gets 429;
    - 1.5 s later there is no suggestion chip, no "Auto-categorized" badge, and the category is unchanged (Food & Dining, the default).
  - **Not switched off:** a second unmatched note ("Spotify family plan") asks again and gets 429. Suggestions come back when the window rolls over.
  - **Saving still works:** the entry saves with an amount typed by hand, and the dialog closes.
  - **A keyword rule still categorises:** "coffee 45" gets "Auto-categorized: Food & Dining" and ฿45 from the note, with **no** request to the classifier (rules first, ADR `0011`).
  - **No breakage:** no uncaught page error; the only console errors are the two 429 resource loads.
  - **Not exercised live:** the insights card sent no request for this fresh guest, so its 429 path on production was not exercised. That path resolves to the same offline summary as every other failure (ADR `0020`) and is covered by `tests/insights.spec.ts`.

## Consequences

- **Signed-in callers have no firewall cap.** Anyone can create an account, and a valid token passes `checkCaller`, so one account can call TypeSafe as fast as it likes. ADR `0032`'s 120 a minute was the only bound on that. Ways to close it, none taken here:
  - the Pro plan, which allows more rate-limit rules;
  - a per-user count kept in the proxies (Supabase or Edge Config);
  - a lower-cost rule type, if Vercel offers one on Hobby.
- **A fixed window allows a burst of up to 60 at a boundary** (30 at the end of one window and 30 at the start of the next).
- **Guests behind one address share 30 a minute:** an office network or a mobile carrier's shared IP. Past it, each guest falls back to keyword rules for the rest of the minute. A CSV import's classifier run (ADR `0019`) retries a 429 once after 400 ms, then leaves that row without a suggestion and goes on; rows keep any keyword-rule category.
- **A guest who sends any `Authorization` header skips the guest rule,** but then needs a token Supabase accepts, so a fake header only buys a 401.
- **The rule lives in the dashboard, outside the repo.** Nothing in the code or CI notices if it is removed or edited. To check it, re-run the empty-body burst: a guest must get 429 at request 31 within a minute.
