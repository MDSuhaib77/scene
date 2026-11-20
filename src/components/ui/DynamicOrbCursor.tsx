/**
 * SceneOS — Hardware-First Pointer Mode
 *
 * Restores the native OS cursor so pointer motion never stalls during main-thread
 * work, React reconciliations, media decoding, or heavy scroll transitions.
 * Eliminates the previous 120Hz RAF loop, per-frame CSS variable writes, DOM `.closest()`
 * queries on mousemove, and mix-blend-mode: difference full-viewport compositor readbacks.
 */
export function DynamicOrbCursor() {
  return null;
}
