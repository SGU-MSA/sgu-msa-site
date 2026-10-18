import * as React from "react";

// Animate UI helper (MIT, animate-ui.com). Project change: a controlled value
// is read directly instead of being copied into state by an effect.

interface CommonControlledStateProps<T> {
  value?: T;
  defaultValue?: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useControlledState<T, Rest extends any[] = []>(
  props: CommonControlledStateProps<T> & {
    onChange?: (value: T, ...args: Rest) => void;
  },
): readonly [T, (next: T, ...args: Rest) => void] {
  const { value, defaultValue, onChange } = props;

  const [internal, setInternal] = React.useState<T>(defaultValue as T);
  const state = value !== undefined ? value : internal;

  const setState = React.useCallback(
    (next: T, ...args: Rest) => {
      setInternal(next);
      onChange?.(next, ...args);
    },
    [onChange],
  );

  return [state, setState] as const;
}
