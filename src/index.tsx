import "./index.css";
import React from "react";
import { render } from "react-dom";
import { App } from "./App";
import { initializeTheme } from "./lib/appSettings";

initializeTheme();
render(<App />, document.getElementById("root"));
