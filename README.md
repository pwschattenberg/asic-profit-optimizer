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

## v0.2.0 highlights

- Native Home Assistant device per configured miner
- **Configure** button for editing the measured power/hashrate profile after setup
- Automatic integration reload after configuration changes
- Current and optimal profitability sensors
- Break-even electricity price
- True wall-power efficiency at the optimal point
- Daily optimal profit projection
- Mining Request binary sensor for external power-control automations
- Automatic power-target setting through an existing writable `number` entity such as hass-miner Power Limit
- Multiple miners are supported by adding another ASIC Profit Optimizer config entry

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

## Editing a miner profile

After adding a miner:

1. Go to **Settings → Devices & services**.
2. Open **ASIC Profit Optimizer**.
3. Select **Configure** on the miner entry.
4. Edit the measured power/hashrate profile, minimum retune threshold, or startup wait.
5. Press **Submit**.

The integration reloads automatically and recalculates the optimum from the new profile. You do not need to delete and recreate the miner.

## Safe behavior

- Auto Optimize defaults to OFF on first installation.
- If hashprice or electricity price is unavailable, no mining request is generated and no power target is changed.
- The optimizer only selects target wattages explicitly present in the measured profile.
- The minimum retune threshold reduces unnecessary miner reconfiguration.
- If the miner is off and its hashrate entity becomes unavailable, a zero wall-power reading is treated as zero current hashrate for current-profit reporting only. Optimal-profit calculations remain profile-based.

## Installation with HACS

Add this repository to HACS as a custom **Integration** repository:

```text
https://github.com/pwschattenberg/asic-profit-optimizer
```

Then download ASIC Profit Optimizer, restart Home Assistant, and add it from **Settings → Devices & services → Add integration**.

## Multiple miners

Add one config entry per miner. Each miner gets its own profile, calculated entities, Mining Request, and Auto Optimize control.

This avoids duplicating template helpers and profitability automations for S9, S9i, S19, S19j Pro, or other miners that expose compatible Home Assistant entities.

## Roadmap

The next architectural step is farm-level aggregation and a dedicated Home Assistant dashboard/card showing total hashrate, total power, aggregate profit, active/profitable miners, and per-miner optimal targets.

Longer term, the profitability engine can remain independent from the miner transport layer so adapters other than hass-miner can be supported without changing the economics engine.
