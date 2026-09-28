const $ = (el) => document.getElementById(el);
/* scriptinjected.js - Interceptor y utilidades compartidas de NyxHub */

const ACCESS_JSON_URL = '/accessPasswords.json';
const TOKEN_STORAGE_KEY = 'nyxhub_accessTokens';
const RECENT_LOG_KEY = 'nyxhub_recentAccess';
const TOKEN_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

let _accessDataCache = null;

async function getAccessData() {
    if (_accessDataCache) return _accessDataCache;
    const res = await fetch(ACCESS_JSON_URL, { cache: 'no-store' });
    const data = await res.json();
    _accessDataCache = data.filesAccessData || [];
    return _accessDataCache;
}

function findEntryByUrl(pathname, accessData) {
    let match = null;
    for (const entry of accessData) {
        if (pathname === entry.pageUrl || pathname.startsWith(entry.pageUrl + '/')) {
            if (!match || entry.pageUrl.length > match.pageUrl.length) match = entry;
        }
    }
    return match;
}

function findEntryByAccessCode(code, accessData) {
    return accessData.find(e => e.accessCode === code) || null;
}

function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function saveToken(pageUrl) {
    const tokens = getTokens();
    tokens[pageUrl] = { expires: Date.now() + TOKEN_DURATION_MS };
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

function isAuthorized(pageUrl) {
    const tokens = getTokens();
    const token = tokens[pageUrl];
    if (!token) return false;
    if (Date.now() > token.expires) {
        delete tokens[pageUrl];
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
        return false;
    }
    return true;
}

function logRecentAccess(pageUrl, type = 'protected') {
    const log = JSON.parse(localStorage.getItem(RECENT_LOG_KEY) || '[]');
    log.unshift({ pageUrl, type, timestamp: Date.now() });
    localStorage.setItem(RECENT_LOG_KEY, JSON.stringify(log.slice(0, 20)));
}

/*=============================
        Interceptor principal
=============================*/
(async function nyxhubInterceptor() {
    const path = window.location.pathname;

    if (path.startsWith('/webs/')) {
        const accessData = await getAccessData();
        const entry = findEntryByUrl(path, accessData);

        if (!entry) {
            window.location.href = '/requestAccess.html?target=' + encodeURIComponent(path);
            return;
        }

        if (isAuthorized(entry.pageUrl)) {
            logRecentAccess(entry.pageUrl, 'webpage');
            document.documentElement.style.visibility = 'visible';
            return;
        }

        window.location.href = '/requestAccess.html?target=' + encodeURIComponent(path);
        return;
    }

    if (path.startsWith('/public/') || path.startsWith('/shared/')) {
        logRecentAccess(path, path.startsWith('/public/') ? 'public' : 'shared');
    }
})();