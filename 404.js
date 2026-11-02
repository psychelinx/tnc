// 404 handler (DESIGN.md 6.5). The apex domain moves from Shopify to this site
// for app links only, so every other path goes back to the main website.
(function () {
    var SITE = 'https://www.psychelinx.com';
    var path = window.location.pathname;
    if (path.indexOf('/code/') === 0) {
        // The app is not installed (installed apps open /code/* links directly).
        window.location.replace(SITE + '/pages/download-universal');
    } else {
        window.location.replace(SITE + path + window.location.search + window.location.hash);
    }
})();
