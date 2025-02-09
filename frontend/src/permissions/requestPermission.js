const socket = new WebSocket("ws://localhost:8080");


export function startStreamingAudio() {
// Capture audio and convert to Blob
    navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                socket.send(event.data);  // Sending Blob
            }
        };
 
        mediaRecorder.start(1000); // 1-second chunks
    });

    socket.onmessage = (event) => {
        console.log("Received from server:", event.data);
    };
}