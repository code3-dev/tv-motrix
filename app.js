// Constants
const COUNTRIES_METADATA_URL = 'https://raw.githubusercontent.com/TVGarden/tv-garden-channel-list/refs/heads/main/channels/raw/countries_metadata.json';
const COUNTRY_BASE_URL = 'https://raw.githubusercontent.com/TVGarden/tv-garden-channel-list/refs/heads/main/channels/raw/countries/';
const FLAG_API_BASE = 'https://flagcdn.com/w80/';

// Special country code mappings for flags
const FLAG_COUNTRY_MAPPINGS = {
    'UK': 'gb',
    'GB': 'gb'
};

// Get correct flag code
function getFlagCode(countryCode) {
    return FLAG_COUNTRY_MAPPINGS[countryCode.toUpperCase()] || countryCode.toLowerCase();
}

// DOM Elements
const countryModal = document.getElementById('countryModal');
const countrySearch = document.getElementById('countrySearch');
const channelSearch = document.getElementById('channelSearch');
const countryGrid = document.getElementById('countryGrid');
const selectedCountryText = document.getElementById('selectedCountryText');
const channelGrid = document.getElementById('channelGrid');
const playerModal = document.getElementById('playerModal');
const channelTitle = document.getElementById('channelTitle');
const playerContainer = document.getElementById('playerContainer');
const toggleIPTVBtn = document.getElementById('toggleIPTV');
const toggleYouTubeBtn = document.getElementById('toggleYouTube');
const resultsCount = document.getElementById('resultsCount');
const channelCount = document.getElementById('channelCount');
const noResults = document.getElementById('noResults');
const searchFilters = document.getElementById('searchFilters');

// State
let currentPlayer = null;
let currentHls = null;
let currentChannel = null;
let countriesData = null;
let selectedCountry = null;
let currentChannels = [];
let activeFilter = 'all';
let searchTimeout = null;

// Initialize the application
async function init() {
    try {
        countriesData = await fetchCountriesMetadata();
        populateCountryGrid(countriesData);
        
        // Event Listeners
        countrySearch.addEventListener('input', handleCountrySearch);
        channelSearch.addEventListener('input', handleChannelSearch);
        
        // Load default country (Iran)
        if (countriesData['IR']) {
            selectCountry('IR', countriesData['IR']);
        }
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError('Failed to initialize the application. Please try again later.');
    }
}

// Fetch countries metadata
async function fetchCountriesMetadata() {
    const response = await fetch(COUNTRIES_METADATA_URL);
    if (!response.ok) throw new Error('Failed to fetch countries metadata');
    return response.json();
}

// Handle country search
function handleCountrySearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const countryItems = countryGrid.querySelectorAll('.country-item');
    
    countryItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        const code = item.dataset.code.toLowerCase();
        const match = text.includes(searchTerm) || code.includes(searchTerm);
        item.style.display = match ? '' : 'none';
    });
}

// Handle channel search
function handleChannelSearch(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchTerm = event.target.value.toLowerCase();
        filterAndDisplayChannels(searchTerm, activeFilter);
    }, 300);
}

// Toggle filter
function toggleFilter(filter) {
    activeFilter = filter;
    const buttons = searchFilters.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    filterAndDisplayChannels(channelSearch.value.toLowerCase(), filter);
}

// Filter and display channels
function filterAndDisplayChannels(searchTerm, filter) {
    if (!currentChannels.length) return;

    const filteredChannels = currentChannels.filter(channel => {
        const matchesSearch = channel.name.toLowerCase().includes(searchTerm);
        const matchesFilter = filter === 'all' || 
            (filter === 'iptv' && channel.iptv_urls.length) ||
            (filter === 'youtube' && channel.youtube_urls.length);
        return matchesSearch && matchesFilter;
    });

    if (filteredChannels.length === 0) {
        showNoResults();
    } else {
        hideNoResults();
        displayChannels(filteredChannels, selectedCountry.code, searchTerm);
        updateResultsCount(filteredChannels.length);
    }
}

// Show no results message
function showNoResults() {
    channelGrid.innerHTML = '';
    noResults.classList.remove('hidden');
    resultsCount.classList.add('hidden');
}

// Hide no results message
function hideNoResults() {
    noResults.classList.add('hidden');
    resultsCount.classList.remove('hidden');
}

// Update results count
function updateResultsCount(count) {
    channelCount.textContent = count;
    resultsCount.classList.remove('hidden');
}

// Highlight search term in text
function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

