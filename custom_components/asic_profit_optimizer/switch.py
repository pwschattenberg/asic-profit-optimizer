"""Control switches for ASIC Profit Optimizer."""

from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN
from .entity import AsicProfitEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    """Create optimizer control switches."""
    manager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        [
            AutoOptimizeSwitch(manager),
            ManualMiningSwitch(manager),
        ]
    )


class _BaseRestoreSwitch(AsicProfitEntity, SwitchEntity, RestoreEntity):
    """Shared restore/listener behavior for optimizer control switches."""

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                self.manager.signal,
                self.async_write_ha_state,
            )
        )


class AutoOptimizeSwitch(_BaseRestoreSwitch):
    """Enable profitability-based mining requests and optimum power targeting."""

    _attr_name = "Auto Optimize"
    _attr_icon = "mdi:auto-fix"

    def __init__(self, manager) -> None:
        super().__init__(manager, "auto_optimize")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
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


class ManualMiningSwitch(_BaseRestoreSwitch):
    """Force the external Mining Request on regardless of profitability."""

    _attr_name = "Manual Mining"
    _attr_icon = "mdi:play-circle-outline"

    def __init__(self, manager) -> None:
        super().__init__(manager, "manual_mining")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        previous = await self.async_get_last_state()
        # First installation defaults safely to off.
        restore_on = previous is not None and previous.state == "on"
        await self.manager.async_set_manual_mining(restore_on)

    @property
    def is_on(self) -> bool:
        return self.manager.manual_mining

    async def async_turn_on(self, **kwargs) -> None:
        await self.manager.async_set_manual_mining(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self.manager.async_set_manual_mining(False)
