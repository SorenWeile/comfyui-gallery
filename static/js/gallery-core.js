// Gallery Core Logic, API Calls, Event Handlers, and Initialization

// API Functions
async function loadDirectoryTree() {
    try {
        const response = await fetch('/api/tree');
        return await response.json();
    } catch (error) {
        console.error('Error loading tree:', error);
        return [];
    }
}

async function buildTree() {
    const treeView = document.getElementById('treeView');
    treeView.innerHTML = '<div style="padding: 16px; color: #999;">Loading folders...</div>';

    const rootItem = document.createElement('div');
    rootItem.className = currentPath === '' ? 'tree-item active' : 'tree-item';
    rootItem.dataset.path = '';
    rootItem.onclick = () => navigateToFolder('');
    rootItem.innerHTML = `
        <span class="tree-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
        </span>
        <span class="tree-item-name">Root</span>
    `;

    const folders = await loadDirectoryTree();

    treeView.innerHTML = '';
    treeView.appendChild(rootItem);
    buildTreeLevel(treeView, folders, 0);
}

async function loadImages() {
    const stats = document.getElementById('stats');

    try {
        // Show loading indicator
        stats.textContent = 'Loading...';
        showLoadingIndicator();

        const url = currentPath ? `/api/browse/${currentPath}` : '/api/browse';
        const response = await fetch(url);
        const data = await response.json();

        folders = data.folders || [];
        images = data.images || [];

        updateBreadcrumb(currentPath);
        stats.textContent = `${folders.length} folder${folders.length !== 1 ? 's' : ''}, ${images.length} image${images.length !== 1 ? 's' : ''}`;

        // Render based on current view mode
        if (currentViewMode === 'grid') {
            renderGridView();
        } else {
            renderThumbnails();
        }

        // Pre-generate thumbnails in background
        if (images.length > 0) {
            preGenerateThumbnails();
            if (currentViewMode === 'detail') {
                openDetailView(0);
            }
        } else {
            if (currentViewMode === 'detail') {
                showEmptyState();
            }
        }

        hideLoadingIndicator();
    } catch (error) {
        console.error('Error loading items:', error);
        stats.textContent = 'Error loading items';
        hideLoadingIndicator();
    }
}

async function navigateToFolder(path) {
    currentPath = path;
    await buildTree();
    await loadImages();
}

