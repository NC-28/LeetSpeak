/**
 * LeetSpeak Content Scraper - Based on Proven Legacy Approach
 * 
 * Simplified, reliable content scraper using the exact same approach that worked in legacy
 * Connects to FastAPI backend at ws://localhost:8000/ws/scraping
 */

console.log("🚀 LeetSpeak Legacy-Style Scraper Initialized");

// Connect to FastAPI WebSocket Server  
const socket = new WebSocket("ws://localhost:8000/ws/scraping");

// --- WebSocket Setup ---
socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected to FastAPI backend");
});

socket.addEventListener('error', (error) => {
    console.error("❌ WebSocket error:", error);
});

socket.addEventListener('close', () => {
    console.warn("⚠️ WebSocket closed. Attempting to reconnect...");
    // Simple reconnect strategy
    setTimeout(() => {
        console.log("🔄 Reloading page to reconnect...");
        location.reload();
    }, 3000);
});

// Function to send data via WebSocket with retry logic - Enhanced with FastAPI format
function sendToServer(type, content) {
    console.log("=" * 50);
    console.log(`📤 SENDING TO BACKEND - Type: ${type}`);
    console.log(`📤 Content Length: ${content.length}`);
    console.log(`📤 Content Preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    console.log(`📤 Full Content:`, content);
    
    if (socket.readyState === WebSocket.OPEN) {
        // Format message for FastAPI backend (matching our backend expectations)
        const message = {
            type: type,
            data: {
                content: content,
                type: type === "editor_update" ? "code_editor" : "problem_description",
                timestamp: Date.now()
            },
            url: window.location.href,
            timestamp: Date.now()
        };
        
        socket.send(JSON.stringify(message));
        console.log(`✅ Sent ${type} successfully to FastAPI backend`);
        console.log(`✅ Complete message sent:`, message);
    } else {
        console.warn("⚠️ Socket not ready. Retrying...");
        setTimeout(() => sendToServer(type, content), 500);
    }
    console.log("=" * 50);
}

// --- Helper: Debounce (same as legacy) ---
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// --- Generic Element Observer (same as legacy) ---
function observeElement(selector, callback) {
    const element = document.querySelector(selector);
    if (!element) {
        console.log(`🔍 Element not found yet: ${selector}, retrying in 500ms...`);
        // Retry if the element isn't available yet
        return setTimeout(() => observeElement(selector, callback), 500);
    }
    
    console.log(`✅ Found element: ${selector}, setting up observer`);
    const observer = new MutationObserver(debounce(callback, 500));
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    
    // Fire the callback once initially
    callback();
}

// --- Observers for Specific Elements (using exact legacy selectors) ---

// Observe the LeetCode editor (using exact legacy selector)
function observeLeetCodeEditor() {
    const editorSelector = ".view-lines.monaco-mouse-cursor-text";
    console.log(`🔍 Setting up editor observer with selector: ${editorSelector}`);
    
    observeElement(editorSelector, () => {
        const editor = document.querySelector(editorSelector);
        if (editor) {
            const content = editor.innerText;
            console.log(`📝 Editor content changed: ${content.length} characters`);
            sendToServer("editor_update", content);
        } else {
            console.log("⚠️ Editor element not found during callback");
        }
    });
}

// Observe the problem description (using exact legacy selector)
function observeProblemDescription() {
    console.log('🔍 Setting up problem description observer...');
    const descriptionSelector = ".elfjS";
    
    observeElement(descriptionSelector, () => {
        const descriptionElements = document.querySelectorAll(descriptionSelector);
        console.log(`📋 Found ${descriptionElements.length} description elements`);
        
        const content = Array.from(descriptionElements)
            .map(el => el.innerText.trim())
            .join("\n");
            
        if (content) {
            console.log(`📋 Description content: ${content.length} characters`);
            sendToServer("description_update", content);
        } else {
            console.log("⚠️ No description content found");
        }
    });
}

console.log('🎯 Initializing LeetSpeak scraper with legacy approach...');

// Initialize Observers (same as legacy)
observeLeetCodeEditor();
observeProblemDescription();

// --- Handle SPA Navigation (same as legacy) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "reloadContentScript") {
        console.log("🔄 Reloading content script observers...");
        observeLeetCodeEditor();
        observeProblemDescription();
    } else if (message.action === "getLeetCodeData") {
        // Provide current data if requested
        const editorElement = document.querySelector(".view-lines.monaco-mouse-cursor-text");
        const descriptionElements = document.querySelectorAll(".elfjS");
        
        const data = {
            title: document.title,
            description: Array.from(descriptionElements).map(el => el.innerText.trim()).join("\n"),
            code: editorElement ? editorElement.innerText : "",
            url: window.location.href,
            timestamp: Date.now()
        };
        
        sendResponse(data);
    }
    return true; // Keep message channel open
});

// Export for debugging
window.leetSpeakScraper = {
    socket,
    sendToServer,
    observeLeetCodeEditor,
    observeProblemDescription
};

console.log("✅ LeetSpeak Legacy-Style Scraper Ready!");