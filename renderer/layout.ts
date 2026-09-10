import {ComponentContainer, LayoutConfig} from "./layout/types.ts";
import {LayoutManager} from "./layout/manager.ts";

let instance: LayoutManager | undefined = undefined;

export default {
  init(
    el: HTMLElement,
    layoutConfig: LayoutConfig,
    factories: Record<string, (container: ComponentContainer, state: unknown) => void>,
    onstatechanged: () => void,
  ) {
    if (instance !== undefined) {
      throw new Error("Layout already initialized");
    }

    const gl = new LayoutManager(el, factories, layoutConfig);
    gl.on("stateChanged", onstatechanged);
    instance = gl;
  },
  get instance(): LayoutManager | undefined {
    return instance;
  },
};
