/**
 * Self-contained Font Awesome 6 CSS with base64-embedded font files.
 * Generated once at module load, cached in memory.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedCSS = null;

function buildSelfContainedCSS() {
  // Resolve fontawesome package root from the electron/ directory
  const faRoot = path.resolve(__dirname, "..", "..", "node_modules", "@fortawesome", "fontawesome-free");
  const cssPath = path.join(faRoot, "css", "all.min.css");
  const cssDir = path.join(faRoot, "css");

  let css = fs.readFileSync(cssPath, "utf-8");

  // Replace each url(...) reference with an inline base64 data URI
  css = css.replace(/url\(["']?([^"')]+)["']?\)/g, (match, filePath) => {
    const fullPath = path.resolve(cssDir, filePath);
    if (!fs.existsSync(fullPath)) return match;

    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".woff2" ? "font/woff2" :
      ext === ".woff"  ? "font/woff"  :
      ext === ".ttf"   ? "font/ttf"   :
      ext === ".svg"   ? "image/svg+xml" : "application/octet-stream";

    const data = fs.readFileSync(fullPath).toString("base64");
    return `url(data:${mime};base64,${data})`;
  });

  return css;
}

/**
 * Get self-contained Font Awesome 6 CSS.
 * All @font-face src URLs are replaced with data URIs so no network
 * requests are made when the CSS is used in srcdoc iframes.
 */
export function getFontAwesomeCSS() {
  if (!cachedCSS) {
    cachedCSS = buildSelfContainedCSS();
  }
  return cachedCSS;
}
