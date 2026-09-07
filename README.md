# ASIC Profit Optimizer

A Home Assistant custom integration for optimizing variable-power ASIC miners
against a live hashprice and electricity price.

**This integration contains no heating logic.**

It deliberately exposes a mining-only request signal so that heating, solar,
battery dispatch, load shedding, or other systems can remain completely
independent.

## Core model

For each measured miner operating point:

```text
profit €/h =
    hashrate_THs × hashprice_€/TH/day / 24
    - actual_wall_w / 1000 × electricity_€/kWh
```

The integration selects the measured operating point with the highest expected
profit.

Negative electricity prices work naturally.

## Inputs

Each configured miner needs existing Home Assistant entities for:

- Hashprice sensor, e.g. `sensor.bch_hashprice` in `€/TH/day`
- Electricity price sensor in `€/kWh`
- Live hashrate sensor in `TH/s`
- Live power sensor in `W`
- Writable miner power-limit `number` entity
- A measured power/hashrate curve

Example curve:

```text
# target_w, actual_wall_w, hashrate_THs
600,597.5,7.157
800,801.2,9.31
1000,1005.6,10.82
1200,1211.4,12.02
```

`actual_wall_w` is used for the cost calculation; `target_w` is what gets sent
to the miner.

## Entities created per miner

Sensors:

- Current Revenue
- Current Electricity Cost
- Current Profit
- Optimal Power
- Optimal Actual Power
- Optimal Hashrate
- Optimal Profit

Binary sensors:

- **Profitable** — ON whenever the best measured operating point has profit > 0
- **Mining Request** — ON when Auto Optimize is enabled AND mining is profitable

Switch:

- **Auto Optimize** — master enable for the mining request and automatic power
  target setting

## Important architecture

ASIC Profit Optimizer **does not switch mains power on or off**.

That is intentional.

Your Home Assistant automations can use:

```text
binary_sensor.<miner>_mining_request
```

as one independent request signal.

For example, if you separately use the ASIC as a heater, your own arbitration
automation can implement:

```text
mining_request OR heating_request -> physical smart plug ON
neither request                    -> physical smart plug OFF
```

The plugin does not know that a heating system exists.

When Mining Request becomes ON, the plugin waits for the configured miner
power-limit entity to become available. This allows an external automation to
power the ASIC. Once the entity appears, the plugin sets the calculated optimal
power target.

When Mining Request becomes OFF, the plugin does not power anything off.

## Safe startup behavior

Auto Optimize defaults to OFF on first installation.

If economic inputs are unavailable, no mining request is generated and no power
target is changed.

The optimizer only selects target wattages explicitly included in the measured
curve.

## Installation for testing

1. Copy:
   `custom_components/asic_profit_optimizer`
   into:
   `/config/custom_components/asic_profit_optimizer`
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration**.
4. Search for **ASIC Profit Optimizer**.
5. Add one entry for your S9i.
6. Verify all calculated values while **Auto Optimize is OFF**.
7. Enable Auto Optimize when ready.

Add another integration entry for the S9 or S19j Pro instead of duplicating
template sensors and profitability automations.

## S9i development point

The first measured S9i operating point from the development system is:

```text
600,597.5,7.157
```

Replace/add points after each Braiins target has stabilized.

## HACS publication

The directory structure is suitable for turning into a HACS repository, but
before publishing:

- replace `REPLACE_ME` URLs in `manifest.json`
- publish the code to a GitHub repository
- add repository/brand metadata as required
- run Home Assistant/HACS validation