// Populate country grid
function populateCountryGrid(countriesMetadata) {
    const sortedCountries = Object.entries(countriesMetadata)
        .filter(([_, data]) => data.hasChannels)
        .sort((a, b) => a[1].country.localeCompare(b[1].country));

    countryGrid.innerHTML = sortedCountries.map(([code, data]) => `
        <div class="country-item glass-effect rounded-lg p-4 cursor-pointer hover:bg-white/5 transition-all"
             onclick="selectCountry('${code}', ${JSON.stringify(data).replace(/"/g, '&quot;')})"
             data-code="${code}">
            <div class="flex items-center gap-3">
                <img src="${FLAG_API_BASE}${getFlagCode(code)}.png" 
                     alt="${code}" 
                     class="w-8 h-6 object-cover rounded shadow-sm"
                     onerror="this.src='https://via.placeholder.com/32x24/374151/FFFFFF?text=${code}'">
                <div>
                    <h3 class="font-semibold">${data.country}</h3>
                    <div class="text-sm text-gray-400">${data.capital}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Select country
async function selectCountry(code, data) {
    selectedCountry = { code, data };
    selectedCountryText.innerHTML = `
        <img src="${FLAG_API_BASE}${getFlagCode(code)}.png" 
             alt="${code}" 
             class="w-5 h-4 object-cover rounded inline-block ml-2">
        ${data.country}
    `;
    
    closeCountryModal();
    await loadCountryChannels(code);
}

// Load country channels
async function loadCountryChannels(countryCode) {
    try {
        showLoading();
        const channels = await fetchCountryChannels(countryCode.toLowerCase());
        currentChannels = channels;
        displayChannels(channels, countryCode);
        updateResultsCount(channels.length);
        channelSearch.value = '';
        activeFilter = 'all';
        toggleFilter('all');
    } catch (error) {
        console.error('Failed to load channels:', error);
        showError('Failed to load channels. Please try again.');
    } finally {
        hideLoading();
    }
}

// Show loading state
function showLoading() {
    channelGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p class="text-gray-400">در حال بارگذاری کانال‌ها...</p>
        </div>
    `;
}

// Hide loading state
function hideLoading() {
    // Loading state will be replaced by content
}

// Show error message
function showError(message) {
    channelGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div class="text-red-500 mb-4">
                <i class="fas fa-exclamation-circle text-4xl"></i>
            </div>
            <p class="text-gray-400">${message}</p>
            <button onclick="retryLastAction()" 
                    class="mt-4 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition-all">
                <i class="fas fa-redo mr-2"></i>تلاش مجدد
            </button>
        </div>
    `;
}

// Retry last action
function retryLastAction() {
    if (selectedCountry) {
        loadCountryChannels(selectedCountry.code);
    }
}

// Open country modal
function openCountryModal() {
    countryModal.classList.remove('hidden');
    countrySearch.focus();
}

// Close country modal
function closeCountryModal() {
    countryModal.classList.add('hidden');
    countrySearch.value = '';
    handleCountrySearch({ target: { value: '' } });
}

// Fetch channels for a specific country
async function fetchCountryChannels(countryCode) {
    const response = await fetch(`${COUNTRY_BASE_URL}${countryCode}.json`);
    if (!response.ok) throw new Error(`Failed to fetch channels for ${countryCode}`);
    return response.json();
}

// Display channels in the grid
function displayChannels(channels, countryCode, searchTerm = '') {
    channelGrid.innerHTML = channels.map(channel => `
        <div class="channel-card glass-effect rounded-xl overflow-hidden cursor-pointer"
             onclick="playChannel('${channel.nanoid}', ${JSON.stringify(channel).replace(/"/g, '&quot;')})">
            <div class="p-4">
                <div class="flex items-center gap-3 mb-3">
                    <img src="${FLAG_API_BASE}${getFlagCode(countryCode)}.png" 
                         alt="${countryCode}" 
                         class="w-6 h-4 object-cover rounded shadow-sm"
                         onerror="this.src='https://via.placeholder.com/24x16/374151/FFFFFF?text=${countryCode}'">
                    <h3 class="font-semibold truncate">${highlightText(channel.name, searchTerm)}</h3>
                </div>
                <div class="flex gap-2">
                    ${channel.iptv_urls.length ? 
                        '<span class="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400"><i class="fas fa-tv ml-1"></i>IPTV</span>' : ''}
                    ${channel.youtube_urls.length ? 
                        '<span class="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400"><i class="fab fa-youtube ml-1"></i>YouTube</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Play selected channel
function playChannel(id, channel) {
    currentChannel = channel;
    channelTitle.textContent = channel.name;
    playerModal.classList.remove('hidden');

    // Setup stream toggle buttons
    toggleIPTVBtn.classList.toggle('hidden', !channel.iptv_urls.length);
    toggleYouTubeBtn.classList.toggle('hidden', !channel.youtube_urls.length);

    toggleIPTVBtn.onclick = () => setupIPTVPlayer(channel.iptv_urls[0]);
    toggleYouTubeBtn.onclick = () => setupYouTubePlayer(channel.youtube_urls[0]);

    if (currentPlayer) {
        playerContainer.innerHTML = '';
        currentPlayer = null;
    }

    // Default to IPTV if available, otherwise YouTube
    if (channel.iptv_urls.length > 0) {
        setupIPTVPlayer(channel.iptv_urls[0]);
    } else if (channel.youtube_urls.length > 0) {
        setupYouTubePlayer(channel.youtube_urls[0]);
    }
}

// Setup IPTV player
function setupIPTVPlayer(url) {
    // Clear previous player
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }
    if (currentPlayer) {
        currentPlayer.remove();
        currentPlayer = null;
    }
    playerContainer.innerHTML = '';

    // Create video container
    const container = document.createElement('div');
    container.className = 'video-container';
    
    // Create video element
    const video = document.createElement('video');
    video.className = 'w-full h-full';
    video.controls = true;
    video.autoplay = true;
    container.appendChild(video);
    
    // Add loading indicator
    const loading = document.createElement('div');
    loading.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-50';
    loading.innerHTML = `
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
    `;
    container.appendChild(loading);
    
    playerContainer.appendChild(container);
    currentPlayer = video;

    // Setup HLS
    if (Hls.isSupported()) {
        const hls = new Hls({
            // debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            // maxBufferLength: 30,
            // maxMaxBufferLength: 600,
            // maxBufferSize: 60 * 1000 * 1000, // 60MB
            // maxBufferHole: 0.5,
            // highBufferWatchdogPeriod: 2,
            // nudgeOffset: 0.1,
            // nudgeMaxRetry: 5,
        });

        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, function () {
            hls.loadSource(url);
        });

        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        showPlayerError('Network error, trying to recover...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        showPlayerError('Media error, trying to recover...');
                        hls.recoverMediaError();
                        break;
                    default:
                        showPlayerError('An error occurred while playing the stream. Please try again.');
                        hls.destroy();
                        break;
                }
            }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            loading.remove();
            video.play().catch(function(error) {
                console.log("Play failed:", error);
                showPlayerError('Playback failed. Please try again or check if autoplay is allowed.');
            });
        });

        currentHls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
            loading.remove();
            video.play().catch(function(error) {
                console.log("Play failed:", error);
                showPlayerError('Playback failed. Please try again or check if autoplay is allowed.');
            });
        });
    } else {
        showPlayerError('Your browser does not support HLS playback.');
        loading.remove();
    }

    // Update button states
    toggleIPTVBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    toggleIPTVBtn.classList.remove('bg-blue-600/50');
    toggleYouTubeBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
    toggleYouTubeBtn.classList.add('bg-red-600/50');
}

// Show player error
function showPlayerError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'player-error';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
        <p>${message}</p>
    `;
    
    const container = playerContainer.querySelector('.video-container');
    if (container) {
        // Remove loading indicator if it exists
        const loading = container.querySelector('.loading');
        if (loading) loading.remove();
        
        // Add error message
        container.appendChild(errorDiv);
    }
}

// Setup YouTube player
function setupYouTubePlayer(url) {
    const iframe = document.createElement('iframe');
    iframe.className = 'w-full h-full';
    iframe.src = url;
    iframe.allowFullscreen = true;
    
    playerContainer.innerHTML = '';
    playerContainer.appendChild(iframe);
    currentPlayer = iframe;

    // Update button states
    toggleYouTubeBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    toggleYouTubeBtn.classList.remove('bg-red-600/50');
    toggleIPTVBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    toggleIPTVBtn.classList.add('bg-blue-600/50');
}

// Close player modal
function closePlayer() {
    playerModal.classList.add('hidden');
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }
    if (currentPlayer) {
        currentPlayer.remove();
        currentPlayer = null;
    }
    playerContainer.innerHTML = '';
}

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !playerModal.classList.contains('hidden')) {
        closePlayer();
    }
});

// Initialize the app
init(); 