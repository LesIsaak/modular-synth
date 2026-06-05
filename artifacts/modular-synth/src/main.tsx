import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener('error', (ev) => {
  console.error('[Synth] Uncaught error:', ev.error ?? ev.message, ev.filename, ev.lineno);
});
window.addEventListener('unhandledrejection', (ev) => {
  console.error('[Synth] Unhandled promise rejection:', ev.reason);
  ev.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
