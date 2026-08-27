import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const sourceBase = "https://vocabulary-foundation-one.mstrangtrieuenglishh.chatgpt.site";
const buildStamp = "20260827-1";

function lessonCode(number) {
  return String(number).padStart(2, "0");
}

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function convertDriveIframes(html, number) {
  let count = 0;
  const converted = html.replace(
    /<iframe\b([^>]*?)src="https:\/\/drive\.google\.com\/file\/d\/([^/\"]+)\/preview"([^>]*)><\/iframe>/gi,
    (tag, before, driveId, after) => {
      count += 1;
      const attrs = `${before} ${after}`;
      const title = attrs.match(/title="([^"]*)"/i)?.[1] || `Discover English Video ${lessonCode(number)}`;
      return `<div class="video-shell" data-drive-id="${escapeAttribute(driveId)}" data-title="${escapeAttribute(title)}"></div>`;
    },
  );

  if (count < 1) {
    throw new Error(`Lesson ${lessonCode(number)}: no Google Drive video found`);
  }
  return converted;
}

function convertLocalVideos(html, number, firstDriveId) {
  if (number === 50) return html;
  let count = 0;
  const converted = html.replace(
    /<video\b([^>]*?)src="\.\/de-video-[0-9]+\.mp4"([^>]*)><\/video>/gi,
    (tag, before, after) => {
      count += 1;
      const attrs = `${before} ${after}`;
      const title = attrs.match(/aria-label="([^"]*)"/i)?.[1] || `Discover English Video ${lessonCode(number)}`;
      return `<div class="video-shell" data-drive-id="${escapeAttribute(firstDriveId)}" data-title="${escapeAttribute(title)}"></div>`;
    },
  );
  if (count < 1) throw new Error(`Lesson ${lessonCode(number)}: no local practice video found`);
  return converted;
}

function transform(html, number) {
  const firstDriveId = html.match(/drive\.google\.com\/file\/d\/([^/\"]+)\/preview/i)?.[1];
  if (!firstDriveId) throw new Error(`Lesson ${lessonCode(number)}: missing primary Drive video`);
  let output = convertLocalVideos(html, number, firstDriveId);
  output = convertDriveIframes(output, number);
  output = output.replaceAll('src="/ms-trang-trieu-education-logo.png"', 'src="../ms-trang-trieu-education-logo.png"');
  output = output.replaceAll('href="/android-video-controls.css"', 'href="../android-video-controls.css"');
  output = output.replaceAll('src="/android-video-controls.js"', 'src="../android-video-controls.js"');
  output = output.replace(
    /href="https:\/\/vocabulary-foundation-one\.mstrangtrieuenglishh\.chatgpt\.site\/de-[0-9]+-live\/video\.html"/g,
    'href="./video.html"',
  );
  output = output.replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?<\/script>/g, "");
  output = output.replace(
    "</head>",
    `  <link rel="stylesheet" href="../mobile-video-fallback.css?v=${buildStamp}">\n</head>`,
  );
  output = output.replace(
    "</body>",
    `  <script src="../mobile-video-fallback.js?v=${buildStamp}"></script>\n</body>`,
  );
  return { html: output, firstDriveId };
}

function fullscreenPage(number, firstDriveId) {
  const code = lessonCode(number);
  const player = number === 50
    ? `<video controls muted playsinline preload="metadata" src="./de-video-50.mp4" aria-label="Discover English Video 50 - bản tắt tiếng"></video>`
    : `<div class="video-shell" data-drive-id="${escapeAttribute(firstDriveId)}" data-title="Discover English Video ${code} - bản tắt tiếng"></div>`;
  const fallbackAssets = number === 50
    ? ""
    : `\n  <link rel="stylesheet" href="../mobile-video-fallback.css?v=${buildStamp}">`;
  const fallbackScript = number === 50
    ? ""
    : `\n  <script src="../mobile-video-fallback.js?v=${buildStamp}"></script>`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Discover English - Video ${code}</title>${fallbackAssets}
<style>html,body{margin:0;min-height:100%;background:#080b14}body{display:grid;place-items:center}.player{width:min(1400px,100%)}video{display:block;width:100%;max-height:100vh;background:#080b14}</style></head>
<body><main class="player">${player}</main>${fallbackScript}</body></html>`;
}

async function fetchLesson(number) {
  const code = lessonCode(number);
  const url = `${sourceBase}/de-${code}-live/`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lesson ${code}: ${response.status} ${response.statusText}`);
  const html = await response.text();
  if (!html.includes(`Discover English - Video ${code}`)) {
    throw new Error(`Lesson ${code}: unexpected source page`);
  }
  const transformed = transform(html, number);
  return { number, ...transformed };
}

await Promise.all(
  Array.from({ length: 50 }, (_, index) => index + 1).map(async (number) => {
    const { html, firstDriveId } = await fetchLesson(number);
    const dir = path.join(root, `lesson-${lessonCode(number)}`);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), html, "utf8");
    await writeFile(path.join(dir, "video.html"), fullscreenPage(number, firstDriveId), "utf8");
  }),
);

await copyFile(
  path.resolve(root, "..", "critical-github", "ms-trang-trieu-education-logo.png"),
  path.join(root, "ms-trang-trieu-education-logo.png"),
);

for (const asset of ["android-video-controls.css", "android-video-controls.js"]) {
  const response = await fetch(`${sourceBase}/${asset}`);
  if (!response.ok) throw new Error(`${asset}: ${response.status} ${response.statusText}`);
  await writeFile(path.join(root, asset), await response.text(), "utf8");
}

const finalVideoUrl = `${sourceBase}/de-50-live/de-video-50.mp4`;
const finalVideoResponse = await fetch(finalVideoUrl);
if (!finalVideoResponse.ok) {
  throw new Error(`Lesson 50 video: ${finalVideoResponse.status} ${finalVideoResponse.statusText}`);
}
await writeFile(
  path.join(root, "lesson-50", "de-video-50.mp4"),
  Buffer.from(await finalVideoResponse.arrayBuffer()),
);

console.log("Built 50 Discover English lessons.");
