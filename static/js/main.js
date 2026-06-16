// Application State
let allReleases = [];
let filteredReleases = [];
let selectedUpdates = new Set();
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const notesGrid = document.getElementById('notes-grid');
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const btnRefresh = document.getElementById('btn-refresh');
const refreshSpinner = document.getElementById('refresh-spinner');
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const filterChips = document.querySelectorAll('.filter-chip');
const updateCountBadge = document.getElementById('update-count');
const lastUpdatedText = document.getElementById('last-updated');
const selectionStatusBar = document.getElementById('selection-status-bar');
const selectedCountText = document.getElementById('selected-count-text');
const btnClearSelection = document.getElementById('btn-clear-selection');
const btnTweetSelected = document.getElementById('btn-tweet-selected');
const btnRetry = document.getElementById('btn-retry');
const btnResetFilters = document.getElementById('btn-reset-filters');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalUpdatePreview = document.getElementById('modal-update-preview');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountSpan = document.getElementById('char-count');
const charProgressCircle = document.getElementById('char-progress');
const btnCopyTweet = document.getElementById('btn-copy-tweet');
const btnLaunchTweet = document.getElementById('btn-launch-tweet');

// Toast Element
const toast = document.getElementById('toast');
const toastText = document.getElementById('toast-text');

// Twitter limits
const MAX_TWEET_CHARS = 280;
const TCO_LINK_CHARS = 23; // Twitter counts any link as 23 characters

// Initialize Progress Ring
const radius = 10;
const circumference = 2 * Math.PI * radius;
charProgressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
charProgressCircle.style.strokeDashoffset = circumference;

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
});

// Setup Listeners
function setupEventListeners() {
    // Refresh Button
    btnRefresh.addEventListener('click', () => fetchReleases(true));
    btnRetry.addEventListener('click', () => fetchReleases(true));
    
    // Search Input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        if (searchQuery.length > 0) {
            btnClearSearch.classList.remove('hidden');
        } else {
            btnClearSearch.classList.add('hidden');
        }
        applyFilters();
    });
    
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        btnClearSearch.classList.add('hidden');
        applyFilters();
        searchInput.focus();
    });
    
    // Category Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-type');
            applyFilters();
        });
    });

    // Reset Filters Button (on empty state)
    btnResetFilters.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        btnClearSearch.classList.add('hidden');
        filterChips.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-type="all"]').classList.add('active');
        currentFilter = 'all';
        applyFilters();
    });
    
    // Selection Management
    btnClearSelection.addEventListener('click', clearSelection);
    btnTweetSelected.addEventListener('click', openMultipleTweetComposer);
    
    // Modal Events
    btnCloseModal.addEventListener('click', closeModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeModal();
    });
    tweetTextarea.addEventListener('input', updateCharCounter);
    
    btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    btnLaunchTweet.addEventListener('click', launchTweetIntent);
}

