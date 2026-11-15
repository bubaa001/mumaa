import { createRoot } from "react-dom/client";
import { Compass } from "./Compass";

const mountNode = document.getElementById("compass-root");

if (mountNode) {
  createRoot(mountNode).render(<Compass />);
}
