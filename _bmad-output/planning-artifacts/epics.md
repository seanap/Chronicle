---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
inputDocuments:
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd.md
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/architecture.md
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/ux-design-specification.md
  - /home/shipyard/src/Auto-Stat-Description/_bmad-output/planning-artifacts/prd-validation-report.md
---

# {{project_name}} - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for {{project_name}}, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements
FR1: Users can view status of each external data source connection.
FR2: Users can configure source credentials via a web UI.
FR3: Users can complete Strava OAuth and verify connection success.
FR4: Users can disconnect/reconnect sources without losing other settings.
FR5: Users can edit a description template using Jinja syntax.
FR6: Users can validate templates before saving.
FR7: Users can preview a template against sample or latest activity context.
FR8: Users can roll back to a previous template version.
FR9: Users can select a working profile for template editing.
FR10: Users can create and edit activity classification profiles in a UI.
FR11: Users can enable/disable profiles and set priority.
FR12: Users can preview which profile applies to a given activity context.
FR13: Users can import/export profiles as YAML.
FR14: Users can view and edit a multi-week plan grid.
FR15: Users can set run type and mileage per day.
FR16: Users can attach workouts to a day.
FR17: Users can create and edit structured workouts in the Workout Workshop UI.
FR18: Users can select workouts from a searchable list.
FR19: Users can send a workout to Garmin from a plan day.
FR20: The system can create a Garmin workout if it does not exist.
FR21: The system can add the workout to the Garmin calendar for a date.
FR22: Users can see a Garmin sync result within 30 seconds with a status code, timestamp, and either confirmation of scheduling or retry guidance.
FR23: Users can view training trends via charts/heatmaps.
FR24: Users can scope dashboard views by year/summary modes.
FR25: Users can view activity-type labels and custom metrics.
FR26: The system can detect new activities on a worker heartbeat.
FR27: Users can rerun description generation for latest activity.
FR28: Users can rerun description generation for a specific activity.
FR29: Users can complete core flows (plan edit, template edit, rerun) in ≤ 3 steps and ≤ 60 seconds.
FR30: Users can complete UI interactions for dashboard navigation and plan edits in < 1s p95.
FR31: Users can follow a Strava API app setup walkthrough.
FR32: Users can access inline Jinja hints/examples.
FR33: Users can view a health/status page.
FR34: Users can access a troubleshooting guide.
FR35: Users can export templates for sharing.
FR36: Users can import templates from a bundle.
FR37: Users can export/import profiles for sharing.

### NonFunctional Requirements
NFR1: Core user actions complete in < 1s p95 under normal load (client timing).
NFR2: Template preview/render completes in < 1s p95 under normal load (server render timing).
NFR3: Automated description writes fail < 1 time per month under normal load (job logs).
NFR4: System runs ≥ 8 weeks without manual intervention under normal conditions (health/error logs).
NFR5: Garmin sync completes within 15–30 seconds p95 under normal load (sync job duration).
NFR6: External API failures use retry + backoff and surface actionable errors within 60 seconds.
NFR7: API keys/tokens stored securely (env + local state only; never logged).
NFR8: Designed for local/Tailscale-only access; no public exposure required.

### Additional Requirements
- Architecture: SPA starter template if chosen is Vite + React + TS + MUI.
- Architecture: Preserve existing MPA routes unless SPA clearly improves UX/velocity.
- Architecture: Brownfield migration requires MPA/SPA coexistence safeguards and rollback validation during phased rollout.
- Architecture: Local-only deployment via Docker Compose.
- Architecture: REST JSON with standard error envelope; no `/api/v1` prefix.
- Architecture: CORS off by default; dev-only if SPA dev server needs it.
- Architecture: SQLite retained; SQLAlchemy Core + Alembic + Pydantic for data/validation.
- Architecture: Health/ready endpoints + worker heartbeat; retries and idempotent tasks.
- Architecture: Android widget uses `/plan/today.json` without auth (LAN/Tailscale).
- UX: Material-based design system; dark theme base with neon orange accents.
- UX: Responsive 320–1440px, no horizontal scroll on core pages; WCAG AA.
- UX: Browsers: Chrome, Firefox, Opera (latest).
- UX: PWA supported.
- UX: Validation-first UX with inline errors and clear fixes.
- UX: Garmin push is one-click with clear success/failure feedback.

