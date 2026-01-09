// Gallery State Management
// Global state variables

let images = [];
let folders = [];
let currentImageIndex = -1;
let currentPath = '';
let selectedImage = null;
let contextMenuTarget = null;
let contextMenuType = null;

// Zoom/Pan state
let scale = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

// Loading indicator state
let loadingIndicator = null;

// Grid view state
let currentViewMode = 'detail'; // 'detail' or 'grid'
let selectedImages = new Set();
let lastSelectedIndex = -1;

// Thumbnail retry state
let thumbnailRetryInterval = null;

// Current workflow summary
let currentWorkflowSummary = null;
