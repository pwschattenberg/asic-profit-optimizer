"""Shared entity base."""

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN


class AsicProfitEntity(Entity):
    """Entity belonging to one configured optimizer/miner."""

    _attr_has_entity_name = True

    def __init__(self, manager, key: str) -> None:
        self.manager = manager
        self._attr_unique_id = f"{manager.entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, manager.entry.entry_id)},
            name=manager.name,
            manufacturer="ASIC Profit Optimizer",
            model="Profit Optimizer",
        )
