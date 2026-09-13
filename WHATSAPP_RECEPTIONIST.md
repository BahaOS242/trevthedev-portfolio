# WhatsApp AI Receptionist — Portfolio Demo

A portfolio project page (`/whatsapp-ai-receptionist`) that demonstrates an
AI receptionist product for a fictional dental clinic, **BrightSmile
Dental**. It's a working conversation engine, not a scripted animation —
every reply is generated live by a rule-based dialogue manager running on
the server.

**This is a demo, not a production deployment.** Nothing here sends a real
WhatsApp message, books a real appointment, calls a real LLM, or writes to
a real database. See [Demo limitations](#demo-limitations) below for the
exact boundary between what's real and what's simulated.

## What it demonstrates

- A realistic, stateful-feeling conversation UX (greeting, FAQs, service
  explanations, appointment booking, rescheduling, cancellation, lead
  capture, human escalation) built on a genuinely stateless request model.
- Business/AI logic cleanly separated from presentation — the dialogue
  engine has zero knowledge of HTML/DOM, and the UI has zero knowledge of
  intent detection or slot-filling.
- An architecture shaped like a real integration (webhook → agent →
  business knowledge → business actions), with simulated actions standing
  in for the real ones.

## Architecture

```
Visitor types in the chat widget (ReceptionistDemo.astro)
        │  POST { messages: ChatMessage[] }
        ▼
src/pages/api/receptionist.ts        — Astro server route (the "webhook")
        │
        ▼
src/lib/receptionist/engine.ts       — the "AI Agent": stateless dialogue
        │                               manager. Recomputes conversation
        │                               state from the full transcript on
        │                               every call — nothing is persisted
        │                               server-side between requests.
        ├── nlu.ts                    — intent detection + slot extraction
        │                               (name/phone/date/time/service).
        │                               Regex-based today; isolated so a
        │                               real LLM call could replace just
        │                               this module later.
        └── knowledge.ts              — "Business Knowledge": clinic
                                          hours, address, services,
                                          pricing, policies.
        │
        ▼
SimulatedAction (booking_captured, reschedule_captured,
cancellation_captured, escalation_created, lead_captured)
        │  returned to the client, rendered as a clearly-labeled
        │  demo card — never written to any datastore.
```

This mirrors the target production shape from the project brief:

```
WhatsApp → Webhook/API → AI Agent → Business Knowledge → Business Actions → CRM/Booking/Notifications
```

For the demo, `Webhook/API` is the Astro API route, `AI Agent` is the
rule-based engine, `Business Knowledge` is `knowledge.ts`, and
`Business Actions` / `CRM/Booking/Notifications` are the `SimulatedAction`
objects rendered as demo cards instead of real side effects.

### Why a stateless, transcript-replayed engine

Every turn, the client sends the **entire** message history back to
`/api/receptionist`, and the engine recomputes the current booking draft,
active flow, and fallback streak from scratch by replaying it — the same
way a stateless chat-completion API works. This means:

- No server-side session storage is needed for the demo.
- The "conversation memory" requirement (never re-ask for info already
  given) falls out of the replay naturally, rather than needing a
  hand-maintained session object.
- Each assistant message carries a small amount of its own state
  (`pending`, `wasFallback`) so the next turn can correctly interpret a
  free-text reply — e.g. knowing that a bare "John Miller" is answering
  "could I get your name?" rather than being an unrelated statement.

### Why a rule-based engine, not an LLM, for now

The brief's future-proofing instructions explicitly call for *not* wiring
up integrations before they're authorized. `nlu.ts` (intent + slot
extraction) is the only place that would need to change to swap in a real
LLM provider — `engine.ts`'s flow/slot-filling logic and the API contract
would stay the same.

## Features implemented

- Greeting, with quick-reply suggested prompts.
- FAQs: hours, location, services, pricing, insurance, new patients,
  payment options, emergencies.
- Conversational service explanations (e.g. "do you do teeth whitening?").
- Appointment booking: collects service, date, time, name, and phone —
  one question at a time, filling multiple slots from a single message
  when the visitor volunteers them together, and never re-asking for
  something already provided anywhere earlier in the conversation.
- Rescheduling and cancellation flows.
- Lead capture: fires once, silently, the first time a name is known
  during an active booking/reschedule flow — shown as a subtle chip in
  the chat, distinct from the customer-facing conversation.
- Human escalation: on an explicit request, a detected emergency, or two
  consecutive low-confidence replies in a row.
