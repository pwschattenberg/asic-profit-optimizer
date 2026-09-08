import "./asic-profit-panel-v039.js";

const Panel = customElements.get("asic-profit-panel");

const watchedEntityIds = (panel) => {
  const ids = new Set();
  for (const miner of panel._data?.miners || []) {
    for (const entityId of Object.values(miner.sources || {})) {
      if (typeof entityId === "string" && entityId.includes(".")) ids.add(entityId);
    }
    for (const entityId of Object.values(miner.entities || {})) {
      if (typeof entityId === "string" && entityId.includes(".")) ids.add(entityId);
    }
  }
  return ids;
};

if (Panel && !Panel.prototype.__v0310Patched) {
  const hassDescriptor = Object.getOwnPropertyDescriptor(Panel.prototype, "hass");
  const previousRender = Panel.prototype._render;
  const previousConnected = Panel.prototype.connectedCallback;
  const previousDisconnected = Panel.prototype.disconnectedCallback;

  Object.defineProperty(Panel.prototype, "hass", {
    configurable: true,
    get: hassDescriptor?.get,
    set(value) {
      const previous = this._hass;
      this._hass = value;

      if (!previous || !this._data) {
        this._scheduleLoad();
        return;
      }

      if (previous.config?.currency !== value?.config?.currency) {
        this._scheduleLoad();
        return;
      }

      const ids = watchedEntityIds(this);
      for (const entityId of ids) {
        if (previous.states?.[entityId] !== value?.states?.[entityId]) {
          this._scheduleLoad();
          return;
        }
      }
    },
  });

  Panel.prototype._markUserScrolling = function (delay = 700) {
    this.__v0310RenderAfter = Date.now() + delay;
    if (this.__v0310DeferredRenderTimer) {
      window.clearTimeout(this.__v0310DeferredRenderTimer);
    }
  };

  Panel.prototype._flushDeferredRender = function () {
    if (!this.__v0310RenderPending) return;

    const wait = Math.max(0, (this.__v0310RenderAfter || 0) - Date.now());
    if (wait > 0) {
      if (this.__v0310DeferredRenderTimer) {
        window.clearTimeout(this.__v0310DeferredRenderTimer);
      }
      this.__v0310DeferredRenderTimer = window.setTimeout(
        () => this._flushDeferredRender(),
        wait + 20
      );
      return;
    }

    this.__v0310RenderPending = false;
    this.__v0310DeferredRenderTimer = null;
    previousRender.call(this);
  };

  Panel.prototype._render = function (...args) {
    const renderAfter = this.__v0310RenderAfter || 0;
    if (this._data && Date.now() < renderAfter) {
      this.__v0310RenderPending = true;
      this._flushDeferredRender();
      return;
    }

    this.__v0310RenderPending = false;
    return previousRender.apply(this, args);
  };

  Panel.prototype.connectedCallback = function (...args) {
    const result = previousConnected?.apply(this, args);

    if (!this.__v0310InteractionHandlersInstalled) {
      this.__v0310OnTouchStart = () => this._markUserScrolling(1000);
      this.__v0310OnTouchMove = () => this._markUserScrolling(1000);
      this.__v0310OnTouchEnd = () => {
        this._markUserScrolling(500);
        this._flushDeferredRender();
      };
      this.__v0310OnWheel = () => {
        this._markUserScrolling(350);
        this._flushDeferredRender();
      };

      this.addEventListener("touchstart", this.__v0310OnTouchStart, { passive: true });
      this.addEventListener("touchmove", this.__v0310OnTouchMove, { passive: true });
      this.addEventListener("touchend", this.__v0310OnTouchEnd, { passive: true });
      this.addEventListener("touchcancel", this.__v0310OnTouchEnd, { passive: true });
      this.addEventListener("wheel", this.__v0310OnWheel, { passive: true });
      this.__v0310InteractionHandlersInstalled = true;
    }

    return result;
  };

  Panel.prototype.disconnectedCallback = function (...args) {
    if (this.__v0310DeferredRenderTimer) {
      window.clearTimeout(this.__v0310DeferredRenderTimer);
      this.__v0310DeferredRenderTimer = null;
    }

    if (this.__v0310InteractionHandlersInstalled) {
      this.removeEventListener("touchstart", this.__v0310OnTouchStart);
      this.removeEventListener("touchmove", this.__v0310OnTouchMove);
      this.removeEventListener("touchend", this.__v0310OnTouchEnd);
      this.removeEventListener("touchcancel", this.__v0310OnTouchEnd);
      this.removeEventListener("wheel", this.__v0310OnWheel);
      this.__v0310InteractionHandlersInstalled = false;
    }

    return previousDisconnected?.apply(this, args);
  };

  Panel.prototype.__v0310Patched = true;
}
