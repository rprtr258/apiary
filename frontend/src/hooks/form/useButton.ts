import {signal, Signal} from "../../utils.ts";

type UseButtonOptions = {
  on?: {click?: () => void | Promise<void>},
  disabled?: boolean,
  loading?: boolean,
};

type UseButtonResult = {
  // State
  disabledSignal: Signal<boolean>,
  loadingSignal: Signal<boolean>,

  // Event handlers
  on: {click: () => Promise<void>},

  // Actions
  set disabled(disabled: boolean),
  set loading(loading: boolean),
  reset: () => void,
};

// Headless hook for button management
export function useButton(options: UseButtonOptions = {}): UseButtonResult {
  const {
    on: {click: onClick} = {},
    disabled = false,
    loading = false,
  } = options;

  const disabledSignal = signal<boolean>(disabled);
  const loadingSignal = signal<boolean>(loading);

  const handleClick = async (): Promise<void> => {
    if (disabledSignal.value || loadingSignal.value) {
      return;
    }

    if (onClick !== undefined) {
      loadingSignal.update(() => true);
      try {
        await onClick();
      } finally {
        loadingSignal.update(() => false);
      }
    }
  };

  return {
    disabledSignal,
    loadingSignal,
    on: {click: handleClick},
    set disabled(disabled: boolean) {
      disabledSignal.update(() => disabled);
    },
    set loading(loading: boolean) {
      loadingSignal.update(() => loading);
    },
    reset(): void {
      disabledSignal.update(() => disabled);
      loadingSignal.update(() => loading);
    },
  };
}