### FR Coverage Map

FR1: Epic 1 - Source Setup & OAuth Connections
FR2: Epic 1 - Source Setup & OAuth Connections
FR3: Epic 1 - Source Setup & OAuth Connections
FR4: Epic 1 - Source Setup & OAuth Connections
FR5: Epic 2 - Template Authoring & Validation
FR6: Epic 2 - Template Authoring & Validation
FR7: Epic 2 - Template Authoring & Validation
FR8: Epic 2 - Template Authoring & Validation
FR9: Epic 2 - Template Authoring & Validation
FR10: Epic 3 - Profile Management
FR11: Epic 3 - Profile Management
FR12: Epic 3 - Profile Management
FR13: Epic 3 - Profile Management
FR14: Epic 4 - Planning & Workout Workshop
FR15: Epic 4 - Planning & Workout Workshop
FR16: Epic 4 - Planning & Workout Workshop
FR17: Epic 4 - Planning & Workout Workshop
FR18: Epic 4 - Planning & Workout Workshop
FR19: Epic 5 - Garmin Workout Sync
FR20: Epic 5 - Garmin Workout Sync
FR21: Epic 5 - Garmin Workout Sync
FR22: Epic 5 - Garmin Workout Sync
FR23: Epic 7 - Dashboard & Trends
FR24: Epic 7 - Dashboard & Trends
FR25: Epic 7 - Dashboard & Trends
FR26: Epic 6 - Automation & Rerun
FR27: Epic 6 - Automation & Rerun
FR28: Epic 6 - Automation & Rerun
FR29: Cross-cutting (apply to relevant epics as ACs)
FR30: Cross-cutting (apply to relevant epics as ACs)
FR31: Epic 1 - Source Setup & OAuth Connections
FR32: Epic 2 - Template Authoring & Validation
FR33: Epic 8 - Reliability & Recovery
FR34: Epic 8 - Reliability & Recovery
FR35: Epic 2 - Template Authoring & Validation
FR36: Epic 2 - Template Authoring & Validation
FR37: Epic 3 - Profile Management

## Cross-Cutting Acceptance Checklist (MVP)

- FR29: Applicable core flows must complete in <= 3 UI steps and <= 60 seconds under normal load.
- FR30: Applicable interactive flows must respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs.
- Error handling: On failed writes/actions, users receive clear actionable errors and no partial/incorrect data is persisted.
- API/action feedback: User-visible actions return status code and timestamped outcome where required by PRD (including retry guidance for sync/rerun flows).

## Epic List

### Epic 1: Source Setup & OAuth Connections
Users can connect and manage external sources confidently with clear status and guided setup.
**FRs covered:** FR1, FR2, FR3, FR4, FR31

### Epic 2: Template Authoring & Validation
Users can edit, validate, preview, and roll back description templates with confidence, including template sharing.
**FRs covered:** FR5, FR6, FR7, FR8, FR9, FR32, FR35, FR36

### Epic 3: Profile Management
Users can create, prioritize, preview, and share profiles that drive template selection.
**FRs covered:** FR10, FR11, FR12, FR13, FR37

### Epic 4: Planning & Workout Workshop
Users can plan weeks, attach workouts, and build/search workouts efficiently.
**FRs covered:** FR14, FR15, FR16, FR17, FR18

### Epic 5: Garmin Workout Sync
Users can send workouts to Garmin with reliable feedback and retry guidance.
**FRs covered:** FR19, FR20, FR21, FR22

