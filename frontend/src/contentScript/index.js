// Connect to Python WebSocket Server
const socket = new WebSocket("ws://localhost:8765");

// --- WebSocket Setup ---
socket.addEventListener('open', () => {
    console.log("WebSocket connected");
});
socket.addEventListener('error', (error) => {
    console.error("WebSocket error:", error);
});
socket.addEventListener('close', () => {
    console.warn("WebSocket closed. Attempting to reconnect...");
    // Simple reconnect strategy by reloading the page
    setTimeout(() => location.reload(), 3000);
});

// Function to send data via WebSocket with retry logic
function sendToServer(type, content) {
    console.log(`Attempting to send ${type}:`, content);
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, content }));
        console.log(`Sent ${type} successfully.`);
    } else {
        console.warn("Socket not ready. Retrying...");
        setTimeout(() => sendToServer(type, content), 500);
    }
}


// --- Helper: Debounce ---
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// --- Generic Element Observer ---
function observeElement(selector, callback) {
    const element = document.querySelector(selector);
    if (!element) {
        // Retry if the element isn't available yet
        return setTimeout(() => observeElement(selector, callback), 500);
    }
    const observer = new MutationObserver(debounce(callback, 500));
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    // Fire the callback once initially
    callback();
}

// --- Observers for Specific Elements ---

// Observe the LeetCode editor
function observeLeetCodeEditor() {
    const editorSelector = ".view-lines.monaco-mouse-cursor-text";
    observeElement(editorSelector, () => {
        const editor = document.querySelector(editorSelector);
        if (editor) {
            sendToServer("editor_update", editor.innerText);
        }
    });
}

// Observe the problem description
function observeProblemDescription() {
    console.log('obseriving proble mdesc')
    const descriptionSelector = ".elfjS";
    observeElement(descriptionSelector, () => {
        const descriptionElements = document.querySelectorAll(descriptionSelector);
        const content = Array.from(descriptionElements)
            .map(el => el.innerText.trim())
            .join("\n");
        if (content) {
            sendToServer("description_update", content);
        }
    });
}
console.log('running man')
// Initialize Observers
observeLeetCodeEditor();
observeProblemDescription();

// --- Optional: Handle SPA Navigation ---
// If LeetCode uses SPA navigation, you can re-trigger the observers via messaging:
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "reloadContentScript") {
        observeLeetCodeEditor();
        observeProblemDescription();
    }
});