async function loadMetadata(imagePath) {
    const metadataContent = document.getElementById('metadataContent');
    metadataContent.innerHTML = '<div class="metadata-empty">Loading...</div>';

    try {
        const response = await fetch(`/api/metadata/${imagePath}`);
        const metadata = await response.json();

        if (metadata.error) {
            metadataContent.innerHTML = `<div class="metadata-empty">Error: ${metadata.error}</div>`;
            return;
        }

        // Store workflow summary for popup
        currentWorkflowSummary = metadata.workflow_summary || null;

        let html = '';

        // Basic Info
        const basicCollapsed = getMetadataSectionState('basic');
        html += '<div class="metadata-section">';
        html += `<div class="metadata-section-title" onclick="toggleMetadataSection('basic')">
            <span class="metadata-section-toggle ${basicCollapsed ? 'collapsed' : ''}" id="basic-toggle">▼</span>
            <span>Basic Info</span>
        </div>`;
        html += `<div class="metadata-section-content ${basicCollapsed ? 'collapsed' : ''}" id="basic-content">`;
        html += `<div class="metadata-item">
            <div class="metadata-label">Format</div>
            <div class="metadata-value">${metadata.format || 'N/A'}</div>
        </div>`;
        html += `<div class="metadata-item">
            <div class="metadata-label">Dimensions</div>
            <div class="metadata-value">${metadata.size.width} × ${metadata.size.height}</div>
        </div>`;
        html += `<div class="metadata-item">
            <div class="metadata-label">Color Mode</div>
            <div class="metadata-value">${metadata.mode || 'N/A'}</div>
        </div>`;
        html += `<div class="metadata-item">
            <div class="metadata-label">File Size</div>
            <div class="metadata-value">${formatFileSize(metadata.file_size)}</div>
        </div>`;
        html += '</div></div>';

        // Workflow Summary (NEW - appears before raw JSON sections)
        if (metadata.workflow_summary && Object.keys(metadata.workflow_summary).length > 0) {
            const summaryCollapsed = getMetadataSectionState('workflow-summary');
            html += '<div class="metadata-section workflow-summary-section">';
            html += `<div class="metadata-section-title" onclick="toggleMetadataSection('workflow-summary')">
                <span class="metadata-section-toggle ${summaryCollapsed ? 'collapsed' : ''}" id="workflow-summary-toggle">▼</span>
                <span>Node Summary</span>
                <button class="popup-btn" onclick="openWorkflowPopup(event)" title="Open in popup window">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </button>
            </div>`;
            html += `<div class="metadata-section-content ${summaryCollapsed ? 'collapsed' : ''}" id="workflow-summary-content">`;
            html += renderWorkflowSummary(metadata.workflow_summary);
            html += '</div></div>';
        }

        // Prompt
        if (metadata.prompt) {
            const promptCollapsed = getMetadataSectionState('prompt');
            html += '<div class="metadata-section">';
            html += `<div class="metadata-section-title" onclick="toggleMetadataSection('prompt')">
                <span class="metadata-section-toggle ${promptCollapsed ? 'collapsed' : ''}" id="prompt-toggle">▼</span>
                <span>ComfyUI Prompt</span>
            </div>`;
            html += `<div class="metadata-section-content ${promptCollapsed ? 'collapsed' : ''}" id="prompt-content">`;
            html += `<div class="metadata-json">${JSON.stringify(metadata.prompt, null, 2)}</div>`;
            html += '</div></div>';
        }

        // Workflow
        if (metadata.workflow) {
            const workflowCollapsed = getMetadataSectionState('workflow');
            html += '<div class="metadata-section">';
            html += `<div class="metadata-section-title" onclick="toggleMetadataSection('workflow')">
                <span class="metadata-section-toggle ${workflowCollapsed ? 'collapsed' : ''}" id="workflow-toggle">▼</span>
                <span>ComfyUI Workflow</span>
            </div>`;
            html += `<div class="metadata-section-content ${workflowCollapsed ? 'collapsed' : ''}" id="workflow-content">`;
            html += `<div class="metadata-json">${JSON.stringify(metadata.workflow, null, 2)}</div>`;
            html += '</div></div>';
        }

        // Other Parameters
        if (Object.keys(metadata.parameters).length > 0) {
            const paramsCollapsed = getMetadataSectionState('parameters');
            html += '<div class="metadata-section">';
            html += `<div class="metadata-section-title" onclick="toggleMetadataSection('parameters')">
                <span class="metadata-section-toggle ${paramsCollapsed ? 'collapsed' : ''}" id="parameters-toggle">▼</span>
                <span>Parameters</span>
            </div>`;
            html += `<div class="metadata-section-content ${paramsCollapsed ? 'collapsed' : ''}" id="parameters-content">`;
            for (const [key, value] of Object.entries(metadata.parameters)) {
                html += `<div class="metadata-item">
                    <div class="metadata-label">${key}</div>
                    <div class="metadata-value">${value}</div>
                </div>`;
            }
            html += '</div></div>';
        }

        metadataContent.innerHTML = html;
    } catch (error) {
        metadataContent.innerHTML = `<div class="metadata-empty">Error loading metadata: ${error.message}</div>`;
    }
}

