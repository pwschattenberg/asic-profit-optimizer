"""Sidebar farm dashboard registration for ASIC Profit Optimizer."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.frontend import async_panel_exists
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .websocket_api import async_register_websocket_handlers

PANEL_URL = "asic-profit"
PANEL_COMPONENT = "asic-profit-panel"
PANEL_TITLE = "ASIC Profit"
PANEL_ICON = "mdi:pickaxe"

_MANIFEST_PATH = Path(__file__).parent / "manifest.json"
_PANEL_VERSION = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))["version"]
PANEL_ASSET_BASE = f"/{DOMAIN}/assets/{_PANEL_VERSION}"
PANEL_MODULE = f"{PANEL_ASSET_BASE}/asic-profit-panel-wrapper.js"

DATA_STATIC_REGISTERED = f"{DOMAIN}_panel_static_registered"
DATA_WS_REGISTERED = f"{DOMAIN}_websocket_registered"


async def async_setup_dashboard(hass: HomeAssistant) -> None:
    """Register the farm dashboard, assets and WebSocket API once."""
    if not hass.data.get(DATA_WS_REGISTERED):
        async_register_websocket_handlers(hass)
        hass.data[DATA_WS_REGISTERED] = True

    if not hass.data.get(DATA_STATIC_REGISTERED):
        frontend_path = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    PANEL_ASSET_BASE,
                    str(frontend_path),
                    cache_headers=True,
                )
            ]
        )
        hass.data[DATA_STATIC_REGISTERED] = True

    if not async_panel_exists(hass, PANEL_URL):
        await panel_custom.async_register_panel(
            hass=hass,
            frontend_url_path=PANEL_URL,
            webcomponent_name=PANEL_COMPONENT,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=PANEL_MODULE,
            require_admin=True,
            config={"domain": DOMAIN},
        )
