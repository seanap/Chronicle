---
stepsCompleted: ['step-01-init','step-02-discovery','step-02b-vision','step-02c-executive-summary','step-03-success','step-04-journeys','step-05-domain','step-06-innovation','step-07-project-type','step-08-scoping','step-09-functional','step-10-nonfunctional','step-11-polish','step-12-complete']
inputDocuments:
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/product-brief.md
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/research-technical-feasibility.md
workflowType: 'prd'
workflow: 'edit'
classification:
  projectType: web_app
  domain: fitness/training, personal analytics
  complexity: high
  projectContext: brownfield
date: 2026-02-25
lastEdited: 2026-02-26
editHistory:
  - date: 2026-02-26
    changes: "Normalized accessibility and PWA scope with UX + Architecture; clarified MVP scope."
---

# Product Requirements Document - Auto-Stat-Description

**Author:** boss  
**Date:** 2026-02-25

## Executive Summary
Chronicle is a local-first web app for hobby runners that consolidates planning, automated Strava descriptions, and personalized trend analytics into one workflow. It reduces time spent in apps by automating the “update and document” loop and surfacing only the metrics the runner cares about. The product is opinionated and personal by design: it reflects a real runner’s training approach and preferences while remaining fast and low-friction despite high algorithmic complexity under the hood.

### What Makes This Special
Chronicle complements Strava/Garmin rather than replacing them. It enriches Strava with data those platforms don’t include, simplifies device workout delivery, and enables rapid “what-if” planning to avoid detraining or injury risk. Differentiation comes from personalization + automation + whimsy: playful conversions (e.g., calories to banana microsieverts) make training stats feel human, and automation ensures the best button is the one you never press. The core insight is consolidation: runners already stitch together multiple tools and subscriptions; Chronicle collapses that into one free, self-hosted system.

## Project Classification
- **Project Type:** Web app  
- **Domain:** Fitness/training and personal analytics  
- **Complexity:** High (medical/physiology-backed algorithms with a lightweight UX)  
- **Project Context:** Brownfield (existing system; focus on new changes/features)

## Success Criteria

### User Success
- [US1] Generate **creative, fun descriptions** with zero edits for **≥ 90%** of runs.  
- [US2] **War-game weekly mileage** in **≤ 5 minutes** to reduce injury risk.  
- [US3] **Build workouts** in **≤ 3 minutes** and have them appear on Garmin so the watch prompts “today’s workout.”

### Business Success
- [BS1] A non-technical user (dad) completes setup in **≤ 30 minutes** with **≤ 10 steps**.  
- [BS2] A moderately technical user (brother) completes self-host install in **≤ 45 minutes** with **≤ 15 steps**.
- Continued personal use over time.

### Technical Success
- [TS1] **Zero manual interventions** required per week.  
- [TS2] **Snappy UI**: p95 UI interactions **< 1s** for planning and dashboards.  
- [TS3] **Description fidelity**: templates render exactly as intended on **≥ 95%** of real activities.

### Measurable Outcomes
- [MO1] Weekly planning completed in **≤ 5 minutes**.  
- [MO2] Template edits reach production in **≤ 1 iteration**.  
- [MO3] **≥ 90%** of runs require no manual edits.
- [MO4] Non-technical setup completes in **≤ 30 minutes** with **≤ 10 steps** using the guided walkthrough.  
- [MO5] Semi-technical self-host install completes in **≤ 45 minutes** with **≤ 15 steps**.

## Product Scope

### MVP - Minimum Viable Product
- Keep the description pipeline stable and fast.  
- UI/UX polish pass to reduce friction.  
- Maintain template editor + preview loop.

### Growth Features (Post-MVP)
1. **Profile builder (YAML + UI)**  
2. **Workout Workshop (YAML + UI)**  
3. **Garmin workout sync** (create workout + calendar event)

### Out of Scope (Current Planning Horizon)
- Public cloud multi-tenant deployment.
- Full social network feature set.
- Real-time collaborative editing.
- Public marketplace moderation tooling.

