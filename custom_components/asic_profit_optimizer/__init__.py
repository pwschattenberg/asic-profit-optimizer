"""ASIC Profit Optimizer integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .manager import AsicProfitManager

PLATFORMS = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
    Platform.SWITCH,
]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up one ASIC Profit Optimizer config entry."""
    hass.data.setdefault(DOMAIN, {})

    manager = AsicProfitManager(hass, entry)
    hass.data[DOMAIN][entry.entry_id] = manager

    await manager.async_start()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload an ASIC Profit Optimizer config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unloaded:
        manager: AsicProfitManager = hass.data[DOMAIN].pop(entry.entry_id)
        await manager.async_stop()

    return unloaded
