// Builds the Chrome Web Store version of the app into dist-extension/ (and zwinkit-extension.zip with --zip).
// The whole dashboard runs inside the extension: data in chrome.storage.local, order fetching in the service worker.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = (p) => path.join(root, "extension-app", p);
const out = path.join(root, "dist-extension");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "icons"), { recursive: true });

const common = {
  bundle: true, format: "iife", target: "chrome116", platform: "browser", logLevel: "warning", legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic", tsconfig: path.join(root, "tsconfig.json"),
  // the dashboard components talk to an Api; in the extension that is chrome.storage + the service worker, not a server
  alias: { "@/lib/api": src("api.ts") },
};
await Promise.all([
  build({ ...common, entryPoints: [src("background.js")], outfile: path.join(out, "background.js") }),
  build({ ...common, entryPoints: [src("dashboard.tsx")], outfile: path.join(out, "dashboard.js"), minify: true }),
  build({ ...common, entryPoints: [src("popup.ts")], outfile: path.join(out, "popup.js") }),
]);

execFileSync(path.join(root, "node_modules/.bin/tailwindcss"), ["-i", src("styles.css"), "-o", path.join(out, "dashboard.css"), "--minify"], { stdio: "inherit", cwd: root });
for (const f of ["manifest.json", "dashboard.html", "popup.html", "popup.css"]) fs.copyFileSync(src(f), path.join(out, f));
fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(root, "public/fonts"))) fs.copyFileSync(path.join(root, "public/fonts", f), path.join(out, "fonts", f));
fs.cpSync(path.join(root, "public/img"), path.join(out, "img"), { recursive: true });
for (const f of fs.readdirSync(src("icons"))) fs.copyFileSync(src(`icons/${f}`), path.join(out, "icons", f));

// Guard rails for store review: no remote code, no stray permissions, no dev-only leftovers.
const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
const problems = [];
if (manifest.key) problems.push("manifest has a dev 'key' (the store assigns the ID)");
if ((manifest.permissions ?? []).some((p) => !["scripting", "storage"].includes(p))) problems.push("unexpected permission");
if ((manifest.host_permissions ?? []).some((h) => /127\.0\.0\.1|localhost|<all_urls>|\*:\/\/\*\//.test(h))) problems.push("unexpected host permission");
for (const f of ["background.js", "dashboard.js", "popup.js"]) {
  const t = fs.readFileSync(path.join(out, f), "utf8");
  if (/https?:\/\/[^"'`\s]*\.(js)\b/.test(t) && /createElement\(["']script["']\)/.test(t) && /\.src\s*=\s*["']https?:/.test(t)) problems.push(`${f} may load remote script`);
}
const cssText = fs.readFileSync(path.join(out, "dashboard.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // comments (the Tailwind licence banner has a URL) are not requests
if (/https?:\/\//.test(cssText.replace(/http:\/\/www\.w3\.org\/[^"')]*/g, ""))) problems.push("dashboard.css references a remote URL (fonts and art must be bundled)");
for (const m of cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!m[1].startsWith("data:") && !fs.existsSync(path.join(out, m[1]))) problems.push(`dashboard.css points at a missing file: ${m[1]}`);
if (problems.length) { console.error("Build checks failed:\n- " + problems.join("\n- ")); process.exit(1); }

if (process.argv.includes("--zip")) {
  const zip = path.join(root, "zwinkit-extension.zip");
  fs.rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  console.log("Wrote", zip);
}
const kb = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + " KB";
console.log(`Built dist-extension/ (background ${kb("background.js")}, dashboard ${kb("dashboard.js")}, css ${kb("dashboard.css")})`);
