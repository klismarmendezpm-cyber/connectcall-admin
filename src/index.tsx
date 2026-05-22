import "./index.css";
import React from "react";
import { render } from "react-dom";
import { App } from "./App";
import { initializeTheme } from "./lib/appSettings";
import { registerServiceWorker } from "./lib/pwa";

initializeTheme();
registerServiceWorker();
render(<App />, document.getElementById("root"));
