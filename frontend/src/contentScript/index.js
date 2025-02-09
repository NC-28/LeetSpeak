// function observeLeetCodeEditor() {
//     const targetClass = "view-lines monaco-mouse-cursor-text";
  
//     function getEditorContent() {
//       console.log("contentScript: getEditorContent")
//         const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
//         return editor ? editor.innerText : null;
//     }
  
//     function sendDataToBackground(content) {
//         chrome.runtime.sendMessage({ action: "updateEditorContent", content });
//     }
  
//     const observer = new MutationObserver(() => {
//         const content = getEditorContent();
//         if (content) {
//             sendDataToBackground(content);
//         }
//     });
  
//     function waitForElement() {
//         const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
//         if (editor) {
//             observer.observe(editor, { childList: true, subtree: true, characterData: true });
//             sendDataToBackground(editor.innerText); // Send initial data
//         } else {
//             setTimeout(waitForElement, 500); // Retry after 500ms
//         }
//     }
  
//     waitForElement();
//   }
  
//   observeLeetCodeEditor();
  
//   // Function to extract the required data
//   function extractData() {
//       const targetElements = document.querySelectorAll('.elfjS');
//       let scrapedData = [];
  
//       targetElements.forEach(element => {
//           scrapedData.push(element.innerText.trim());
//       });
  
//       if (scrapedData.length > 0) {
//           // Send data to background script or store in local storage
//           chrome.runtime.sendMessage({ action: "sendData", data: scrapedData });
//       }
//   }
  
//   // Setup MutationObserver to detect changes in the DOM
//   const observer = new MutationObserver((mutations) => {
//       mutations.forEach(mutation => {
//           if (mutation.type === 'childList' || mutation.type === 'subtree') {
//               extractData();
//           }
//       });
//   });
  
//   // Select the parent node that wraps dynamic content
//   const targetNode = document.body; // Adjust if needed
  
//   const config = { childList: true, subtree: true };
//   observer.observe(targetNode, config);
  
//   // Initial extraction in case data is already loaded
//   extractData();

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
