# ComfyUI Gallery

A lightweight Flask-based gallery viewer for ComfyUI outputs.

## Features

- 📸 Grid view of all generated images
- 🔍 Lightbox view for full-size images
- ⌨️ Keyboard navigation (arrow keys, ESC)
- 🔄 Real-time refresh
- 📅 Sorted by modification date (newest first)
- 🎨 Dark theme
- 🚀 Lightweight and fast

## Installation

### As part of Docker image:

Add to your `Dockerfile`:

```dockerfile
# Install Gallery
ARG GALLERY_VERSION=v1.0.0
ENV GALLERY_VERSION=${GALLERY_VERSION}
COPY --chmod=755 install_gallery.sh /install_gallery.sh
RUN /install_gallery.sh && \
    rm /install_gallery.sh
```

### Standalone:

```bash
git clone https://github.com/YOUR_USERNAME/comfyui-gallery.git
cd comfyui-gallery
pip install -r requirements.txt
python app.py
```

## Usage

### Environment Variables

| Variable             | Description                    | Default          |
|----------------------|--------------------------------|------------------|
| COMFYUI_OUTPUT_DIR   | Path to ComfyUI output folder  | /ComfyUI/output  |
| GALLERY_PORT         | Port to run the gallery on     | 3002             |

### Running

```bash
# Using the start script
./start.sh

# Or directly
python app.py

# Or with custom settings
COMFYUI_OUTPUT_DIR=/path/to/output GALLERY_PORT=8080 python app.py
```

### Accessing

Open your browser and navigate to:
```
http://localhost:3002
```

## API Endpoints

- `GET /` - Main gallery page
- `GET /api/images` - JSON list of all images
- `GET /image/<path>` - Serve full-size image
- `GET /thumbnail/<path>` - Serve thumbnail (currently same as full image)
- `GET /health` - Health check endpoint

## Keyboard Shortcuts

- `←` / `→` - Navigate between images in lightbox
- `ESC` - Close lightbox

## Integration with Application Manager

To add the gallery to your Application Manager config:

```json
{
  "name": "Gallery",
  "port": 3002,
  "proxy_port": 0,
  "command": "/comfyui-gallery/start.sh",
  "autolaunch": false,
  "env": {
    "COMFYUI_OUTPUT_DIR": "/ComfyUI/output",
    "GALLERY_PORT": "3002"
  }
}
```

## License

MIT

## Contributing

Pull requests welcome!
