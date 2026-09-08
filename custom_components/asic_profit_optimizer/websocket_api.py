"""WebSocket API for the ASIC Profit farm dashboard."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_ELECTRICITY_PRICE_SENSOR,
    CONF_HASHPRICE_SENSOR,
    CONF_HASHRATE_SENSOR,
    CONF_POWER_SENSOR,
    DOMAIN,
)
from .farm import aggregate_farm


def _float_state(hass: HomeAssistant, entity_id: str) -> float | None:
    """Read a numeric Home Assistant state."""
    state = hass.states.get(entity_id)
    if state is None or state.state in ("unknown", "unavailable", "", "none"):
        return None

    try:
        return float(state.state)
    except (TypeError, ValueError):
        return None


def _entry_entity_ids(hass: HomeAssistant, entry_id: str) -> dict[str, str]:
    """Return dashboard-relevant entity ids for a config entry."""
    registry = er.async_get(hass)
    result: dict[str, str] = {}

    wanted = {
        f"{entry_id}_auto_optimize": "auto_optimize",
        f"{entry_id}_manual_mining": "manual_mining",
        f"{entry_id}_mining_request": "mining_request",
        f"{entry_id}_profitable": "profitable",
        f"{entry_id}_current_profit": "current_profit",
        f"{entry_id}_optimal_profit": "optimal_profit",
        f"{entry_id}_optimal_power": "optimal_power",
    }

    for entity in er.async_entries_for_config_entry(registry, entry_id):
        key = wanted.get(entity.unique_id)
        if key:
            result[key] = entity.entity_id

    return result


def _manager_snapshot(hass: HomeAssistant, entry_id: str, manager) -> dict[str, Any]:
    """Build one miner snapshot for the farm dashboard."""
    metrics = manager.calculate()

    hashrate_entity = manager.config[CONF_HASHRATE_SENSOR]
    power_entity = manager.config[CONF_POWER_SENSOR]
    hashprice_entity = manager.config[CONF_HASHPRICE_SENSOR]
    electricity_entity = manager.config[CONF_ELECTRICITY_PRICE_SENSOR]

    hashrate = _float_state(hass, hashrate_entity)
    power = _float_state(hass, power_entity)

    # If wall power is known to be zero, an unavailable miner-side hashrate
    # simply means the miner is physically off.
    if hashrate is None and power is not None and abs(power) < 1.0:
        hashrate = 0.0

    telemetry_known = hashrate is not None or power is not None
    active = None
    if telemetry_known:
        active = bool(
            (power is not None and power > 25.0)
            or (hashrate is not None and hashrate > 0.05)
        )

    profitable = manager.profitable()
    mining_request = manager.mining_request_state()

    hashprice = _float_state(hass, hashprice_entity)
    if hashprice is not None and hashprice <= 0:
        hashprice = None

    return {
        "entry_id": entry_id,
        "name": manager.name,
        "profile_points": len(manager.curve),
        "hashrate_ths": hashrate,
        "power_w": power,
        "current_revenue_per_hour": metrics.current_revenue,
        "current_electricity_cost_per_hour": metrics.current_electricity_cost,
        "current_profit_per_hour": metrics.current_profit,
        "optimal_power_w": metrics.optimal_power,
        "optimal_actual_power_w": metrics.optimal_actual_power,
        "optimal_hashrate_ths": metrics.optimal_hashrate,
        "optimal_efficiency_w_per_th": metrics.optimal_efficiency,
        "optimal_profit_per_hour": metrics.optimal_profit,
        "optimal_profit_per_day": metrics.optimal_daily_profit,
        "break_even_electricity_price": metrics.break_even_electricity_price,
        "profitable": profitable is True,
        "profitability_known": profitable is not None,
        "mining_request": mining_request is True,
        "mining_request_known": mining_request is not None,
        "manual_mining": manager.manual_mining,
        "manual_mining_initialized": manager.manual_mining_initialized,
        "auto_optimize": manager.auto_optimize,
        "auto_optimize_initialized": manager.auto_optimize_initialized,
        "market_ready": manager.economics_ready(),
        "active": active,
        "telemetry_known": telemetry_known,
        "sources": {
            "hashprice_entity": hashprice_entity,
            "hashprice": hashprice,
            "electricity_entity": electricity_entity,
            "electricity_price": _float_state(hass, electricity_entity),
            "hashrate_entity": hashrate_entity,
            "power_entity": power_entity,
        },
        "entities": _entry_entity_ids(hass, entry_id),
    }


def _shared_source(miners: list[dict[str, Any]], key_entity: str, key_value: str):
    """Return a shared source when every configured miner uses the same entity."""
    if not miners:
        return None

    entity_ids = {miner["sources"][key_entity] for miner in miners}
    if len(entity_ids) != 1:
        return None

    entity_id = next(iter(entity_ids))
    values = [miner["sources"][key_value] for miner in miners]
    value = next((item for item in values if item is not None), None)

    return {"entity_id": entity_id, "value": value}


@callback
def async_register_websocket_handlers(hass: HomeAssistant) -> None:
    """Register farm dashboard WebSocket commands."""
    websocket_api.async_register_command(hass, websocket_get_farm)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/farm"})
@callback
def websocket_get_farm(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the live ASIC farm snapshot."""
    managers = hass.data.get(DOMAIN, {})
    miners = [
        _manager_snapshot(hass, entry_id, manager)
        for entry_id, manager in sorted(
            managers.items(), key=lambda item: item[1].name.lower()
        )
    ]

    result = {
        "currency": hass.config.currency,
        "farm": aggregate_farm(miners),
        "miners": miners,
        "shared": {
            "hashprice": _shared_source(miners, "hashprice_entity", "hashprice"),
            "electricity": _shared_source(
                miners, "electricity_entity", "electricity_price"
            ),
        },
    }

    connection.send_result(msg["id"], result)
