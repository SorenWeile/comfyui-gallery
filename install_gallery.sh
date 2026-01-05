#!/usr/bin/env bash
set -e

git clone --branch main --single-branch https://github.com/SorenWeile/comfyui-gallery.git /comfyui-gallery
cd /comfyui-gallery
git pull origin main
pip install --ignore-installed -r requirements.txt
