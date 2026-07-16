// Single shared Socket.io connection for the whole app. A module-level
// singleton (not created per-component) so switching pages doesn't tear
// down and reconnect — React Router swaps page components without
// unmounting the app itself, so this connects once on load and lives for
// the whole session. Pages subscribe/unsubscribe their own event handlers
// but never call .disconnect() on it themselves.
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const socket = io(SOCKET_URL);
