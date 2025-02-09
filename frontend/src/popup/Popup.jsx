// Need to put logic in Popup.jsx or other DOM accessible place since the
import React, { useState } from "react";
import { startStreamingAudio } from "../permissions/requestPermission.js"

export const Popup = () => {
  return (
    <div>
      <h2>Mic Access</h2>
      <button onClick={startStreamingAudio}>Start Recording</button>
      <button>Stop Recording</button>
    </div>
  );
};
