import { createRoot } from "react-dom/client";
import Dashboard from "../src/components/Dashboard";
import { AppHeader } from "../src/components/AppHeader";
import { applyLook, getLook } from "../src/lib/look";

applyLook(getLook(), false);
createRoot(document.getElementById("app")!).render(
  <>
    <AppHeader />
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6"><Dashboard /></main>
  </>,
);