### Epic 6: Automation & Rerun
Users can trust automation and rerun descriptions for latest or specific activities.
**FRs covered:** FR26, FR27, FR28

### Epic 7: Dashboard & Trends
Users can view trends, heatmaps, and scoped analytics quickly.
**FRs covered:** FR23, FR24, FR25

### Epic 8: Reliability & Recovery
Users can confirm system health and resolve issues quickly.
**FRs covered:** FR33, FR34

## Epic 1: Source Setup & OAuth Connections

Users can connect and manage external sources confidently with clear status and guided setup.

### Story 1.1: Set Up SPA Starter Template

As a developer,
I want to scaffold the SPA using the approved starter template,
So that the UI foundation matches the architecture decision.

**Acceptance Criteria:**

**Given** the SPA path is chosen
**When** I initialize the frontend
**Then** a Vite + React + TypeScript project is created
**And** MUI is installed and configured for theming.

### Story 1.2: View Source Connection Status

As a runner,
I want to see the status of each external data source connection,
So that I can quickly confirm which sources are healthy or need attention.

**Acceptance Criteria:**

**Given** I open the Sources page
**When** the page loads
**Then** I can see each source with a clear status (connected, warning, error, disconnected)
**And** the status reflects the latest known connection state.

### Story 1.3: Configure Source Credentials in UI

As a runner,
I want to enter and update source credentials in a web UI,
So that I can connect sources without editing files manually.

**Acceptance Criteria:**

**Given** I am on the Sources page
**When** I open a source's configuration panel
**Then** I can enter required credentials (e.g., client ID/secret, tokens)
**And** I can save changes and see a clear success or error message.
**Given** I submit invalid or expired credentials
**When** I save credential changes
**Then** the save is rejected with clear corrective guidance
**And** no partial or incorrect credentials are persisted.

### Story 1.4: Complete Strava OAuth and Verify Connection

As a runner,
I want to complete Strava OAuth and verify the connection,
So that I can trust Strava data is flowing into the system.

**Acceptance Criteria:**

**Given** I have entered Strava credentials
**When** I initiate OAuth
**Then** I am redirected to Strava to authorize access
**And** after approval, I return to the app and see a verified connection status.

### Story 1.5: Disconnect and Reconnect Sources Without Losing Settings

As a runner,
I want to disconnect and reconnect a source without losing other settings,
So that I can safely reauthorize or reset a connection.

**Acceptance Criteria:**

**Given** a source is connected
**When** I choose to disconnect it
**Then** the connection is removed but other app settings remain unchanged
**And** I can reconnect later without re-entering unrelated configuration.

### Story 1.6: Guided Strava API App Setup Walkthrough

As a runner,
I want a guided walkthrough for creating a Strava API app,
So that I can complete OAuth setup without confusion.

**Acceptance Criteria:**

**Given** I have not created a Strava API app
**When** I open the Strava setup walkthrough
**Then** I see step-by-step instructions with required fields
**And** I can confirm completion and proceed to OAuth setup.

## Epic 2: Template Authoring & Validation

Users can edit, validate, preview, and roll back description templates with confidence, including template sharing.

### Story 2.1: Edit Description Template (Jinja)

As a runner,
I want to edit a description template using Jinja,
So that I can customize how my activity descriptions read.

**Acceptance Criteria:**

**Given** I am on the Build page
**When** I open a template editor
**Then** I can modify the template text using Jinja syntax
**And** I can save changes to the template
**And** a typical edit + save flow completes in <= 3 steps and <= 60 seconds (FR29)
**And** edit/save interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)
**Given** I attempt to save invalid template content
**When** I submit the save action
**Then** the save is rejected with clear error details
**And** no partial template update is persisted.

### Story 2.2: Validate Template Before Save (with Jinja Hints)

As a runner,
I want to validate a template before saving, with Jinja hints,
So that I can fix syntax or logic errors quickly.

**Acceptance Criteria:**

