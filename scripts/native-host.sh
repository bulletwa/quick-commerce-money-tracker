#!/bin/zsh
# Chrome starts this with a bare environment, so find Node the same way launcher.sh does.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
for d in "$HOME"/.nvm/versions/node/*/bin(N); do PATH="$d:$PATH"; done
exec node "${0:A:h}/native-host.js"
