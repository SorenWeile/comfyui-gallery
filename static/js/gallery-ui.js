// Gallery UI Rendering and Updates

// Context Menu Functions
function showContextMenu(e, target, type) {
    e.preventDefault();
    e.stopPropagation();

    const contextMenu = document.getElementById('contextMenu');
    contextMenuTarget = target;
    contextMenuType = type;

    const downloadItem = contextMenu.querySelector('[data-action="download"]');
    const downloadFolderItem = contextMenu.querySelector('[data-action="download-folder"]');
    const copyMetadataItem = contextMenu.querySelector('[data-action="copy-metadata"]');
    const copyWorkflowItem = contextMenu.querySelector('[data-action="copy-workflow"]');

    if (type === 'image') {
        downloadItem.style.display = 'flex';
        downloadFolderItem.style.display = 'none';
        copyMetadataItem.style.display = 'flex';
        copyWorkflowItem.style.display = 'flex';
    } else if (type === 'folder') {
        downloadItem.style.display = 'none';
        downloadFolderItem.style.display = 'flex';
        copyMetadataItem.style.display = 'none';
        copyWorkflowItem.style.display = 'none';
    }

    // Show menu first to get its height
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.classList.add('active');

    // Check if menu would go off bottom of screen
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (menuRect.bottom > viewportHeight) {
        // Position menu above cursor
        contextMenu.style.top = (e.pageY - menuRect.height) + 'px';
    }

    // Check if menu would go off right of screen
    const viewportWidth = window.innerWidth;
    if (menuRect.right > viewportWidth) {
        contextMenu.style.left = (e.pageX - menuRect.width) + 'px';
    }
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('active');
    contextMenuTarget = null;
    contextMenuType = null;
}

async function handleContextMenuAction(action) {
    if (!contextMenuTarget) return;

    switch (action) {
        case 'download':
            if (contextMenuType === 'image') downloadImage(contextMenuTarget.path);
            break;
        case 'download-folder':
            if (contextMenuType === 'folder') downloadFolder(contextMenuTarget.path);
            break;
        case 'copy-path':
            copyToClipboard(contextMenuTarget.path);
            break;
        case 'copy-metadata':
            if (contextMenuType === 'image') await copyMetadataToClipboard(contextMenuTarget.path);
            break;
        case 'copy-workflow':
            if (contextMenuType === 'image') await copyWorkflowToClipboard(contextMenuTarget.path);
            break;
    }

    hideContextMenu();
}

function renderThumbnails() {
    const thumbnailsScroll = document.getElementById('thumbnailsScroll');
    thumbnailsScroll.innerHTML = '';

    // Folders
    folders.forEach((folder) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-item folder-thumbnail';
        thumb.onclick = () => navigateToFolder(folder.path);
        thumb.oncontextmenu = (e) => showContextMenu(e, folder, 'folder');

        thumb.innerHTML = `
            <div class="folder-icon-small">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <div class="folder-name-small">${folder.name}</div>
        `;
        thumbnailsScroll.appendChild(thumb);
    });

    // Images - load directly, no lazy loading complexity
    images.forEach((image, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumbnail-item';
        if (index === currentImageIndex) {
            thumb.classList.add('active');
        }
        thumb.onclick = () => openDetailView(index);
        thumb.oncontextmenu = (e) => showContextMenu(e, image, 'image');

        // Create img element - load directly
        const img = document.createElement('img');
        img.src = `/thumbnail/${image.path}`;
        img.alt = image.name;
        img.style.background = '#2d2d2d';
        img.loading = 'lazy'; // Use browser native lazy loading

        // Add loading state
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';

        img.onload = () => {
            img.style.opacity = '1';
        };

        img.onerror = () => {
            img.style.opacity = '0.3';
            img.alt = 'Loading...';
        };

        thumb.appendChild(img);

        // Add favorite indicator overlay
        if (image.is_favorite) {
            const favoriteOverlay = document.createElement('div');
            favoriteOverlay.className = 'favorite-overlay';
            favoriteOverlay.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            `;
            thumb.appendChild(favoriteOverlay);
        }

        thumbnailsScroll.appendChild(thumb);
    });

    // Scroll active into view
    const activeThumb = thumbnailsScroll.querySelector('.thumbnail-item.active');
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function renderGridView() {
    const gridView = document.getElementById('gridView');
    gridView.innerHTML = '';

    // Folders
    folders.forEach((folder) => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item grid-folder-item';
        gridItem.onclick = () => navigateToFolder(folder.path);
        gridItem.oncontextmenu = (e) => showContextMenu(e, folder, 'folder');

        gridItem.innerHTML = `
            <div class="grid-folder-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <div class="grid-folder-name">${folder.name}</div>
        `;
        gridView.appendChild(gridItem);
    });

    // Images
    images.forEach((image, index) => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.dataset.index = index;
        gridItem.dataset.path = image.path;

        if (selectedImages.has(image.path)) {
            gridItem.classList.add('selected');
        }

        // Click handler for selection
        gridItem.onclick = (e) => handleGridItemClick(e, image, index);
        gridItem.oncontextmenu = (e) => showContextMenu(e, image, 'image');

        const img = document.createElement('img');
        img.src = `/thumbnail/${image.path}`;
        img.alt = image.name;
        img.loading = 'lazy';
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';

        img.onload = () => {
            img.style.opacity = '1';
        };

        img.onerror = () => {
            img.style.opacity = '0.3';
            img.alt = 'Loading...';
        };

        const checkbox = document.createElement('div');
        checkbox.className = 'grid-item-checkbox';
        checkbox.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        gridItem.appendChild(img);
        gridItem.appendChild(checkbox);

        // Add favorite indicator overlay
        if (image.is_favorite) {
            const favoriteOverlay = document.createElement('div');
            favoriteOverlay.className = 'favorite-overlay';
            favoriteOverlay.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            `;
            gridItem.appendChild(favoriteOverlay);
        }

        gridView.appendChild(gridItem);
    });

    updateSelectionUI();
}

