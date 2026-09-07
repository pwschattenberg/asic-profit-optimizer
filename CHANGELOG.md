# Changelog

## 0.3.5

- Add a local Home Assistant brand icon and matching logo for ASIC Profit Optimizer.
- Store the branding under the integration's local `brand/` directory for Home Assistant 2026.3 and newer.
- Keep all optimizer calculations, dashboard behavior, power targeting, and arbitration behavior unchanged.

## 0.3.4

- Give each calculated profitability sensor a distinct icon that better matches the metric it represents.
- Add separate icons for Profitable, Mining Request, and Auto Optimize.
- Keep all calculation, power-target, dashboard, and arbitration behavior unchanged.

## 0.3.3

- Use the Home Assistant configured currency instead of hardcoded euro units.
- Format dashboard monetary values using the configured currency and browser locale.
- Expose calculated sensor units as currency-aware values such as `EUR/h`, `USD/day`, and `GBP/kWh`.
- Rename the summary metric to **Optimal farm profit** and explain when a zero optimum means all unprofitable miners should remain off.
- Stop placing the farm optimum under the per-miner **Best-point profit** footer columns, avoiding a misleading aggregate label.
- Show the farm-level optimal action as **OFF** when no configured miner is profitable.
- Document that ASIC Profit Optimizer does not perform FX conversion and expects hashprice and electricity inputs in the same currency.
- Add more meaningful entity icons to the roadmap for a later release.

## 0.3.2

- Make the ASIC Profit dashboard react to Home Assistant state updates without requiring a manual browser refresh.
- Keep a low-frequency refresh fallback for unusual frontend/browser conditions.
- Treat non-positive hashprice values as unavailable so startup template sentinels such as `0` do not briefly make every miner appear unprofitable.
- Keep Mining Request unknown while Auto Optimize is restoring or while required market data is unavailable, preventing external power arbitration from interpreting startup as an explicit shutdown request.
- Show waiting/pending states in the dashboard instead of misleading zero or negative values while market data is still loading.
- Rename the table's target column to **Optimal action** and show **OFF** when the best measured point is unprofitable while retaining the best measured wattage for reference.
- Fix singular profile-point wording.
- Use the official Buy Me a Coffee image button in the README.

## 0.3.1

- Replace per-miner dashboard cards with a compact farm table.
- Keep farm summary cards at the top while making individual miner comparison much easier.
- Add table columns for status, hashrate, wall power, current profit, optimal target, optimal profit, daily optimal profit, break-even electricity price, Mining Request, and Auto Optimize.
- Add a farm-total footer row for the key aggregate metrics.
- Preserve per-miner Auto Optimize controls and the existing mining-only architecture.

## 0.3.0

- Add an admin-only **ASIC Profit** farm dashboard to the Home Assistant left sidebar.
- Aggregate all configured optimizer entries into total live hashrate, live wall power, current profit, optimal mining profit, active miners, profitable miners, and Mining Request counts.
- Add per-miner dashboard cards with live telemetry, optimal target, optimal profit, break-even electricity price, profile size, and status.
- Allow Auto Optimize to be toggled per miner directly from the farm dashboard.
- Add an authenticated Home Assistant WebSocket endpoint for farm snapshots.
- Serve the dashboard frontend from a versioned static integration path.
- Treat negative per-miner optimal profit as OFF when calculating the farm-wide optimal mining profit.
- Add farm aggregation tests.
- Keep the dashboard and optimizer mining-only; no heating logic or physical mains switching is added.

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
- Reload the integration automatically after options changes.
- Preserve existing v0.1 config entries without migration.
- Add **Optimal Efficiency**, **Optimal Daily Profit**, and **Break-even Electricity Price** sensors.
- Treat unavailable live hashrate as zero when measured wall power is effectively zero, while keeping optimal calculations profile-based.
- Keep the integration mining-only: no heating logic and no mains switching.
- Update Home Assistant/HACS metadata and documentation.

## 0.1.0

- Initial Home Assistant custom integration.
- Per-miner profitability calculation using hashprice, electricity price, live telemetry, and a measured power/hashrate profile.
- Automatic optimal power-target setting through an existing writable Home Assistant `number` entity.
- Profitable and Mining Request binary sensors.
- Auto Optimize switch.
