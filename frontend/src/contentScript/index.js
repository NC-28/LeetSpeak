function observeLeetCodeEditor() {
    const targetClass = "view-lines monaco-mouse-cursor-text";
  
    function getEditorContent() {
      console.log("contentScript: getEditorContent")
        const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
        return editor ? editor.innerText : null;
    }
  
    function sendDataToBackground(content) {
        chrome.runtime.sendMessage({ action: "updateEditorContent", content });
    }
  
    const observer = new MutationObserver(() => {
        const content = getEditorContent();
        if (content) {
            sendDataToBackground(content);
        }
    });
  
    function waitForElement() {
        const editor = document.querySelector(`.${targetClass.replace(/ /g, ".")}`);
        if (editor) {
            observer.observe(editor, { childList: true, subtree: true, characterData: true });
            sendDataToBackground(editor.innerText); // Send initial data
        } else {
            setTimeout(waitForElement, 500); // Retry after 500ms
        }
    }
  
    waitForElement();
  }
  
  observeLeetCodeEditor();
  
  // Function to extract the required data
  function extractData() {
      const targetElements = document.querySelectorAll('.elfjS');
      let scrapedData = [];
  
      targetElements.forEach(element => {
          scrapedData.push(element.innerText.trim());
      });
  
      if (scrapedData.length > 0) {
          // Send data to background script or store in local storage
          chrome.runtime.sendMessage({ action: "sendData", data: scrapedData });
      }
  }
  
  // Setup MutationObserver to detect changes in the DOM
  const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
          if (mutation.type === 'childList' || mutation.type === 'subtree') {
              extractData();
          }
      });
  });
  
  // Select the parent node that wraps dynamic content
  const targetNode = document.body; // Adjust if needed
  
  const config = { childList: true, subtree: true };
  observer.observe(targetNode, config);
  
  // Initial extraction in case data is already loaded
  extractData();