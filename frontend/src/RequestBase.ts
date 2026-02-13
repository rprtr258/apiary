import {database} from "../wailsjs/go/models.ts";
import {type HistoryEntry} from "./types.ts";
import {type get_request} from "./store.ts";
import {Signal} from "./utils.ts";

/**
 * Base interface for all Request component results
 */
export interface RequestComponentResult {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
}

/**
 * Base configuration for Request components
 */
export interface RequestConfig<Req extends database.Request> {
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Req>) => Promise<void>,
    send: () => Promise<void>,
  },
}

/**
 * Base class for Request components to reduce duplication
 */
export abstract class RequestBase<Req extends database.Request> {
  protected el: HTMLElement;
  protected showRequest: Signal<boolean>;
  protected onUpdate: (patch: Partial<Req>) => Promise<void>;
  protected onSend: () => Promise<void>;
  protected unmounts: (() => void)[] = [];
  protected currentRequest: Req | null = null;

  constructor(config: RequestConfig<Req>) {
    this.el = config.el;
    this.showRequest = config.show_request;
    this.onUpdate = config.on.update;
    this.onSend = config.on.send;
  }

  /**
   * Initialize the component with request data
   */
  loaded(r: get_request): void {
    this.currentRequest = r.request as unknown as Req;
    this.render();
  }

  /**
   * Handle new history entry
   */
  push_history_entry(_he: HistoryEntry): void {
    // Base implementation - override in subclasses
  }

  /**
   * Clean up resources
   */
  unmount(): void {
    for (const unmount of this.unmounts)
      unmount();
    this.unmounts = [];
  }

  /**
   * Render the component (abstract - must be implemented by subclasses)
   */
  protected abstract render(): void;

  /**
   * Helper to safely update request
   */
  protected async updateRequest(patch: Partial<Req>): Promise<void> {
    if (this.currentRequest === null) return;
    await this.onUpdate(patch);
  }

  /**
   * Helper to safely send request
   */
  protected async sendRequest(): Promise<void> {
    await this.onSend();
  }

  /**
   * Helper to create a loading state
   */
  protected showLoading(message: string = "Loading request..."): void {
    this.el.innerHTML = "";
    this.el.textContent = message;
  }

  /**
   * Helper to clear loading state
   */
  protected clearLoading(): void {
    this.el.innerHTML = "";
  }
}

/**
 * Factory function pattern for backward compatibility
 */
export function createRequestComponent<Req extends database.Request>(
  factory: (config: RequestConfig<Req>) => RequestComponentResult,
): (config: RequestConfig<Req>) => RequestComponentResult {
  return factory;
}