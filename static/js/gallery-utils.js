// Gallery Utility Functions

function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4a9eff;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function showLoadingIndicator() {
    if (loadingIndicator) return;

    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div class="spinner"></div>
            <span>Loading images...</span>
        </div>
    `;
    loadingIndicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 10002;
        font-size: 16px;
    `;
    document.body.appendChild(loadingIndicator);
}

function hideLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.remove();
        loadingIndicator = null;
    }
}

function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard', true);
    });
}

async function copyMetadataToClipboard(imagePath) {
    try {
        const response = await fetch(`/api/metadata/${imagePath}`);
        const metadata = await response.json();
        await navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
        showNotification('Metadata copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy metadata:', err);
    }
}

async function copyWorkflowToClipboard(imagePath) {
    try {
        const response = await fetch(`/api/metadata/${imagePath}`);
        const metadata = await response.json();
        if (metadata.workflow) {
            await navigator.clipboard.writeText(JSON.stringify(metadata.workflow, null, 2));
            showNotification('Workflow copied to clipboard!');
        } else {
            showNotification('No workflow found in image');
        }
    } catch (err) {
        console.error('Failed to copy workflow:', err);
    }
}

function downloadImage(imagePath) {
    window.location.href = `/api/download/${imagePath}`;
}

function downloadFolder(folderPath) {
    window.location.href = `/api/download-folder/${folderPath}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
