import "@testing-library/jest-dom"

// jsdom has no ResizeObserver -- RiskGraphWidget uses one to size its
// graph viewBox to the card's real rendered height. A no-op stub (observe
// never fires) is enough: components that use it just keep their default
// size in tests, same as before ResizeObserver existed in this codebase.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver
}
