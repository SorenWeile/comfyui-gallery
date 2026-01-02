#!/usr/bin/env bash
set -e

git clone https://github.com/YOUR_USERNAME/comfyui-gallery.git /comfyui-gallery
cd /comfyui-gallery
git checkout tags/${GALLERY_VERSION}
pip3 install --no-cache-dir -r requirements.txt