// Fetch Releases from Flask API
async function fetchReleases(forceRefresh = false) {
    showLoading(true);
    let url = '/api/releases';
    if (forceRefresh) {
        url += '?refresh=true';
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned code ${response.status}`);
        }
        const result = await response.json();
        
        if (result.success) {
            allReleases = result.data;
            
            // Format and show last fetched time
            if (result.last_fetched) {
                const date = new Date(result.last_fetched);
                lastUpdatedText.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                    ' (' + date.toLocaleDateString() + ')';
            }
            
            if (forceRefresh && !result.warning) {
                showToast('Successfully updated release feed!');
            } else if (result.warning) {
                showToast(result.warning, true);
            }
            
            applyFilters();
        } else {
            throw new Error(result.error || 'Unknown server error');
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showError(err.message);
    } finally {
        showLoading(false);
    }
}

// Show/Hide Loading Skeleton
function showLoading(isLoading) {
    if (isLoading) {
        loadingSkeleton.classList.remove('hidden');
        notesGrid.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        btnRefresh.disabled = true;
        refreshSpinner.classList.remove('hidden');
    } else {
        loadingSkeleton.classList.add('hidden');
        btnRefresh.disabled = false;
        refreshSpinner.classList.add('hidden');
    }
}

// Show Error State
function showError(msg) {
    notesGrid.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = msg;
}

// Show Custom Toast
function showToast(message, isWarning = false) {
    toastText.textContent = message;
    toast.className = 'toast'; // reset
    if (isWarning) {
        toast.style.background = 'rgba(239, 68, 68, 0.95)'; // Red for warning
        toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-exclamation toast-icon';
    } else {
        toast.style.background = 'rgba(16, 185, 129, 0.95)'; // Green for success
        toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-check toast-icon';
    }
    toast.classList.remove('hidden');
    
    // Auto hide
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3500);
}

// Apply Search Query and Category Filter
function applyFilters() {
    filteredReleases = allReleases.filter(release => {
        // 1. Category Filter
        const typeNormalized = release.type.toLowerCase();
        let matchesCategory = false;
        
        if (currentFilter === 'all') {
            matchesCategory = true;
        } else if (currentFilter === 'feature' && typeNormalized.includes('feature')) {
            matchesCategory = true;
        } else if (currentFilter === 'issue' && (typeNormalized.includes('issue') || typeNormalized.includes('bug') || typeNormalized.includes('fix'))) {
            matchesCategory = true;
        } else if (currentFilter === 'deprecation' && (typeNormalized.includes('deprecat') || typeNormalized.includes('decommission'))) {
            matchesCategory = true;
        } else if (currentFilter === 'other' && !typeNormalized.includes('feature') && !typeNormalized.includes('issue') && !typeNormalized.includes('bug') && !typeNormalized.includes('fix') && !typeNormalized.includes('deprecat')) {
            matchesCategory = true;
        }
        
        // 2. Search Query Filter
        let matchesSearch = true;
        if (searchQuery) {
            const dateMatch = release.date.toLowerCase().includes(searchQuery);
            const typeMatch = release.type.toLowerCase().includes(searchQuery);
            const contentMatch = release.content_text.toLowerCase().includes(searchQuery);
            matchesSearch = dateMatch || typeMatch || contentMatch;
        }
        
        return matchesCategory && matchesSearch;
    });
    
    updateCountBadge.textContent = `${filteredReleases.length} Updates`;
    renderCards();
}

// Render release cards in UI
function renderCards() {
    notesGrid.innerHTML = '';
    
    if (filteredReleases.length === 0) {
        notesGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    notesGrid.classList.remove('hidden');
    
    filteredReleases.forEach(release => {
        const card = document.createElement('div');
        const typeClass = getCardTypeClass(release.type);
        const isChecked = selectedUpdates.has(release.id);
        
        card.className = `release-card ${typeClass} ${isChecked ? 'selected' : ''}`;
        card.setAttribute('data-id', release.id);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta-left">
                    <span class="card-date"><i class="fa-regular fa-calendar"></i> ${release.date}</span>
                    <span class="card-badge">${release.type}</span>
                </div>
                <div class="card-select-wrapper">
                    <label class="custom-checkbox" title="Select to Tweet">
                        <input type="checkbox" class="cb-select" data-id="${release.id}" ${isChecked ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </div>
            </div>
            
            <div class="card-body">
                ${release.content_html}
            </div>
            
            <div class="card-actions">
                <a href="${release.link}" target="_blank" rel="noopener noreferrer" class="card-link">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Google Cloud Feed
                </a>
                <button class="tweet-action-btn" data-id="${release.id}">
                    <i class="fa-brands fa-x-twitter"></i> Tweet
                </button>
            </div>
        `;
        
        // Attach event listener to individual tweet button
        card.querySelector('.tweet-action-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openSingleTweetComposer(release);
        });
        
        // Attach checkbox event listener
        card.querySelector('.cb-select').addEventListener('change', (e) => {
            toggleSelectUpdate(release.id, e.target.checked);
        });
        
        notesGrid.appendChild(card);
    });
}

// Match type string to appropriate CSS subclass
function getCardTypeClass(typeStr) {
    const norm = typeStr.toLowerCase();
    if (norm.includes('feature')) return 'type-feature';
    if (norm.includes('issue') || norm.includes('bug') || norm.includes('fix')) return 'type-issue';
    if (norm.includes('deprecat') || norm.includes('decommission')) return 'type-deprecation';
    return 'type-other';
}

// Selection Logic
function toggleSelectUpdate(id, isSelected) {
    if (isSelected) {
        selectedUpdates.add(id);
        document.querySelector(`.release-card[data-id="${id}"]`)?.classList.add('selected');
    } else {
        selectedUpdates.delete(id);
        document.querySelector(`.release-card[data-id="${id}"]`)?.classList.remove('selected');
    }
    
    updateSelectionBar();
}

function updateSelectionBar() {
    const count = selectedUpdates.size;
    if (count > 0) {
        selectionStatusBar.classList.remove('hidden');
        selectedCountText.textContent = `${count} update${count > 1 ? 's' : ''} selected`;
    } else {
        selectionStatusBar.classList.add('hidden');
    }
}

function clearSelection() {
    selectedUpdates.clear();
    document.querySelectorAll('.cb-select').forEach(cb => cb.checked = false);
    document.querySelectorAll('.release-card').forEach(card => card.classList.remove('selected'));
    updateSelectionBar();
}

