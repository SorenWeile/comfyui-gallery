#!/usr/bin/env bash

# Default values
export COMFYUI_OUTPUT_DIR="${COMFYUI_OUTPUT_DIR:-/ComfyUI/output}"
export GALLERY_PORT="${GALLERY_PORT:-3002}"

echo "Starting ComfyUI Gallery..."
echo "Output directory: $COMFYUI_OUTPUT_DIR"
echo "Port: $GALLERY_PORT"

cd /comfyui-gallery
python3 app.py