### Vision (Future)
- UX strong enough for long-term personal use.  
- Opt-in social sharing/competition.  
- Community ecosystem for profiles, templates, and workouts (import/export + showcase).

## User Journeys

### 1) Primary User – Hobby Runner (Success Path) [J1]
Sunday evening: connect sources, tune templates, enable profiles, plan 2–4 weeks. Test via rerun on latest activity. First perfect auto-description validates the flow. Outcome: confidence in planning + storytelling with minimal ongoing effort.

**Failure/Recovery:** Broken output → edit Jinja → rerun until correct.

---

### 2) Primary User – Edge Case (Broken Template) [J2]
Jinja change breaks output. User can’t recall syntax. Recovery: validation feedback + rollback + fix → rerun to verify.

**Failure/Recovery:** Validation error → rollback → correct template → rerun.

---

### 3) Secondary User – Non-technical Runner (Dad) [J3]
Goal: whimsical descriptions (e.g., calories → shots of Jameson). Strava API app creation is the main barrier. A guided walkthrough takes him from app creation → credential input → verified status. After setup, he never touches it again.

**Failure/Recovery:** OAuth confusion → checklist + copy/paste → success confirmation.

---

### 4) Secondary User – Semi-technical Runner (Brother) [J4]
Reluctant to self-host after work. Installs once for automation; keeps it because it requires no ongoing attention.

**Failure/Recovery:** Install friction → concise guide + defaults → immediate automation.

---

### 5) Admin/Ops User – Self-Hoster [J5]
Weekly maintenance is plan updates. Edge cases: token expiration or breaking changes after updates. Recovery via health/status, alerts, and a clear troubleshooting guide.

**Failure/Recovery:** Tokens expired/upgrade regression → health flags → guided fix.

---

### 6) Integration/API User – Garmin Sync Flow [J6]
Build YAML workout in UI → searchable selection when Run Type = SOS → “Send to Garmin.” System creates workout if missing and schedules calendar entry. On run day, watch prompts “today’s workout.”

**Failure/Recovery:** API failure/duplicate → actionable error + retry.

---

### 7) Primary User – Trends & Heatmaps [J7]
User opens dashboard to review training trends and heatmaps to spot load spikes or gaps. Outcome: quick insight without leaving the app.

**Failure/Recovery:** Missing/incorrect trend data → refresh/recompute → corrected view.

---

### 8) Community/Sharing User – Templates & Profiles [J8]
User exports templates/profiles to share or imports a bundle from the community to try new styles. Outcome: quick experimentation without rebuilding from scratch.

**Failure/Recovery:** Import errors → validation feedback → fix and retry.

---

### Journey Requirements Summary
- Guided setup/OAuth walkthroughs.  
- Template validation, preview, and rollback.  
- Rerun flow for testing latest activity.  
- Fast planning UI.  
- Health/status + alerts + troubleshooting.  
- Workout YAML builder + searchable selection + Garmin sync.
- Trend/heatmap views with filtering.  
- Template/profile import/export.

## Innovation & Novel Patterns

### Detected Innovation Areas
- **Unified multi-source activity context** exposed via Jinja.  
- **Automation-first storytelling** for daily descriptions.  
- **Opinionated consolidation** for hobby runners.

### Market Context & Competitive Landscape
Existing tools are fragmented or premium-heavy. Chronicle differentiates through free, self-hosted consolidation and creative customization.

### Validation Approach
- A moderately technical user can create a working Jinja template with minimal guidance.  
- Setup → template → tested description completes within a short onboarding flow.

### Risk Mitigation
If templating is too hard, defaults must still feel great. Provide starter templates, sample fixtures, and rollback.

## Web App Specific Requirements

### Project-Type Overview
Self-hosted Docker web app. Current architecture is **MPA**; SPA is optional only if it improves UX or velocity.

