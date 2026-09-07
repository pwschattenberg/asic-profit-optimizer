import "./asic-profit-panel.js";

const Panel = customElements.get("asic-profit-panel");

if (Panel && !Panel.prototype.__mobileCardsPatched) {
  const originalRender = Panel.prototype._render;

  Panel.prototype._render = function (...args) {
    const result = originalRender.apply(this, args);
    const root = this.shadowRoot;

    if (!root || root.getElementById("mobile-card-layout")) {
      return result;
    }

    const style = document.createElement("style");
    style.id = "mobile-card-layout";
    style.textContent = `
      @media (max-width: 760px) {
        .table-shell {
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        table {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          font-size: 14px !important;
        }

        thead,
        tfoot {
          display: none !important;
        }

        tbody {
          display: grid !important;
          gap: 12px !important;
        }

        tbody tr {
          display: block !important;
          overflow: hidden !important;
          padding: 0 14px !important;
          border: 1px solid var(--divider-color) !important;
          border-radius: 14px !important;
          background: var(--card-background-color) !important;
          box-shadow: var(--ha-card-box-shadow, none) !important;
        }

        tbody tr:hover {
          background: var(--card-background-color) !important;
        }

        tbody td {
          display: flex !important;
          width: 100% !important;
          min-width: 0 !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 16px !important;
          padding: 11px 0 !important;
          border-bottom: 1px solid var(--divider-color) !important;
          white-space: normal !important;
          text-align: right !important;
        }

        tbody td:last-child {
          border-bottom: 0 !important;
        }

        tbody td::before {
          flex: 0 0 43%;
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.035em;
          text-align: left;
          text-transform: uppercase;
        }

        tbody td:nth-child(2)::before { content: "Status"; }
        tbody td:nth-child(3)::before { content: "Hashrate"; }
        tbody td:nth-child(4)::before { content: "Wall power"; }
        tbody td:nth-child(5)::before { content: "Current profit"; }
        tbody td:nth-child(6)::before { content: "Optimal action"; }
        tbody td:nth-child(7)::before { content: "Best-point profit"; }
        tbody td:nth-child(8)::before { content: "Best-point / day"; }
        tbody td:nth-child(9)::before { content: "Break-even"; }
        tbody td:nth-child(10)::before { content: "Mining request"; }
        tbody td:nth-child(11)::before { content: "Auto optimize"; }

        tbody td.miner-cell {
          display: block !important;
          padding: 15px 0 13px !important;
          text-align: left !important;
        }

        tbody td.miner-cell::before {
          display: none !important;
        }

        .miner-cell strong {
          font-size: 17px !important;
        }

        .miner-cell span {
          margin-top: 4px !important;
        }

        .status-stack {
          align-items: flex-end !important;
        }

        .numeric,
        .center {
          text-align: right !important;
        }

        .action-cell {
          min-width: 0 !important;
        }

        .best-point {
          text-align: right !important;
        }
      }
    `;

    root.append(style);
    return result;
  };

  Panel.prototype.__mobileCardsPatched = true;
}
