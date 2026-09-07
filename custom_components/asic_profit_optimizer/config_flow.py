"""UI configuration flow."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers import selector

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
    DOMAIN,
)
from .optimizer import parse_curve


def _schema(user_input=None):
    """Build setup form."""
    user_input = user_input or {}

    return vol.Schema(
        {
            vol.Required(
                CONF_NAME,
                default=user_input.get(CONF_NAME, "ASIC Miner"),
            ): selector.TextSelector(),
            vol.Required(
                CONF_HASHPRICE_SENSOR,
                default=user_input.get(CONF_HASHPRICE_SENSOR),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(
                CONF_ELECTRICITY_PRICE_SENSOR,
                default=user_input.get(CONF_ELECTRICITY_PRICE_SENSOR),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(
                CONF_HASHRATE_SENSOR,
                default=user_input.get(CONF_HASHRATE_SENSOR),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(
                CONF_POWER_SENSOR,
                default=user_input.get(CONF_POWER_SENSOR),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(
                CONF_POWER_LIMIT_ENTITY,
                default=user_input.get(CONF_POWER_LIMIT_ENTITY),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="number")
            ),
            vol.Required(
                CONF_CURVE,
                default=user_input.get(
                    CONF_CURVE,
                    "# target_w, actual_wall_w, hashrate_THs\n600,597.5,7.157",
                ),
            ): selector.TextSelector(
                selector.TextSelectorConfig(multiline=True)
            ),
            vol.Optional(
                CONF_MIN_POWER_CHANGE,
                default=user_input.get(
                    CONF_MIN_POWER_CHANGE,
                    DEFAULT_MIN_POWER_CHANGE,
                ),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=2000,
                    step=10,
                    mode=selector.NumberSelectorMode.BOX,
                    unit_of_measurement="W",
                )
            ),
            vol.Optional(
                CONF_STARTUP_WAIT,
                default=user_input.get(CONF_STARTUP_WAIT, DEFAULT_STARTUP_WAIT),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=30,
                    max=1800,
                    step=30,
                    mode=selector.NumberSelectorMode.BOX,
                    unit_of_measurement="s",
                )
            ),
        }
    )


class AsicProfitOptimizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure one miner through the Home Assistant UI."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}

        if user_input is not None:
            try:
                parse_curve(user_input[CONF_CURVE])
            except ValueError:
                errors["base"] = "invalid_curve"

            if not errors:
                # One optimizer entry per writable miner power-limit entity.
                await self.async_set_unique_id(user_input[CONF_POWER_LIMIT_ENTITY])
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=user_input[CONF_NAME],
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(user_input),
            errors=errors,
        )
