# Profile Workshop YAML Guide

## What changed
The Build page `Profile Workshop` now separates two concerns:

- `Profile YAML` defines what a profile is and what activity conditions make it match.
- `Profile Status` controls whether that profile is enabled or disabled.

`Enabled / disabled` is no longer part of the YAML document you edit.

## Basic workflow
1. Open `Build`
2. Open `Profile Workshop`
3. Choose a profile from the dropdown
4. Use the status button to enable or disable the selected profile
5. Edit the YAML if you want to change label, priority, or match criteria
6. Click `Save`
7. Click `Set Working` if you want that profile to become the working fallback/template context

## Buttons
- `New`: start a new custom profile draft
- `Reload`: discard local YAML edits and reload the saved profile document
- `Enable Profile` / `Disable Profile`: toggle the selected profile status
- `Save`: save the YAML document for the selected custom profile
- `Set Working`: make the selected enabled profile the working fallback/template context
- `Validate`: test the current YAML against a real Strava activity ID

## Status rules
- `Default` is always enabled and cannot be disabled
- Builtin profiles can be enabled or disabled, but their YAML is read-only
- Custom profiles can be enabled or disabled and their YAML is editable
- Invalid custom YAML files are shown as invalid and must be fixed before they can be used

## Activity validator
The validator box sits below the YAML editor.

Workflow:
1. Select or draft a profile
2. Edit the YAML
3. Enter a Strava activity ID
4. Click `Validate`

What it does:
- validates the YAML structure first
- fetches that real Strava activity
- evaluates whether the currently selected profile would process it
- returns a brief result with the activity id, name, sport type, and match reason summary

Important:
- disabled profiles will return `Would not process` even if the criteria would otherwise match
- drafts are validated as if they were enabled, so you can test a new profile before saving it
- Garmin-aligned activity context is used when available so Garmin-specific criteria stay meaningful

## YAML shape
A profile document uses this shape:

```yaml
profile_id: evening-commute-run
label: Evening Commute Run
priority: 55
criteria:
  all_of:
    - sport_type:
        - run
    - strava_tags_any:
        - commute
    - time_of_day_after: "17:00"
```

## Top-level fields
- `profile_id`: stable id used for the profile file and matching
- `label`: human-readable profile name shown in the UI
- `priority`: higher numbers win when multiple profiles match
- `criteria`: the rule object that determines when the profile matches

## Criteria meta fields
These are documentation-only fields inside `criteria` and do not affect matching by themselves:

- `kind`
- `description`
- `notes`
- `label`
- `name`
- `version`

Example:

```yaml
criteria:
  kind: activity
  description: Evening commute runs from work
  all_of:
    - sport_type:
        - run
    - strava_tags_any:
        - commute
```

## Clause combinators
Use these to build rule logic:

- `all_of`: every nested rule must match
- `any_of`: at least one nested rule must match
- `none_of`: none of the nested rules may match

Example:

```yaml
criteria:
  all_of:
    - sport_type:
        - run
    - any_of:
        - strava_tags_any:
            - race
        - text_contains_any:
            - marathon
            - half
```

## Supported executable criteria
### Activity type and tags
- `sport_type`
- `workout_type`
- `strava_tags_any`
- `strava_tags_all`
- `garmin_activity_type_in`

### Boolean signals
- `trainer`
- `commute`
- `has_gps`
- `treadmill`
- `strength_like`

### Distance, time, and elevation
- `distance_miles_min`
- `distance_miles_max`
- `moving_time_seconds_min`
- `moving_time_seconds_max`
- `moving_time_minutes_min`
- `moving_time_minutes_max`
- `gain_per_mile_ft_min`
- `gain_per_mile_ft_max`
- `home_distance_miles_min`
- `home_distance_miles_max`

### Text matching
- `text_contains`
- `text_contains_any`
- `text_not_contains`
- `name_contains`
- `name_contains_any`
- `name_not_contains`
- `external_id_contains`
- `device_name_contains`

### Time and day
- `day_of_week_in`
- `time_of_day_after`
- `time_of_day_before`

`time_of_day_*` must use `HH:MM` 24-hour format.

### Location
- `start_geofence`

Example:

```yaml
criteria:
  all_of:
    - sport_type:
        - walk
    - start_geofence:
        latitude: 34.241946
        longitude: -83.964154
        radius_miles: 0.5
        mode: within
```

`mode` must be either:
- `within`
- `outside`

## Common examples
### Evening commute run
```yaml
profile_id: evening-commute-run
label: Evening Commute Run
priority: 55
criteria:
  all_of:
    - sport_type:
        - run
    - strava_tags_any:
        - commute
    - day_of_week_in:
        - monday
        - tuesday
        - wednesday
        - thursday
        - friday
    - time_of_day_after: "17:00"
```

### Long trail run
```yaml
profile_id: long-trail-run
label: Long Trail Run
priority: 70
criteria:
  all_of:
    - sport_type:
        - trailrun
    - distance_miles_min: 10
    - gain_per_mile_ft_min: 180
```

### Badge chase / keyword run
```yaml
profile_id: badge-chase
label: Badge Chase
priority: 40
criteria:
  all_of:
    - sport_type:
        - run
    - text_contains_any:
        - badge
        - local legend
        - segment
```

### Home-area walk
```yaml
profile_id: home-walk
label: Home Walk
priority: 25
criteria:
  all_of:
    - sport_type:
        - walk
    - trainer: false
    - has_gps: true
    - start_geofence:
        latitude: 34.241946
        longitude: -83.964154
        radius_miles: 0.75
        mode: within
```

## Validation rules
A custom profile must include at least one executable rule.

This will be rejected:

```yaml
profile_id: blank-custom
label: Blank Custom
priority: 5
criteria:
  kind: activity
  description: Missing executable rules
```

## Where files live
- Profile YAML files: `data/profile_rules/*.yaml`
- Workshop state: `data/profile_rules/_workshop_state.yaml`
- Per-profile templates: `data/template_profiles/*.j2`

## Notes
- Builtin profile YAML files exist as reference documents, but runtime immutability is enforced by the backend.
- If you manually break a custom YAML file, the workshop will surface it as invalid so it can be repaired.
