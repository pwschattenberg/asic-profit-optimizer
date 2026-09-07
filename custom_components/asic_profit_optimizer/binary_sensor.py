"""Binary sensor entities."""

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN
from .entity import AsicProfitEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    """Create optimizer status sensors."""
    manager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            ProfitableBinarySensor(manager),
            MiningRequestBinarySensor(manager),
        ]
    )


class _BaseBinarySensor(AsicProfitEntity, BinarySensorEntity):
    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                self.manager.signal,
                self.async_write_ha_state,
            )
        )


class ProfitableBinarySensor(_BaseBinarySensor):
    """True whenever at least one measured curve point is profitable."""

    _attr_name = "Profitable"

    def __init__(self, manager) -> None:
        super().__init__(manager, "profitable")

    @property
    def is_on(self) -> bool | None:
        return self.manager.profitable()


class MiningRequestBinarySensor(_BaseBinarySensor):
    """The mining-only request output for external automations."""

    _attr_name = "Mining Request"

    def __init__(self, manager) -> None:
        super().__init__(manager, "mining_request")

    @property
    def is_on(self) -> bool:
        return self.manager.mining_requested()
