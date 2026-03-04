# UI Component Inventory (Android)

**Part:** android

## Activities / Views
- `MainActivity` — configuration UI (base URL input + refresh)

## App Widgets
- `MilesWidgetProvider` — 1x1 miles-only widget
- `TodayDetailWidgetProvider` — detailed widget (miles, run type, workout)

## Layouts
- `res/layout/activity_main.xml` — configuration screen
- `res/layout/widget_miles.xml` — miles-only widget layout
- `res/layout/widget_plan_today.xml` — detailed widget layout

## UI Rendering
- `WidgetRenderService` — applies `RemoteViews` updates for widgets

---
_Source: `android/app/src/main/java/com/chronicle/widget/*`, `res/layout/*`_ 
