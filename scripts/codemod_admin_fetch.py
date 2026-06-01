"""
iter96 · adminFetch codemod.

Sweeps every BackOffice / admin page that calls `fetch(${BACKEND}/api/admin/...`
and migrates it to `adminFetch('/api/admin/...')`. The wrapper preserves the
existing fetch() contract (returns Response, no throw, no JSON parse), so we
DON'T need to touch the .ok / .json() handling at the callsite — it just
keeps working.

Transformations:
  1. Add `import { adminFetch } from '<n>/../lib/fetchAdmin'` (relative path).
  2. Replace every `fetch(\`${BACKEND}/api/admin/...`...)` invocation with
     `adminFetch(\`/api/admin/...\`, { ...options... })`.
  3. Inside the options object: strip the X-Admin-Token header entry (cookie
     does the work), strip credentials: 'include' (now the default), strip
     headers: { 'Content-Type': 'application/json' } when it's the only
     remaining header (auto-applied by buildAdminRequest on bodied methods).
  4. If the file no longer references BACKEND anywhere except the import,
     remove the `const BACKEND = process.env.REACT_APP_BACKEND_URL;` line.
  5. If `token` parameter is still used in the options (it shouldn't be —
     cookie wins), leave it intact (`token: foo` survives as a back-compat
     X-Admin-Token header via buildAdminRequest).

Conservative: anything we can't pattern-match cleanly is left alone and
listed at the end for manual review.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

FRONTEND = Path('/app/frontend/src')

# Files to migrate (collected from `grep -l X-Admin-Token`)
TARGETS = [
    'pages/BackOfficeProfilerFunnel.jsx', 'pages/BackOfficeQueue.jsx',
    'pages/StreamersAdmin.jsx', 'pages/FoundationalResearch.jsx',
    'pages/BackOfficeVoyagerRotation.jsx', 'pages/BackOfficeActivity.jsx',
    'pages/BackOfficeStreamerMeta.jsx',
    'pages/BackOfficeMestariDiagnosticsCopy.jsx', 'pages/BackOfficeLeads.jsx',
    'pages/BackOfficeSlotRegistry.jsx', 'pages/BackOfficeDrafts.jsx',
    'pages/BackOfficeVoita.jsx', 'pages/BackOfficeOptinSegments.jsx',
    'pages/BackOfficeIntegrations.jsx', 'pages/BackOfficeFunnelHistory.jsx',
    'pages/BackOfficeTelegram.jsx', 'pages/BackOfficeVoitaQuiz.jsx',
    'pages/BackOfficeToday.jsx', 'pages/BackOfficeSettings.jsx',
    'pages/BackOfficeEmailTemplates.jsx', 'pages/BackOfficeMiniGameAnalytics.jsx',
    'pages/BackOfficeNewsWatch.jsx', 'pages/BackOfficeRunbook.jsx',
    'pages/BackOfficeWebhooks.jsx', 'pages/BackOfficeMittariCopy.jsx',
    'pages/BackOfficeBotRouting.jsx', 'pages/BackOfficePlaybook.jsx',
    'pages/BackOfficeMiniGames.jsx', 'pages/BackOfficeOgImages.jsx',
    'pages/BackOfficeDispatchPreview.jsx', 'pages/BackOfficeWeekly.jsx',
    'pages/OperatorsAdmin.jsx', 'pages/BackOfficeMestariCopy.jsx',
    'pages/BackOfficePeli.jsx', 'pages/BackOfficeMittariGrading.jsx',
    'components/Layer2StatusPanel.jsx',
]

# Pattern: fetch(`${BACKEND}/api/admin/...`, { ... })  OR  fetch(`${BACKEND}/api/admin/...`)
# Captures: (1) full URL after BACKEND including any template expressions/query string
# We walk character by character to balance the surrounding parens since the
# options object can contain nested {}.
def find_and_rewrite_calls(src: str) -> tuple[str, int]:
    n = 0
    out = []
    i = 0
    pat = re.compile(r"fetch\(`\$\{BACKEND\}(/api/admin/[^`]+)`")
    while i < len(src):
        m = pat.search(src, i)
        if not m:
            out.append(src[i:])
            break
        out.append(src[i:m.start()])
        url_path = m.group(1)
        # Find the closing `)` matching the opening fetch( — track nesting
        # of parens + braces, ignoring strings.
        j = m.end()  # right after the closing backtick of the URL
        # Skip comma/whitespace
        while j < len(src) and src[j] in ' \t\n,':
            j += 1
        # Now we're either at `)` (no options) or `{` (options object).
        if j < len(src) and src[j] == ')':
            # No options
            out.append(f"adminFetch(`{url_path}`")
            i = j  # the closing `)` is consumed below
            out.append(src[i])
            i += 1
            n += 1
            continue
        if j < len(src) and src[j] == '{':
            # Walk balanced braces
            depth = 0
            k = j
            in_str = None
            while k < len(src):
                c = src[k]
                if in_str:
                    if c == '\\':
                        k += 2; continue
                    if c == in_str:
                        in_str = None
                elif c in ('"', "'", '`'):
                    in_str = c
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        k += 1; break
                k += 1
            options_block = src[j:k]
            # Skip closing ) of fetch
            tail = k
            while tail < len(src) and src[tail] in ' \t\n,':
                tail += 1
            if tail >= len(src) or src[tail] != ')':
                # Pattern didn't match cleanly — leave as is.
                out.append(src[m.start():tail + 1])
                i = tail + 1
                continue
            # Sanitise options
            new_opts = sanitise_options(options_block)
            new_call = f"adminFetch(`{url_path}`, {new_opts})"
            out.append(new_call)
            i = tail + 1
            n += 1
            continue
        # Unknown shape — leave alone
        out.append(src[m.start():m.end()])
        i = m.end()
    return ''.join(out), n


def sanitise_options(block: str) -> str:
    """Strip credentials: 'include' (now default), remove X-Admin-Token header
    entries (cookie does the work), drop trivial headers blocks that become
    empty. Returns the cleaned options-object string."""
    s = block

    # 1. Remove credentials: 'include' (and the trailing comma/whitespace)
    s = re.sub(r"credentials:\s*['\"]include['\"]\s*,?\s*", '', s)

    # 2. Remove `'X-Admin-Token': <anything until comma or }>` inside a
    #    headers object.
    s = re.sub(r"['\"]X-Admin-Token['\"]\s*:\s*[^,}]+,?\s*", '', s)

    # 3. If a `headers: { ... }` block now contains only the Content-Type
    #    entry, drop the entire headers block — adminFetch sets
    #    Content-Type automatically on bodied methods.
    def _maybe_drop_headers(match):
        inner = match.group(1).strip().rstrip(',').strip()
        # Only Content-Type left?
        ct_only = re.fullmatch(r"['\"]Content-Type['\"]\s*:\s*['\"]application/json['\"]\s*", inner, re.S)
        if ct_only:
            return ''
        # Or completely empty (headers: {} or with whitespace)
        if not inner:
            return ''
        # Otherwise rebuild the headers block intact
        return f"headers: {{ {inner} }},"

    s = re.sub(r"headers:\s*\{([^{}]*)\},?\s*", _maybe_drop_headers, s)

    # 4. Tidy: collapse adjacent blank lines, trailing commas, repeated spaces
    s = re.sub(r",\s*,", ',', s)
    s = re.sub(r"\{\s*,", '{', s)
    s = re.sub(r",\s*\}", '}', s)
    s = re.sub(r"\{\s*\}", '{}', s)
    s = re.sub(r"\n\s*\n+", '\n', s)
    return s


def ensure_import(src: str, file_relative_to_src: Path) -> str:
    """Inject `import { adminFetch } from '<n>/../lib/fetchAdmin';` if missing.
    Computes the right relative path from the file's location."""
    if 'adminFetch' not in src:
        return src
    if "from '../lib/fetchAdmin'" in src or 'from "../lib/fetchAdmin"' in src \
       or "from '../../lib/fetchAdmin'" in src:
        return src
    # Compute relative path
    depth = len(file_relative_to_src.parent.parts)  # e.g. "pages" → 1
    prefix = '../' * depth + 'lib/fetchAdmin'
    import_line = f"import {{ adminFetch }} from '{prefix}';\n"
    # Insert after the last existing top-level import
    lines = src.splitlines(keepends=True)
    last_import_idx = -1
    for idx, line in enumerate(lines):
        if line.startswith('import ') and ' from ' in line:
            last_import_idx = idx
    if last_import_idx == -1:
        return import_line + src
    lines.insert(last_import_idx + 1, import_line)
    return ''.join(lines)