async function preGenerateThumbnails() {
    // Pre-generate thumbnails for all images in the current folder
    if (images.length === 0) return;

    try {
        const imagePaths = images.map(img => img.path);

        console.log(`Starting thumbnail generation for ${imagePaths.length} images...`);

        // Send request to generate thumbnails in background
        fetch('/api/generate-thumbnails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ images: imagePaths })
        }).then(response => response.json())
          .then(data => {
              console.log(`Thumbnail generation ${data.status}: ${data.total} images queued`);

              // Start polling to retry failed thumbnails
              startThumbnailRetry();
          })
          .catch(error => {
              console.error('Error pre-generating thumbnails:', error);
          });
    } catch (error) {
        console.error('Error in preGenerateThumbnails:', error);
    }
}

function startThumbnailRetry() {
    // Clear any existing interval
    if (thumbnailRetryInterval) {
        clearInterval(thumbnailRetryInterval);
    }

    let retryCount = 0;
    const maxRetries = 15; // Retry for up to 45 seconds (15 * 3s)

    thumbnailRetryInterval = setInterval(() => {
        retryCount++;

        // Find all images that failed to load (opacity 0.3)
        const allImages = document.querySelectorAll('#thumbnailsScroll img');
        const failedImages = Array.from(allImages).filter(img => {
            const opacity = parseFloat(window.getComputedStyle(img).opacity);
            return opacity < 0.5 && img.src.includes('/thumbnail/');
        });

        if (failedImages.length === 0 || retryCount >= maxRetries) {
            clearInterval(thumbnailRetryInterval);
            thumbnailRetryInterval = null;
            if (failedImages.length === 0) {
                console.log('All thumbnails loaded successfully!');
            } else {
                console.log(`Stopped retrying. ${failedImages.length} thumbnails still pending.`);
            }
            return;
        }

        // Retry loading failed images
        failedImages.forEach(img => {
            const originalSrc = img.src.split('?')[0]; // Remove any existing cache buster
            img.src = originalSrc + `?retry=${retryCount}`;
        });

        console.log(`Retrying ${failedImages.length} thumbnails... (attempt ${retryCount}/${maxRetries})`);
    }, 3000); // Retry every 3 seconds
}

// Detail View with Zoom/Pan
function openDetailView(index) {
    if (images.length === 0) return;

    currentImageIndex = index;
    const currentImage = images[index];

    selectedImage = currentImage;
    loadMetadata(currentImage.path);

    const detailEmpty = document.getElementById('detailEmpty');
    const imageWrapper = document.getElementById('imageWrapper');
    const detailImage = document.getElementById('detailImage');

    detailEmpty.style.display = 'none';
    imageWrapper.style.display = 'block';

    detailImage.src = `/image/${currentImage.path}`;
    detailImage.onload = () => {
        fitToScreen();
    };

    // Update image info bar
    updateImageInfo(currentImage);

    // Update favorite button
    updateFavoriteButton();

    updateActiveThumbnail();
}

function navigateDetail(direction) {
    if (images.length === 0) return;

    currentImageIndex += direction;
    if (currentImageIndex < 0) currentImageIndex = images.length - 1;
    if (currentImageIndex >= images.length) currentImageIndex = 0;

    openDetailView(currentImageIndex);
}

