# ASIC Profit Optimizer

A Home Assistant custom integration for optimizing variable-power ASIC miners against a live hashprice and electricity price.

**ASIC Profit Optimizer is mining-only.** It contains no heating logic and does not switch mains power on or off.

## What it does

For every measured operating point in a miner profile:

```text
profit €/h =
    hashrate_THs × hashprice_€/TH/day / 24
    - actual_wall_w / 1000 × electricity_€/kWh
```

The integration selects the measured point with the highest expected profit. Negative electricity prices are supported naturally.

The optimizer continues calculating while the miner is powered off because optimal profitability uses the stored power/hashrate profile rather than live miner consumption.

## v0.3.0 farm dashboard

v0.3.0 adds an admin-only **ASIC Profit** panel directly to the Home Assistant left sidebar.

The farm dashboard aggregates every configured ASIC Profit Optimizer miner and shows:

- configured, active and profitable miner counts
- total live hashrate
- total live wall power
- aggregate current profit
- aggregate optimal mining profit per hour and per day
- active Mining Request count
- Auto Optimize status for each miner
- live and optimal per-miner economics
- break-even electricity price
- number of measured profile points

The dashboard also lets an administrator toggle **Auto Optimize** for each miner.

Farm optimal profit assumes miners whose best measured operating point is unprofitable remain off, so a negative per-miner optimal profit contributes zero to the farm optimum.

The panel uses Home Assistant's authenticated WebSocket API and does not expose a separate web server.

## Inputs

Each miner needs existing Home Assistant entities for:

- Hashprice sensor, for example `sensor.bch_hashprice` in `€/TH/day`
- Electricity price sensor in `€/kWh`
- Live hashrate sensor in `TH/s`
- Live power sensor in `W`
- Writable miner power-limit `number` entity
- A measured power/hashrate profile

A smart plug with power metering is preferred for the live power sensor because it measures true wall consumption.

Example profile:

```text
# target_w, actual_wall_w, hashrate_THs
600,630.1,7.544
800,840.0,9.20
1000,1045.0,10.75
1200,1245.0,11.90
```

The values above are only an example. Measure each miner individually.

`target_w` is the value sent to the miner. `actual_wall_w` is used for electricity cost.

## Entities created per miner

Sensors:

- Current Revenue
- Current Electricity Cost
- Current Profit
- Optimal Power
- Optimal Actual Power
- Optimal Hashrate
- Optimal Efficiency
- Optimal Profit
- Optimal Daily Profit
- Break-even Electricity Price

Binary sensors:

- **Profitable** — ON whenever the best measured operating point has profit greater than zero
- **Mining Request** — ON when Auto Optimize is enabled and mining is profitable

Control:

- **Auto Optimize** — enables Mining Request and automatic optimal power-target updates

## Power-control architecture

ASIC Profit Optimizer deliberately does **not** control the physical smart plug or mains power.

Use the generated Mining Request entity as an input to your own Home Assistant power-control automation:

```text
binary_sensor.<miner>_mining_request
```

When Mining Request turns ON, an external automation can power the miner. ASIC Profit Optimizer waits for the configured writable power-limit entity to become available and then sends the calculated optimal wattage.

When Mining Request turns OFF, ASIC Profit Optimizer stops requesting mining and does not switch any physical load itself.

This keeps mining economics independent from any other reason a user may choose to power an ASIC.

## Editing a miner profile

After adding a miner:

1. Go to **Settings → Devices & services**.
2. Open **ASIC Profit Optimizer**.
3. Select the gear beside the miner entry.
4. Rename the miner or edit the measured power/hashrate profile, minimum retune threshold, or startup wait.
5. Press **Submit**.

The integration reloads automatically and recalculates the optimum from the new profile. You do not need to delete and recreate the miner.

Each config-entry heading uses the configured miner name, so multiple miners remain easy to distinguish.

## Safe behavior

- Auto Optimize defaults to OFF on first installation.
- If hashprice or electricity price is unavailable, no mining request is generated and no power target is changed.
- The optimizer only selects target wattages explicitly present in the measured profile.
- The minimum retune threshold reduces unnecessary miner reconfiguration.
- If the miner is off and its hashrate entity becomes unavailable, a zero wall-power reading is treated as zero current hashrate for current-profit reporting only. Optimal-profit calculations remain profile-based.
- The farm dashboard is admin-only in v0.3.0.

## Installation with HACS

Add this repository to HACS as a custom **Integration** repository:

```text
https://github.com/pwschattenberg/asic-profit-optimizer
```

Then download ASIC Profit Optimizer, restart Home Assistant, and add it from **Settings → Devices & services → Add integration**.

After at least one miner is configured, **ASIC Profit** appears in the Home Assistant left sidebar.

## Multiple miners

Add one ASIC Profit Optimizer config entry per miner. Each miner gets its own profile, calculated entities, Mining Request, and Auto Optimize control.

The farm dashboard discovers all configured entries automatically, so adding an S9, S9i, S19j Pro, or another compatible miner requires no dashboard YAML.

## Current architecture

```text
Physical ASIC
    ↓
hass-miner / existing miner integration
    ↓
hashrate + power + writable power-limit entities
    ↓
ASIC Profit Optimizer
    ├── per-miner profitability
    ├── optimal power target
    ├── Mining Request
    └── ASIC Profit farm dashboard
```

The profitability engine remains separate from the miner transport layer. A future direct pyasic adapter can therefore be added without changing the economics engine.

## Roadmap

Planned follow-on work includes native farm-level Home Assistant entities for automations/history, improved profile editing/calibration, richer farm controls, and an optional direct miner transport layer.

A donation section for project support may also be added later.
