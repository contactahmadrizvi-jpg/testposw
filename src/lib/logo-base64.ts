// This file contains the base64 encoded logo for prints
// Logo is already transparent PNG - no processing needed!

export const LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Load the transparent logo from public folder
export async function getLogoBase64(): Promise<string> {
  try {
    // Fetch the logo from public folder (already transparent!)
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
    // Return a fallback SVG logo (transparent chef character)
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <style>
            .chef-body { fill: #ffffff; stroke: #000000; stroke-width: 4; }
            .chef-details { fill: #dc2f02; }
          </style>
        </defs>
        <!-- Chef Hat -->
        <ellipse cx="100" cy="60" rx="45" ry="25" class="chef-body"/>
        <rect x="55" y="60" width="90" height="15" class="chef-body"/>
        <!-- Head -->
        <circle cx="100" cy="110" r="35" class="chef-body"/>
        <!-- Eyes -->
        <circle cx="90" cy="105" r="4" fill="#000000"/>
        <circle cx="110" cy="105" r="4" fill="#000000"/>
        <!-- Nose -->
        <ellipse cx="100" cy="115" rx="3" ry="5" fill="#000000"/>
        <!-- Mouth -->
        <path d="M 85 125 Q 100 135, 115 125" fill="none" stroke="#000000" stroke-width="3"/>
        <!-- Chicken Leg -->
        <ellipse cx="70" cy="95" rx="12" ry="18" class="chef-details"/>
        <rect x="64" y="110" width="12" height="8" class="chef-details" rx="2"/>
        <!-- Body -->
        <ellipse cx="100" cy="155" rx="30" ry="35" class="chef-body"/>
        <!-- Feet -->
        <ellipse cx="85" cy="185" rx="10" ry="8" class="chef-details"/>
        <ellipse cx="115" cy="185" rx="10" ry="8" class="chef-details"/>
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
