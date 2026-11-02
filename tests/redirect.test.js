// Run with: node --test tests/redirect.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// The 404 handler is inline in 404.html (allowed by a CSP hash).
function inline404() {
    const html = read('404.html');
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(m, '404.html has an inline script');
    return { html, code: m[1] };
}

function run(file, opts) {
    return runCode(file === '404' ? inline404().code : read(file), opts);
}

function runCode(code, { pathname = '/', search = '', hash = '', hostname = 'psychelinx.com' }) {
    const replaced = [];
    const listeners = {};
    const els = {};
    const el = (id) => (els[id] = els[id] || {
        value: '', dataset: {}, innerHTML: '', addEventListener() {},
    });
    const fetched = [];
    const ctx = {
        URLSearchParams,
        console,
        fetch: async (p) => { fetched.push(p); return { ok: true, text: async () => '# T' }; },
        marked: { parse: (m) => `<p>${m}</p>` },
        document: {
            getElementById: el,
            addEventListener: (n, f) => { listeners[n] = f; },
        },
        window: {
            location: { pathname, search, hash, hostname, replace: (u) => replaced.push(u) },
            history: { replaceState() {} },
            addEventListener() {},
        },
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return { replaced, listeners, fetched, els };
}

test('index without doc redirects to the main site and loads nothing', async () => {
    const r = run('script.js', { pathname: '/tnc/', search: '' });
    assert.deepStrictEqual(r.replaced, ['https://www.psychelinx.com/']);
    if (r.listeners.DOMContentLoaded) await r.listeners.DOMContentLoaded();
    assert.strictEqual(r.fetched.length, 0);
});

test('legal documents still load when doc is present', async () => {
    const r = run('script.js', { search: '?doc=privacy-policy&type=clinician&locale=en-US' });
    assert.deepStrictEqual(r.replaced, []);
    r.listeners.DOMContentLoaded();
    await new Promise((res) => setTimeout(res, 20));
    assert.deepStrictEqual(r.fetched, ['./privacy-policy/en/clinician.md']);
    assert.strictEqual(r.els.content.innerHTML, '<p># T</p>');
});

test('404 on /code/ goes to the download page', () => {
    const r = run('404', { pathname: '/code/ABC123', search: '?x=1', hash: '#k=2' });
    assert.deepStrictEqual(r.replaced, ['https://www.psychelinx.com/pages/download-universal']);
});

test('404 elsewhere keeps path, query and hash', () => {
    const r = run('404', { pathname: '/pages/faq', search: '?a=b', hash: '#c' });
    assert.deepStrictEqual(r.replaced, ['https://www.psychelinx.com/pages/faq?a=b#c']);
});

test('/codex is not treated as a /code/ link', () => {
    const r = run('404', { pathname: '/codex' });
    assert.deepStrictEqual(r.replaced, ['https://www.psychelinx.com/codex']);
});

test('index.html pins marked with SRI and has a meta CSP', () => {
    const html = read('index.html');
    assert.match(html, /marked@\d+\.\d+\.\d+\/marked\.min\.js" integrity="sha384-[A-Za-z0-9+\/=]+" crossorigin="anonymous"/);
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.doesNotMatch(html, /marked\/marked\.min\.js/);
});

test('404 on the project site removes the repository segment', () => {
    const host = { hostname: 'psychelinx.github.io' };
    assert.deepStrictEqual(
        run('404', { ...host, pathname: '/tnc/code/ABC123' }).replaced,
        ['https://www.psychelinx.com/pages/download-universal']);
    assert.deepStrictEqual(
        run('404', { ...host, pathname: '/tnc/pages/faq', search: '?a=b', hash: '#c' }).replaced,
        ['https://www.psychelinx.com/pages/faq?a=b#c']);
    assert.deepStrictEqual(
        run('404', { ...host, pathname: '/tnc' }).replaced,
        ['https://www.psychelinx.com/']);
});

test('404 on the apex does not remove a path segment', () => {
    const r = run('404', { pathname: '/tnc/code/X' });
    assert.deepStrictEqual(r.replaced, ['https://www.psychelinx.com/tnc/code/X']);
});

test('404.html CSP allows exactly its inline script and nothing else', () => {
    const { html, code } = inline404();
    const digest = crypto.createHash('sha256').update(code, 'utf8').digest('base64');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    assert.ok(csp, '404.html has a meta CSP');
    assert.strictEqual(csp[1], `default-src 'none'; script-src 'sha256-${digest}'`);
    assert.doesNotMatch(html, /<script[^>]+src=/);
    assert.strictEqual((html.match(/<script/g) || []).length, 1);
});
