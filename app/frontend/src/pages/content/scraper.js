console.log("LeetSpeak Content Script - Enhanced Scraper Running");

class LeetSpeakScraper {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        
        // Cache for avoiding duplicate updates
        this.lastEditorContent = '';
        this.lastDescriptionContent = '';
        
        this.init();
        this.setupMessageHandler();
    }
    
    init() {
        this.connectToBackend();
        this.setupObservers();
    }
    
    setupMessageHandler() {
        // Listen for messages from extension popup/panel
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'getLeetCodeData') {
                const data = this.getCurrentLeetCodeData();
                sendResponse(data);
            }
            return true; // Keep message channel open for async response
        });
    }
    
    getCurrentLeetCodeData() {
        const problemTitle = this.getProblemTitle();
        const problemDescription = this.getProblemDescription();
        const editorContent = this.getEditorContent();
        const testCases = this.getTestCases();
        
        return {
            title: problemTitle,
            description: problemDescription,
            code: editorContent,
            testCases: testCases,
            url: window.location.href,
            timestamp: Date.now()
        };
    }
    
    connectToBackend() {
        try {
            // Connect to FastAPI WebSocket endpoint
            this.socket = new WebSocket("ws://localhost:8000/ws/scraping");
            
            this.socket.addEventListener('open', () => {
                console.log("✅ Connected to LeetSpeak backend");
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Send initial data
                this.sendEditorUpdate();
                this.sendDescriptionUpdate();
            });
            
            this.socket.addEventListener('error', (error) => {
                console.error("❌ WebSocket connection error:", error);
                this.isConnected = false;
            });
            
            this.socket.addEventListener('close', (event) => {
                console.warn("⚠️ WebSocket connection closed:", event.code, event.reason);
                this.isConnected = false;
                this.attemptReconnect();
            });
            
            this.socket.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleBackendMessage(data);
                } catch (error) {
                    console.error("Error parsing backend message:", error);
                }
            });
            
        } catch (error) {
            console.error("Error connecting to backend:", error);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("❌ Max reconnection attempts reached. Please check if backend is running on localhost:8000");
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connectToBackend();
        }, delay);
    }
    
    handleBackendMessage(data) {
        // Handle any messages from backend if needed
        console.log("📨 Backend message:", data);
    }
    
    sendToBackend(type, content) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ Backend not connected, queuing data...");
            return;
        }
        
        try {
            this.socket.send(JSON.stringify({ type, content }));
            console.log(`📤 Sent ${type}:`, content.substring(0, 100) + (content.length > 100 ? '...' : ''));
        } catch (error) {
            console.error("Error sending data to backend:", error);
        }
    }
    
    // Helper: Debounce function to avoid excessive updates
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    setupObservers() {
        // Observe LeetCode editor with improved selectors - more frequent updates for code
        this.observeElement([
            ".monaco-editor",             // Monaco editor container
            ".view-lines.monaco-mouse-cursor-text", // Monaco editor content
            ".monaco-editor .view-lines",
            ".CodeMirror",               // CodeMirror container
            ".CodeMirror-lines",         // CodeMirror fallback
            ".ace_editor",               // ACE editor
            "div[data-track-load='description_content'] .elfjS",
        ], this.debounce(() => this.sendEditorUpdate(), 300)); // Reduced delay for code updates
        
        // Also set up keyboard and input listeners for immediate feedback
        this.setupKeyboardListeners();
        
        // Observe problem description with multiple selectors
        this.observeElement([
            ".elfjS", // Main description container
            "[data-track-load='description_content']",
            ".question-content",
            ".problem-description",
            ".content__u3I1 .question-content",
        ], this.debounce(() => this.sendDescriptionUpdate(), 1000));
        
        // Also observe for navigation changes in SPA
        this.observeNavigationChanges();
    }
    
    setupKeyboardListeners() {
        // Listen for keyboard events on the editor for immediate updates
        const addKeyListener = () => {
            const editors = document.querySelectorAll([
                '.monaco-editor textarea',
                '.CodeMirror textarea', 
                '.ace_text-input'
            ].join(', '));
            
            editors.forEach(editor => {
                if (!editor._leetSpeakListener) {
                    editor._leetSpeakListener = true;
                    editor.addEventListener('input', this.debounce(() => {
                        console.log('⌨️ Keyboard input detected');
                        this.sendEditorUpdate();
                    }, 200));
                    
                    editor.addEventListener('keyup', this.debounce(() => {
                        this.sendEditorUpdate();
                    }, 300));
                }
            });
        };
        
        // Try to add listeners now and retry periodically
        addKeyListener();
        setInterval(addKeyListener, 2000);
    }
    
    observeElement(selectors, callback) {
        const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
        
        const findAndObserve = () => {
            let element = null;
            
            // Try each selector until we find an element
            for (const selector of selectorArray) {
                element = document.querySelector(selector);
                if (element) {
                    console.log(`🎯 Found element with selector: ${selector}`);
                    break;
                }
            }
            
            if (!element) {
                // Retry after a short delay if element not found
                setTimeout(findAndObserve, 1000);
                return;
            }
            
            // Set up mutation observer
            const observer = new MutationObserver(callback);
            observer.observe(element, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
            
            // Fire callback once immediately
            callback();
            
            return observer;
        };
        
        findAndObserve();
    }
    
    sendEditorUpdate() {
        const editorSelectors = [
            ".monaco-editor .view-lines",  // Monaco editor content
            ".monaco-editor textarea",     // Monaco editor hidden textarea
            ".CodeMirror-code",           // CodeMirror content
            ".ace_content",               // ACE editor content
            ".view-lines.monaco-mouse-cursor-text",
            ".CodeMirror-lines",
            ".ace_text-input",
        ];
        
        let editorContent = '';
        
        // Try Monaco editor first (most common on LeetCode)
        const monacoEditor = document.querySelector('.monaco-editor');
        if (monacoEditor) {
            // Try to get content from Monaco's model
            try {
                // Look for the Monaco editor instance
                const editor = monacoEditor._monacoInstance || 
                              window.monaco?.editor?.getModels()?.[0];
                
                if (editor && editor.getValue) {
                    editorContent = editor.getValue();
                } else {
                    // Fallback to text extraction
                    const viewLines = monacoEditor.querySelector('.view-lines');
                    if (viewLines) {
                        editorContent = viewLines.innerText || viewLines.textContent || '';
                    }
                }
            } catch (e) {
                console.log('Monaco editor access failed, using fallback');
                const viewLines = monacoEditor.querySelector('.view-lines');
                if (viewLines) {
                    editorContent = viewLines.innerText || viewLines.textContent || '';
                }
            }
        }
        
        // If Monaco didn't work, try other editors
        if (!editorContent) {
            for (const selector of editorSelectors) {
                const editor = document.querySelector(selector);
                if (editor) {
                    editorContent = editor.innerText || editor.textContent || editor.value || '';
                    if (editorContent.trim()) break;
                }
            }
        }
        
        // Clean up the content
        editorContent = editorContent.trim();
        
        // Only send if content has changed and is meaningful
        if (editorContent && editorContent !== this.lastEditorContent && editorContent.length > 5) {
            this.lastEditorContent = editorContent;
            console.log('📝 Editor content changed, length:', editorContent.length);
            this.sendToBackend("editor_update", {
                type: "code",
                content: editorContent,
                timestamp: Date.now()
            });
        }
    }
    
    sendDescriptionUpdate() {
        const descriptionSelectors = [
            ".elfjS",
            "[data-track-load='description_content']",
            ".question-content",
            ".problem-description",
            ".content__u3I1 .question-content",
        ];
        
        let descriptionContent = '';
        
        // Try to get description from multiple possible locations
        for (const selector of descriptionSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                descriptionContent = Array.from(elements)
                    .map(el => el.innerText || el.textContent || '')
                    .filter(text => text.trim().length > 0)
                    .join('\n');
                
                if (descriptionContent.trim()) {
                    break;
                }
            }
        }
        
        // Only send if content has changed and is meaningful
        if (descriptionContent && descriptionContent !== this.lastDescriptionContent && descriptionContent.length > 50) {
            this.lastDescriptionContent = descriptionContent;
            this.sendToBackend("description_update", descriptionContent);
        }
    }
    
    observeNavigationChanges() {
        // Watch for URL changes (SPA navigation)
        let currentUrl = window.location.href;
        
        const checkForNavigationChanges = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                console.log("🔄 Navigation detected, reinitializing observers...");
                
                // Clear cached content to force refresh
                this.lastEditorContent = '';
                this.lastDescriptionContent = '';
                
                // Wait for page to load then refresh observers
                setTimeout(() => {
                    this.setupObservers();
                }, 2000);
            }
        };
        
        // Check for navigation changes periodically
        setInterval(checkForNavigationChanges, 2000);
        
        // Also listen for popstate events
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                this.setupObservers();
            }, 1000);
        });
    }
    
    getProblemTitle() {
        try {
            // Multiple selectors for problem title
            const titleSelectors = [
                '[data-cy="question-title"]',
                '.css-v3d350', 
                'h4[class*="text-lg"]',
                '.question-title h4',
                'h1[class*="text"]'
            ];
            
            for (const selector of titleSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    return element.textContent.trim();
                }
            }
            
            // Fallback to page title
            const pageTitle = document.title;
            if (pageTitle.includes('LeetCode')) {
                const match = pageTitle.match(/^\d+\.\s*(.+?)\s*-\s*LeetCode/);
                if (match) {
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error getting problem title:', error);
            return null;
        }
    }
    
    getTestCases() {
        try {
            const testCases = [];
            
            // Look for example test cases
            const exampleSelectors = [
                '.example',
                '[data-track-load="description_content"] pre',
                '.css-1h0uts4 pre',
                'strong:contains("Example") + pre'
            ];
            
            for (const selector of exampleSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element, index) => {
                    const text = element.textContent.trim();
                    if (text && (text.includes('Input:') || text.includes('Output:'))) {
                        testCases.push({
                            example: index + 1,
                            content: text
                        });
                    }
                });
            }
            
            return testCases.slice(0, 3); // Limit to first 3 examples
        } catch (error) {
            console.warn('Error getting test cases:', error);
            return [];
        }
    }
}

// Initialize the scraper
const leetSpeakScraper = new LeetSpeakScraper();

// Handle messages from extension (for manual refresh and context requests)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "refreshScrapers") {
        console.log("🔄 Manual refresh requested");
        leetSpeakScraper.lastEditorContent = '';
        leetSpeakScraper.lastDescriptionContent = '';
        leetSpeakScraper.setupObservers();
        sendResponse({ status: "refreshed" });
    } else if (message.action === "getLeetCodeData") {
        console.log("📊 LeetCode context requested");
        const data = leetSpeakScraper.getCurrentLeetCodeData();
        sendResponse(data);
    }
    return true; // Keep message channel open
});

// Export for debugging
window.leetSpeakScraper = leetSpeakScraper;