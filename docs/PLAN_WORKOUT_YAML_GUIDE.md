# Plan Workout YAML Guide

## Purpose
The `Plan` page now has two separate workshops:

- `Pace Workshop`: defines your goal-derived pace targets
- `Workout Workshop`: defines reusable workout YAML files

The main plan table stays fast and compact. You build workouts in YAML, then attach them to `SOS` sessions from the table.

## Core workflow
1. Open `Plan`
2. Set or confirm your goal in `Pace Workshop`
3. Open `Workout Workshop`
4. Pick an existing workout or click `New`
5. Edit the Garmin-style YAML
6. Click `Save`
7. Close the drawer
8. In the main plan table, set a session to `SOS`
9. Select the workout from the workout picker
10. Use the row `...` menu to `Send to Garmin` or `Send 7 days to Garmin`

## What the YAML is for
The YAML is the authoritative workout definition.

The plan table does not store the full Garmin-style YAML inline. It shows a one-line shorthand for speed, but the shorthand is derived in the background.

That means:
- you author workouts in YAML
- Chronicle converts YAML to shorthand for the table
- if you edit shorthand in a row, Chronicle can derive a unique workout variant behind the scenes

## Workout libraries
The workshop groups workouts under expandable libraries such as:
- `Hansons`
- `Pfitz`
- `JD`
- `Higdon`
- `Galloway`
- `Run Type`
- `Strength`
- `Stretching`

These are stored as YAML files in `./data/workout_definitions`.

## Garmin-style YAML shape
A workout file uses this general shape:

```yaml
library: Hansons
run_type_default: SOS
workout:
  type: Run
  "Hansons Strength 8 mi":
    - warmup: lap @H(z2)
    - repeat(4):
        - run: 4min @P($strength)
        - recovery: 4min
    - cooldown: 2mi @H(z2)
tags:
  - strength
notes: ""
```

## Top-level fields
- `library`: grouping shown in the workshop picker
- `run_type_default`: usually `SOS` for running workouts
- `workout`: Garmin-style structured definition
- `tags`: optional labels for filtering or organization
- `notes`: optional free text

## Workout block
The `workout` block contains:
- `type`: workout sport/type
- one named workout body

Example:

```yaml
workout:
  type: Run
  "4 x 4min Strength":
    - warmup: lap @H(z2)
    - repeat(4):
        - run: 4min @P($strength)
        - recovery: 4min
    - cooldown: 2mi @H(z2)
```

## Supported workout type values
Chronicle is currently designed around Garmin-style workout families such as:
- `Run`
- `Bike`
- `Pool Swim`
- `Multisport`
- `Strength Training`
- `Cardio`
- `HIIT`
- `Yoga`
- `Pilates`
- `Mobility`
- `Custom`

Run is the most complete flow today.

## Common run step labels
For run workouts, common step labels include:
- `warmup`
- `run`
- `recovery`
- `rest`
- `cooldown`
- `other`

Repeat blocks use the form:

```yaml
- repeat(4):
    - run: 4min @P($10k)
    - recovery: 90sec
```

## Duration shorthand
Common duration expressions:
- `lap`
- `20min`
- `90sec`
- `2mi`
- `800m`

Examples:
- `warmup: lap @H(z2)`
- `run: 4min @P($strength)`
- `cooldown: 2mi @H(z2)`

## Target shorthand
### Pace targets
Use `@P(...)` for pace-driven targets.

Examples:
- `@P($easy)`
- `@P($strength)`
- `@P($mp)`
- `@P($10k)`
- `@P($5k)`

### Heart-rate targets
Use `@H(...)` for heart-rate targets.

Examples:
- `@H(z2)`
- `@H(z3)`

## Pace tokens
Chronicle resolves pace tokens from the current `Pace Workshop` goal.

Hansons remains the canonical baseline. Other plan labels are mapped onto that baseline where possible.

Common pace tokens:
- `$recovery`
- `$easy`
- `$easy_a`
- `$easy_b`
- `$lr`
- `$strength`
- `$mp`
- `$hmp`
- `$10k`
- `$5k`

Common aliases that resolve to the same target family:
- `$tempo`
- `$threshold`
- `$lt`
- `$lt2`
- `$t`
  These resolve to the Hansons-centered `strength` family.
- `$ga`
- `$general_aerobic`
- `$lt1`
  These resolve to the moderate / aerobic side of the easy-general range.
- `$i`
- `$vo2max`
  These resolve to interval pace.
- `$r`
- `$mile`
- `$repetition`
  These resolve to repetition / mile pace.

## Example workouts
### Strength repeat session
```yaml
library: Hansons
run_type_default: SOS
workout:
  type: Run
  "Strength 4 x 4min":
    - warmup: lap @H(z2)
    - repeat(4):
        - run: 4min @P($strength)
        - recovery: 4min
    - cooldown: 2mi @H(z2)
tags:
  - strength
notes: ""
```

### Marathon pace block
```yaml
library: Run Type
run_type_default: SOS
workout:
  type: Run
  "MP Block":
    - warmup: 2mi @H(z2)
    - run: 6mi @P($mp)
    - cooldown: 2mi @H(z2)
tags:
  - marathon-pace
notes: ""
```

### 10k intervals
```yaml
library: JD
run_type_default: SOS
workout:
  type: Run
  "6 x 1k @ 10k":
    - warmup: lap @H(z2)
    - repeat(6):
        - run: 1k @P($10k)
        - recovery: 90sec
    - cooldown: 2mi @H(z2)
tags:
  - interval
notes: ""
```

## Main table behavior
When a row has an `SOS` session and an attached workout:
- the shorthand appears in the row
- the backing `workout_id` stays attached to that session
- the row `...` menu becomes the send surface

Menu actions:
- `Send to Garmin`: sends attached workouts for that date
- `Send 7 days to Garmin`: sends that day plus the next 6 days

## Send to Garmin notes
The main plan table is the user-facing control point.

Chronicle uses the existing Garmin sync pipeline behind the scenes:
- it identifies attached workouts for the selected day or window
- it queues Garmin sync work per workout
- it returns success, partial, or error state back to the table

A partial result means some workouts were scheduled and some failed.

## Editing guidance
Use the workshop for structural edits such as:
- changing repeats
- changing step order
- changing targets
- changing libraries or tags

Use row-level edits for small per-day tweaks such as:
- slightly longer rep distance
- slightly different recovery
- a one-off variation for that specific day

Chronicle will preserve that edited row as its own workout variant when needed.
