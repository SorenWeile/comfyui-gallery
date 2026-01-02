#!/usr/bin/env python3
import os
import mimetypes
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, send_file, jsonify
from werkzeug.utils import safe_join

app = Flask(__name__)

# Configuration
OUTPUT_DIR = os.environ.get('COMFYUI_OUTPUT_DIR', '/ComfyUI/output')
GALLERY_PORT = int(os.environ.get('GALLERY_PORT', 3002))

# Supported image formats
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}

def get_images(directory):
    """Recursively get all images from the output directory."""
    images = []
    
    if not os.path.exists(directory):
        return images
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if Path(file).suffix.lower() in IMAGE_EXTENSIONS:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, directory)
                
                stat = os.stat(full_path)
                images.append({
                    'path': rel_path,
                    'name': file,
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'modified_str': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                })
    
    # Sort by modification time (newest first)
    images.sort(key=lambda x: x['modified'], reverse=True)
    return images

@app.route('/')
def index():
    """Main gallery page."""
    return render_template('gallery.html')

@app.route('/api/images')
def api_images():
    """API endpoint to get list of images."""
    images = get_images(OUTPUT_DIR)
    return jsonify(images)

@app.route('/image/<path:filename>')
def serve_image(filename):
    """Serve an image file."""
    try:
        safe_path = safe_join(OUTPUT_DIR, filename)
        if safe_path and os.path.exists(safe_path):
            return send_file(safe_path)
        return "Image not found", 404
    except Exception as e:
        return str(e), 404

@app.route('/thumbnail/<path:filename>')
def serve_thumbnail(filename):
    """Serve thumbnail (for now, just serve the full image)."""
    return serve_image(filename)

@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'output_dir': OUTPUT_DIR})

if __name__ == '__main__':
    print(f"Starting ComfyUI Gallery on port {GALLERY_PORT}")
    print(f"Serving images from: {OUTPUT_DIR}")
    app.run(host='0.0.0.0', port=GALLERY_PORT, debug=False)