**Given** I have edited a template
**When** I run validation
**Then** I see a success state if valid
**And** if invalid, I see actionable Jinja error hints/examples.
**And** the validate flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)
**And** validation interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

### Story 2.3: Preview Template Against Sample or Latest Activity

As a runner,
I want to preview a template against sample or latest activity data,
So that I can see the output before publishing.

**Acceptance Criteria:**

**Given** a template is edited
**When** I run preview against sample or latest activity
**Then** I see the rendered description output
**And** any render errors are shown clearly.
**And** the preview flow can be completed in <= 3 steps and <= 60 seconds under normal load (FR29)
**And** preview interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)

### Story 2.4: Roll Back to a Previous Template Version

As a runner,
I want to roll back to a previous template version,
So that I can recover quickly after a bad change.

**Acceptance Criteria:**

**Given** I have multiple saved versions of a template
**When** I select a previous version
**Then** the template is restored to that version
**And** I can confirm it is now active.

### Story 2.5: Select Profile for Template Editing

As a runner,
I want to select a working profile while editing templates,
So that I can target the right activity classification.

**Acceptance Criteria:**

**Given** I am editing a template
**When** I choose a profile from a list
**Then** the template editor reflects the selected profile context
**And** I can switch profiles without losing my edits.

### Story 2.6: Export Templates for Sharing (Phase-2)

As a runner,
I want to export templates for sharing,
So that I can reuse them or share with others.

**Acceptance Criteria:**

**Given** I have saved templates
**When** I choose export
**Then** I receive a downloadable template bundle
**And** it includes all selected templates.

### Story 2.7: Import Template Bundles (Phase-2)

As a runner,
I want to import a template bundle,
So that I can try new styles without rebuilding from scratch.

**Acceptance Criteria:**

**Given** I have a template bundle file
**When** I import it
**Then** the templates are added and available for selection
**And** any validation errors are shown clearly.

## Epic 3: Profile Management

Users can create, prioritize, preview, and share profiles that drive template selection.

### Story 3.1: Create and Edit Activity Classification Profiles

As a runner,
I want to create and edit activity classification profiles in a UI,
So that I can control how activities are categorized.

**Acceptance Criteria:**

**Given** I am on the Profiles section
**When** I create or edit a profile
**Then** I can enter classification rules and save the profile
**And** the profile appears in the profile list.
**Given** I submit an invalid or conflicting profile configuration
**When** I save the profile
**Then** the save is rejected with clear corrective guidance
**And** no partial or incorrect profile data is persisted.

### Story 3.2: Enable/Disable Profiles and Set Priority

As a runner,
I want to enable/disable profiles and set their priority,
So that the correct profile is selected for an activity.

**Acceptance Criteria:**

**Given** I have multiple profiles
**When** I toggle a profile on/off or change its priority
**Then** the profile list reflects the new enabled state and ordering
**And** only enabled profiles are considered active.

### Story 3.3: Preview Which Profile Applies to an Activity

As a runner,
I want to preview which profile applies to a given activity context,
So that I can verify my rules are working.

**Acceptance Criteria:**

**Given** I have a sample or latest activity context
**When** I run a profile preview
**Then** the system shows which profile would apply
**And** I can see the matching criteria.

### Story 3.4: Import/Export Profiles as YAML

As a runner,
I want to import and export profiles as YAML,
So that I can share and reuse profile setups.

**Acceptance Criteria:**

**Given** I have saved profiles
**When** I export profiles
**Then** I receive a YAML file with the selected profiles
**And** when I import a YAML file, valid profiles are added and errors shown if invalid.

## Epic 4: Planning & Workout Workshop

Users can plan weeks, attach workouts, and build/search workouts efficiently.

### Story 4.1: View and Edit Multi-Week Plan Grid

As a runner,
I want to view and edit a multi-week plan grid,
So that I can adjust my training plan quickly.

**Acceptance Criteria:**

