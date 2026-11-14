// Chrome native-messaging host: lets the extension popup start the Money Tracker server.
// Protocol: 4-byte little-endian length + JSON, on stdin/stdout. It only understands {cmd:"start"} and {cmd:"status"}.
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");

function reply(obj) {
  const b = Buffer.from(JSON.stringify(obj));
  const h = Buffer.alloc(4); h.writeUInt32LE(b.length);
  process.stdout.write(Buffer.concat([h, b]));
}
function isUp() {
  return new Promise((res) => {
    const r = http.get({ host: "127.0.0.1", port: PORT, path: "/api/orders", timeout: 3000 }, (x) => {
      let d = ""; x.on("data", (c) => { if (d.length < 64) d += c; }); x.on("end", () => res(d.includes('"orders"')));
    });
    r.on("error", () => res(false)); r.on("timeout", () => { r.destroy(); res(false); });
  });
}

async function handle(msg) {
  if (msg && msg.cmd === "status") return reply({ ok: true, running: await isUp() });
  if (!msg || msg.cmd !== "start") return reply({ ok: false, error: "unknown command" });
  if (await isUp()) return reply({ ok: true, running: true, started: false });
  // Detached so the server outlives this short-lived host; the launcher stops it itself once the dashboard has been closed.
  const child = spawn("/bin/zsh", [path.join(ROOT, "scripts/launcher.sh")], { detached: true, stdio: "ignore", env: { ...process.env, NO_OPEN: "1" } });
  child.unref();
  reply({ ok: true, running: false, started: true });
}

const chunks = [];
process.stdin.on("data", (c) => {
  chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (buf.length < 4) return;
  const len = buf.readUInt32LE(0);
  if (len > 4096) return process.exit(1);
  if (buf.length < 4 + len) return;
  let msg; try { msg = JSON.parse(buf.subarray(4, 4 + len).toString()); } catch { msg = null; }
  process.stdin.pause();
  handle(msg).finally(() => setTimeout(() => process.exit(0), 50));
});
