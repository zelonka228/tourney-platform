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
export async function downloadTeamCard(cardHandle, teamName) {
  const el = cardHandle?.node;
  if (!el) return;
  const prevTransform = el.style.transform;
  el.style.transform = "none";
  try {
    const dataUrl = await toPng(el);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${teamName}-card-${cardHandle.face}.png`;
    a.click();
  } finally {
    el.style.transform = prevTransform;
  }
}
