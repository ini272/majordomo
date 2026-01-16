/**
 * Font Loading Debug Utilities
 *
 * Helps diagnose font loading issues by logging:
 * - When fonts are loaded
 * - Which fonts are available
 * - Computed styles for elements
 */

export interface FontDebugInfo {
  fontsLoaded: boolean;
  availableFonts: Array<{
    family: string;
    weight: string;
    style: string;
    status: string;
  }>;
  timestamp: number;
}

/**
 * Enable comprehensive font loading debugging
 */
export function debugFontLoading(): void {
  console.group('🔤 Font Loading Debug');

  // Check if Font Loading API is available
  if (!('fonts' in document)) {
    console.warn('⚠️ Font Loading API not available in this browser');
    console.groupEnd();
    return;
  }

  console.log('📦 Font Loading API available');
  console.log('🔄 Current font loading status:', document.fonts.status);
  console.log('📊 Fonts currently available:', document.fonts.size);

  // Log all currently loaded fonts
  logCurrentFonts();

  // Wait for all fonts to load
  document.fonts.ready.then(() => {
    console.log('✅ All fonts loaded!');
    console.log('📊 Total fonts loaded:', document.fonts.size);
    logCurrentFonts();
    console.groupEnd();
  });

  // Listen for individual font loading events
  document.fonts.addEventListener('loadingdone', (event: FontFaceSetLoadEvent) => {
    console.log('✅ Font loading done:', event.fontfaces);
    event.fontfaces.forEach(font => {
      console.log(`  Loaded: ${font.family} ${font.weight} ${font.style}`);
    });
  });

  document.fonts.addEventListener('loadingerror', (event: FontFaceSetLoadEvent) => {
    console.error('❌ Font loading error!', event.fontfaces);
    event.fontfaces.forEach(font => {
      console.error(`  Failed: ${font.family} ${font.weight} ${font.style}`);
    });
  });
}

/**
 * Log all currently available fonts
 */
function logCurrentFonts(): void {
  const fontsList: string[] = [];
  document.fonts.forEach((font: FontFace) => {
    const fontInfo = `${font.family} (${font.weight} ${font.style}) - ${font.status}`;
    fontsList.push(fontInfo);
  });

  if (fontsList.length > 0) {
    console.table(fontsList);
  } else {
    console.log('No fonts registered yet');
  }
}

/**
 * Check computed styles for an element
 */
export function debugElementFont(selector: string): void {
  const element = document.querySelector(selector);

  if (!element) {
    console.error(`❌ Element not found: ${selector}`);
    return;
  }

  const computed = window.getComputedStyle(element);

  console.group(`🎯 Font Debug for: ${selector}`);
  console.log('font-family:', computed.fontFamily);
  console.log('font-weight:', computed.fontWeight);
  console.log('font-style:', computed.fontStyle);
  console.log('font-size:', computed.fontSize);

  // Try to determine which font is actually being used
  const fontFamily = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  console.log('Primary font requested:', fontFamily);

  // Check if this font is loaded
  if ('fonts' in document) {
    const fontFaces: FontFace[] = [];
    document.fonts.forEach((font: FontFace) => {
      if (font.family.replace(/['"]/g, '') === fontFamily) {
        fontFaces.push(font);
      }
    });

    if (fontFaces.length > 0) {
      console.log(`✅ Font "${fontFamily}" is loaded:`, fontFaces);
    } else {
      console.warn(`⚠️ Font "${fontFamily}" is NOT loaded - using fallback`);
    }
  }

  console.groupEnd();
}

/**
 * Get current font debug information (useful for React state)
 */
export function getFontDebugInfo(): FontDebugInfo {
  const availableFonts: Array<{
    family: string;
    weight: string;
    style: string;
    status: string;
  }> = [];

  if ('fonts' in document) {
    document.fonts.forEach((font: FontFace) => {
      availableFonts.push({
        family: font.family,
        weight: font.weight,
        style: font.style,
        status: font.status,
      });
    });
  }

  return {
    fontsLoaded: document.fonts?.status === 'loaded',
    availableFonts,
    timestamp: Date.now(),
  };
}

/**
 * Check if a specific font family is loaded
 */
export function isFontLoaded(fontFamily: string): boolean {
  if (!('fonts' in document)) {
    return false;
  }

  let found = false;
  document.fonts.forEach((font: FontFace) => {
    if (font.family.replace(/['"]/g, '') === fontFamily && font.status === 'loaded') {
      found = true;
    }
  });

  return found;
}

/**
 * Wait for a specific font to load
 */
export async function waitForFont(
  fontFamily: string,
  weight: string = '400',
  style: string = 'normal',
  timeout: number = 5000
): Promise<boolean> {
  if (!('fonts' in document)) {
    return false;
  }

  try {
    await document.fonts.load(`${weight} ${style} 16px "${fontFamily}"`, undefined);
    console.log(`✅ Font loaded: ${fontFamily} ${weight} ${style}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to load font: ${fontFamily}`, error);
    return false;
  }
}
