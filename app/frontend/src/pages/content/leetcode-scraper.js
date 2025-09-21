/**
 * LeetSpeak Content Scraper - Connection-Aware Version
 * 
 * Only connects and starts scraping wh        } else if (message.action === "reloadContentScript") {
        console.log("🔄 Reloading content script observers...");
        if (observersActive) {
            observeLeetCodeEditor();
            observeProblemDescription();
            observeProblemTitle();
        }re's an active voice session
 * Listens to connection state changes from the voice client
 */

console.log("🚀 LeetSpeak Connection-Aware Scraper Initialized");

// Connection state management
let socket = null;
let isVoiceSessionActive = false;
let currentSessionId = null;
let observersActive = false;

// --- Connection Management ---

function connectToBackend() {
    if (socket) {
        console.log("⚠️ Socket already exists, closing previous connection");
        socket.close();
    }
    
    console.log("📡 Connecting to FastAPI WebSocket backend...");
    socket = new WebSocket("ws://localhost:8000/ws/scraping");
    
    socket.addEventListener('open', () => {
        console.log("✅ WebSocket connected to FastAPI backend");
        // Send initial data when connected
        if (observersActive) {
            sendCurrentData();
        }
    });

    socket.addEventListener('error', (error) => {
        console.error("❌ WebSocket error:", error);
    });

    socket.addEventListener('close', () => {
        console.warn("⚠️ WebSocket closed");
        socket = null;
    });
}

function disconnectFromBackend() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("🔌 Disconnecting from backend");
        socket.close();
    }
    socket = null;
}

function startScraping() {
    if (observersActive) {
        console.log("⚠️ Observers already active");
        return;
    }
    
    console.log("🎯 Starting LeetCode scraping...");
    observersActive = true;
    
    // Start observers
    observeLeetCodeEditor();
    observeProblemDescription();
    observeProblemTitle();
    
    // Connect to backend if voice session is active
    if (isVoiceSessionActive) {
        connectToBackend();
    }
}

function stopScraping() {
    if (!observersActive) {
        console.log("⚠️ Observers not active");
        return;
    }
    
    console.log("🛑 Stopping LeetCode scraping...");
    observersActive = false;
    
    // Disconnect from backend
    disconnectFromBackend();
    
    // Note: We don't stop MutationObservers as they're cheap to keep running
    // They just won't send data when observersActive is false
}

// --- Voice Connection State Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'voiceConnectionStateChanged') {
        console.log(`🔄 Voice connection state changed: ${message.state}`);
        
        const wasActive = isVoiceSessionActive;
        isVoiceSessionActive = message.sessionActive && message.isConnected;
        currentSessionId = message.sessionId;
        
        if (isVoiceSessionActive && !wasActive) {
            // Voice session became active
            console.log("🎤 Voice session activated - starting scraping");
            startScraping();
        } else if (!isVoiceSessionActive && wasActive) {
            // Voice session became inactive
            console.log("🎤 Voice session deactivated - stopping scraping");
            stopScraping();
        }
    } else if (message.action === "reloadContentScript") {
        console.log("🔄 Reloading content script observers...");
        if (observersActive) {
            observeLeetCodeEditor();
            observeProblemDescription();
        }
    } else if (message.action === "getLeetCodeData") {
        // Always provide current data if requested
        const data = getCurrentLeetCodeData();
        sendResponse(data);
    }
    return true; // Keep message channel open
});

