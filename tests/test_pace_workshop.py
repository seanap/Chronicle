import unittest

from chronicle.pace_workshop import (
    DEFAULT_MARATHON_GOAL,
    calculate_race_equivalency,
    normalize_marathon_goal_time,
    parse_duration_to_seconds,
    resolve_pace_reference,
    supported_race_distances,
    training_paces_for_goal,
)


class TestPaceWorkshop(unittest.TestCase):
    def test_parse_duration_to_seconds_supports_mmss_and_hmmss(self) -> None:
        self.assertEqual(parse_duration_to_seconds("44:45"), 2685)
        self.assertEqual(parse_duration_to_seconds("0:44:45"), 2685)
        self.assertEqual(parse_duration_to_seconds("3:30:00"), 12600)

    def test_normalize_marathon_goal_time(self) -> None:
        self.assertEqual(normalize_marathon_goal_time("3:30:00"), "3:30:00")
        self.assertEqual(normalize_marathon_goal_time("210:00"), "3:30:00")

    def test_supported_race_distances(self) -> None:
        values = [item["value"] for item in supported_race_distances()]
        self.assertEqual(values, ["1mi", "2mi", "5k", "10k", "15k", "10mi", "hm", "marathon"])

    def test_training_paces_for_goal_nearest_lookup(self) -> None:
        payload = training_paces_for_goal("3:29:36")
        self.assertEqual(payload["matched_marathon_goal"], "3:30:00")
        paces = {item["key"]: item["pace"] for item in payload["paces"]}
        self.assertEqual(paces.get("recovery"), "10:19")
        self.assertEqual(paces.get("marathon_pace"), "8:01")
        family_lookup = {item["label"]: item for item in payload["plan_families"]}
        self.assertIn("Pfitz", family_lookup)
        pfitz_items = {item["label"]: item["display"] for item in family_lookup["Pfitz"]["items"]}
        self.assertEqual(pfitz_items.get("LT"), "7:51")
        self.assertEqual(pfitz_items.get("General Aerobic"), "9:41 to 9:02")
        pfitz_lt = next(item for item in family_lookup["Pfitz"]["items"] if item["label"] == "LT")
        self.assertEqual(pfitz_lt["preferred_token"], "strength")

    def test_calculate_race_equivalency_from_10k_input(self) -> None:
        payload = calculate_race_equivalency("10k", "0:44:45")
        self.assertEqual(payload["derived_marathon_goal"], "3:29:36")
        self.assertEqual(payload["training"]["matched_marathon_goal"], "3:30:00")
        equivalency = {item["distance"]: item["time"] for item in payload["race_equivalency"]}
        self.assertEqual(equivalency.get("10k"), "44:40")
        self.assertEqual(equivalency.get("marathon"), "3:29:36")

    def test_default_marathon_goal_constant(self) -> None:
        self.assertEqual(DEFAULT_MARATHON_GOAL, "5:00:00")

    def test_resolve_pace_reference_maps_aliases_to_hansons_defaults(self) -> None:
        threshold = resolve_pace_reference("3:30:00", "$threshold")
        self.assertEqual(threshold["canonical_key"], "strength")
        self.assertEqual(threshold["display"], "7:51")
        interval = resolve_pace_reference("3:30:00", "$i")
        self.assertEqual(interval["canonical_key"], "interval")
        self.assertEqual(interval["display"], "7:21 to 7:03")


if __name__ == "__main__":
    unittest.main()
