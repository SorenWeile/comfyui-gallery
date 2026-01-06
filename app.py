#!/usr/bin/env python3
import os
import mimetypes
import json
import zipfile
import io
import threading
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, send_file, jsonify, request
from werkzeug.utils import safe_join
from PIL import Image
from PIL.PngImagePlugin import PngInfo

app = Flask(__name__)

# Configuration
# Default to local 'preview' folder for development, or use environment variable
default_output_dir = os.path.join(os.path.dirname(__file__), 'preview') if os.path.exists(os.path.join(os.path.dirname(__file__), 'preview')) else '/ComfyUI/output'
OUTPUT_DIR = os.environ.get('COMFYUI_OUTPUT_DIR', default_output_dir)
GALLERY_PORT = int(os.environ.get('GALLERY_PORT', 3002))
THUMBNAIL_DIR = os.path.join(os.path.dirname(__file__), 'thumbnails')
THUMBNAIL_SIZE = (300, 300)

# Supported image formats
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}

# Cache for directory tree
directory_tree_cache = None
directory_tree_cache_time = None
CACHE_DURATION = 300  # Cache for 5 minutes

# Create thumbnail directory if it doesn't exist
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

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
    """Build a hierarchical directory tree structure recursively."""
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
                folder_node = {
                    'name': entry,
                    'path': rel_path,
                    'type': 'folder',
                    'children': []
                }
                # Recursively get subfolders
                folder_node['children'] = build_directory_tree(directory, rel_path)
                folders.append(folder_node)

        folders.sort(key=lambda x: x['name'].lower())
        tree.extend(folders)

    except Exception as e:
        print(f"Error building tree: {e}")

    return tree

def get_cached_directory_tree(directory):
    """Get directory tree with caching."""
    global directory_tree_cache, directory_tree_cache_time

    current_time = datetime.now().timestamp()

    # Check if cache is valid
    if (directory_tree_cache is not None and
        directory_tree_cache_time is not None and
        (current_time - directory_tree_cache_time) < CACHE_DURATION):
        return directory_tree_cache

    # Build new tree and cache it
    tree = build_directory_tree(directory)
    directory_tree_cache = tree
    directory_tree_cache_time = current_time

    return tree

def generate_thumbnail(image_path, thumbnail_path):
    """Generate a thumbnail for an image."""
    try:
        with Image.open(image_path) as img:
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background

            # Create thumbnail
            img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            img.save(thumbnail_path, 'JPEG', quality=85, optimize=True)
            return True
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return False

def get_thumbnail_path(image_path):
    """Get the path to a thumbnail, generating it if necessary."""
    # Create a unique filename based on the image path
    path_hash = str(abs(hash(image_path)))
    thumbnail_filename = f"{path_hash}.jpg"
    thumbnail_path = os.path.join(THUMBNAIL_DIR, thumbnail_filename)

    # Check if thumbnail exists and is newer than the original
    full_image_path = safe_join(OUTPUT_DIR, image_path)
    if not full_image_path or not os.path.exists(full_image_path):
        return None

    image_mtime = os.path.getmtime(full_image_path)

    if os.path.exists(thumbnail_path):
        thumb_mtime = os.path.getmtime(thumbnail_path)
        if thumb_mtime >= image_mtime:
            return thumbnail_path

    # Generate thumbnail
    if generate_thumbnail(full_image_path, thumbnail_path):
        return thumbnail_path

    return None

def generate_thumbnails_background(image_paths):
    """Background task to generate thumbnails."""
    generated = 0
    total = len(image_paths)

    for i, image_path in enumerate(image_paths):
        try:
            thumbnail_path = get_thumbnail_path(image_path)
            if thumbnail_path:
                generated += 1
            print(f"Generated thumbnail {i+1}/{total}: {image_path}")
        except Exception as e:
            print(f"Error generating thumbnail for {image_path}: {e}")

    print(f"Thumbnail generation completed: {generated}/{total} successful")

