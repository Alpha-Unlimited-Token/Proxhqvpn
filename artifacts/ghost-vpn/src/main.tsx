// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { reportWebVitals } from "@/lib/performanceTelemetry";

reportWebVitals();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
