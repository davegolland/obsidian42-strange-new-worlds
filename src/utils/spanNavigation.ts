// NO-OP shim - visual-only approach
// This file provides type definitions but no actual navigation functionality
// All navigation has been removed in favor of visual-only span display

export type CharSpan = { 
  start: number; 
  end: number; 
  unit?: "char" 
};

// No-op function - visual-only approach
export async function openFileAndRevealCharSpan(
  _app: any, 
  _filePath: string, 
  _start: number, 
  _end: number
): Promise<void> {
  // No-op - visual-only approach
  return;
}

// No-op function - visual-only approach  
export function charSpanToLineCh(_text: string, _charIndex: number): any {
  // No-op - visual-only approach
  return { line: 0, ch: 0 };
}

// Legacy function - kept for compatibility but should not be used
export function buildContext(
  _text: string, 
  _start: number, 
  _end: number, 
  _maxLength = 60
): string {
  // No-op - visual-only approach
  return "";
}