function renderWorkflowSummary(summary) {
    let html = '';

    if (!summary || !summary.nodes || summary.nodes.length === 0) {
        return '<div class="metadata-empty">No workflow nodes found</div>';
    }

    // Display each node
    summary.nodes.forEach((node, index) => {
        html += `<div class="summary-node">
            <div class="summary-node-header">
                <span class="summary-node-id">#${node.id}</span>
                <span class="summary-node-type">${escapeHtml(node.type)}</span>
            </div>`;

        if (node.title && node.title !== node.type) {
            html += `<div class="summary-node-title">${escapeHtml(node.title)}</div>`;
        }

        // Display parameters
        if (node.params && Object.keys(node.params).length > 0) {
            html += `<div class="summary-node-params">`;
            for (const [key, value] of Object.entries(node.params)) {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                const isLongValue = displayValue.length > 50;

                html += `<div class="summary-param">
                    <span class="summary-param-key">${escapeHtml(key)}:</span>
                    <span class="summary-param-value ${isLongValue ? 'long-value' : ''}">${escapeHtml(displayValue)}</span>
                    <button class="copy-btn-small" onclick="copyToClipboard(\`${displayValue.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`, '${escapeHtml(key)}')" title="Copy ${escapeHtml(key)}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
    });

    return html;
}

function buildTreeLevel(container, folders, level) {
    for (const folder of folders) {
        const itemContainer = document.createElement('div');
        itemContainer.style.paddingLeft = `${level * 20}px`;

        const item = document.createElement('div');
        item.className = currentPath === folder.path ? 'tree-item active' : 'tree-item';
        item.dataset.path = folder.path;
        item.innerHTML = `
            <span class="tree-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </span>
            <span class="tree-item-name">${folder.name}</span>
        `;
        item.onclick = (e) => {
            e.stopPropagation();
            navigateToFolder(folder.path);
        };
        item.oncontextmenu = (e) => {
            e.stopPropagation();
            showContextMenu(e, folder, 'folder');
        };

        itemContainer.appendChild(item);
        container.appendChild(itemContainer);

        if (folder.children && folder.children.length > 0) {
            buildTreeLevel(container, folder.children, level + 1);
        }
    }
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';

    const parts = path ? path.split(/[\\/]/).filter(p => p) : [];

    const homeLink = document.createElement('span');
    homeLink.className = 'breadcrumb-item';
    homeLink.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Home
    `;
    homeLink.onclick = () => navigateToFolder('');
    breadcrumb.appendChild(homeLink);

    if (parts.length === 0) {
        breadcrumb.style.display = 'none';
        return;
    }

    breadcrumb.style.display = 'flex';

    let accumulatedPath = '';
    parts.forEach((part, index) => {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '/';
        breadcrumb.appendChild(separator);

        accumulatedPath += (accumulatedPath ? '/' : '') + part;
        const isLast = index === parts.length - 1;

        const link = document.createElement('span');
        link.className = isLast ? 'breadcrumb-current' : 'breadcrumb-item';
        link.textContent = part;

        if (!isLast) {
            const pathToNavigate = accumulatedPath;
            link.onclick = () => navigateToFolder(pathToNavigate);
        }

        breadcrumb.appendChild(link);
    });
}

function updateImageInfo(image) {
    document.getElementById('infoName').textContent = image.name;
    document.getElementById('infoSize').textContent = formatFileSize(image.size);
    document.getElementById('infoDate').textContent = image.modified_str;
}

function updateActiveThumbnail() {
    // Remove active class from all thumbnails
    document.querySelectorAll('.thumbnail-item').forEach(thumb => {
        thumb.classList.remove('active');
    });

    // Add active class to current thumbnail
    const thumbnailsScroll = document.getElementById('thumbnailsScroll');
    const thumbnails = thumbnailsScroll.querySelectorAll('.thumbnail-item');

    // Account for folders before images
    const thumbnailIndex = folders.length + currentImageIndex;
    if (thumbnails[thumbnailIndex]) {
        thumbnails[thumbnailIndex].classList.add('active');
        thumbnails[thumbnailIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function toggleMetadataSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const toggle = document.getElementById(`${sectionId}-toggle`);

    if (content && toggle) {
        content.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');

        const isCollapsed = content.classList.contains('collapsed');
        localStorage.setItem(`metadata-${sectionId}`, isCollapsed ? 'collapsed' : 'expanded');
    }
}

function getMetadataSectionState(sectionId) {
    const saved = localStorage.getItem(`metadata-${sectionId}`);
    if (saved) return saved === 'collapsed';
    return ['prompt', 'workflow'].includes(sectionId);
}

function showEmptyState() {
    document.getElementById('detailEmpty').style.display = 'flex';
    document.getElementById('imageWrapper').style.display = 'none';
    document.getElementById('detailEmpty').textContent = folders.length > 0
        ? 'No images in this folder'
        : 'No images yet. Generate some in ComfyUI!';
}

function updateSelectionUI() {
    const selectionControls = document.getElementById('selectionControls');
    const selectionCount = document.getElementById('selectionCount');

    if (selectedImages.size > 0 && currentViewMode === 'grid') {
        selectionControls.classList.add('active');
        selectionCount.textContent = `${selectedImages.size} selected`;
    } else {
        selectionControls.classList.remove('active');
    }
}

function updateGridSelection() {
    const gridItems = document.querySelectorAll('.grid-item[data-path]');
    gridItems.forEach(item => {
        const path = item.dataset.path;
        if (selectedImages.has(path)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function openWorkflowPopup(event) {
    event.stopPropagation();

    if (!currentWorkflowSummary) {
        showToast('No workflow data available', true);
        return;
    }

    const popupWidth = 500;
    const popupHeight = 700;
    const left = (screen.width - popupWidth) / 2;
    const top = (screen.height - popupHeight) / 2;

    const popup = window.open('', 'WorkflowSummary',
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`);

    if (popup) {
        const htmlContent = renderWorkflowSummary(currentWorkflowSummary);
        popup.document.write('<!DOCTYPE html><html><head><title>Workflow Summary</title><style>' +
            '* { margin: 0; padding: 0; box-sizing: border-box; }' +
            'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a1a; color: #e0e0e0; padding: 20px; line-height: 1.6; }' +
            'h1 { font-size: 20px; margin-bottom: 20px; color: #4a9eff; border-bottom: 2px solid #4a9eff; padding-bottom: 10px; }' +
            '.metadata-empty { color: #999; text-align: center; padding: 20px; font-style: italic; }' +
            '.summary-node { margin-bottom: 12px; background: #242424; border-radius: 6px; padding: 10px; border-left: 3px solid #4a9eff; }' +
            '.summary-node-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }' +
            '.summary-node-id { background: #4a9eff; color: #1a1a1a; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }' +
            '.summary-node-type { color: #4a9eff; font-weight: 600; font-size: 12px; }' +
            '.summary-node-title { color: #999; font-size: 11px; margin-bottom: 6px; font-style: italic; }' +
            '.summary-node-params { display: flex; flex-direction: column; gap: 4px; }' +
            '.summary-param { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; padding: 4px 6px; background: #1a1a1a; border-radius: 3px; }' +
            '.summary-param-key { color: #999; min-width: 70px; flex-shrink: 0; }' +
            '.summary-param-value { color: #e0e0e0; flex: 1; word-break: break-word; }' +
            '.summary-param-value.long-value { max-width: 400px; white-space: pre-wrap; font-size: 10px; line-height: 1.4; }' +
            '.copy-btn-small { background: transparent; border: 1px solid #4a9eff; color: #4a9eff; padding: 2px 4px; border-radius: 2px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; flex-shrink: 0; font-size: 10px; }' +
            '.copy-btn-small:hover { background: #4a9eff; color: #1a1a1a; }' +
            '</style></head><body><h1>Workflow Summary</h1>' +
            htmlContent +
            '<script>function copyToClipboard(text, label) { navigator.clipboard.writeText(text).then(() => { alert(label + " copied to clipboard!"); }).catch(err => { alert("Failed to copy to clipboard"); }); }<\/script>' +
            '</body></html>');
        popup.document.close();
    } else {
        showToast('Please allow popups for this site', true);
    }
}
