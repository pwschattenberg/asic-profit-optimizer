"""Pure profitability calculations for ASIC Profit Optimizer."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CurvePoint:
    """One measured ASIC operating point."""

    target_w: float
    actual_w: float
    hashrate_ths: float


@dataclass(frozen=True, slots=True)
class OptimalPoint:
    """Best economic operating point."""

    target_w: float
    actual_w: float
    hashrate_ths: float
    profit_per_hour: float


def parse_curve(raw: str) -> list[CurvePoint]:
    """Parse lines formatted as target_w,actual_w,hashrate_ths."""
    points: list[CurvePoint] = []

    for line_no, original in enumerate(raw.splitlines(), start=1):
        line = original.split("#", 1)[0].strip()
        if not line:
            continue

        parts = [part.strip() for part in line.split(",")]
        if len(parts) != 3:
            raise ValueError(
                f"Curve line {line_no} must contain exactly 3 comma-separated values"
            )

        try:
            target_w, actual_w, hashrate_ths = (float(part) for part in parts)
        except ValueError as err:
            raise ValueError(f"Curve line {line_no} contains a non-numeric value") from err

        if target_w <= 0 or actual_w <= 0 or hashrate_ths <= 0:
            raise ValueError(f"Curve line {line_no} values must all be greater than zero")

        points.append(CurvePoint(target_w, actual_w, hashrate_ths))

    if not points:
        raise ValueError("At least one curve point is required")

    targets = [point.target_w for point in points]
    if len(targets) != len(set(targets)):
        raise ValueError("Power target values must be unique")

    return sorted(points, key=lambda point: point.target_w)


def revenue_per_hour(hashrate_ths: float, hashprice_per_th_day: float) -> float:
    """Expected mining revenue per hour."""
    return hashrate_ths * hashprice_per_th_day / 24.0


def electricity_cost_per_hour(actual_w: float, price_per_kwh: float) -> float:
    """Electricity cost per hour. Negative electricity prices are valid."""
    return (actual_w / 1000.0) * price_per_kwh


def profit_per_hour(
    hashrate_ths: float,
    actual_w: float,
    hashprice_per_th_day: float,
    price_per_kwh: float,
) -> float:
    """Expected profit per hour."""
    return (
        revenue_per_hour(hashrate_ths, hashprice_per_th_day)
        - electricity_cost_per_hour(actual_w, price_per_kwh)
    )


def find_optimal_point(
    curve: list[CurvePoint],
    hashprice_per_th_day: float,
    price_per_kwh: float,
) -> OptimalPoint:
    """Find the measured curve point with maximum expected profit."""
    best: OptimalPoint | None = None

    for point in curve:
        profit = profit_per_hour(
            point.hashrate_ths,
            point.actual_w,
            hashprice_per_th_day,
            price_per_kwh,
        )
        candidate = OptimalPoint(
            target_w=point.target_w,
            actual_w=point.actual_w,
            hashrate_ths=point.hashrate_ths,
            profit_per_hour=profit,
        )
        if best is None or candidate.profit_per_hour > best.profit_per_hour:
            best = candidate

    if best is None:
        raise ValueError("Curve must contain at least one point")

    return best
