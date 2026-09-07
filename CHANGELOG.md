# Changelog

## 0.2.2

- Add **Miner name** to the Configure flow so an existing optimizer entry can be renamed without deleting and recreating it.
- Keep the Home Assistant config-entry heading synchronized with the configured miner name.
- Use the configured miner name as the optimizer device's default name after reload.
- Remove the generic `ASIC Miner` default from new setup so users choose a recognizable per-miner name.
- Keep profile editing, entity mappings, Mining Request, and power-target behavior unchanged.

## 0.2.1

- Reclassify ASIC Profit Optimizer from a Home Assistant `helper` integration to a `device` integration.
- This moves configured miners out of the Helpers section and gives each optimizer entry the expected native Devices & Services integration/device experience.
- Keep the existing Configure options flow and per-miner virtual device entities unchanged.

## 0.2.0

- Add a native **Configure** options flow so measured power/hashrate profiles can be edited after initial setup.
- Reload the integration automatically after profile/tuning options are changed.
- Preserve existing v0.1 config entries without migration.
- Add **Optimal Efficiency**, **Optimal Daily Profit**, and **Break-even Electricity Price** sensors.
- Treat unavailable live hashrate as zero when measured wall power is effectively zero, while keeping optimal calculations profile-based.
- Keep the integration mining-only: no heating logic and no physical mains switching.
- Update Home Assistant/HACS metadata and documentation.

## 0.1.0

- Initial Home Assistant custom integration.
- Per-miner profitability calculation using hashprice, electricity price, live telemetry, and a measured power/hashrate profile.
- Automatic optimal power-target setting through an existing writable Home Assistant `number` entity.
- Profitable and Mining Request binary sensors.
- Auto Optimize switch.