**Given** I open the Plan page
**When** the plan grid loads
**Then** I can view multiple weeks of planned days
**And** I can edit plan entries within the grid
**And** a simple plan edit completes in <= 3 steps and <= 60 seconds (FR29)
**And** plan interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).
**Given** a plan edit contains invalid values or conflicts
**When** I save the plan change
**Then** the save is rejected with clear corrective guidance
**And** no partial or incorrect plan update is persisted.

### Story 4.2: Set Run Type and Mileage Per Day

As a runner,
I want to set the run type and mileage for a day,
So that each day reflects my intended training.

**Acceptance Criteria:**

**Given** I am editing a plan day
**When** I set run type and mileage
**Then** the day reflects the new values
**And** changes persist after refresh.
**And** this day-edit flow completes in <= 3 steps and <= 60 seconds under normal load (FR29)
**And** day-edit interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30)
**Given** I submit invalid mileage or an unsupported run type
**When** I save day values
**Then** the save is rejected with clear corrective guidance
**And** no partial or incorrect day data is persisted.

### Story 4.3: Attach a Workout to a Day

As a runner,
I want to attach a workout to a plan day,
So that I can track a specific workout for that day.

**Acceptance Criteria:**

**Given** I am editing a plan day
**When** I select a workout to attach
**Then** the workout is associated with that day
**And** the association is visible in the plan grid.

### Story 4.4: Build Structured Workouts in Workout Workshop

As a runner,
I want to create and edit structured workouts in the Workout Workshop UI,
So that I can define structured workouts without leaving the app.

**Acceptance Criteria:**

**Given** I open the Workout Workshop
**When** I create or edit a structured workout in the UI
**Then** the workout is saved and available for selection
**And** validation errors are shown if required workout fields are invalid.

### Story 4.5: Search and Select Workouts

As a runner,
I want to search and select workouts from a list,
So that I can quickly attach the right workout.

**Acceptance Criteria:**

**Given** I am choosing a workout
**When** I search by name or type
**Then** matching workouts are shown
**And** I can select one to attach to a plan day.

## Epic 5: Garmin Workout Sync

Users can send workouts to Garmin with reliable feedback and retry guidance.

### Story 5.1: Send Workout to Garmin from a Plan Day

As a runner,
I want to send a workout to Garmin from a plan day,
So that my watch has the correct workout scheduled.

**Acceptance Criteria:**

**Given** a plan day has a workout attached
**When** I choose "Send to Garmin"
**Then** the system initiates a Garmin sync for that workout
**And** I see a pending or in-progress status.

### Story 5.2: Create Garmin Workout if Missing

As a runner,
I want the system to create a Garmin workout if it doesn't exist,
So that my planned workout can still be synced.

**Acceptance Criteria:**

**Given** I send a workout that does not exist in Garmin
**When** the sync runs
**Then** the system creates the workout in Garmin
**And** it continues the sync flow with the new workout.

### Story 5.3: Schedule Workout on Garmin Calendar

As a runner,
I want the system to schedule the workout on my Garmin calendar,
So that my watch prompts the workout on the correct day.

**Acceptance Criteria:**

**Given** a workout exists in Garmin
**When** I sync a plan day
**Then** the workout is scheduled on the Garmin calendar for that date
**And** the calendar entry matches the plan day.

### Story 5.4: Show Sync Result Within 30 Seconds with Retry Guidance

As a runner,
I want to see a Garmin sync result quickly with actionable guidance,
So that I know whether it succeeded and how to retry if it failed.

**Acceptance Criteria:**

**Given** I initiate a Garmin sync
**When** the sync completes or fails
**Then** I see a status code and timestamp within 30 seconds
**And** I see either confirmation that scheduling succeeded or actionable retry guidance with next steps.

## Epic 6: Automation & Rerun

Users can trust automation and rerun descriptions for latest or specific activities.

### Story 6.1: Detect New Activities on Worker Heartbeat

As a runner,
I want the system to detect new activities via a worker heartbeat,
So that I know new activities are picked up for processing.

