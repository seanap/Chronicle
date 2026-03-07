from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from chronicle.storage import set_plan_setting
from chronicle.workout_workshop import (
    collect_workout_target_references,
    create_workout_definition_from_yaml,
    list_workout_definitions,
    resolve_session_workout,
)


class TestWorkoutWorkshop(unittest.TestCase):
    def test_list_workout_definitions_seeds_sample_libraries_when_empty(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "runtime_state.db"
            workouts = list_workout_definitions(runtime_path)
            libraries = {str(item.get("library") or "") for item in workouts}
            self.assertGreaterEqual(len(workouts), 8)
            self.assertEqual(
                libraries,
                {"Hansons", "Pfitz", "Higdon", "JD", "Galloway", "Run Type", "Strength", "Stretching"},
            )

    def test_create_workout_definition_from_yaml_persists_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "runtime_state.db"
            document = create_workout_definition_from_yaml(
                runtime_path,
                yaml_text="\n".join(
                    [
                        "library: Pfitz",
                        "run_type_default: SOS",
                        "workout:",
                        "  type: Run",
                        "  \"Pfitz LT 6 mi Custom\":",
                        "    - warmup: 2mi @H(z2)",
                        "    - run: 6mi @P($threshold)",
                        "    - cooldown: 2mi @H(z2)",
                    ]
                ),
            )
            workout = document["workout"]
            self.assertEqual(workout["workout_id"], "pfitz-lt-6-mi-custom")
            self.assertEqual(workout["library"], "Pfitz")
            self.assertTrue((Path(temp_dir) / "workout_definitions" / "pfitz-lt-6-mi-custom.yaml").exists())

    def test_list_workout_definitions_migrates_legacy_plan_setting(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "runtime_state.db"
            set_plan_setting(
                runtime_path,
                "workout_workshop.definitions",
                [
                    {
                        "workout_code": "tempo-20",
                        "title": "Tempo 20",
                        "structure": "2E + 20T + 2E",
                    }
                ],
            )
            workouts = list_workout_definitions(runtime_path)
            self.assertEqual(len(workouts), 1)
            self.assertEqual(workouts[0]["workout_id"], "tempo-20")
            self.assertEqual(workouts[0]["shorthand"], "2E + 20T + 2E")
            self.assertTrue((Path(temp_dir) / "workout_definitions" / "tempo-20.yaml").exists())

    def test_resolve_session_workout_derives_variant_for_edited_shorthand(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "runtime_state.db"
            create_workout_definition_from_yaml(
                runtime_path,
                yaml_text="\n".join(
                    [
                        "library: Hansons",
                        "run_type_default: SOS",
                        "workout:",
                        "  type: Run",
                        "  \"Hansons Strength 9 mi Custom\":",
                        "    - warmup: 2mi @H(z2)",
                        "    - repeat(4):",
                        "        - run: 2mi @P($strength)",
                        "        - recovery: 800m",
                        "    - cooldown: 2mi @H(z2)",
                    ]
                ),
            )
            resolved = resolve_session_workout(
                runtime_path,
                workout_code="hansons-strength-9-mi-custom",
                planned_workout="2E + 5x2T w/ 800m E + 2E",
                run_type="SOS",
            )
            self.assertNotEqual(resolved["workout_code"], "hansons-strength-9-mi-custom")
            self.assertEqual(resolved["planned_workout"], "2E + 5x2T w/ 800m E + 2E")
            derived = {item["workout_id"]: item for item in list_workout_definitions(runtime_path)}
            self.assertIn(resolved["workout_code"], derived)
            self.assertEqual(derived[resolved["workout_code"]]["source_workout_id"], "hansons-strength-9-mi-custom")

    def test_collect_workout_target_references_resolves_pace_aliases(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_path = Path(temp_dir) / "runtime_state.db"
            document = create_workout_definition_from_yaml(
                runtime_path,
                yaml_text="\n".join(
                    [
                        "library: JD",
                        "run_type_default: SOS",
                        "workout:",
                        "  type: Run",
                        "  \"Daniels Cruise\":",
                        "    - warmup: 2mi @H(z2)",
                        "    - repeat(4):",
                        "        - run: 1mi @P($t)",
                        "        - recovery: 1min",
                        "    - cooldown: 2mi @H(z2)",
                    ]
                ),
            )
            targets = collect_workout_target_references(document["workout"], "3:30:00")
            target_lookup = {item["raw"]: item for item in targets}
            self.assertEqual(target_lookup["P($t)"]["kind"], "pace")
            self.assertEqual(target_lookup["P($t)"]["canonical_key"], "strength")
            self.assertEqual(target_lookup["P($t)"]["display"], "7:51")
            self.assertEqual(target_lookup["H(z2)"]["kind"], "heart_rate_zone")
