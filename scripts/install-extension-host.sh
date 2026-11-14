#!/bin/zsh
# One-time setup: lets the Zwinkit extension start the app when you click its icon.
# Writes a single small file into Chrome's NativeMessagingHosts folder; remove it to undo.
ROOT="${0:A:h:h}"
NAME="com.moneytracker.launcher"
DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
ID=$(python3 - "$ROOT/extension/manifest.json" <<'PY'
import sys, json, base64, hashlib
der = base64.b64decode(json.load(open(sys.argv[1]))["key"])
print("".join(chr(ord("a") + int(c, 16)) for c in hashlib.sha256(der).hexdigest()[:32]))
PY
) || { echo "Could not read the extension key from manifest.json"; exit 1; }
chmod +x "$ROOT/scripts/native-host.sh" "$ROOT/scripts/launcher.sh"
mkdir -p "$DIR"
cat > "$DIR/$NAME.json" <<JSON
{
  "name": "$NAME",
  "description": "Starts the local Zwinkit dashboard",
  "path": "$ROOT/scripts/native-host.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$ID/"]
}
JSON
echo "Installed $DIR/$NAME.json for extension $ID"
echo "Now reload the extension in chrome://extensions (if it was loaded before, remove it and load the extension folder again: its ID changed)."
