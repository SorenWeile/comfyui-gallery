#!/usr/bin/env python3
import os
import mimetypes
import json
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, send_file, jsonify
from werkzeug.utils import safe_join
from PIL import Image
from PIL.PngImagePlugin import PngInfo

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

def get_items(directory, current_path=''):
    """Get folders and images in the current directory (non-recursive)."""
    items = {'folders': [], 'images': []}

    full_path = safe_join(directory, current_path) if current_path else directory

    if not full_path or not os.path.exists(full_path):
        return items

    # Get folders
    try:
        entries = os.listdir(full_path)
        for entry in entries:
            entry_path = os.path.join(full_path, entry)
            rel_path = os.path.join(current_path, entry) if current_path else entry

            if os.path.isdir(entry_path):
                stat = os.stat(entry_path)
                items['folders'].append({
                    'path': rel_path,
                    'name': entry,
                    'modified': stat.st_mtime,
                    'modified_str': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                })
            elif os.path.isfile(entry_path) and Path(entry).suffix.lower() in IMAGE_EXTENSIONS:
                stat = os.stat(entry_path)
                items['images'].append({
                    'path': rel_path,
                    'name': entry,
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'modified_str': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                })
    except Exception as e:
        print(f"Error reading directory: {e}")

    # Sort folders and images by name
    items['folders'].sort(key=lambda x: x['name'].lower())
    items['images'].sort(key=lambda x: x['modified'], reverse=True)

    return items

def get_image_metadata(file_path):
    """Extract metadata from an image file."""
    metadata = {
        'format': None,
        'size': {'width': 0, 'height': 0},
        'mode': None,
        'file_size': 0,
        'exif': {},
        'prompt': None,
        'workflow': None,
        'parameters': {}
    }

    try:
        if not os.path.exists(file_path):
            return metadata

        # Get file size
        metadata['file_size'] = os.path.getsize(file_path)

        # Open image and get basic info
        with Image.open(file_path) as img:
            metadata['format'] = img.format
            metadata['size'] = {'width': img.width, 'height': img.height}
            metadata['mode'] = img.mode

            # Get PNG metadata (ComfyUI stores workflow here)
            if img.format == 'PNG':
                png_info = img.info
                if 'prompt' in png_info:
                    try:
                        metadata['prompt'] = json.loads(png_info['prompt'])
                    except:
                        metadata['prompt'] = png_info['prompt']

                if 'workflow' in png_info:
                    try:
                        metadata['workflow'] = json.loads(png_info['workflow'])
                    except:
                        metadata['workflow'] = png_info['workflow']

                # Store all PNG text chunks
                for key, value in png_info.items():
                    if key not in ['prompt', 'workflow']:
                        metadata['parameters'][key] = value

            # Get EXIF data
            if hasattr(img, '_getexif') and img._getexif():
                exif_data = img._getexif()
                if exif_data:
                    metadata['exif'] = {str(k): str(v) for k, v in exif_data.items()}

    except Exception as e:
        metadata['error'] = str(e)

    return metadata

def build_directory_tree(directory, current_path=''):
    """Build a hierarchical directory tree structure."""
    tree = []

    full_path = safe_join(directory, current_path) if current_path else directory
    if not full_path or not os.path.exists(full_path):
        return tree

    try:
        entries = os.listdir(full_path)
        folders = []

        for entry in entries:
            entry_path = os.path.join(full_path, entry)
            if os.path.isdir(entry_path):
                rel_path = os.path.join(current_path, entry) if current_path else entry
                folders.append({
                    'name': entry,
                    'path': rel_path,
                    'type': 'folder'
                })

        folders.sort(key=lambda x: x['name'].lower())
        tree.extend(folders)

    except Exception as e:
        print(f"Error building tree: {e}")

    return tree

@app.route('/')
def index():
    """Main gallery page."""
    return render_template('gallery.html')

@app.route('/api/images')
def api_images():
    """API endpoint to get list of images."""
    images = get_images(OUTPUT_DIR)
    return jsonify(images)

@app.route('/api/browse')
@app.route('/api/browse/<path:folder_path>')
def api_browse(folder_path=''):
    """API endpoint to browse folders and images."""
    items = get_items(OUTPUT_DIR, folder_path)
    return jsonify({
        'current_path': folder_path,
        'folders': items['folders'],
        'images': items['images']
    })

@app.route('/api/tree')
@app.route('/api/tree/<path:folder_path>')
def api_tree(folder_path=''):
    """API endpoint to get directory tree."""
    tree = build_directory_tree(OUTPUT_DIR, folder_path)
    return jsonify(tree)

@app.route('/api/metadata/<path:image_path>')
def api_metadata(image_path):
    """API endpoint to get image metadata."""
    safe_path = safe_join(OUTPUT_DIR, image_path)
    if not safe_path or not os.path.exists(safe_path):
        return jsonify({'error': 'Image not found'}), 404

    metadata = get_image_metadata(safe_path)
    return jsonify(metadata)

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
