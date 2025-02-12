// Establish the WebSocket connection.
const socket = new WebSocket("ws://localhost:8080");
// Make sure binary messages are received as ArrayBuffers.
socket.binaryType = "arraybuffer";

// Create a single AudioContext.
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// A queue to hold decoded audio buffers.
const audioQueue = [];
let isPlaying = false;

export function startStreamingAudio() {
    // Capture audio from the user's microphone.
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Send the audio Blob to the backend.
                socket.send(event.data);
            }
        };
        // Record in 0.1-second chunks.
        mediaRecorder.start(100);
    });

    // When processed audio is received from the backend.
    socket.onmessage = async (event) => {
        try {
            // Decode the received ArrayBuffer into an AudioBuffer.
            const audioBuffer = await audioContext.decodeAudioData(event.data);
            // Add the decoded buffer to the queue.
            audioQueue.push(audioBuffer);
            // Try to play the queue.
            playQueue();
        } catch (error) {
            console.error("Error decoding audio data:", error);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
        console.log("WebSocket connection closed.");
    };
}

/**
 * Plays the next audio buffer in the queue if nothing is currently playing.
 */
function playQueue() {
    // If already playing or the queue is empty, do nothing.
    if (isPlaying || audioQueue.length === 0) return;

    // Set the flag so we don't start overlapping playback.
    isPlaying = true;
    // Get the next audio buffer.
    const buffer = audioQueue.shift();
    // Create a buffer source node.
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    // Start playback immediately.
    source.start();
    console.log("Playing a packet of duration:", buffer.duration.toFixed(2), "seconds");

    // When playback finishes, reset the flag and try to play the next packet.
    source.onended = () => {
        isPlaying = false;
        playQueue();
    };
}
