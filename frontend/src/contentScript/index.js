const socket = new WebSocket("ws://localhost:8765"); // Connect to Python WebSocket Server

// Function to send data over WebSocket
function sendToServer(type, content) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, content }));
    } else {
        console.error("WebSocket is not open. Retrying...");
        setTimeout(() => sendToServer(type, content), 500);
    }
}

// Observe the LeetCode editor
function observeLeetCodeEditor() {
    const targetClass = "view-lines monaco-mouse-cursor-text";

    function getEditorContent() {
        const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
        return editor ? editor.innerText : null;
    }

    const observer = new MutationObserver(() => {
        const content = getEditorContent();
        if (content) {
            sendToServer("editor_update", content);
        }
    });

    function waitForElement() {
        const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
        if (editor) {
            observer.observe(editor, { childList: true, subtree: true, characterData: true });
            sendToServer("editor_update", editor.innerText); // Send initial data
        } else {
            setTimeout(waitForElement, 500);
        }
    }

    waitForElement();
}

observeLeetCodeEditor();

// Observe the problem description
function observeProblemDescription() {
    const targetClass = "elfjS"; // Problem description class

    function getDescriptionContent() {
        const descriptionElements = document.querySelectorAll(`.${targetClass.replace(/ /g, ".")}`);
        return Array.from(descriptionElements).map(el => el.innerText.trim()).join("\n");
    }

    const observer = new MutationObserver(() => {
        const content = getDescriptionContent();
        if (content) {
            sendToServer("description_update", content);
        }
    });

    function waitForDescription() {
        const description = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
        if (description) {
            observer.observe(description, { childList: true, subtree: true, characterData: true });
            sendToServer("description_update", getDescriptionContent()); // Send initial data
        } else {
            setTimeout(waitForDescription, 500);
        }
    }

    waitForDescription();
}

observeProblemDescription();
