import { createRoot } from "react-dom/client";

import App from "./App.tsx";

const pixiContainer = document.getElementById("pixi-container");
if (!pixiContainer) {
    throw new Error("Pixi container not found");
}

createRoot(pixiContainer).render(<App />);