// Tweet Generation & Limits Helper
function calculateTweetStats(text) {
    // A simplified X/Twitter length calculator:
    // It parses out URLs and counts them as exactly 23 characters
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlPattern) || [];
    
    let baseText = text.replace(urlPattern, '');
    let charLength = baseText.length + (urls.length * TCO_LINK_CHARS);
    
    return {
        length: charLength,
        remaining: MAX_TWEET_CHARS - charLength,
        isOverLimit: charLength > MAX_TWEET_CHARS
    };
}

// Open Composer for a single update
function openSingleTweetComposer(release) {
    const date = release.date;
    const typeLabel = release.type.toUpperCase();
    const prefix = `BigQuery ${typeLabel} (${date}): `;
    const hashtags = ` #GoogleCloud #BigQuery`;
    const link = ` ${release.link}`;
    
    // We want the total length to be <= 280
    // Account for link (23 chars) and hashtags/prefix spacing
    const baseLength = prefix.length + hashtags.length + TCO_LINK_CHARS + 4; // safety gap
    const maxDescLength = MAX_TWEET_CHARS - baseLength;
    
    let description = release.content_text;
    if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength).trim() + "...";
    }
    
    const draftTweet = `${prefix}${description}${hashtags}${link}`;
    
    // Display Modal
    modalUpdatePreview.textContent = release.content_text;
    tweetTextarea.value = draftTweet;
    
    openModal();
}

// Open Composer for multiple selected updates
function openMultipleTweetComposer() {
    if (selectedUpdates.size === 0) return;
    
    // Retrieve full items from selection
    const selectedItems = allReleases.filter(r => selectedUpdates.has(r.id));
    
    let dateRangeText = "";
    const dates = [...new Set(selectedItems.map(item => item.date))];
    if (dates.length === 1) {
        dateRangeText = ` (${dates[0]})`;
    }
    
    const header = `BigQuery Updates${dateRangeText}:\n`;
    const hashtags = `\n#GoogleCloud #BigQuery`;
    
    let body = "";
    selectedItems.forEach(item => {
        const typeBadge = item.type.toUpperCase();
        // Short summary of this update
        let cleanText = item.content_text;
        if (cleanText.length > 50) {
            cleanText = cleanText.substring(0, 47) + "...";
        }
        body += `• [${typeBadge}] ${cleanText}\n`;
    });
    
    // Include the general feed url as the link since we have multiple updates
    const link = " https://docs.cloud.google.com/bigquery/docs/release-notes";
    const draftTweet = `${header}${body}${hashtags}${link}`;
    
    // Modal preview of all selected texts concatenated
    const previewTexts = selectedItems.map(item => `[${item.type}] - ${item.content_text}`).join('\n\n');
    modalUpdatePreview.textContent = previewTexts;
    tweetTextarea.value = draftTweet;
    
    openModal();
}

// Modal Animation Helpers
function openModal() {
    tweetModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scroll
    tweetTextarea.focus();
    updateCharCounter();
}

function closeModal() {
    tweetModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore background scroll
}

// Update Character Counter Progress Ring and Number
function updateCharCounter() {
    const text = tweetTextarea.value;
    const stats = calculateTweetStats(text);
    
    charCountSpan.textContent = stats.remaining;
    
    // Color indicators
    if (stats.remaining < 0) {
        charCountSpan.style.color = 'var(--accent-rose)';
        charProgressCircle.style.stroke = 'var(--accent-rose)';
    } else if (stats.remaining <= 20) {
        charCountSpan.style.color = 'var(--accent-amber)';
        charProgressCircle.style.stroke = 'var(--accent-amber)';
    } else {
        charCountSpan.style.color = 'var(--text-secondary)';
        charProgressCircle.style.stroke = 'var(--accent-cyan)';
    }
    
    // Progress Ring offset
    const percentage = Math.min(stats.length / MAX_TWEET_CHARS, 1.0);
    const offset = circumference - (percentage * circumference);
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Disable Tweet launch if over character count
    btnLaunchTweet.disabled = stats.isOverLimit;
    if (stats.isOverLimit) {
        btnLaunchTweet.style.opacity = '0.5';
        btnLaunchTweet.style.cursor = 'not-allowed';
    } else {
        btnLaunchTweet.style.opacity = '1';
        btnLaunchTweet.style.cursor = 'pointer';
    }
}

// Copy Tweet Text
function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Tweet copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy to clipboard', true);
        });
}

// Launch Twitter Web Intent
function launchTweetIntent() {
    const text = tweetTextarea.value;
    const stats = calculateTweetStats(text);
    
    if (stats.isOverLimit) {
        showToast('Cannot tweet: text exceeds 280 character limit.', true);
        return;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    closeModal();
    clearSelection();
}
