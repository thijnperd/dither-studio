# The inbox

Drop new captures here — the app window, a phone, a preset worth showing — and
they wait until they are developed into [`docs/`](../docs/), which is what the
documentation actually shows.

Nothing in this folder is committed. Its own `.gitignore` ignores everything
except itself and this file, so a capture can sit here for a week without ever
reaching a commit, and a fresh clone gets the same rule without needing the
repository root to say anything.

## Dropping one in

- **Replacing a picture in `docs/`** — name it exactly what it replaces, so
  `desktop-app.png` here replaces `docs/desktop-app.png`.
- **A new picture** — name it after what it shows
  (`ice-dot-field-on-a-portrait.png`) and say where it belongs when you hand it
  over.
- A 1440-wide window shot or a phone shot is plenty. The pictures in `docs/`
  run 80–210 KB each; anything past half a megabyte is worth trimming first.
- PNG is what `docs/` holds. A JPEG or a WebP is fine to drop in as a source —
  it gets converted before it is committed.

## Reading the inbox

```bash
node tools/inbox.js
```

This prints every file that is waiting, with its format, byte size and pixel
size, and points out anything heavier than what `docs/` already ships and any
name that would replace a picture already there. It reads the headers itself
and writes nothing, so it is safe to run at any time.

Placing a capture means copying it into `docs/`, linking it from whichever file
shows it (usually `README.md` or `GUIDE.md`) and checking the link resolves.
The inbox itself is never part of that commit.
