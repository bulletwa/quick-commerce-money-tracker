import { createRoot } from "react-dom/client";
import Dashboard from "../src/components/Dashboard";
import { applyLook, getLook } from "../src/lib/look";

applyLook(getLook(), false);
createRoot(document.getElementById("app")!).render(<Dashboard />);
