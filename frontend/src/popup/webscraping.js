console.log("webscraping is running")

document.addEventListener("DOMContentLoaded", () => {
    chrome.runtime.sendMessage({ action: "getEditorContent" }, (response) => {
        if (response && response.content) {
            document.getElementById("editorContent").innerText = response.content;
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    chrome.runtime.sendMessage({ action: "getData" }, (response) => {
        if (response && response.data) {
            const outputDiv = document.getElementById("output");
            outputDiv.innerHTML = response.data.map(item => `<p>${item}</p>`).join("");
        }
    });
});
