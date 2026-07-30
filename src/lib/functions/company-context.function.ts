import { fetch } from "@tauri-apps/plugin-http";

export async function fetchCompanyContext(url: string): Promise<string> {
  if (!url) return "";
  
  // Basic validation and protocol addition
  let targetUrl = url.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      // Important to look like a browser to avoid simple bot blocks
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch company URL: ${response.status}`);
      return "";
    }

    const html = await response.text();
    
    // Very simple HTML to text extraction (since we are in a browser context)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Remove scripts, styles, navs
    const elementsToRemove = doc.querySelectorAll("script, style, nav, footer, iframe, img, svg");
    elementsToRemove.forEach(el => el.remove());
    
    let textContent = doc.body.textContent || "";
    
    // Clean up whitespace
    textContent = textContent.replace(/\s+/g, " ").trim();
    
    // Limit to roughly 5000 chars to avoid blowing up the prompt context window
    return textContent.substring(0, 5000);
  } catch (error) {
    console.error("Error fetching company context:", error);
    return "";
  }
}
