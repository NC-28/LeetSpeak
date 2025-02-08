// Need to put logic in Popup.jsx or other DOM accessible place since the
import React, { useState } from "react";
import { getUserPermission } from "../permissions/requestPermission.js"

export const Popup = () => {
  return (
    <div>
      <h2>Mic Access</h2>
      <button onClick={getUserPermission}>Start Recording</button>
      <button>Stop Recording</button>
    </div>
  );
};
