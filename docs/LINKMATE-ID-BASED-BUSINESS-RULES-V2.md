# Link Mate — ID-based business rules v2

Authoritative implementation contract for batches after Batch 1.
Batch 1 locks this document only. It does **not** implement the new engine.

**Batch 1 lock:** production test-business reset applied `2026-09-09T08:22:24Z` (`app_settings.batch1_test_reset_at`). Two admin identities preserved. No ID-progression/commission engine was implemented in Batch 1.

## A. Core entity model

1. **User Account** — a human/login/identity container. One account can own multiple Membership IDs.
2. **Membership ID** — every activated Membership ID is an independent business node/stake.
3. **Principle:** Person owns IDs. IDs perform and earn. Account aggregates.

Admin identity and business Membership ID are separate. An admin account may have zero Membership IDs.

## B. Package / ID model

| Package | Membership IDs | Structure |
|---|---|---|
| Builder | 1 | 1 root |
| Turbo | 4 | 1 root + 3 internal |
| Super Turbo | 13 | 1 root + 3 first-layer + 9 second-layer |
| Hyper Turbo | 22 | already-approved 1 + 3 + 9 + 9 (middle ID of each gen-2 group sponsors 3 of the final 9) |

All valid created Membership IDs are real independent qualifying business IDs.

Do **not** count persons.
Do **not** collapse package-created IDs into one person-level qualification unit.

## C. ID-level referral / sponsorship

Every Membership ID has its own referral/reference identity.

Joining attribution is:

`New Membership ID → Exact Sponsor Membership ID`

Not:

`User Account → User Account`

If someone joins using a specific Membership ID’s referral:

- that specific Membership ID is the sponsor node
- its direct sponsor count updates
- its own level eligibility/progression updates
- legitimate upstream sponsor-tree IDs may also receive eligible active-level progress according to later rules

Each Membership ID must support its own:

- referral code/link
- sponsor relationship
- downline
- level state
- commission attribution
- performance history

## D. Level rules

Every Membership ID follows the same rules independently.

**Level 1**

- requires 3 directly sponsored Membership IDs
- 3/3 completes Level 1
- package-created internal IDs may legitimately satisfy this when they are structurally sponsored by that ID

After Level 1 completes:

| Level | Target |
|---|---|
| 2 | 9 new eligible downline Membership IDs |
| 3 | 27 |
| 4 | 54 |
| 5 | 108 |
| 6 | 162 |
| 7 | 216 |
| 8 | 270 |
| 9 | 324 |

For Levels 2–9:

- generation depth does **not** determine the level
- any newly activated legitimate descendant Membership ID anywhere in the sponsor-tree downline may count
- it counts toward that beneficiary Membership ID’s **current active level**
- progression is sequential
- no level skipping
- one joining event may count once for each eligible ancestor Membership ID independently
- for a given beneficiary Membership ID, the same joining must never be counted twice
- an event used to finish one level must not also be reused as progress for that beneficiary’s next level
- do not retroactively bank pre-qualification joins unless explicitly changed later
- after Level 9 completes, the Membership ID becomes COMPLETED/GRADUATED
- account/history/wallet remain accessible
- no further level progression after graduation

## E. Commission model

Commission is earned and attributed per beneficiary Membership ID.

Existing level rates remain:

| Level | Rate |
|---|---|
| 1 | 8% |
| 2 | 6% |
| 3 | 3% |
| 4 | 2% |
| 5 | 1.2% |
| 6 | 1% |
| 7 | 1% |
| 8 | 1% |
| 9 | 1% |

Keep existing HELD / RELEASED / REVERSED ledger philosophy:

- qualifying commission accumulates member/ID-event by event
- level earnings remain HELD until that level target is fully completed
- no partial level payout
- full accumulated level amount releases when the target completes
- preserve auditable immutable ledger behavior
- no silent balance editing

Commission calculations are ID-based, not person-based.

## F. Account / wallet principle

Account owns/uses the financial balance.
Membership IDs earn and attribute the money.

Every earning/ledger record must remain traceable to the exact beneficiary Membership ID.

Conceptual chain:

```
Joining ID
→ Sponsor ancestry
→ Eligible beneficiary Membership ID
→ Beneficiary active level
→ Commission entry
→ Owner Account wallet
```

## G. Dashboard contract (later batches)

Do not implement the redesign in Batch 1.

**Account Dashboard**

- aggregate summary across owned IDs
- Total IDs
- Total Held
- Total Available
- Total Released
- overall useful status summary

**My Membership IDs** — each ID independently shows:

- Membership ID
- root/internal/source indication
- current level
- current progress
- direct sponsor count
- held commission
- released earnings
- status
- referral copy/share
- open/view ID dashboard

**Individual ID Dashboard**

- exact selected ID context
- own referral code
- direct sponsored IDs
- current level
- progress
- completed levels
- eligible downline activity
- held commission
- released commission
- earning history
- network/downline
- qualification/performance
- activity history

The user must be able to answer: “Which ID earned how much and from what activity?”

For 13/22 IDs: do not dump an unmanageable wall of cards. Support scalable search/filter/sort/ID switching in a later UI batch. Mobile-first.

## H. Land benefit

Current business wording:

- **1 Decimal Land**
- Membership qualification requires the defined sponsor/level journey
- personally/ID structurally achieve Level 1 according to the final ID model
- complete Level 9
- qualification does not itself equal legal land transfer
- documentation/allocation/transfer terms remain applicable

Do not revert to 1 Katha wording.

## I. Source-of-truth change

The previous generation-based progression model is **no longer** the source of truth for Levels 2–9.

Sponsor ancestry remains relevant for determining legitimate downline relationships.

Generation data must not be reused blindly as the new level-progress source.

Later batches should use an immutable/idempotent event-oriented concept similar to:

```
Membership ID Activation Event
→ Eligible Ancestor Membership ID
→ Ancestor Active Level at Event Time
→ Count Once
→ Commission Entry
```

Do **not** implement this engine in Batch 1.
