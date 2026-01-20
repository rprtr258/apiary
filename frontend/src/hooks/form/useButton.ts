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
  clickedSignal: Signal<boolean>,

  // Event handlers
  on: {click: () => Promise<void>},

  // Actions
  setDisabled: (disabled: boolean) => void,
  setLoading: (loading: boolean) => void,
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
  const clickedSignal = signal<boolean>(false);
  let clickResetTimer: ReturnType<typeof setTimeout> | undefined;

  const handleClick = async (): Promise<void> => {
    if (disabledSignal.value || loadingSignal.value) {
      return;
    }

    clickedSignal.update(() => true);

    if (onClick !== undefined) {
      try {
        loadingSignal.update(() => true);
        await onClick();
      } finally {
        loadingSignal.update(() => false);
      }
    }

    // Reset clicked state after a short delay
    clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => {
      clickedSignal.update(() => false);
    }, 300);
  };

  const setDisabled = (disabled: boolean): void => {
    disabledSignal.update(() => disabled);
  };

  const setLoading = (loading: boolean): void => {
    loadingSignal.update(() => loading);
  };

  const reset = (): void => {
    clearTimeout(clickResetTimer);
    clickResetTimer = undefined;
    disabledSignal.update(() => disabled);
    loadingSignal.update(() => loading);
    clickedSignal.update(() => false);
  };

  return {
    disabledSignal,
    loadingSignal,
    clickedSignal,
    on: {click: handleClick},
    setDisabled,
    setLoading,
    reset,
  };
}
