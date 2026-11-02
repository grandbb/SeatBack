/** Build a shareable event URL using the current page origin. */
export function buildEventUrl(eventId: bigint): string {
  return `${window.location.origin}/?event=${eventId.toString()}`
}
