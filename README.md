# ComfyUI Gallery

A modern, feature-rich Flask-based gallery viewer for ComfyUI outputs with dual view modes and advanced navigation.

## Screenshots

### Detail View
![Detail View - Browse images with large preview, thumbnail strip, and metadata panel](docs/detail-view.png)

### Grid View with Multiselect
![Grid View - Select multiple images for batch download](docs/grid-view.png)

### Folder Navigation
![Folder Tree - Hierarchical navigation with context menus](docs/folder-navigation.png)

## Features

### 🎨 Dual View Modes
- **Detail View**: Large image preview with horizontal thumbnail strip
- **Grid View**: Responsive grid layout for quick overview and batch operations

### 📁 Folder Navigation
- Hierarchical folder tree with expandable/collapsible structure
- Breadcrumb navigation
- Right-click context menus on folders and images
- Folder download as ZIP

### 🖼️ Image Management
- **Multiselect**: Select multiple images with click, Ctrl+Click, or Shift+Click
- **Batch Download**: Download selected images as ZIP file
- **Single Image Actions**: Download, view metadata, copy path/workflow
- Lazy-loaded thumbnails with background generation
- Image information bar (name, size, modified date)

### 🔍 Detail View Features
- Pan and zoom controls
- Fit-to-screen mode
- Keyboard navigation (arrow keys)
- ComfyUI metadata viewer (prompt, workflow, parameters)

### 🎯 Performance
- Background thumbnail generation with caching
- Directory tree caching (5-minute duration)
- Optimized for large image collections
- Native browser lazy loading

### 🎨 UI/UX
- Modern dark theme
- Minimal SVG icons
- Responsive grid layout
- Custom styled scrollbars
- Smooth transitions and animations

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

### Image Serving
- `GET /` - Main gallery page
- `GET /image/<path>` - Serve full-size image
- `GET /thumbnail/<path>` - Serve optimized thumbnail (300x300 JPEG)

### Data & Metadata
- `GET /api/browse` - Get root folder contents
- `GET /api/browse/<path>` - Get folder contents at path
- `GET /api/metadata/<path>` - Get ComfyUI PNG metadata (prompt, workflow)
- `GET /api/tree` - Get complete directory tree structure
- `POST /api/generate-thumbnails` - Pre-generate thumbnails in background
- `GET /health` - Health check endpoint

### Downloads
- `GET /api/download/<path>` - Download single image
- `GET /api/download-folder/<path>` - Download folder as ZIP
- `POST /api/download-multiple` - Download multiple selected images as ZIP

## Usage Guide

### View Modes

**Detail View** (Default)
- Browse images with large preview and thumbnail strip
- Pan and zoom images
- View full metadata
- Navigate with arrow keys

**Grid View**
- Switch using "Grid View" button in header
- Click images to select/deselect
- Shift+Click for range selection
- Use "Download Selected" to batch download

### Context Menu Actions

**Right-click on Images:**
- Open in Detail View
- Download Image
- Copy Image Path
- Copy Metadata as JSON
- Copy Workflow

**Right-click on Folders:**
- Open Folder
- Download Folder (as ZIP)

### Keyboard Shortcuts

**Detail View:**
- `←` / `→` - Navigate between images
- Mouse drag - Pan image
- Scroll wheel - Zoom in/out

**Grid View:**
- Click - Toggle selection
- Ctrl/Cmd + Click - Toggle individual selection
- Shift + Click - Range selection

## Project Structure

```
comfyui-gallery/
├── app.py                  # Flask backend server
├── templates/
│   └── gallery.html        # Single-page application (HTML + CSS + JS)
├── thumbnails/             # Auto-generated thumbnail cache (gitignored)
├── requirements.txt        # Python dependencies
├── start.sh               # Startup script
├── install_gallery.sh     # Installation script for Docker
└── README.md              # This file
```

## Technical Details

### Backend (Flask)
- **Thumbnail Generation**: PIL/Pillow for optimized 300x300 JPEG thumbnails
- **Caching**: In-memory directory tree cache (5-minute TTL)
- **Threading**: Background thumbnail generation to prevent blocking
- **ZIP Creation**: In-memory ZIP file generation for downloads

### Frontend (Vanilla JavaScript)
- **No Dependencies**: Pure HTML/CSS/JavaScript
- **Responsive Grid**: CSS Grid with auto-fill columns
- **State Management**: Simple JavaScript state for view modes and selections
- **SVG Icons**: Minimal Feather-style icons

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

## Development

### Running in Development Mode

```bash
# Install dependencies
pip install -r requirements.txt

# Run with debug mode
FLASK_ENV=development python app.py
```

### Adding New Features

The application is structured as a single-page application with all frontend code in `gallery.html`. Backend endpoints are defined in `app.py`.

## License

MIT

## Contributing

Pull requests welcome! Please ensure:
- Code follows existing style
- No external dependencies added without discussion
- Test with multiple browsers
- Update README for new features
