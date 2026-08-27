/** Hold a loading flag for a short minimum so fast resolutions do not flash. */
export function remainingHoldMs(
  startedAt: number | null,
  now: number,
  pending: boolean,
  minMs = 180,
): number {
  if (pending) return minMs;
  if (startedAt == null) return 0;
  return Math.max(0, minMs - (now - startedAt));
}

export function shouldShowQueryError(state: {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
}): boolean {
  return state.isError && !state.isPending && !state.isFetching;
}
