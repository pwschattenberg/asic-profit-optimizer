# Changelog

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