- Typing indicator, message timestamps, quick-reply chips, loading state
  on first load, and an inline error state if the API call fails.
- Interactive customer ROI calculator ("What could this be worth to your
  business?") — models potential annual impact across three engines
  (recovered bookings, improved retention, reactivated customers) against
  the fixed $300/month product price, entirely client-side. See
  [Customer ROI calculator](#customer-roi-calculator) below.

## Customer ROI calculator

`src/lib/receptionist/roi.ts` holds the calculation as pure functions
(`calculateRoi`), independent of the DOM — `ReceptionistEconomics.astro`'s
client script only wires inputs/sliders to it and formats the output. No
network call is involved; every input change recomputes instantly in the
browser.

Three independent revenue engines, summed into a total:

- **Recover** — `missed bookings/month × recovery rate × avg. revenue per
  new customer × 12`
- **Retain** — `active customers × (expected retention − current
  retention) × avg. annual revenue per retained customer`
- **Reactivate** (optional, toggleable) — `inactive customers ×
  reactivation rate × revenue per reactivated customer`

`total impact − ($300 × 12 = $3,600)` gives the potential net annual
impact; `net impact ÷ $3,600` gives the potential ROI multiple.

This intentionally shows the *customer's* potential economics, not the
product's own internal economics — no CAC, LTV, COGS, gross margin, or
capital-required figures appear anywhere in this section. Every default
input, label, and the "How is this calculated?" panel is phrased as an
editable planning assumption ("potential", "illustrative"), never as a
guaranteed or actual result — including the "expected retention with AI
follow-up" input, which is explicitly labeled as the visitor's own
hypothesis, not a claimed outcome.

## Local setup

This lives inside the existing Wix Headless + Astro portfolio project —
there's no separate install.

```bash
npm install
npm run dev
```

Then visit `/whatsapp-ai-receptionist` on the local dev URL the Wix CLI
prints.

No environment variables are required to run this feature today — see
below.

## Environment variables

**None are required for the current demo.** The engine is fully
self-contained (no external API calls, no database).

Future phases would need variables like these (not created, not read by
any code yet):

| Variable | Would be needed for |
|---|---|
| `OPENAI_API_KEY` (or another LLM provider key) | Replacing the rule-based `nlu.ts` with a real model |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Real Meta WhatsApp Cloud API integration |
| `GOOGLE_CALENDAR_CLIENT_ID` / `_SECRET` | Real appointment availability + booking |
| A CRM/database connection string | Persisting real leads, customers, and appointment history |

## Demo limitations

Everything below is **simulated**, clearly labeled as such in the UI, and
does not touch any real system:

- No real WhatsApp message is sent or received — this is a web chat
  widget styled like WhatsApp.
- No real appointment is booked, rescheduled, or cancelled.
- No real lead record is created anywhere — "lead captured" is a
  same-session UI event only, not a database write.
- No real staff member is contacted on escalation.
- The AI responses come from a deterministic rule-based engine, not a
  real LLM.
- All clinic information (BrightSmile Dental, hours, address, prices) is
  fictional and illustrative.
- The ROI calculator computes illustrative, editable planning
  assumptions from whatever numbers the visitor enters — it is not
  connected to any real business's data and shows no actual revenue,
  customers, or results.

## Future production architecture

To take this from demo to a real deployment, each simulated action would
be replaced by a real integration behind the same `SimulatedAction`-style
boundary already in `engine.ts`:

- **WhatsApp**: Meta WhatsApp Cloud API webhook instead of the browser
  chat widget calling `/api/receptionist` directly.
- **AI**: swap `nlu.ts`'s regex matching for a real LLM call, keeping
  `engine.ts`'s flow/slot-filling contract the same.
- **Booking**: `booking_captured` / `reschedule_captured` /
  `cancellation_captured` actions would call a real calendar (e.g. Google
  Calendar) and a real appointments table instead of just returning a
  label.
- **CRM**: `lead_captured` would write to a real customer/lead table (this
  repo already has a proven pattern for this — see
  `src/pages/api/audit.ts`'s use of `@wix/data` + `auth.elevate()` for the
  Growth Audit tool's lead capture — deliberately not reused here yet, to
  keep this demo from writing into production Wix Data).
- **Escalation**: `escalation_created` would notify real staff (email/SMS)
  and create a record in a real staff dashboard instead of a chat card.
- **Multi-business configuration**: `knowledge.ts` is already shaped as a
  single business's config; supporting multiple tenants would mean loading
  this per-tenant instead of as static constants.
