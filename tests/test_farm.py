"""Tests for farm-level aggregation."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "asic_profit_optimizer"
    / "farm.py"
)
SPEC = spec_from_file_location("asic_profit_optimizer_farm", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
farm = module_from_spec(SPEC)
sys.modules[SPEC.name] = farm
SPEC.loader.exec_module(farm)


def test_aggregate_farm_counts_and_totals() -> None:
    result = farm.aggregate_farm(
        [
            {
                "hashrate_ths": 7.5,
                "power_w": 630.0,
                "current_profit_per_hour": 0.01,
                "optimal_profit_per_hour": 0.02,
                "optimal_actual_power_w": 630.0,
                "active": True,
                "profitable": True,
                "mining_request": True,
                "auto_optimize": True,
            },
            {
                "hashrate_ths": 0.0,
                "power_w": 0.0,
                "current_profit_per_hour": 0.0,
                "optimal_profit_per_hour": -0.01,
                "optimal_actual_power_w": 800.0,
                "active": False,
                "profitable": False,
                "mining_request": False,
                "auto_optimize": True,
            },
        ]
    )

    assert result["configured_miners"] == 2
    assert result["active_miners"] == 1
    assert result["profitable_miners"] == 1
    assert result["mining_requested_miners"] == 1
    assert result["auto_optimize_miners"] == 2
    assert result["total_hashrate_ths"] == 7.5
    assert result["total_power_w"] == 630.0
    assert result["current_profit_per_hour"] == 0.01
    assert result["optimal_profit_per_hour"] == 0.02
    assert result["optimal_profit_per_day"] == 0.48
    assert result["optimal_active_power_w"] == 630.0


def test_negative_optimal_profit_means_off_at_farm_optimum() -> None:
    result = farm.aggregate_farm(
        [
            {
                "hashrate_ths": 0.0,
                "power_w": 0.0,
                "current_profit_per_hour": 0.0,
                "optimal_profit_per_hour": -0.20,
                "optimal_actual_power_w": 1000.0,
                "active": False,
                "profitable": False,
                "mining_request": False,
                "auto_optimize": True,
            }
        ]
    )

    assert result["optimal_profit_per_hour"] == 0.0
    assert result["optimal_profit_per_day"] == 0.0
    assert result["optimal_active_power_w"] == 0.0


def test_partial_data_is_flagged() -> None:
    result = farm.aggregate_farm(
        [
            {
                "hashrate_ths": None,
                "power_w": None,
                "current_profit_per_hour": None,
                "optimal_profit_per_hour": 0.01,
                "optimal_actual_power_w": 600.0,
                "active": False,
                "profitable": True,
                "mining_request": False,
                "auto_optimize": False,
            }
        ]
    )

    assert result["complete"]["hashrate"] is False
    assert result["complete"]["power"] is False
    assert result["complete"]["current_profit"] is False
    assert result["complete"]["optimal_profit"] is True