def maybe_remove_backend_const(src: str) -> str:
    """If BACKEND is no longer referenced anywhere except the const itself,
    remove the const + the import of process.env (it's only used through
    REACT_APP_BACKEND_URL anyway)."""
    if src.count('BACKEND') > 1:
        return src
    # Remove the const declaration line
    return re.sub(r"^const BACKEND = process\.env\.REACT_APP_BACKEND_URL;\s*\n", '', src, flags=re.M)


def migrate_file(path: Path) -> tuple[int, str | None]:
    if not path.exists():
        return 0, f"missing"
    src = path.read_text()
    original = src
    new_src, n = find_and_rewrite_calls(src)
    if n == 0:
        return 0, None
    relative = path.relative_to(FRONTEND)
    new_src = ensure_import(new_src, relative)
    new_src = maybe_remove_backend_const(new_src)
    if new_src == original:
        return 0, "no-op"
    path.write_text(new_src)
    return n, None


def main() -> int:
    total = 0
    total_files = 0
    skipped = []
    for rel in TARGETS:
        p = FRONTEND / rel
        n, err = migrate_file(p)
        if err:
            skipped.append((rel, err))
            continue
        if n > 0:
            print(f"  ✓ {rel}: +{n}")
            total += n
            total_files += 1
    print(f"\nDONE: {total} calls migrated across {total_files} files.")
    if skipped:
        print(f"Skipped: {len(skipped)} files")
        for s in skipped:
            print(f"  - {s[0]}: {s[1]}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
