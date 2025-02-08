/**
 * requestPermission.js
 * Requests user permission for microphone access.
 * @returns {Promise<void>} A Promise that resolves when permission is granted or rejects with an error.
 */
export function getUserPermission() {
  return new Promise((resolve, reject) => {
    // Using navigator.mediaDevices.getUserMedia to request microphone access
    navigator.mediaDevices
      .getUserMedia({audio: true})
      .then((stream) => {
        console.log("Microphone access granted");
        // go to .next() of where this is called.
        resolve(stream);
      })
      .catch((error) => {
        console.error("Error requesting microphone permission", error);
        reject(error);
      });
  });
}