### Technical Architecture Considerations
- **Rendering:** MPA today; SPA optional.  
- **Browsers:** Chrome, Firefox, Opera (latest).  
- **SEO:** Not required for the app UI.  
- **Real-time:** Not required; heartbeat is sufficient.  
- **Accessibility:** MVP requires WCAG 2.1 AA conformance for core user flows (Sources, Build, Plan, View, Control).
- **PWA:** Supported as a convenience install wrapper in MVP; full offline-first behavior is not required.

### Implementation Considerations
Preserve existing MPA routes unless SPA provides clear benefit. Keep UI fast without heavier frontend frameworks unless justified.

### Responsive Design
UI supports viewport widths 360–1440px with no horizontal scroll on core pages (plan, templates, dashboard), verified via manual QA on Chrome and Firefox.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**Approach:** Experience MVP  
**Resources:** 1 full-stack engineer + optional frontend polish

### MVP Feature Set (Phase 1)

**Core Journeys Supported**
- Setup → template → plan → rerun  
- Garmin sync  
- Template recovery path

**Must-Have Capabilities**
- UI/UX polish  
- Profile builder (YAML + UI)  
- Workout Workshop (YAML + UI)  
- Garmin workout send
- WCAG 2.1 AA accessibility baseline on core user flows
- PWA installability support (convenience), without offline-first requirements

### Post-MVP Features

**Phase 2**
- Guided OAuth + Strava API walkthrough  
- Jinja hints/examples  
- Health/status + troubleshooting  
- Template/profile import/export
- Expanded accessibility hardening beyond core flows
- Optional enhanced PWA ergonomics (install prompts/surface polish)

**Phase 3**
- Community sharing  
- Social comparison/competition  
- Creative description showcase

### Risk Mitigation Strategy
**Technical:** Garmin API, YAML builders, template UX → start small, expand after core flow is stable.  
**Market:** Limited adoption → emphasize automation + fun descriptions.  
**Resource:** Time constraints → keep MVP tight; defer community to Phase 3.

## Functional Requirements

### Source Setup & OAuth
- FR1 [MVP] [Trace: J1,J3->BS1]: Users can view status of each external data source connection.  
- FR2 [MVP] [Trace: J1,J3->BS1]: Users can configure source credentials via a web UI.  
- FR3 [MVP] [Trace: J1,J3->BS1]: Users can complete Strava OAuth and verify connection success.  
- FR4 [MVP] [Trace: J1,J3->TS1]: Users can disconnect/reconnect sources without losing other settings.

### Template Editing & Rendering
- FR5 [MVP] [Trace: J1,J2->US1]: Users can edit a description template using Jinja syntax.  
- FR6 [MVP] [Trace: J1,J2->US1]: Users can validate templates before saving.  
- FR7 [MVP] [Trace: J1,J2->US1]: Users can preview a template against sample or latest activity context.  
- FR8 [MVP] [Trace: J2->TS1]: Users can roll back to a previous template version.  
- FR9 [MVP] [Trace: J1,J2->US1]: Users can select a working profile for template editing.

### Profile Management (Phase-1)
- FR10 [MVP] [Trace: J1,J8->US1]: Users can create and edit activity classification profiles in a UI.  
- FR11 [MVP] [Trace: J1->US1]: Users can enable/disable profiles and set priority.  
- FR12 [MVP] [Trace: J1->US1]: Users can preview which profile applies to a given activity context.  
- FR13 [MVP] [Trace: J8->US1]: Users can import/export profiles as YAML.

### Planning & Workouts
- FR14 [MVP] [Trace: J1->US2]: Users can view and edit a multi-week plan grid.  
- FR15 [MVP] [Trace: J1->US2]: Users can set run type and mileage per day.  
- FR16 [MVP] [Trace: J1,J6->US3]: Users can attach workouts to a day.  
- FR17 [MVP] [Trace: J6->US3]: Users can create and edit structured workouts in the Workout Workshop UI.  
- FR18 [MVP] [Trace: J6->US3]: Users can select workouts from a searchable list.

