"""Auto Optimize master switch."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN
from .entity import AsicProfitEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    """Create the Auto Optimize switch."""
    manager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([AutoOptimizeSwitch(manager)])


class AutoOptimizeSwitch(AsicProfitEntity, SwitchEntity, RestoreEntity):
    """Enable mining requests and automatic optimum power-target updates."""

    _attr_name = "Auto Optimize"
    _attr_icon = "mdi:auto-fix"

    def __init__(self, manager) -> None:
        super().__init__(manager, "auto_optimize")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()

        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                self.manager.signal,
                self.async_write_ha_state,
            )
        )

        previous = await self.async_get_last_state()
        # First installation defaults safely to off.
        restore_on = previous is not None and previous.state == "on"
        await self.manager.async_set_auto_optimize(restore_on)

    @property
    def is_on(self) -> bool:
        return self.manager.auto_optimize

    async def async_turn_on(self, **kwargs) -> None:
        await self.manager.async_set_auto_optimize(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self.manager.async_set_auto_optimize(False)
