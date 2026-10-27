/**
 * What React Flow needs that jsdom lacks (istar-ts's react test setup): call
 * it in a `beforeAll` of a test that renders the canvas (or the panels
 * around it).
 */
export const mockReactFlowDom = () => {
  class ResizeObserverMock {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: 800, height: 600 },
            // react-resizable-panels reads the border box
            borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyMock {
    m22 = 1;
  }
  Object.assign(globalThis, {
    ResizeObserver: ResizeObserverMock,
    DOMMatrixReadOnly: DOMMatrixReadOnlyMock,
  });
  (
    globalThis.SVGElement.prototype as unknown as { getBBox: () => DOMRect }
  ).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
};
