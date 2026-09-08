import "./asic-profit-panel-wrapper.js";

const Panel = customElements.get("asic-profit-panel");

const composedParent = (node) => {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode?.();
  return root instanceof ShadowRoot ? root.host : null;
};

const captureScroll = (host) => {
  const positions = [];
  const seen = new Set();

  const add = (element) => {
    if (!element || seen.has(element)) return;
    seen.add(element);
    positions.push({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    });
  };

  let node = host;
  while (node) {
    if (
      node instanceof HTMLElement &&
      (node.scrollHeight > node.clientHeight + 1 ||
        node.scrollWidth > node.clientWidth + 1)
    ) {
      add(node);
    }
    node = composedParent(node);
  }

  add(document.scrollingElement);

  return {
    positions,
    windowX: window.scrollX,
    windowY: window.scrollY,
  };
};

const restoreScroll = (snapshot) => {
  if (!snapshot) return;

  const apply = () => {
    for (const position of snapshot.positions) {
      if (!position.element?.isConnected) continue;
      position.element.scrollTop = position.top;
      position.element.scrollLeft = position.left;
    }
    window.scrollTo(snapshot.windowX, snapshot.windowY);
  };

  // Restore immediately, then again after layout settles. This prevents live
  // Home Assistant state updates from moving a user who is reading lower down
  // the farm dashboard, especially in mobile Safari.
  apply();
  window.requestAnimationFrame(() => {
    apply();
    window.requestAnimationFrame(apply);
  });
};

const manualButton = (miner) => {
  const entityId = miner.entities?.manual_mining;
  const initialized = miner.manual_mining_initialized;
  const on = miner.manual_mining;

  return `
    <button
      class="auto-button manual-button ${on ? "enabled" : ""}"
      data-manual-entity="${entityId || ""}"
      data-manual-state="${on ? "on" : "off"}"
      ${entityId && initialized ? "" : "disabled"}
      title="${
        initialized
          ? "Force Mining Request on without automatic retuning"
          : "Waiting for Home Assistant to restore Manual Mining state"
      }"
    >${initialized ? (on ? "ON" : "OFF") : "…"}</button>
  `;
};

if (Panel && !Panel.prototype.__v039Patched) {
  const previousRender = Panel.prototype._render;

  Panel.prototype._render = function (...args) {
    const scrollSnapshot = captureScroll(this);
    const result = previousRender.apply(this, args);
    const root = this.shadowRoot;

    if (!root) {
      restoreScroll(scrollSnapshot);
      return result;
    }

    if (!root.getElementById("v039-dashboard-style")) {
      const style = document.createElement("style");
      style.id = "v039-dashboard-style";
      style.textContent = `
        :host, .page { overflow-anchor: none; }
        @media (min-width: 761px) {
          table { min-width: 1380px; }
        }
        @media (max-width: 760px) {
          tbody td:nth-child(11)::before { content: "Manual mining"; }
          tbody td:nth-child(12)::before { content: "Auto optimize"; }
        }
      `;
      root.append(style);
    }

    const miners = this._data?.miners || [];
    const farm = this._data?.farm;

    const headerRow = root.querySelector("thead tr");
    if (headerRow && !headerRow.querySelector("[data-manual-column]")) {
      const cell = document.createElement("th");
      cell.className = "center";
      cell.dataset.manualColumn = "true";
      cell.textContent = "Manual mining";
      headerRow.lastElementChild?.before(cell);
    }

    root.querySelectorAll("tbody tr").forEach((row, index) => {
      if (row.querySelector("[data-manual-cell]")) return;
      const miner = miners[index];
      if (!miner) return;

      const cell = document.createElement("td");
      cell.className = "center";
      cell.dataset.manualCell = "true";
      cell.innerHTML = manualButton(miner);
      row.lastElementChild?.before(cell);
    });

    const footerRow = root.querySelector("tfoot tr");
    if (footerRow && !footerRow.querySelector("[data-manual-total]")) {
      const cell = document.createElement("td");
      cell.className = "center";
      cell.dataset.manualTotal = "true";
      cell.textContent = String(farm?.manual_mining_miners ?? 0);
      footerRow.lastElementChild?.before(cell);
    }

    const requestSummary = Array.from(root.querySelectorAll(".summary-card")).find(
      (card) =>
        card.querySelector(".summary-label")?.textContent?.trim() ===
        "Mining requests"
    );
    const requestSub = requestSummary?.querySelector(".summary-sub");
    if (requestSub && farm) {
      requestSub.textContent = `${farm.auto_optimize_miners} auto-enabled · ${farm.manual_mining_miners} manual`;
    }

    root.querySelectorAll("[data-manual-entity]").forEach((button) => {
      button.addEventListener("click", async () => {
        const entityId = button.dataset.manualEntity;
        const isOn = button.dataset.manualState === "on";
        if (!this._hass || !entityId) return;

        try {
          await this._hass.callService(
            "switch",
            isOn ? "turn_off" : "turn_on",
            { entity_id: entityId }
          );
          await this._load();
        } catch (err) {
          this._error = err?.message || String(err);
          this._render();
        }
      });
    });

    restoreScroll(scrollSnapshot);
    return result;
  };

  Panel.prototype.__v039Patched = true;
}