// Function to send data via WebSocket with retry logic - Enhanced with FastAPI format
function sendToServer(type, content) {
    // Only send if observers are active and we have a voice session
    if (!observersActive || !isVoiceSessionActive) {
        console.log(`🚫 Scraping disabled - not sending ${type}`);
        return;
    }
    
    console.log("=" * 50);
    console.log(`📤 SENDING TO BACKEND - Type: ${type}`);
    console.log(`📤 Content Length: ${content.length}`);
    console.log(`📤 Content Preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    console.log(`📤 Session ID: ${currentSessionId}`);
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Format message for FastAPI backend (matching our backend expectations)
        const message = {
            type: type,
            data: {
                content: content,
                type: type === "editor_update" ? "code_editor" : "problem_description",
                timestamp: Date.now()
            },
            url: window.location.href,
            timestamp: Date.now(),
            sessionId: currentSessionId
        };
        
        socket.send(JSON.stringify(message));
        console.log(`✅ Sent ${type} successfully to FastAPI backend`);
        console.log(`✅ Complete message sent:`, message);
    } else {
        console.warn("⚠️ Socket not ready or not connected");
    }
    console.log("=" * 50);
}

// --- Data Collection Functions ---

function getCurrentLeetCodeData() {
    const editorElement = document.querySelector(".view-lines.monaco-mouse-cursor-text");
    const descriptionElements = document.querySelectorAll(".elfjS");
    
    return {
        title: document.title,
        description: Array.from(descriptionElements).map(el => el.innerText.trim()).join("\n"),
        code: editorElement ? editorElement.innerText : "",
        url: window.location.href,
        timestamp: Date.now()
    };
}

// Helper function to extract just the problem name from the title
function extractProblemTitle() {
    const titleElement = document.querySelector('title[data-next-head]');
    if (titleElement) {
        const fullTitle = titleElement.textContent;
        // Extract just the problem name by removing " - LeetCode" suffix
        const problemName = fullTitle.replace(' - LeetCode', '').trim();
        console.log(`🏷️ Extracted problem title: "${problemName}" from full title: "${fullTitle}"`);
        return problemName;
    }
    return "";
}

function sendCurrentData() {
    if (!observersActive || !isVoiceSessionActive) {
        return;
    }
    
    const data = getCurrentLeetCodeData();
    
    // Send title data
    const problemTitle = extractProblemTitle();
    if (problemTitle) {
        sendToServer("title_update", problemTitle);
    }
    
    // Send both editor and description data
    if (data.code) {
        sendToServer("editor_update", data.code);
    }
    if (data.description) {
        sendToServer("description_update", data.description);
    }
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
        if (!observersActive) return; // Don't process if observers are inactive
        
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
        if (!observersActive) return; // Don't process if observers are inactive
        
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

// Observe the problem title changes
function observeProblemTitle() {
    console.log('🔍 Setting up problem title observer...');
    
    // Create a MutationObserver to watch for title changes
    const titleObserver = new MutationObserver(debounce(() => {
        if (!observersActive) return; // Don't process if observers are inactive
        
        const problemTitle = extractProblemTitle();
        if (problemTitle) {
            console.log(`🏷️ Title changed: ${problemTitle}`);
            sendToServer("title_update", problemTitle);
        }
    }, 500));
    
    // Observe changes to the document title
    const titleElement = document.querySelector('title[data-next-head]');
    if (titleElement) {
        console.log('✅ Found title element, setting up observer');
        titleObserver.observe(titleElement, { childList: true, characterData: true });
        
        // Send initial title
        const initialTitle = extractProblemTitle();
        if (initialTitle && observersActive) {
            console.log(`🏷️ Initial title: ${initialTitle}`);
            sendToServer("title_update", initialTitle);
        }
    } else {
        console.log('⚠️ Title element not found, retrying in 500ms...');
        setTimeout(() => observeProblemTitle(), 500);
    }
}

console.log('🎯 LeetSpeak Connection-Aware Scraper Ready');

// Initialize observers but don't start scraping yet - wait for voice connection
// The observers will be set up but won't send data until voice session is active
observeLeetCodeEditor();
observeProblemDescription();
observeProblemTitle();

// Export for debugging
window.leetSpeakScraper = {
    socket,
    sendToServer,
    observeLeetCodeEditor,
    observeProblemDescription,
    observeProblemTitle,
    extractProblemTitle,
    startScraping,
    stopScraping,
    getCurrentLeetCodeData,
    isVoiceSessionActive,
    observersActive
};

console.log("✅ LeetSpeak Connection-Aware Scraper Ready!");