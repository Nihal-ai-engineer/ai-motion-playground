#!/bin/zsh
cd /Users/nihaljanjua/chitprojects/ai-motion-playground || exit 1
if curl -fsS http://127.0.0.1:8765/ 2>/dev/null | grep -q 'Formlab'; then
  open http://127.0.0.1:8765
else
  python3 fitness.py
fi