**Acceptance Criteria:**

**Given** the worker heartbeat runs
**When** a new activity is detected
**Then** the system records the detection state
**And** the UI can surface that a new activity is available.

### Story 6.2: Rerun Description for Latest Activity

As a runner,
I want to rerun description generation for the latest activity,
So that I can refresh output after template changes.

**Acceptance Criteria:**

**Given** there is a latest activity
**When** I click "Rerun latest"
**Then** a new description is generated
**And** I see a status code and timestamped success/failure result without duplicate reruns.
**And** the rerun initiation flow completes in <= 3 steps and <= 60 seconds under normal load (FR29)

### Story 6.3: Rerun Description for a Specific Activity

As a runner,
I want to rerun description generation for a specific activity,
So that I can refresh output for a chosen run.

**Acceptance Criteria:**

**Given** I select a specific activity
**When** I click "Rerun"
**Then** a new description is generated for that activity
**And** I see a status code and timestamped success/failure result without duplicate reruns.
**And** the rerun initiation flow completes in <= 3 steps and <= 60 seconds under normal load (FR29)

## Epic 7: Dashboard & Trends

Users can view trends, heatmaps, and scoped analytics quickly.

### Story 7.1: View Trends and Heatmaps Dashboard

As a runner,
I want to view training trends and heatmaps,
So that I can understand my training patterns at a glance.

**Acceptance Criteria:**

**Given** I open the Dashboard
**When** the page loads
**Then** I see trend charts and heatmaps
**And** they reflect my current training data
**And** dashboard interactions respond in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).

### Story 7.2: Scope Dashboard by Year or Summary Mode

As a runner,
I want to scope the dashboard by year or summary mode,
So that I can focus on a specific time range or view.

**Acceptance Criteria:**

**Given** I am viewing the dashboard
**When** I select a year or summary mode
**Then** the charts and heatmaps update to that scope
**And** the selected scope is clearly shown
**And** the dashboard scope-change interaction responds in < 1s p95 under normal load, as measured by client-side timing telemetry in test runs (FR30).

### Story 7.3: View Activity-Type Labels and Custom Metrics

As a runner,
I want to view activity-type labels and custom metrics on the dashboard,
So that I can interpret trends with my own classification and stats.

**Acceptance Criteria:**

**Given** the dashboard is displayed
**When** I view trend panels
**Then** activity-type labels and custom metrics are shown where applicable
**And** they match my configured profiles and metrics.

## Epic 8: Reliability & Recovery

Users can confirm system health and resolve issues quickly.

### Story 8.1: View Health/Status Page

As a runner,
I want to view a health/status page,
So that I can see if the system is healthy and what to do next.

**Acceptance Criteria:**

**Given** I open the Health/Status page
**When** the page loads
**Then** I see clear healthy/warn/error states
**And** each state includes a recommended next action.

### Story 8.2: Troubleshooting Guide with Actionable Fixes

As a runner,
I want a troubleshooting guide with actionable fixes,
So that I can resolve common issues quickly.

**Acceptance Criteria:**

**Given** I open the Troubleshooting guide
**When** I review a common issue
**Then** I see clear steps to resolve it
**And** the steps reference known fixes (tokens, Docker, connectivity).

### Story 8.3: Brownfield MPA/SPA Coexistence and Rollback Guardrails

As a maintainer,
I want phased MPA/SPA coexistence guardrails with rollback checks,
So that UI migration can ship safely without breaking existing core flows.

**Acceptance Criteria:**

**Given** a new SPA route is introduced
**When** it is released
**Then** the corresponding legacy MPA flow remains available behind a fallback path
**And** smoke tests verify core journeys (Sources, Build, Plan, View, Control) before and after release.

**Given** a regression is detected in a migrated flow
**When** rollback is triggered
**Then** traffic can return to the MPA fallback within 15 minutes
**And** the rollback procedure and verification checklist are documented and executable.
