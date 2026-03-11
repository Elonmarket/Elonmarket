import React from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.tsx";
import "./index.css";

// Polyfill Buffer for browser compatibility (required for Solana web3.js)
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

