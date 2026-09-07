"""Sensor entities for ASIC Profit Optimizer."""

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.const import UnitOfPower
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN
from .entity import AsicProfitEntity

DEFINITIONS = {
    "current_revenue": ("Current Revenue", "€/h", None),
    "current_electricity_cost": ("Current Electricity Cost", "€/h", None),
    "current_profit": ("Current Profit", "€/h", None),
    "optimal_power": ("Optimal Power", UnitOfPower.WATT, SensorDeviceClass.POWER),
    "optimal_actual_power": (
        "Optimal Actual Power",
        UnitOfPower.WATT,
        SensorDeviceClass.POWER,
    ),
    "optimal_hashrate": ("Optimal Hashrate", "TH/s", None),
    "optimal_efficiency": ("Optimal Efficiency", "W/TH", None),
    "optimal_profit": ("Optimal Profit", "€/h", None),
    "optimal_daily_profit": ("Optimal Daily Profit", "€/day", None),
    "break_even_electricity_price": (
        "Break-even Electricity Price",
        "€/kWh",
        None,
    ),
}


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    """Create calculated sensors."""
    manager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            AsicProfitSensor(manager, key, *definition)
            for key, definition in DEFINITIONS.items()
        ]
    )


class AsicProfitSensor(AsicProfitEntity, SensorEntity):
    """One calculated profitability metric."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, manager, key, name, unit, device_class) -> None:
        super().__init__(manager, key)
        self.key = key
        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                self.manager.signal,
                self.async_write_ha_state,
            )
        )

    @property
    def native_value(self):
        """Return the latest calculated value."""
        value = getattr(self.manager.calculate(), self.key)
        if value is None:
            return None

        if self.key in ("optimal_power", "optimal_actual_power"):
            return round(value, 1)

        if self.key == "optimal_efficiency":
            return round(value, 2)

        return round(value, 6)