// Zoom and Pan Functions
function updateImageTransform() {
    const image = document.getElementById('detailImage');
    image.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${scale})`;
}

function zoomIn() {
    scale = Math.min(scale * 1.2, 10);
    updateImageTransform();
}

function zoomOut() {
    scale = Math.max(scale / 1.2, 0.1);
    updateImageTransform();
}

function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    updateImageTransform();
}

function fitToScreen() {
    const image = document.getElementById('detailImage');
    const wrapper = document.getElementById('imageWrapper');

    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;

    const scaleX = wrapperWidth / imageWidth;
    const scaleY = wrapperHeight / imageHeight;
    scale = Math.min(scaleX, scaleY) * 0.95;

    panX = 0;
    panY = 0;
    updateImageTransform();
}

function downloadCurrentImage() {
    if (currentImageIndex >= 0 && currentImageIndex < images.length) {
        downloadImage(images[currentImageIndex].path);
    }
}

function downloadSelected() {
    if (selectedImages.size === 0) {
        alert('No images selected');
        return;
    }

    const imagePaths = Array.from(selectedImages);

    // Create form and submit
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download-multiple';
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'paths';
    input.value = JSON.stringify(imagePaths);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

// Grid View Functions
function handleGridItemClick(e, image, index) {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey && selectedImages.size > 0) {
        // Range selection with Shift
        selectImageRange(index);
    } else {
        // Simple click or Ctrl+Click - toggle selection
        toggleImageSelection(image.path);
    }
}

function toggleImageSelection(imagePath) {
    if (selectedImages.has(imagePath)) {
        selectedImages.delete(imagePath);
    } else {
        selectedImages.add(imagePath);
        lastSelectedIndex = images.findIndex(img => img.path === imagePath);
    }
    updateGridSelection();
    updateSelectionUI();
}

function selectImageRange(toIndex) {
    if (lastSelectedIndex === -1) {
        toggleImageSelection(images[toIndex].path);
        return;
    }

    const start = Math.min(lastSelectedIndex, toIndex);
    const end = Math.max(lastSelectedIndex, toIndex);

    for (let i = start; i <= end; i++) {
        selectedImages.add(images[i].path);
    }

    updateGridSelection();
    updateSelectionUI();
}

function clearSelection() {
    selectedImages.clear();
    lastSelectedIndex = -1;
    updateGridSelection();
    updateSelectionUI();
}

function toggleViewMode() {
    const detailView = document.getElementById('detailView');
    const thumbnails = document.getElementById('thumbnails');
    const imageInfoBar = document.getElementById('imageInfoBar');
    const gridView = document.getElementById('gridView');
    const viewToggle = document.getElementById('viewToggle');

    if (currentViewMode === 'detail') {
        // Switch to grid view
        currentViewMode = 'grid';
        detailView.style.display = 'none';
        thumbnails.style.display = 'none';
        imageInfoBar.style.display = 'none';
        gridView.classList.add('active');

        viewToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                <rect x="3" y="3" width="18" height="7"></rect>
                <rect x="3" y="14" width="18" height="7"></rect>
            </svg>
            Detail View
        `;

        renderGridView();
        updateSelectionUI();
    } else {
        // Switch to detail view
        currentViewMode = 'detail';
        detailView.style.display = 'flex';
        thumbnails.style.display = 'block';
        imageInfoBar.style.display = 'flex';
        gridView.classList.remove('active');

        viewToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
            Grid View
        `;

        // Re-render thumbnails to sync with current folder
        renderThumbnails();

        // Open first image if available
        if (images.length > 0) {
            openDetailView(0);
        } else {
            showEmptyState();
        }

        updateSelectionUI();
    }
}

function refreshGallery() {
    loadImages();
}

// Event Listeners
document.addEventListener('click', hideContextMenu);
document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.thumbnail-item')) {
        hideContextMenu();
    }
});

document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        handleContextMenuAction(action);
    });
});

// Pan with mouse
const imageWrapper = document.getElementById('imageWrapper');

imageWrapper.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateImageTransform();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// Zoom with mouse wheel
imageWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        scale = Math.min(scale * 1.1, 10);
    } else {
        scale = Math.max(scale / 1.1, 0.1);
    }
    updateImageTransform();
});

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    if (images.length === 0) return;

    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateDetail(-1);
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateDetail(1);
    }
});

// Favorites Functions
async function toggleFavorite(imagePath) {
    try {
        const response = await fetch(`/api/favorite/${imagePath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Update the image in the current images array
            const imageIndex = images.findIndex(img => img.path === imagePath);
            if (imageIndex >= 0) {
                images[imageIndex].is_favorite = result.is_favorite;
            }

            // Update UI based on current view
            if (currentViewMode === 'grid') {
                renderGridView();
            } else {
                // Update detail view favorite button
                updateFavoriteButton();
                // Update thumbnail overlay
                renderThumbnails();
            }

            showNotification(result.is_favorite ? 'Added to favorites' : 'Removed from favorites');
            return result.is_favorite;
        } else {
            showNotification('Error updating favorite', true);
            return null;
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error updating favorite', true);
        return null;
    }
}

