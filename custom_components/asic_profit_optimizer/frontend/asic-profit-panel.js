const DOMAIN = "asic_profit_optimizer";
const INTEGRATION_PATH = `/config/integrations/integration/${DOMAIN}`;

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const number = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
};

const currencyAmount = (value, currency, digits = 4, signed = false) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  const code = currency || "EUR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(Number(value));
  } catch (_err) {
    const sign = signed && Number(value) > 0 ? "+" : "";
    return `${sign}${number(value, digits)} ${code}`;
  }
};

const money = (value, currency, suffix = "") =>
  value === null || value === undefined
    ? "—"
    : `${currencyAmount(value, currency, 4, true)}${suffix}`;

const profitClass = (value) =>
  value === null || value === undefined
    ? ""
    : Number(value) >= 0
      ? "positive"
      : "negative";

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${number(count, 0)} ${Number(count) === 1 ? singular : pluralForm}`;

class AsicProfitPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._data = null;
    this._error = null;
    this._loading = false;
    this._reloadPending = false;
    this._refreshTimer = null;
    this._debounceTimer = null;
  }

  set hass(value) {
    this._hass = value;
    this._scheduleLoad();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    this._render();
    this._scheduleLoad(0);

    // Home Assistant pushes a fresh hass object whenever states change. The
    // hass setter above handles normal live updates. This timer is only a
    // low-frequency fallback for unusual frontend/browser conditions.
    this._refreshTimer = window.setInterval(() => this._load(), 30000);
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      window.clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this._debounceTimer) {
      window.clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  _scheduleLoad(delay = 150) {
    if (!this._hass) return;
    if (this._debounceTimer) window.clearTimeout(this._debounceTimer);

    this._debounceTimer = window.setTimeout(() => {
      this._debounceTimer = null;
      this._load();
    }, delay);
  }

  async _load() {
    if (!this._hass) return;
    if (this._loading) {
      this._reloadPending = true;
      return;
    }

    this._loading = true;
    try {
      this._data = await this._hass.callWS({ type: `${DOMAIN}/farm` });
      this._error = null;
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      this._render();
      if (this._reloadPending) {
        this._reloadPending = false;
        this._scheduleLoad(0);
      }
    }
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed"));
  }

  async _toggleAuto(entityId, currentlyOn) {
    if (!this._hass || !entityId) return;

    try {
      await this._hass.callService(
        "switch",
        currentlyOn ? "turn_off" : "turn_on",
        { entity_id: entityId }
      );
      await this._load();
    } catch (err) {
      this._error = err?.message || String(err);
      this._render();
    }
  }

  _currency() {
    return this._data?.currency || this._hass?.config?.currency || "EUR";
  }

  _summaryCard(label, value, sub = "") {
    return `
      <div class="summary-card">
        <div class="summary-label">${esc(label)}</div>
        <div class="summary-value">${value}</div>
        ${sub ? `<div class="summary-sub">${sub}</div>` : ""}
      </div>
    `;
  }

  _partial(key) {
    const farm = this._data?.farm;
    return farm?.complete && farm.complete[key] === false
      ? '<span class="partial">partial</span>'
      : "";
  }

  _aggregateDisplay(field, aggregateValue, digits, unit, completeKey) {
    const miners = this._data?.miners || [];
    const allUnknown =
      miners.length > 0 &&
      miners.every((miner) => miner[field] === null || miner[field] === undefined);

    if (allUnknown) {
      return `— ${this._partial(completeKey)}`;
    }

    return `${number(aggregateValue, digits)}${unit ? ` ${unit}` : ""} ${this._partial(completeKey)}`;
  }

  _aggregateMoney(field, aggregateValue, suffix, completeKey) {
    const miners = this._data?.miners || [];
    const allUnknown =
      miners.length > 0 &&
      miners.every((miner) => miner[field] === null || miner[field] === undefined);

    if (allUnknown) {
      return `— ${this._partial(completeKey)}`;
    }

    return `${money(aggregateValue, this._currency(), suffix)} ${this._partial(completeKey)}`;
  }

  _status(miner) {
    if (!miner.telemetry_known) {
      return `
        <div class="status-stack">
          <span class="status waiting">○ Waiting</span>
          ${
            miner.profitability_known
              ? `<span class="status ${miner.profitable ? "profitable" : ""}">
                   ${miner.profitable ? "Profitable" : "Not profitable"}
                 </span>`
              : '<span class="status waiting">Market data pending</span>'
          }
        </div>
      `;
    }

    const active = miner.active
      ? '<span class="status active">● Active</span>'
      : '<span class="status">○ Off</span>';

    const profitable = miner.profitability_known
      ? miner.profitable
        ? '<span class="status profitable">Profitable</span>'
        : '<span class="status">Not profitable</span>'
      : '<span class="status waiting">Market data pending</span>';

    return `<div class="status-stack">${active}${profitable}</div>`;
  }

  _request(miner) {
    if (!miner.mining_request_known) {
      return '<span class="request waiting">WAIT</span>';
    }
    return miner.mining_request
      ? '<span class="request on">ON</span>'
      : '<span class="request">OFF</span>';
  }

  _optimalAction(miner) {
    if (!miner.profitability_known || miner.optimal_power_w === null) {
      return '<span class="waiting-text">Waiting</span>';
    }

    if (!miner.profitable) {
      return `
        <span class="action-off">OFF</span>
        <span class="best-point">best point ${number(miner.optimal_power_w, 0)} W</span>
      `;
    }

    return `${number(miner.optimal_power_w, 0)} <span class="unit">W</span>`;
  }

  _farmOptimalAction(farm, miners) {
    if (miners.every((miner) => miner.optimal_profit_per_hour == null)) {
      return '<span class="waiting-text">Waiting</span>';
    }
    if (farm.profitable_miners === 0) {
      return '<span class="action-off">OFF</span>';
    }
    return `${farm.profitable_miners} mining`;
  }

  _optimalFarmSub(farm, miners) {
    if (miners.every((miner) => miner.optimal_profit_per_hour == null)) {
      return "waiting for market data";
    }
    if (farm.profitable_miners === 0) {
      return "all miners off at optimum";
    }
    return money(farm.optimal_profit_per_day, this._currency(), "/day");
  }

  _minerRow(miner) {
    const autoEntity = miner.entities?.auto_optimize;
    const currency = this._currency();
    return `
      <tr>
        <td class="miner-cell">
          <strong>${esc(miner.name)}</strong>
          <span>${plural(miner.profile_points, "profile point")}</span>
        </td>
        <td>${this._status(miner)}</td>
        <td class="numeric">${number(miner.hashrate_ths, 3)} <span class="unit">TH/s</span></td>
        <td class="numeric">${number(miner.power_w, 1)} <span class="unit">W</span></td>
        <td class="numeric ${profitClass(miner.current_profit_per_hour)}">
          ${money(miner.current_profit_per_hour, currency, "/h")}
        </td>
        <td class="numeric action-cell">
          ${this._optimalAction(miner)}
        </td>
        <td class="numeric ${profitClass(miner.optimal_profit_per_hour)}">
          ${money(miner.optimal_profit_per_hour, currency, "/h")}
        </td>
        <td class="numeric ${profitClass(miner.optimal_profit_per_day)}">
          ${money(miner.optimal_profit_per_day, currency, "/day")}
        </td>
        <td class="numeric">
          ${
            miner.break_even_electricity_price === null
              ? "—"
              : `${currencyAmount(miner.break_even_electricity_price, currency, 4)}<span class="unit">/kWh</span>`
          }
        </td>
        <td class="center">${this._request(miner)}</td>
        <td class="center">
          <button
            class="auto-button ${miner.auto_optimize ? "enabled" : ""}"
            data-auto-entity="${esc(autoEntity || "")}"
            data-auto-state="${miner.auto_optimize ? "on" : "off"}"
            ${autoEntity && miner.auto_optimize_initialized ? "" : "disabled"}
            title="${
              miner.auto_optimize_initialized
                ? "Toggle Auto Optimize"
                : "Waiting for Home Assistant to restore Auto Optimize state"
            }"
          >
            ${miner.auto_optimize_initialized ? (miner.auto_optimize ? "ON" : "OFF") : "…"}
          </button>
        </td>
      </tr>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;

    const data = this._data;
    const farm = data?.farm;
    const miners = data?.miners || [];
    const shared = data?.shared || {};
    const currency = this._currency();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100%;
          box-sizing: border-box;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        * { box-sizing: border-box; }

        .page {
          max-width: 1700px;
          margin: 0 auto;
          padding: 24px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 22px;
        }

        h1 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 6px;
          font-weight: 600;
        }

        .subtitle {
          color: var(--secondary-text-color);
          font-size: 14px;
        }

        button {
          font: inherit;
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          padding: 8px 12px;
          cursor: pointer;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }

        button:hover { filter: brightness(0.98); }
        button:disabled { opacity: 0.45; cursor: default; }

        .settings-button { white-space: nowrap; }

        .error {
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--error-color);
          color: white;
        }

        .economics {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
          color: var(--secondary-text-color);
          font-size: 14px;
        }

        .source-pill {
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 999px;
          padding: 7px 11px;
        }

        .source-pill.pending {
          color: var(--warning-color);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .summary-card,
        .table-shell {
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 14px;
          box-shadow: var(--ha-card-box-shadow, none);
        }

        .summary-card {
          padding: 15px 16px;
          min-height: 96px;
        }

        .summary-label {
          color: var(--secondary-text-color);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-value {
          margin-top: 8px;
          font-size: 24px;
          font-weight: 600;
          line-height: 1.15;
        }

        .summary-sub {
          margin-top: 5px;
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .partial {
          margin-left: 5px;
          font-size: 10px;
          font-weight: 400;
          color: var(--warning-color);
          vertical-align: middle;
        }

        .section-title {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
        }

        .table-shell {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1280px;
          border-collapse: collapse;
          font-size: 13px;
        }

        thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          padding: 12px 11px;
          text-align: left;
          white-space: nowrap;
          color: var(--secondary-text-color);
          background: var(--card-background-color);
          border-bottom: 1px solid var(--divider-color);
          font-weight: 600;
        }

        tbody td,
        tfoot td {
          padding: 12px 11px;
          border-bottom: 1px solid var(--divider-color);
          vertical-align: middle;
          white-space: nowrap;
        }

        tbody tr:hover {
          background: var(--secondary-background-color);
        }

        tfoot td {
          font-weight: 600;
          background: var(--secondary-background-color);
          border-bottom: 0;
        }

        .miner-cell {
          min-width: 170px;
        }

        .miner-cell strong {
          display: block;
          font-size: 14px;
        }

        .miner-cell span,
        .best-point {
          display: block;
          margin-top: 3px;
          color: var(--secondary-text-color);
          font-size: 11px;
        }

        .status-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .status,
        .request {
          display: inline-block;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 11px;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
        }

        .status.active {
          color: var(--primary-text-color);
        }

        .status.profitable,
        .request.on {
          color: var(--success-color);
        }

        .status.waiting,
        .request.waiting,
        .waiting-text {
          color: var(--warning-color);
        }

        .action-off {
          color: var(--secondary-text-color);
          font-weight: 600;
        }

        .numeric {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .action-cell {
          min-width: 120px;
        }

        .center { text-align: center; }

        .unit {
          color: var(--secondary-text-color);
          font-size: 11px;
        }

        .positive { color: var(--success-color); }
        .negative { color: var(--error-color); }

        .auto-button {
          min-width: 56px;
          padding: 6px 9px;
        }

        .auto-button.enabled {
          border-color: var(--success-color);
          color: var(--success-color);
        }

        .empty {
          padding: 32px;
          text-align: center;
          color: var(--secondary-text-color);
          background: var(--card-background-color);
          border-radius: 14px;
          border: 1px solid var(--divider-color);
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(3, minmax(150px, 1fr));
          }
        }

        @media (max-width: 700px) {
          .page { padding: 14px; }
          .topbar { align-items: center; }
          .summary-grid {
            grid-template-columns: repeat(2, minmax(130px, 1fr));
          }
        }

        @media (max-width: 430px) {
          .summary-grid { grid-template-columns: 1fr; }
          .topbar { flex-direction: column; }
        }
      </style>

      <main class="page">
        <div class="topbar">
          <div>
            <h1>ASIC Profit</h1>
            <div class="subtitle">
              Live mining economics and optimization across all configured miners
            </div>
          </div>
          <button class="settings-button" id="integration-settings">
            Integration settings
          </button>
        </div>

        ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}

        ${
          miners.length
            ? `
              <div class="economics">
                <div class="source-pill ${shared.hashprice?.value == null ? "pending" : ""}">
                  Hashprice:
                  ${
                    shared.hashprice?.value == null
                      ? "waiting for market data"
                      : `${currencyAmount(shared.hashprice.value, currency, 6)}/TH/day`
                  }
                </div>
                <div class="source-pill ${shared.electricity?.value == null ? "pending" : ""}">
                  Electricity:
                  ${
                    shared.electricity?.value == null
                      ? "waiting for data"
                      : `${currencyAmount(shared.electricity.value, currency, 4)}/kWh`
                  }
                </div>
              </div>
            `
            : ""
        }

        ${
          farm
            ? `
              <section class="summary-grid">
                ${this._summaryCard(
                  "Miners",
                  `${farm.active_miners}/${farm.configured_miners}`,
                  `${farm.profitable_miners} profitable`
                )}
                ${this._summaryCard(
                  "Hashrate",
                  this._aggregateDisplay(
                    "hashrate_ths",
                    farm.total_hashrate_ths,
                    3,
                    "TH/s",
                    "hashrate"
                  )
                )}
                ${this._summaryCard(
                  "Wall power",
                  this._aggregateDisplay(
                    "power_w",
                    farm.total_power_w / 1000,
                    3,
                    "kW",
                    "power"
                  )
                )}
                ${this._summaryCard(
                  "Current profit",
                  this._aggregateMoney(
                    "current_profit_per_hour",
                    farm.current_profit_per_hour,
                    "/h",
                    "current_profit"
                  )
                )}
                ${this._summaryCard(
                  "Optimal farm profit",
                  this._aggregateMoney(
                    "optimal_profit_per_hour",
                    farm.optimal_profit_per_hour,
                    "/h",
                    "optimal_profit"
                  ),
                  this._optimalFarmSub(farm, miners)
                )}
                ${this._summaryCard(
                  "Mining requests",
                  `${farm.mining_requested_miners}`,
                  `${farm.auto_optimize_miners} auto-enabled`
                )}
              </section>
            `
            : ""
        }

        <h2 class="section-title">Miners</h2>

        ${
          miners.length
            ? `
              <section class="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Miner</th>
                      <th>Status</th>
                      <th class="numeric">Hashrate</th>
                      <th class="numeric">Wall power</th>
                      <th class="numeric">Current profit</th>
                      <th class="numeric">Optimal action</th>
                      <th class="numeric">Best-point profit</th>
                      <th class="numeric">Best-point / day</th>
                      <th class="numeric">Break-even</th>
                      <th class="center">Mining request</th>
                      <th class="center">Auto optimize</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${miners.map((miner) => this._minerRow(miner)).join("")}
                  </tbody>
                  ${
                    farm
                      ? `
                        <tfoot>
                          <tr>
                            <td>Farm total</td>
                            <td>${farm.active_miners} active</td>
                            <td class="numeric">${this._aggregateDisplay(
                              "hashrate_ths",
                              farm.total_hashrate_ths,
                              3,
                              "TH/s",
                              "hashrate"
                            )}</td>
                            <td class="numeric">${this._aggregateDisplay(
                              "power_w",
                              farm.total_power_w,
                              1,
                              "W",
                              "power"
                            )}</td>
                            <td class="numeric ${profitClass(farm.current_profit_per_hour)}">${this._aggregateMoney(
                              "current_profit_per_hour",
                              farm.current_profit_per_hour,
                              "/h",
                              "current_profit"
                            )}</td>
                            <td class="numeric action-cell">${this._farmOptimalAction(farm, miners)}</td>
                            <td class="numeric">—</td>
                            <td class="numeric">—</td>
                            <td class="numeric">—</td>
                            <td class="center">${farm.mining_requested_miners}</td>
                            <td class="center">${farm.auto_optimize_miners}</td>
                          </tr>
                        </tfoot>
                      `
                      : ""
                  }
                </table>
              </section>
            `
            : `
              <div class="empty">
                No ASIC Profit Optimizer miners are configured yet.
              </div>
            `
        }
      </main>
    `;

    this.shadowRoot
      .getElementById("integration-settings")
      ?.addEventListener("click", () => this._navigate(INTEGRATION_PATH));

    this.shadowRoot.querySelectorAll("[data-auto-entity]").forEach((button) => {
      button.addEventListener("click", () => {
        const entityId = button.dataset.autoEntity;
        const isOn = button.dataset.autoState === "on";
        this._toggleAuto(entityId, isOn);
      });
    });
  }
}

if (!customElements.get("asic-profit-panel")) {
  customElements.define("asic-profit-panel", AsicProfitPanel);
}
