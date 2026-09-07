"""Runtime manager for ASIC Profit Optimizer."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import logging

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import HomeAssistant, State, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event

from .const import (
    CONF_CURVE,
    CONF_ELECTRICITY_PRICE_SENSOR,
    CONF_HASHPRICE_SENSOR,
    CONF_HASHRATE_SENSOR,
    CONF_MIN_POWER_CHANGE,
    CONF_NAME,
    CONF_POWER_LIMIT_ENTITY,
    CONF_POWER_SENSOR,
    CONF_STARTUP_WAIT,
    DEFAULT_MIN_POWER_CHANGE,
    DEFAULT_STARTUP_WAIT,
)
from .optimizer import (
    CurvePoint,
    electricity_cost_per_hour,
    find_optimal_point,
    parse_curve,
    profit_per_hour,
    revenue_per_hour,
)

_LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class Metrics:
    """Calculated values exposed as Home Assistant entities."""

    current_revenue: float | None = None
    current_electricity_cost: float | None = None
    current_profit: float | None = None
    optimal_power: float | None = None
    optimal_actual_power: float | None = None
    optimal_hashrate: float | None = None
    optimal_profit: float | None = None


class AsicProfitManager:
    """Monitor source entities, calculate economics, and set optimal wattage."""

    def __init__(self, hass: HomeAssistant, entry) -> None:
        self.hass = hass
        self.entry = entry
        self.config = entry.data
        self.name: str = self.config[CONF_NAME]
        self.curve: list[CurvePoint] = parse_curve(self.config[CONF_CURVE])

        # Safe default: automatic control begins disabled on a new config entry.
        self.auto_optimize = False

        self.signal = f"asic_profit_optimizer_update_{entry.entry_id}"
        self._unsub_state = None
        self._power_task: asyncio.Task | None = None

    async def async_start(self) -> None:
        """Start tracking all economic/miner input entities."""
        entities = [
            self.config[CONF_HASHPRICE_SENSOR],
            self.config[CONF_ELECTRICITY_PRICE_SENSOR],
            self.config[CONF_HASHRATE_SENSOR],
            self.config[CONF_POWER_SENSOR],
            self.config[CONF_POWER_LIMIT_ENTITY],
        ]

        self._unsub_state = async_track_state_change_event(
            self.hass,
            entities,
            self._source_changed,
        )

    async def async_stop(self) -> None:
        """Stop listeners/tasks."""
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None

        self._cancel_power_task()

    @callback
    def _source_changed(self, _event) -> None:
        """React immediately when a source sensor changes."""
        async_dispatcher_send(self.hass, self.signal)
        self._reconcile_power_target()

    def _float_state(self, entity_id: str) -> float | None:
        state: State | None = self.hass.states.get(entity_id)
        if state is None or state.state in (
            STATE_UNKNOWN,
            STATE_UNAVAILABLE,
            "",
            "none",
        ):
            return None
        try:
            return float(state.state)
        except (TypeError, ValueError):
            return None

    def calculate(self) -> Metrics:
        """Calculate current and predicted/optimal metrics."""
        result = Metrics()

        hashprice = self._float_state(self.config[CONF_HASHPRICE_SENSOR])
        electricity = self._float_state(self.config[CONF_ELECTRICITY_PRICE_SENSOR])
        hashrate = self._float_state(self.config[CONF_HASHRATE_SENSOR])
        power = self._float_state(self.config[CONF_POWER_SENSOR])

        # Live/current values legitimately become zero while the miner is off.
        if hashprice is not None and hashrate is not None:
            result.current_revenue = revenue_per_hour(hashrate, hashprice)

        if electricity is not None and power is not None:
            result.current_electricity_cost = electricity_cost_per_hour(
                power, electricity
            )

        if (
            hashprice is not None
            and electricity is not None
            and hashrate is not None
            and power is not None
        ):
            result.current_profit = profit_per_hour(
                hashrate,
                power,
                hashprice,
                electricity,
            )

        # Optimal values depend ONLY on the stored curve + economic inputs.
        # They therefore keep working while the ASIC itself is powered off.
        if hashprice is not None and electricity is not None:
            best = find_optimal_point(self.curve, hashprice, electricity)
            result.optimal_power = best.target_w
            result.optimal_actual_power = best.actual_w
            result.optimal_hashrate = best.hashrate_ths
            result.optimal_profit = best.profit_per_hour

        return result

    def profitable(self) -> bool | None:
        """Return profitability based on the best known curve point."""
        optimal_profit = self.calculate().optimal_profit
        if optimal_profit is None:
            return None
        return optimal_profit > 0

    def mining_requested(self) -> bool:
        """Output signal for external power/arbitration automations."""
        return self.auto_optimize and self.profitable() is True

    async def async_set_auto_optimize(self, enabled: bool) -> None:
        """Enable/disable the automatic mining request + power tuning."""
        self.auto_optimize = enabled

        if not enabled:
            self._cancel_power_task()

        async_dispatcher_send(self.hass, self.signal)
        self._reconcile_power_target()

    def _reconcile_power_target(self) -> None:
        """If mining is requested, set the optimal target when miner is reachable."""
        if not self.mining_requested():
            self._cancel_power_task()
            return

        best = self.calculate()
        if best.optimal_power is None:
            return

        self._schedule_power_target(best.optimal_power)

    def _cancel_power_task(self) -> None:
        if self._power_task and not self._power_task.done():
            self._power_task.cancel()
        self._power_task = None

    def _schedule_power_target(self, target_w: float) -> None:
        # A new economic optimum supersedes an older pending target.
        self._cancel_power_task()
        self._power_task = self.hass.async_create_task(
            self._async_set_power_when_available(target_w)
        )

    async def _async_set_power_when_available(self, target_w: float) -> None:
        """Wait for hass-miner to come online, then set target if necessary."""
        entity_id = self.config[CONF_POWER_LIMIT_ENTITY]
        minimum_change = float(
            self.config.get(CONF_MIN_POWER_CHANGE, DEFAULT_MIN_POWER_CHANGE)
        )
        timeout = int(self.config.get(CONF_STARTUP_WAIT, DEFAULT_STARTUP_WAIT))
        deadline = asyncio.get_running_loop().time() + timeout

        while asyncio.get_running_loop().time() <= deadline:
            if not self.mining_requested():
                return

            current = self._float_state(entity_id)
            if current is not None:
                if abs(current - target_w) < minimum_change:
                    return

                try:
                    await self.hass.services.async_call(
                        "number",
                        "set_value",
                        {
                            "entity_id": entity_id,
                            "value": target_w,
                        },
                        blocking=True,
                    )
                except Exception:
                    _LOGGER.exception(
                        "%s: failed to set %s to %.0f W",
                        self.name,
                        entity_id,
                        target_w,
                    )
                return

            await asyncio.sleep(5)

        _LOGGER.warning(
            "%s: %s did not become available within %d seconds",
            self.name,
            entity_id,
            timeout,
        )
