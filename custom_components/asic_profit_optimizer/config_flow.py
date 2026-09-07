"""UI configuration flow for ASIC Profit Optimizer."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult, OptionsFlowWithReload
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


def _setup_schema() -> vol.Schema:
    """Build the initial miner setup form."""
    return vol.Schema(
        {
            vol.Required(CONF_NAME): selector.TextSelector(),
            vol.Required(CONF_HASHPRICE_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(CONF_ELECTRICITY_PRICE_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(CONF_HASHRATE_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(CONF_POWER_SENSOR): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="sensor")
            ),
            vol.Required(CONF_POWER_LIMIT_ENTITY): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="number")
            ),
            vol.Required(CONF_CURVE): selector.TextSelector(
                selector.TextSelectorConfig(multiline=True)
            ),
            vol.Optional(CONF_MIN_POWER_CHANGE): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=2000,
                    step=10,
                    mode=selector.NumberSelectorMode.BOX,
                    unit_of_measurement="W",
                )
            ),
            vol.Optional(CONF_STARTUP_WAIT): selector.NumberSelector(
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


def _options_schema() -> vol.Schema:
    """Build editable runtime options.

    Miner identity/entity mappings remain entry data. The measured profile and
    tuning thresholds are safe to change as options and reload automatically.
    """
    return vol.Schema(
        {
            vol.Required(CONF_CURVE): selector.TextSelector(
                selector.TextSelectorConfig(multiline=True)
            ),
            vol.Optional(CONF_MIN_POWER_CHANGE): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=2000,
                    step=10,
                    mode=selector.NumberSelectorMode.BOX,
                    unit_of_measurement="W",
                )
            ),
            vol.Optional(CONF_STARTUP_WAIT): selector.NumberSelector(
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


def _initial_values() -> dict[str, Any]:
    """Return safe starter values for a new miner."""
    return {
        CONF_NAME: "ASIC Miner",
        CONF_CURVE: (
            "# target_w, actual_wall_w, hashrate_THs\n"
            "600,600,7.5"
        ),
        CONF_MIN_POWER_CHANGE: DEFAULT_MIN_POWER_CHANGE,
        CONF_STARTUP_WAIT: DEFAULT_STARTUP_WAIT,
    }


def _validate_curve(user_input: dict[str, Any]) -> dict[str, str]:
    """Validate the measured miner profile."""
    errors: dict[str, str] = {}

    try:
        parse_curve(user_input[CONF_CURVE])
    except ValueError:
        errors["base"] = "invalid_curve"

    return errors


class AsicProfitOptimizerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure one miner through the Home Assistant UI."""

    # Keep the config-entry schema version unchanged so existing v0.1 entries
    # upgrade to v0.2 without requiring a migration.
    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Create a new miner optimizer entry."""
        errors: dict[str, str] = {}

        if user_input is not None:
            errors = _validate_curve(user_input)

            if not errors:
                await self.async_set_unique_id(user_input[CONF_POWER_LIMIT_ENTITY])
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=user_input[CONF_NAME],
                    data=user_input,
                )

        suggested = user_input or _initial_values()
        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(
                _setup_schema(), suggested
            ),
            errors=errors,
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        """Return the editable options flow."""
        return AsicProfitOptimizerOptionsFlow()


class AsicProfitOptimizerOptionsFlow(OptionsFlowWithReload):
    """Edit the power/hashrate profile and tuning behavior, then reload."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage ASIC Profit Optimizer options."""
        current = {**self.config_entry.data, **self.config_entry.options}
        errors: dict[str, str] = {}

        if user_input is not None:
            errors = _validate_curve(user_input)
            if not errors:
                return self.async_create_entry(data=user_input)

        values = user_input or {
            CONF_CURVE: current[CONF_CURVE],
            CONF_MIN_POWER_CHANGE: current.get(
                CONF_MIN_POWER_CHANGE, DEFAULT_MIN_POWER_CHANGE
            ),
            CONF_STARTUP_WAIT: current.get(CONF_STARTUP_WAIT, DEFAULT_STARTUP_WAIT),
        }

        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                _options_schema(), values
            ),
            errors=errors,
        )
