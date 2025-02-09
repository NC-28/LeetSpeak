let ws;

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        ws = new WebSocket("ws://localhost:8765");

        ws.onopen = () => console.log("WebSocket Connected");

        mediaRecorder.start(1000); // Capture chunks every second

        mediaRecorder.ondataavailable = async (event) => {
            const reader = new FileReader();
            reader.readAsDataURL(event.data);
            reader.onloadend = () => {
                const base64Audio = reader.result.split(",")[1]; // Extract Base64 content
                ws.send(base64Audio);
                console.log("Sent audio chunk");
            };
        };

        ws.onclose = () => console.log("WebSocket Closed");
    } catch (err) {
        console.error("Error accessing microphone:", err);
    }
}

// Start recording when called
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startRecording") {
        startRecording();
    }
});
