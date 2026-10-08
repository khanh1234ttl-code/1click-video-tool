import type { Status } from "../lib/types";

/** Test helper: a `status` prop that can change after mount, like the App's status event. */
export function reactiveStatus(initial: Status) {
  const box = $state({ status: initial });
  return {
    get status() { return box.status; },
    set(next: Status) { box.status = next; },
  };
}
