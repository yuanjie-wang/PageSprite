/** Inject CSS to constrain content width to 100% and a scroll-tracking script
 * into HTML before rendering in the global preview iframe.
 */
export function injectScrollScript(html: string): string {
  const styleTag = `<style>html,body{margin:0;padding:0;width:100%;box-sizing:border-box}*,*::before,*::after{box-sizing:border-box}img,video,table,pre,code,svg{max-width:100%;height:auto}</style>`;

  let result = html;
  if (result.includes('</head>')) {
    result = result.replace('</head>', styleTag + '</head>');
  } else if (result.includes('<head>')) {
    result = result.replace('<head>', '<head>' + styleTag);
  } else {
    result = styleTag + result;
  }

  const script = `<script>
(function(){
  var sending = false;
  function sendScroll() {
    if (sending) return;
    sending = true;
    requestAnimationFrame(function() {
      window.parent.postMessage({
        type: 'pagesprite-scroll',
        scrollX: window.scrollX || document.documentElement.scrollLeft || 0,
        scrollY: window.scrollY || document.documentElement.scrollTop || 0
      }, '*');
      sending = false;
    });
  }
  window.addEventListener('scroll', sendScroll);
  sendScroll();
})();
</script>`;

  if (result.includes('</body>')) {
    return result.replace('</body>', script + '</body>');
  }
  return result + script;
}

/**
 * Wrap per-rect generated content (plain HTML fragment, no html/head/body)
 * in a full document with CSS that fills the rect area without scrollbars.
 */
export function wrapRectContent(html: string): string {
  const style = `<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff}*{box-sizing:border-box}img,video,table,pre,code,svg{max-width:100%;height:auto}#_ps{width:100%;height:100%;overflow:hidden}</style>`;
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' + style + '</head><body><div id="_ps">' + html + '</div></body></html>';
}

/** Generate a unique ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/**
 * Default system prompt for PageSprite
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a frontend page generator. Generate complete, standalone HTML files with embedded CSS and JavaScript.

Requirements:
- Output a single HTML file with inline <style> and <script> tags
- Use modern CSS (flexbox, grid, custom properties)
- Designs must be fully responsive: use relative units (%, vw, vh, fr), media queries, and flexible layouts so the page adapts gracefully to any viewport size
- Use CSS transitions/animations sparingly for polish
- Do NOT use external CDN links (except for icon libraries if essential)
- Wrap the output in a markdown code block with \`\`\`html

When the user provides annotations, they describe specific areas of the rendered page that need changes. Pay close attention to the annotation positions and text.`;

