"""Pure profitability-engine tests without importing Home Assistant."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

MODULE_PATH = (
    Path(__file__).parents[1]
    / "custom_components"
    / "asic_profit_optimizer"
    / "optimizer.py"
)
SPEC = spec_from_file_location("asic_profit_optimizer_math", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
optimizer = module_from_spec(SPEC)
sys.modules[SPEC.name] = optimizer
SPEC.loader.exec_module(optimizer)


def test_parse_curve_sorts_points() -> None:
    curve = optimizer.parse_curve(
        """
        1000,1040,10.8
        600,630.1,7.544
        800,835,9.2
        """
    )

    assert [point.target_w for point in curve] == [600, 800, 1000]


def test_negative_electricity_price_is_revenue() -> None:
    assert optimizer.electricity_cost_per_hour(1000, -0.10) == -0.10


def test_optimizer_uses_actual_wall_power_for_cost() -> None:
    curve = optimizer.parse_curve(
        """
        600,630,7.5
        800,900,9.0
        """
    )

    best = optimizer.find_optimal_point(
        curve,
        hashprice_per_th_day=0.12,
        price_per_kwh=0.04,
    )

    assert best.target_w == 600


def test_negative_power_price_can_favor_high_power_point() -> None:
    curve = optimizer.parse_curve(
        """
        600,630,7.5
        1000,1040,10.5
        """
    )

    best = optimizer.find_optimal_point(
        curve,
        hashprice_per_th_day=0.032,
        price_per_kwh=-0.05,
    )

    assert best.target_w == 1000


def test_break_even_price_is_best_curve_efficiency() -> None:
    curve = optimizer.parse_curve(
        """
        600,630,7.5
        1000,1040,10.5
        """
    )

    price = optimizer.break_even_electricity_price(
        curve,
        hashprice_per_th_day=0.032,
    )

    expected = max(
        (7.5 * 0.032 / 24) / 0.630,
        (10.5 * 0.032 / 24) / 1.040,
    )
    assert abs(price - expected) < 1e-12
