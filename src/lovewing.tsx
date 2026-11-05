import { createRoot } from "react-dom/client";
import { FlightCanvas } from "./game/FlightCanvas";
import { Overlay } from "./game/Overlay";
import "./game/styles.css";

const mountNode = document.getElementById("root");

if (!mountNode) {
  throw new Error("The Lovewing game mount point is missing.");
}

createRoot(mountNode).render(
  <Overlay>
    <FlightCanvas />
  </Overlay>,
);
