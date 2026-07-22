import { toPng } from "html-to-image";

// The back face keeps its own rotateY(180deg) in its inline style at all
// times (it's what cancels the parent flip container's rotation so the back
// reads right-side-up when flipped). html-to-image snapshots this node in
// isolation, without that parent, so the un-cancelled rotateY mirrors the
// whole export. Clearing it just for the snapshot (and restoring right
// after) keeps the live flip visual intact.
//
// `cardHandle` is TeamCard's imperative handle: { node, face }, not a bare
// DOM element — `face` ("front"/"back") goes into the filename so saving
// both sides doesn't silently overwrite one with the other (they used to
// share the exact same `${teamName}-card.png` name).
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

// A card that loads already-opened (isPackOpened, no reveal animation to
// wait out) can still have cardHandle.node read as null on the very first
// tick after mount — the ref committing to the DOM and this button becoming
// clickable aren't strictly ordered the same way every time. `node` is a
// getter (see TeamCard's useImperativeHandle), so re-reading it after
// yielding a frame or two picks up the real element once React's committed
// it; this loop is just that wait, capped so a genuinely missing card
// (nothing to export) still gives up instead of hanging the button forever.
async function resolveCardNode(cardHandle) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const el = cardHandle?.node;
    if (el) return el;
    await nextFrame();
  }
  return null;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function downloadTeamCard(cardHandle, teamName) {
  const el = await resolveCardNode(cardHandle);
  if (!el) return;
  const prevTransform = el.style.transform;
  el.style.transform = "none";
  try {
    // html-to-image embeds @font-face rules by reading cssRules off every
    // loaded stylesheet, including the Google Fonts <link> in index.html.
    // That link now carries `crossorigin="anonymous"` (Google Fonts serves
    // permissive CORS headers) specifically so this read succeeds — without
    // it, the browser throws a SecurityError on that cross-origin sheet,
    // which used to make toPng() abort before ever reaching a.click() (the
    // button silently did nothing). Skipping font embedding entirely
    // (skipFonts: true) used to be the workaround, but the exported PNG
    // never carried any @font-face info that way — the display font
    // (Unbounded) silently fell back to a generic system font in the
    // downloaded image while matching fine on-screen, a real, user-visible
    // bug reported after export (Red Phoenix card: "IMMORTAL" in a plain
    // sans instead of the display font). Fixing the CORS attribute at the
    // source lets font embedding actually work instead of needing to skip it.
    //
    // Wrapped in a timeout too: toPng() has measurably hung for several
    // seconds to indefinitely on this card — reproduced consistently, cause
    // not fully pinned down (this card's node is a heavy one to serialize:
    // an embedded raster background image plus a large dump of inline
    // styles per element, going through html-to-image's canvas/Image.onload
    // step). Whatever the exact mechanism, an unbounded hang here reads
    // identically to "the button does nothing" from the user's side, so
    // this at least guarantees the button recovers instead of spinning
    // forever.
    const dataUrl = await withTimeout(toPng(el), 15000, "Card export timed out");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${teamName}-card-${cardHandle.face}.png`;
    a.click();
  } finally {
    el.style.transform = prevTransform;
  }
}
