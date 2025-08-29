// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        doc: params.get('doc') || 'terms-and-conditions',
        type: params.get('type') || 'patient',
        lang: params.get('lang') || 'it'
    };
}

// Set initial values from URL parameters
function setInitialValues() {
    const params = getUrlParams();
    
    document.getElementById('document-type').value = params.doc;
    document.getElementById('user-type').value = params.type;
    document.getElementById('language').value = params.lang;
}

// Update URL parameters without reloading
function updateUrlParams() {
    const doc = document.getElementById('document-type').value;
    const type = document.getElementById('user-type').value;
    const lang = document.getElementById('language').value;
    
    const params = new URLSearchParams({
        doc: doc,
        type: type,
        lang: lang
    });
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Load and render markdown
async function loadDocument() {
    const doc = document.getElementById('document-type').value;
    const type = document.getElementById('user-type').value;
    const lang = document.getElementById('language').value;
    
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">Loading document...</div>';
    
    try {
        // Construct the file path
        const filePath = `./${doc}/${lang}/${type}.md`;
        console.log(filePath);
        // Fetch the markdown file
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`Document not found: ${filePath}`);
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
document.getElementById('document-type').addEventListener('change', loadDocument);
document.getElementById('user-type').addEventListener('change', loadDocument);
document.getElementById('language').addEventListener('change', loadDocument);

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
