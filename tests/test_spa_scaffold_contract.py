from pathlib import Path


def test_spa_workspace_exists() -> None:
    root = Path("chronicle-ui")
    assert root.exists(), "chronicle-ui workspace is missing"
    assert (root / "package.json").exists(), "chronicle-ui/package.json missing"
    assert (root / "vite.config.ts").exists(), "chronicle-ui/vite.config.ts missing"


def test_spa_feature_structure_exists() -> None:
    root = Path("chronicle-ui/src")
    required = [
        "features/sources",
        "features/build",
        "features/plan",
        "features/view",
        "features/control",
        "components",
        "hooks",
        "api",
        "config",
        "assets",
        "app-smoke.test.tsx",
    ]
    for rel in required:
        assert (root / rel).exists(), f"Missing SPA scaffold path: {root / rel}"


def test_vite_proxy_and_router_placeholders_defined() -> None:
    config_text = Path("chronicle-ui/vite.config.ts").read_text(encoding="utf-8")
    assert "proxy" in config_text
    assert "VITE_API_PROXY_TARGET" in config_text
    assert "localhost:1609" in config_text

    routes_text = Path("chronicle-ui/src/config/routes.tsx").read_text(encoding="utf-8")
    for path in ["/sources", "/build", "/plan", "/view", "/control"]:
        assert path in routes_text
