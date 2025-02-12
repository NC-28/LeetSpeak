class AudioVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.center = this.canvas.width / 2;
        this.radius = this.canvas.width * 0.4;

        // Audio context setup
        this.audioContext = new AudioContext();
        this.inputAnalyser = this.audioContext.createAnalyser();

        // Configure analyser
        this.inputAnalyser.fftSize = 1024;
        this.bufferLength = this.inputAnalyser.frequencyBinCount;

        // Create data arrays
        this.inputData = new Uint8Array(this.bufferLength);
        this.previousInputData = new Float32Array(this.bufferLength);
        this.smoothingFactor = 0.3;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    // Method to connect input audio source
    async connectInput(stream) {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.inputAnalyser);
    }

    // Smooth the data for more fluid animation
    smoothData(current, previous) {
        for (let i = 0; i < this.bufferLength; i++) {
            previous[i] = previous[i] * (1 - this.smoothingFactor) +
                          current[i] * this.smoothingFactor;
        }
        return previous;
    }

    // Draw the circular visualizer
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get audio data
        this.inputAnalyser.getByteFrequencyData(this.inputData);

        // Smooth the data
        const smoothedInputData = this.smoothData(this.inputData, this.previousInputData);

        // Draw input audio (green)
        this.drawCircle(smoothedInputData, 'rgba(0, 255, 0, 0.8)', 1);
    }

    drawCircle(data, color, scale) {
        const bars = 180;
        const step = Math.PI * 2 / bars;

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;

        for (let i = 0; i < bars; i++) {
            const value = data[i % this.bufferLength] * scale;
            const angle = step * i;

            const innerRadius = this.radius - (value / 2);
            const outerRadius = this.radius + (value / 2);

            const startX = this.center + Math.cos(angle) * innerRadius;
            const startY = this.center + Math.sin(angle) * innerRadius;
            const endX = this.center + Math.cos(angle) * outerRadius;
            const endY = this.center + Math.sin(angle) * outerRadius;

            this.ctx.lineWidth = 2;
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
        }

        this.ctx.stroke();
    }

    animate() {
        this.draw();
        requestAnimationFrame(this.animate);
    }
}

// Initialize visualizer
const visualizer = new AudioVisualizer();

// Example usage for input (microphone)
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => visualizer.connectInput(stream))
    .catch(err => console.error('Error accessing microphone:', err));


class AudioVisualizerOut {
    constructor() {
        this.canvas = document.getElementById('visualizerOut');
        this.ctx = this.canvas.getContext('2d');
        this.center = this.canvas.width / 2;
        this.radius = this.canvas.width * 0.4;

        // Audio context setup
        this.audioContext = new AudioContext();
        this.outputAnalyser = this.audioContext.createAnalyser();

        // Configure analyser
        this.outputAnalyser.fftSize = 1024;
        this.bufferLength = this.outputAnalyser.frequencyBinCount;

        // Create data arrays
        this.outputData = new Uint8Array(this.bufferLength);
        this.previousOutputData = new Float32Array(this.bufferLength);
        this.smoothingFactor = 0.3;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    // Method to connect output audio source
    connectOutput(audioElement) {
        const source = this.audioContext.createMediaElementSource(audioElement);
        source.connect(this.outputAnalyser);
        source.connect(this.audioContext.destination);
    }

    // Smooth the data for more fluid animation
    smoothData(current, previous) {
        for (let i = 0; i < this.bufferLength; i++) {
            previous[i] = previous[i] * (1 - this.smoothingFactor) +
                          current[i] * this.smoothingFactor;
        }
        return previous;
    }

    // Draw the circular visualizer
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get audio data
        this.outputAnalyser.getByteFrequencyData(this.outputData);

        // Smooth the data
        const smoothedOutputData = this.smoothData(this.outputData, this.previousOutputData);

        // Draw output audio (red)
        this.drawCircle(smoothedOutputData, 'rgba(255, 0, 0, 0.8)', 0.8);
    }

    drawCircle(data, color, scale) {
        const bars = 180;
        const step = Math.PI * 2 / bars;

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;

        for (let i = 0; i < bars; i++) {
            const value = data[i % this.bufferLength] * scale;
            const angle = step * i;

            const innerRadius = this.radius - (value / 2);
            const outerRadius = this.radius + (value / 2);

            const startX = this.center + Math.cos(angle) * innerRadius;
            const startY = this.center + Math.sin(angle) * innerRadius;
            const endX = this.center + Math.cos(angle) * outerRadius;
            const endY = this.center + Math.sin(angle) * outerRadius;

            this.ctx.lineWidth = 2;
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
        }

        this.ctx.stroke();
    }

    animate() {
        this.draw();
        requestAnimationFrame(this.animate);
    }
}

// Initialize visualizer
const visualizerOut = new AudioVisualizerOut();

// document.getElementById("playSound").addEventListener("click", () => {
//     const audio = new Audio(chrome.runtime.getURL("sound.mp3"));
//
//     // Ensure the audio plays even if it's blocked by autoplay policies
//     audio.play().catch(error => {
//         console.error("Playback error:", error);
//     });
//
//     // Connect audio to visualizer
//     visualizerOut.connectOutput(audio);
// });
