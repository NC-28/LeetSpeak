const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
canvas.width = 400;
canvas.height = 400;

const audioCtx = new AudioContext();
const analyserInput = audioCtx.createAnalyser();
const analyserOutput = audioCtx.createAnalyser();
analyserInput.fftSize = 256;
analyserOutput.fftSize = 256;

const bufferLength = analyserInput.frequencyBinCount;
const dataArrayInput = new Uint8Array(bufferLength);
const dataArrayOutput = new Uint8Array(bufferLength);

// Capture Microphone Input
globalThis.navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyserInput);
});

// Function to Play Sound and Capture Output
document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("playSound");

    button.addEventListener("click", () => {
        fetch(chrome.runtime.getURL("sound.mp3"))
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                const gainNode = audioCtx.createGain();
                source.connect(gainNode);
                gainNode.connect(analyserOutput);
                analyserOutput.connect(audioCtx.destination);
                
                source.start();
            })
            .catch(error => console.error("Error playing sound:", error));
    });
});

// Drawing Function
function draw() {
    requestAnimationFrame(draw);
    analyserInput.getByteFrequencyData(dataArrayInput);
    analyserOutput.getByteFrequencyData(dataArrayOutput);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    
    // Draw input (blue) on outer part
    dataArrayInput.forEach((value, i) => {
        const angle = (i / bufferLength) * Math.PI * 2;
        const x1 = centerX + radius * Math.cos(angle);
        const y1 = centerY + radius * Math.sin(angle);
        const x2 = centerX + (radius + value / 4) * Math.cos(angle);
        const y2 = centerY + (radius + value / 4) * Math.sin(angle);
        
        ctx.strokeStyle = "blue";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    });
    
    // Draw output (red) in inner part
    dataArrayOutput.forEach((value, i) => {
        const angle = (i / bufferLength) * Math.PI * 2;
        const x1 = centerX + (radius - value / 4) * Math.cos(angle);
        const y1 = centerY + (radius - value / 4) * Math.sin(angle);
        
        ctx.fillStyle = "rgba(255, 0, 0, " + (value / 255) + ")";
        ctx.beginPath();
        ctx.arc(x1, y1, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}
draw();
