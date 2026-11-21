/* external-links.js - which links the app is willing to hand to a browser.
 *
 * The window used to pass any http(s) URL the renderer asked for straight to
 * shell.openExternal. A renderer injection - a pasted palette name, a plugin
 * package's label, anything that ends up in a link - would then be a way to
 * open an arbitrary page from inside a program the user trusts.
 *
 * The policy is an allowlist of the addresses this project actually links to:
 * its own GitHub pages, its own web build and publicity site, and Lospec, the
 * one third party the palette importer talks to. Everything else is a
 * confirmation prompt, not a silent open, and anything that is not http(s) is
 * refused outright.
 *
 * classify() is pure and is what the tests exercise; main.js only decides how
 * to ask the user.
 */
'use strict';

// Exact hosts. The trailing dot form (github.com.) is normalised away first:
// it resolves to the same name.
const HOSTS = ['github.com', 'thijnperd.github.io', 'lospec.com', 'www.lospec.com'];

// github.com is shared with everyone else on the internet, so on that host only
// the project's own account is ours to open.
const GITHUB_OWNER = '/thijnperd';

function unescapeHost(host) {
  return String(host || '').toLowerCase().replace(/\.$/, '');
}

// Returns 'allow' | 'confirm' | 'deny'.
//   allow   - one of the project's own pages, or Lospec; open it
//   confirm - http(s) somewhere else; ask the user before opening
//   deny    - not a web link at all (javascript:, file:, data:, mailto:)
function classify(raw) {
  if (typeof raw !== 'string' || !raw) return 'deny';
  // A trailing space or a newline is how a link gets split; refuse rather than
  // trim, because a trimmed URL is not the one the renderer asked for.
  if (raw !== raw.trim()) return 'deny';
  let url;
  try {
    url = new URL(raw);
  } catch (err) {
    return 'deny';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'deny';
  // Credentials in the authority are a phishing shape, never a project link.
  if (url.username || url.password) return 'deny';
  const host = unescapeHost(url.hostname);
  if (!host) return 'deny';
  // An http link to one of our own hosts is still a downgrade; ask first.
  const ours = HOSTS.indexOf(host) !== -1 && url.protocol === 'https:';
  if (!ours) return 'confirm';
  if (host === 'github.com') {
    const path = url.pathname.toLowerCase();
    if (path === GITHUB_OWNER || path.indexOf(GITHUB_OWNER + '/') === 0) return 'allow';
    return 'confirm';
  }
  return 'allow';
}

function isAllowed(raw) {
  return classify(raw) === 'allow';
}

// The host and path of a URL, for the confirmation dialog's detail line, or an
// empty string when it is not a URL at all.
function describe(raw) {
  try {
    const url = new URL(String(raw));
    return url.hostname + (url.pathname === '/' ? '' : url.pathname);
  } catch (err) {
    return '';
  }
}

module.exports = { HOSTS: HOSTS, classify: classify, isAllowed: isAllowed, describe: describe };
