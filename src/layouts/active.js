/*
 * The layout (floor plan + room data) the app is currently showing. Modules that only need
 * to ask "which room is this point in?" read it from here, so the same customisation, VR and
 * navigation code serves every layout.
 */
let current = null;

export function setActiveLayout(layout) { current = layout; }
export function activeLayout() { return current; }

export const roomAt = (x, z) => current.roomAt(x, z);
export const roomInfo = (key) => (key && current ? current.ROOMS[key] || null : null);
export const eyeHeight = () => (current ? current.H.eye : 1.65);
