---
stepsCompleted: []
inputDocuments:
  - /home/shipyard/src/Auto-Stat-Description/docs/project-overview.md
  - /home/shipyard/src/Auto-Stat-Description/docs/integration-architecture.md
  - /home/shipyard/src/Auto-Stat-Description/docs/user-provided-context.md
date: 2026-02-26
author: boss
---

# Product Brief: Auto-Stat-Description (Chronicle)

## Problem Statement
Hobby runners use disconnected tools for planning, workout delivery, and post-run documentation. This fragmentation increases weekly overhead, weakens consistency, and creates friction in maintaining training routines.

## Target Users
- Primary: Hobby runners who want low-friction planning plus automatic, personalized run descriptions.
- Secondary: Non-technical runners needing guided setup.
- Secondary: Semi-technical runners willing to self-host once for long-term automation.

## Value Proposition
Chronicle consolidates plan editing, workout generation/sync, and Strava description automation into one local-first workflow. It combines practical utility with personalized, fun output that encourages continued usage.

## Core Outcomes
- Reduce weekly planning and documentation effort.
- Improve consistency of training workflow execution.
- Deliver high-quality auto-generated run descriptions with minimal editing.

## Success Metrics
- At least 90% of generated descriptions require zero manual edits.
- Weekly plan adjustment completed in 5 minutes or less.
- Workout creation-to-Garmin scheduling completed in 3 minutes or less.
- Non-technical setup can be completed in 30 minutes or less with guided flow.

## MVP Scope
- Stable description generation pipeline with template edit/preview/rollback.
- Planning UI improvements for fast weekly updates.
- Profile builder and workout workshop (YAML-backed UI).
- Garmin workout create-and-schedule from plan workflow.

## Non-Goals (Initial)
- Public cloud multi-tenant deployment.
- Full social network feature set.
- Complex real-time collaboration infrastructure.

## Key Risks
- Template authoring complexity may block non-technical users.
- Garmin and external API reliability can degrade user trust.
- Brownfield constraints may slow UX modernization if not scoped tightly.

## Mitigation Approach
- Provide high-quality default templates, validation, and rollback.
- Implement clear health/status visibility and actionable error guidance.
- Prioritize core flow speed and reliability before expanding social/community features.

## Strategic Notes
Chronicle should remain opinionated and personal: optimize for one excellent end-to-end runner workflow rather than broad generic fitness coverage.
