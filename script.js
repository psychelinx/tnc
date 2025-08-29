// Map locale to available language folders
function mapLocaleToLanguage(locale) {
    // Extract language code from locale (e.g., 'en-GB' -> 'en', 'it-IT' -> 'it')
    const languageCode = locale.split('-')[0].toLowerCase();
    
    // Available languages in the repository
    const availableLanguages = ['en', 'it'];
    
    // Direct match
    if (availableLanguages.includes(locale.toLowerCase())) {
        return locale.toLowerCase();
    }
    
    // Match by language code
    if (availableLanguages.includes(languageCode)) {
        return languageCode;
    }
    
    // Fallback to English for any unsupported language
    return 'en';
}

// Check if a document exists
async function documentExists(path) {
    try {
        const response = await fetch(path, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        doc: params.get('doc') || 'terms-and-conditions',
        type: params.get('type') || 'patient',
        locale: params.get('locale') || 'it'
    };
}

// Set initial values from URL parameters
function setInitialValues() {
    const params = getUrlParams();
    const mappedLanguage = mapLocaleToLanguage(params.locale);
    
    document.getElementById('document-type').value = params.doc;
    document.getElementById('user-type').value = params.type;
    document.getElementById('language').value = mappedLanguage;
    
    // Store original locale for reference
    document.getElementById('language').dataset.originalLocale = params.locale;
}

// Update URL parameters without reloading
function updateUrlParams() {
    const doc = document.getElementById('document-type').value;
    const type = document.getElementById('user-type').value;
    const language = document.getElementById('language').value;
    
    // Use original locale if it was provided, otherwise use the selected language
    const locale = document.getElementById('language').dataset.originalLocale || language;

    const params = new URLSearchParams({
        doc: doc,
        type: type,
        locale: locale
    });
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Load and render markdown
async function loadDocument() {
    const doc = document.getElementById('document-type').value;
    const type = document.getElementById('user-type').value;
    const language = document.getElementById('language').value;

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">Loading document...</div>';
    
    try {
        // Try with the selected language
        let filePath = `./${doc}/${language}/${type}.md`;
        let response = await fetch(filePath);
        
        // If document doesn't exist and language is not English, fallback to English
        if (!response.ok && language !== 'en') {
            console.log(`Document not found in ${language}, falling back to English`);
            filePath = `./${doc}/en/${type}.md`;
            response = await fetch(filePath);
        }
        
        if (!response.ok) {
            throw new Error(`Document not found: ${filePath}`);
        }
        
        // Update the language selector to reflect actual loaded language
        if (filePath.includes('/en/') && language !== 'en') {
            document.getElementById('language').value = 'en';
        }
        
        const markdown = await response.text();
        
        // Convert markdown to HTML
        const html = marked.parse(markdown);
        
        // Display the content
        contentDiv.innerHTML = html;
        
        // Update URL parameters
        updateUrlParams();
        
    } catch (error) {
        contentDiv.innerHTML = `
            <div class="error">
                <h3>Error Loading Document</h3>
                <p>${error.message}</p>
                <p>Please check that the document exists at the expected location.</p>
            </div>
        `;
    }
}

// Event listeners
document.getElementById('document-type').addEventListener('change', () => {
    // Clear stored locale when user manually changes selection
    document.getElementById('language').dataset.originalLocale = '';
    loadDocument();
});

document.getElementById('user-type').addEventListener('change', () => {
    // Clear stored locale when user manually changes selection
    document.getElementById('language').dataset.originalLocale = '';
    loadDocument();
});

document.getElementById('language').addEventListener('change', () => {
    // Clear stored locale when user manually changes selection
    document.getElementById('language').dataset.originalLocale = '';
    loadDocument();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setInitialValues();
    loadDocument();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    setInitialValues();
    loadDocument();
});