@app.route('/api/generate-thumbnails', methods=['POST'])
def generate_thumbnails_batch():
    """Pre-generate thumbnails for a list of images in background."""
    from flask import request
    try:
        data = request.get_json()
        image_paths = data.get('images', [])

        # Start background thread to generate thumbnails
        thread = threading.Thread(
            target=generate_thumbnails_background,
            args=(image_paths,),
            daemon=True
        )
        thread.start()

        # Return immediately
        return jsonify({
            'status': 'started',
            'total': len(image_paths),
            'message': 'Thumbnail generation started in background'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
    """API endpoint to get directory tree with caching."""
    tree = get_cached_directory_tree(OUTPUT_DIR)
    return jsonify(tree)

@app.route('/api/tree/refresh')
def api_tree_refresh():
    """Force refresh the directory tree cache."""
    global directory_tree_cache, directory_tree_cache_time
    directory_tree_cache = None
    directory_tree_cache_time = None
    tree = get_cached_directory_tree(OUTPUT_DIR)
    return jsonify({'status': 'refreshed', 'tree': tree})

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
    """Serve a thumbnail image, generating it if necessary."""
    try:
        thumbnail_path = get_thumbnail_path(filename)
        if thumbnail_path and os.path.exists(thumbnail_path):
            return send_file(thumbnail_path, mimetype='image/jpeg')
        # Fallback to full image if thumbnail generation fails
        return serve_image(filename)
    except Exception as e:
        print(f"Error serving thumbnail: {e}")
        return serve_image(filename)

@app.route('/api/download/<path:filename>')
def download_image(filename):
    """Download a single image file."""
    try:
        safe_path = safe_join(OUTPUT_DIR, filename)
        if safe_path and os.path.exists(safe_path):
            return send_file(safe_path, as_attachment=True, download_name=os.path.basename(filename))
        return "Image not found", 404
    except Exception as e:
        return str(e), 404

@app.route('/api/download-folder/<path:folder_path>')
def download_folder(folder_path=''):
    """Download a folder as a ZIP file."""
    try:
        safe_path = safe_join(OUTPUT_DIR, folder_path)
        if not safe_path or not os.path.exists(safe_path):
            return "Folder not found", 404

        # Create ZIP file in memory
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Walk through the folder and add all files
            for root, dirs, files in os.walk(safe_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, safe_path)
                    zf.write(file_path, arcname)

        memory_file.seek(0)

        # Generate a nice folder name for the ZIP
        folder_name = os.path.basename(folder_path) if folder_path else 'output'
        zip_filename = f"{folder_name}.zip"

        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
    except Exception as e:
        return str(e), 500

@app.route('/api/download-multiple', methods=['POST'])
def download_multiple():
    """Download multiple images as a ZIP file."""
    try:
        # Get the paths from the request
        paths_json = request.form.get('paths')
        print(f"Received paths_json: {paths_json}")

        if not paths_json:
            return "No paths provided", 400

        paths = json.loads(paths_json)
        print(f"Parsed paths: {paths}")

        if not paths or not isinstance(paths, list):
            return "Invalid paths", 400

        # Create ZIP file in memory
        memory_file = io.BytesIO()
        added_files = 0
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for path in paths:
                # Normalize path separators - convert all to forward slash first, then to os.sep
                normalized_path = path.replace('\\', '/').replace('/', os.sep)

                # Build the full path
                full_path = os.path.join(OUTPUT_DIR, normalized_path)
                full_path = os.path.normpath(full_path)

                print(f"OUTPUT_DIR: {OUTPUT_DIR}")
                print(f"Original path: {path}")
                print(f"Normalized: {normalized_path}")
                print(f"Full path: {full_path}")
                print(f"Exists: {os.path.exists(full_path)}")

                if os.path.exists(full_path):
                    # Use just the filename in the ZIP
                    arcname = os.path.basename(path)
                    zf.write(full_path, arcname)
                    added_files += 1
                    print(f"Added to ZIP: {arcname}")
                else:
                    print(f"File not found: {full_path}")

        print(f"Total files added to ZIP: {added_files}")

        memory_file.seek(0)

        # Generate filename
        zip_filename = f"images_{len(paths)}.zip"

        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
    except Exception as e:
        print(f"Error downloading multiple images: {e}")
        return str(e), 500

@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'output_dir': OUTPUT_DIR})

if __name__ == '__main__':
    print(f"Starting ComfyUI Gallery on port {GALLERY_PORT}")
    print(f"Serving images from: {OUTPUT_DIR}")
    app.run(host='0.0.0.0', port=GALLERY_PORT, debug=False)
