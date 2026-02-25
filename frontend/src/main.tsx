import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { SoundProvider } from "./contexts/SoundContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SoundProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SoundProvider>
  </StrictMode>
);
