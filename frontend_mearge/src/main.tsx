import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { AuthProvider } from "./app/auth";
import "./app/styles.css";

const rootNode = document.getElementById("root");

if (!rootNode) {
  throw new Error("Root node not found");
}

createRoot(rootNode).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
