// C:\HDUD_DATA\hdud-web-app\src\main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// ✅ Garanta que este CSS está sendo importado aqui (fonte de verdade dos tokens)
import "./styles/global.css";

// ✅ Provider de paletas
import { HdudThemeProvider } from "./theme/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HdudThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HdudThemeProvider>
  </React.StrictMode>
);