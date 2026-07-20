import { toPng } from "html-to-image";

// The bracket container scrolls horizontally (overflow-x-auto) once it's
// wider than the viewport — html-to-image otherwise only rasterizes what's
// currently visible. Passing explicit width/height (the container's full
// scrollWidth/scrollHeight, the same values the component's own wire-SVG
// overlay already sizes itself to) makes it render the whole bracket
// instead of just the scrolled-into-view slice. backgroundColor is needed
// because the bracket itself has no opaque background of its own (unlike
// TeamCard's faces) — it just shows the page's dark background through the
// gaps between match cards.
export async function downloadBracket(el, tournamentName) {
  if (!el) return;
  const dataUrl = await toPng(el, {
    width: el.scrollWidth,
    height: el.scrollHeight,
    backgroundColor: "#09090B",
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${tournamentName}-bracket.png`;
  a.click();
}
