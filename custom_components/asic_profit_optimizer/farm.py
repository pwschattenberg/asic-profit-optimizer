"""Farm aggregation helpers for ASIC Profit Optimizer."""

from __future__ import annotations

from typing import Any


def _sum_known(values: list[float | None]) -> float:
    """Sum known numeric values, treating unknown values as absent."""
    return sum(value for value in values if value is not None)


def aggregate_farm(miners: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate per-miner snapshots into a farm summary.

    The farm's optimal mining profit assumes an unprofitable miner can stay off,
    so negative per-miner optimal-profit values contribute zero to the farm
    optimum.
    """
    hash_rates = [miner.get("hashrate_ths") for miner in miners]
    powers = [miner.get("power_w") for miner in miners]
    current_profits = [miner.get("current_profit_per_hour") for miner in miners]
    optimal_profits = [miner.get("optimal_profit_per_hour") for miner in miners]

    profitable_optimal = [
        max(0.0, value) if value is not None else None for value in optimal_profits
    ]

    optimal_actual_powers = [
        (
            miner.get("optimal_actual_power_w")
            if (miner.get("optimal_profit_per_hour") or 0) > 0
            else 0.0
        )
        for miner in miners
    ]

    return {
        "configured_miners": len(miners),
        "active_miners": sum(bool(miner.get("active")) for miner in miners),
        "profitable_miners": sum(bool(miner.get("profitable")) for miner in miners),
        "mining_requested_miners": sum(
            bool(miner.get("mining_request")) for miner in miners
        ),
        "auto_optimize_miners": sum(
            bool(miner.get("auto_optimize")) for miner in miners
        ),
        "total_hashrate_ths": _sum_known(hash_rates),
        "total_power_w": _sum_known(powers),
        "current_profit_per_hour": _sum_known(current_profits),
        "optimal_profit_per_hour": _sum_known(profitable_optimal),
        "optimal_profit_per_day": _sum_known(profitable_optimal) * 24.0,
        "optimal_active_power_w": _sum_known(optimal_actual_powers),
        "complete": {
            "hashrate": all(value is not None for value in hash_rates),
            "power": all(value is not None for value in powers),
            "current_profit": all(value is not None for value in current_profits),
            "optimal_profit": all(value is not None for value in optimal_profits),
        },
    }
