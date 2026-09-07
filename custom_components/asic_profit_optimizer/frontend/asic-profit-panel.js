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

const money = (value, suffix = "") =>
  value === null || value === undefined
    ? "—"
    : `${Number(value) >= 0 ? "+" : ""}€${number(value, 4)}${suffix}`;

class AsicProfitPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._data = null;
    this._error = null;
    this._loading = false;
    this._refreshTimer = null;
  }

  set hass(value) {
    this._hass = value;
    if (!this._data && !this._loading) {
      this._load();
    }
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
  }

  connectedCallback() {
    this._render();
    if (this._hass) {
      this._load();
    }
    this._refreshTimer = window.setInterval(() => this._load(), 5000);
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      window.clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  async _load() {
    if (!this._hass || this._loading) return;

    this._loading = true;
    try {
      this._data = await this._hass.callWS({ type: `${DOMAIN}/farm` });
      this._error = null;
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      this._render();
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

  _summaryCard(label, value, sub = "") {
    return `
      <div class="summary-card">
        <div class="summary-label">${esc(label)}</div>
        <div class="summary-value">${value}</div>
        ${sub ? `<div class="summary-sub">${sub}</div>` : ""}
      </div>
    `;
  }

  _minerCard(miner) {
    const autoEntity = miner.entities?.auto_optimize;
    const currentProfitClass =
      miner.current_profit_per_hour === null
        ? ""
        : miner.current_profit_per_hour >= 0
          ? "positive"
          : "negative";
    const optimalProfitClass =
      miner.optimal_profit_per_hour === null
        ? ""
        : miner.optimal_profit_per_hour >= 0
          ? "positive"
          : "negative";

    return `
      <article class="miner-card">
        <header class="miner-header">
          <div>
            <div class="miner-name">${esc(miner.name)}</div>
            <div class="chips">
              <span class="chip ${miner.active ? "on" : ""}">
                ${miner.active ? "● Active" : "○ Off"}
              </span>
              <span class="chip ${miner.profitable ? "good" : ""}">
                ${miner.profitable ? "Profitable" : "Not profitable"}
              </span>
              ${
                miner.mining_request
                  ? '<span class="chip request">Mining requested</span>'
                  : ""
              }
            </div>
          </div>
          <button
            class="auto-button ${miner.auto_optimize ? "enabled" : ""}"
            data-auto-entity="${esc(autoEntity || "")}"
            data-auto-state="${miner.auto_optimize ? "on" : "off"}"
            ${autoEntity ? "" : "disabled"}
          >
            Auto ${miner.auto_optimize ? "ON" : "OFF"}
          </button>
        </header>

        <div class="metrics">
          <div class="metric">
            <span>Hashrate</span>
            <strong>${number(miner.hashrate_ths, 3)} TH/s</strong>
          </div>
          <div class="metric">
            <span>Wall power</span>
            <strong>${number(miner.power_w, 1)} W</strong>
          </div>
          <div class="metric">
            <span>Current profit</span>
            <strong class="${currentProfitClass}">
              ${money(miner.current_profit_per_hour, "/h")}
            </strong>
          </div>
          <div class="metric">
            <span>Optimal target</span>
            <strong>${number(miner.optimal_power_w, 0)} W</strong>
          </div>
          <div class="metric">
            <span>Optimal profit</span>
            <strong class="${optimalProfitClass}">
              ${money(miner.optimal_profit_per_hour, "/h")}
            </strong>
          </div>
          <div class="metric">
            <span>Optimal/day</span>
            <strong class="${optimalProfitClass}">
              ${money(miner.optimal_profit_per_day, "/day")}
            </strong>
          </div>
          <div class="metric">
            <span>Break-even</span>
            <strong>€${number(miner.break_even_electricity_price, 4)}/kWh</strong>
          </div>
          <div class="metric">
            <span>Profile</span>
            <strong>${number(miner.profile_points, 0)} points</strong>
          </div>
        </div>
      </article>
    `;
  }

  _render() {
    if (!this.shadowRoot) return;

    const data = this._data;
    const farm = data?.farm;
    const miners = data?.miners || [];
    const shared = data?.shared || {};

    const partial = (key) =>
      farm?.complete && farm.complete[key] === false
        ? '<span class="partial">partial</span>'
        : "";

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
          max-width: 1500px;
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
          padding: 9px 13px;
          cursor: pointer;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }

        button:hover { filter: brightness(0.98); }
        button:disabled { opacity: 0.45; cursor: default; }

        .settings-button {
          white-space: nowrap;
        }

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

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .summary-card,
        .miner-card {
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

        .miners {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 14px;
        }

        .miner-card {
          padding: 16px;
        }

        .miner-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--divider-color);
        }

        .miner-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          display: inline-block;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
        }

        .chip.on {
          color: var(--primary-text-color);
        }

        .chip.good,
        .chip.request {
          color: var(--success-color);
        }

        .auto-button.enabled {
          border-color: var(--success-color);
          color: var(--success-color);
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 18px;
          padding-top: 8px;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid var(--divider-color);
          font-size: 13px;
        }

        .metric span {
          color: var(--secondary-text-color);
        }

        .metric strong {
          font-weight: 600;
          text-align: right;
        }

        .positive { color: var(--success-color); }
        .negative { color: var(--error-color); }

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
          .miners { grid-template-columns: 1fr; }
          .metrics { grid-template-columns: 1fr; }
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

        ${
          this._error
            ? `<div class="error">${esc(this._error)}</div>`
            : ""
        }

        ${
          shared.hashprice || shared.electricity
            ? `
              <div class="economics">
                ${
                  shared.hashprice
                    ? `<div class="source-pill">
                         Hashprice: €${number(shared.hashprice.value, 6)}/TH/day
                       </div>`
                    : ""
                }
                ${
                  shared.electricity
                    ? `<div class="source-pill">
                         Electricity: €${number(shared.electricity.value, 4)}/kWh
                       </div>`
                    : ""
                }
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
                  `${number(farm.total_hashrate_ths, 3)} TH/s ${partial("hashrate")}`
                )}
                ${this._summaryCard(
                  "Wall power",
                  `${number(farm.total_power_w / 1000, 3)} kW ${partial("power")}`
                )}
                ${this._summaryCard(
                  "Current profit",
                  `${money(farm.current_profit_per_hour, "/h")} ${partial("current_profit")}`
                )}
                ${this._summaryCard(
                  "Optimal profit",
                  `${money(farm.optimal_profit_per_hour, "/h")} ${partial("optimal_profit")}`,
                  `${money(farm.optimal_profit_per_day, "/day")}`
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
            ? `<section class="miners">${miners
                .map((miner) => this._minerCard(miner))
                .join("")}</section>`
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