async function setFavoritesBatch(filePaths, isFavorite) {
    try {
        const response = await fetch('/api/favorite-batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_paths: filePaths,
                is_favorite: isFavorite
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Update images in current array
            filePaths.forEach(path => {
                const imageIndex = images.findIndex(img => img.path === path);
                if (imageIndex >= 0) {
                    images[imageIndex].is_favorite = isFavorite;
                }
            });

            // Refresh view
            if (currentViewMode === 'grid') {
                renderGridView();
            } else {
                renderThumbnails();
            }

            showNotification(`Updated favorites for ${result.updated} file(s)`);
            return true;
        } else {
            showNotification('Error updating favorites', true);
            return false;
        }
    } catch (error) {
        console.error('Error in batch favorite:', error);
        showNotification('Error updating favorites', true);
        return false;
    }
}

async function toggleFavoritesFilter() {
    showFavoritesOnly = !showFavoritesOnly;

    const filterBtn = document.getElementById('favoritesFilterBtn');
    if (filterBtn) {
        if (showFavoritesOnly) {
            filterBtn.classList.add('active');
        } else {
            filterBtn.classList.remove('active');
        }
    }

    if (showFavoritesOnly) {
        await loadFavorites();
    } else {
        await loadImages();
    }
}

async function loadFavorites() {
    const stats = document.getElementById('stats');

    try {
        stats.textContent = 'Loading favorites...';
        showLoadingIndicator();

        const response = await fetch('/api/favorites');
        const data = await response.json();

        folders = []; // No folders in favorites view
        images = data.images || [];

        // Update breadcrumb to show "Favorites"
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Favorites
            </span>
        `;

        stats.textContent = `${images.length} favorite image${images.length !== 1 ? 's' : ''}`;

        // Render based on current view mode
        if (currentViewMode === 'grid') {
            renderGridView();
        } else {
            renderThumbnails();
            if (images.length > 0) {
                openDetailView(0);
            } else {
                showEmptyState('No favorites yet');
            }
        }

        hideLoadingIndicator();
    } catch (error) {
        console.error('Error loading favorites:', error);
        stats.textContent = 'Error loading favorites';
        hideLoadingIndicator();
    }
}

function updateFavoriteButton() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (!favoriteBtn || currentImageIndex < 0) return;

    const currentImage = images[currentImageIndex];
    if (!currentImage) return;

    const isFavorite = currentImage.is_favorite;

    // Update button appearance - icon only
    favoriteBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
    `;

    // Update tooltip
    favoriteBtn.title = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

    if (isFavorite) {
        favoriteBtn.classList.add('active');
    } else {
        favoriteBtn.classList.remove('active');
    }
}

function showEmptyState(message = 'No images found') {
    const detailImage = document.getElementById('detailImage');
    const metadataPanel = document.getElementById('metadataPanel');

    detailImage.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
            <div style="text-align: center;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px; opacity: 0.5;">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <div style="font-size: 18px;">${message}</div>
            </div>
        </div>
    `;

    metadataPanel.style.display = 'none';
}

// Wrapper functions for UI button clicks
async function toggleFavoriteCurrentImage() {
    if (currentImageIndex < 0 || !images[currentImageIndex]) return;
    await toggleFavorite(images[currentImageIndex].path);
}

async function favoriteSelected() {
    const selectedPaths = Array.from(selectedImages);
    if (selectedPaths.length === 0) {
        showNotification('No images selected');
        return;
    }
    await setFavoritesBatch(selectedPaths, true);
}

async function unfavoriteSelected() {
    const selectedPaths = Array.from(selectedImages);
    if (selectedPaths.length === 0) {
        showNotification('No images selected');
        return;
    }
    await setFavoritesBatch(selectedPaths, false);
}

// Initialize
async function initGallery() {
    await buildTree();
    await loadImages();
}

initGallery();
