console.log('background script loaded');

// Handle extension icon click to open side panel
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: any) => console.error(error));

/**
 * Define variables.
 */
let socket = null;

/**
 * Connecting WebSocket to localhost.
 */
function connectWebSocket() {
  socket = new WebSocket("ws://localhost:8765");
  socket.onopen = () => console.log("WebSocket connected");
  socket.onclose = () => console.log("WebSocket closed");
  socket.onerror = (err) => console.error("WebSocket Error:", err);
}


// Editor
let latestEditorContent = "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateEditorContent") {
        latestEditorContent = message.content;
    }
});

// Provide data to popup on request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getEditorContent") {
        sendResponse({ content: latestEditorContent });
    }
});

// Description

let leetCodeData: unknown[] = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "sendData") {
        leetCodeData = message.data;
        console.log("Scraped Data:", leetCodeData);
    }
});

// Listener for popup requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getData") {
        sendResponse({ data: leetCodeData });
    }
});