### Garmin Integration (Phase-1)
- FR19 [MVP] [Trace: J6->US3]: Users can send a workout to Garmin from a plan day.  
- FR20 [MVP] [Trace: J6->US3]: The system can create a Garmin workout if it does not exist.  
- FR21 [MVP] [Trace: J6->US3]: The system can add the workout to the Garmin calendar for a date.  
- FR22 [MVP] [Trace: J6,J5->TS1]: Users can see a Garmin sync result within **30 seconds** with a status code, timestamp, and either confirmation of scheduling or retry guidance.

### Dashboard & Trends
- FR23 [MVP] [Trace: J7->US2]: Users can view training trends via charts/heatmaps.  
- FR24 [MVP] [Trace: J7->US2]: Users can scope dashboard views by year/summary modes.  
- FR25 [MVP] [Trace: J7->US2]: Users can view activity-type labels and custom metrics.

### Automation & Rerun
- FR26 [MVP] [Trace: J1,J5->TS1]: The system can detect new activities on a worker heartbeat.  
- FR27 [MVP] [Trace: J1,J2->US1]: Users can rerun description generation for latest activity.  
- FR28 [MVP] [Trace: J1,J2->US1]: Users can rerun description generation for a specific activity.

### UI/UX Polish (Phase-1)
- FR29 [MVP] [Trace: J1,J2,J3->TS2]: Users can complete core flows (plan edit, template edit, rerun) in ≤ 3 steps and ≤ 60 seconds.  
- FR30 [MVP] [Trace: J1,J7->TS2]: Users can complete UI interactions for dashboard navigation and plan edits in < 1s p95.

### Guidance & Troubleshooting (Phase-2)
- FR31 [Phase-2] [Trace: J3->BS1]: Users can follow a Strava API app setup walkthrough.  
- FR32 [Phase-2] [Trace: J2->US1]: Users can access inline Jinja hints/examples.  
- FR33 [Phase-2] [Trace: J5->TS1]: Users can view a health/status page.  
- FR34 [Phase-2] [Trace: J5->TS1]: Users can access a troubleshooting guide.

### Import/Export (Phase-2)
- FR35 [Phase-2] [Trace: J8->US1]: Users can export templates for sharing.  
- FR36 [Phase-2] [Trace: J8->US1]: Users can import templates from a bundle.  
- FR37 [Phase-2] [Trace: J8->US1]: Users can export/import profiles for sharing.

## Non-Functional Requirements

### Performance
- Core user actions complete in **< 1s p95** under normal load (1 active user, local host, no background imports) as measured by client-side performance timing.  
- Template preview/render completes in **< 1s p95** under normal load (1 active user, latest activity context) as measured by server render timing.

### Reliability
- Automated description writes fail **< 1 time per month** under normal load (daily activity sync,< 50 activities/week) as measured by job success logs.  
- System runs **≥ 8 weeks without manual intervention** under normal conditions (1 active user, weekly plan updates, stable network) as measured by health checks and error logs.

### Integration
- Garmin sync completes within **15–30 seconds p95** under normal load (single workout/day, stable network) as measured by sync job duration logs.  
- External API failures apply **retry + backoff** and surface actionable errors within **60 seconds** under normal conditions (stable network, non-expired tokens) as measured by error event timestamps.

### Security
- API keys/tokens stored securely (env + local state only; never logged in plaintext) verified by log scanning and config review.  
- Designed for **local/Tailscale-only access**; no public exposure required, verified by default bind settings and documented configuration.

### Accessibility
- Core user flows (Sources, Build, Plan, View, Control) conform to **WCAG 2.1 AA** in MVP as verified by keyboard-only traversal, contrast checks, and semantic label audits on supported browsers.

### PWA Scope
- The system provides **PWA installability** in MVP for convenience access, while explicitly **not requiring offline-first behavior**, as verified by successful install flow and online-only operation for live data/actions.
