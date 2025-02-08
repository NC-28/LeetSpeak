/**
 * Background script starts running when needed.
 */
console.log("Background is running");

/**
 * Define variables.
 */
let socket = null;

/**
 * Connecting WebSocket to localhost.
 */
function connectWebSocket() {
  socket = new WebSocket("ws://localhost:5000");
  socket.onopen = () => console.log("WebSocket connected");
  socket.onclose = () => console.log("WebSocket closed");
  socket.onerror = (err) => console.error("WebSocket Error:", err);
}
