// This file contains the base64 encoded logo for prints
// Generated from public/logo.png to ensure it works in print iframes

export const LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// This is a placeholder - we'll load the real logo at runtime
export async function getLogoBase64(): Promise<string> {
  try {
    // Try to fetch the logo from public folder
    const response = await fetch('/logo.png');
    if (!response.ok) throw new Error('Logo not found');
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo:', error);
    // Return a fallback SVG logo
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="#dc2f02"/>
        <path d="M30 50 Q40 30, 50 50 T70 50" fill="none" stroke="white" stroke-width="4"/>
        <circle cx="35" cy="40" r="5" fill="white"/>
        <circle cx="65" cy="40" r="5" fill="white"/>
      </svg>
    `)}`;
  }
}

// Cache the logo once loaded
let cachedLogo: string | null = null;

export async function getCachedLogoBase64(): Promise<string> {
  if (!cachedLogo) {
    cachedLogo = await getLogoBase64();
  }
  return cachedLogo;
}
