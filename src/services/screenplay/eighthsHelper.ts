/**
 * SceneOS — Screenplay Eighths & Duration Math Helper
 * Implements Hollywood industry standard 1/8th page measurements for script breakdowns.
 */

/**
 * Formats an integer number of eighths into industry standard notation:
 * 1 => "1/8"
 * 7 => "7/8"
 * 8 => "1"
 * 11 => "1 3/8"
 * 16 => "2"
 */
export function formatEighths(eighths: number): string {
  if (eighths <= 0) return "1/8";
  
  const wholePages = Math.floor(eighths / 8);
  const remainingEighths = eighths % 8;

  if (wholePages === 0) {
    return `${remainingEighths}/8`;
  }
  if (remainingEighths === 0) {
    return `${wholePages}`;
  }
  return `${wholePages} ${remainingEighths}/8`;
}

/**
 * Parses an eighths string representation back into an integer number of eighths:
 * "1 3/8" => 11
 * "4/8" => 4
 * "2" => 16
 */
export function parseEighths(str: string): number {
  if (!str || typeof str !== 'string') return 1;
  const trimmed = str.trim();

  // Pattern: "1 3/8"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/8$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const fraction = parseInt(mixedMatch[2], 10);
    return Math.max(1, whole * 8 + fraction);
  }

  // Pattern: "3/8"
  const fractionMatch = trimmed.match(/^(\d+)\/8$/);
  if (fractionMatch) {
    return Math.max(1, parseInt(fractionMatch[1], 10));
  }

  // Pattern: "2" or "2.5"
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal) && decimal > 0) {
    return Math.max(1, Math.round(decimal * 8));
  }

  return 1;
}

/**
 * Calculates page length in eighths based on line count:
 * Industry standard: ~55 lines per screenplay page.
 * 1/8 page is roughly ~6.875 lines (rounded to nearest 1/8th, minimum 1/8th).
 */
export function calculateLineEighths(lineCount: number): number {
  if (lineCount <= 0) return 1;
  const linesPerEighth = 55 / 8; // ~6.875 lines per eighth
  const eighths = Math.round(lineCount / linesPerEighth);
  return Math.max(1, eighths);
}

/**
 * Estimated screen duration in minutes from eighths (1 page ≈ 1 minute)
 */
export function eighthsToMinutes(eighths: number): number {
  const minutes = eighths / 8;
  return Math.round(minutes * 10) / 10;
}
