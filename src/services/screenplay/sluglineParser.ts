/**
 * SceneOS — Slugline & Scene Heading Parser
 * Robust identification and breakdown of scene headings into Int/Ext, Location, and Time of Day.
 */

import { SceneIntExt, SceneTimeOfDay } from './types';

export interface ParsedSlugline {
  isSlugline: boolean;
  intExt: SceneIntExt;
  location: string;
  timeOfDay: SceneTimeOfDay;
  rawHeading: string;
  sceneNumber?: string;
}

// Regex to detect industry standard scene headings
// Matches: INT., EXT., INT./EXT., INT/EXT, I/E., I/E, EXT./INT., EXT/INT, followed by dot/space/dash
const SLUGLINE_PREFIX_REGEX = /^(?:(\d+[A-Z]?)\s+)?(INT\.\/EXT\.|INT\/EXT|EXT\.\/INT\.|EXT\/INT|INT\.|EXT\.|I\/E\.|I\/E|INT|EXT)\s*[\.\-\–]?\s+(.+)$/i;

// Forced sluglines (Fountain spec: leading period followed by uppercase letters)
const FORCED_SLUGLINE_REGEX = /^\.([A-Z0-9_\-\s\.\/]+)$/;

export function parseSlugline(line: string): ParsedSlugline {
  const trimmed = line.trim();

  // 1. Check for standard sluglines
  const match = trimmed.match(SLUGLINE_PREFIX_REGEX);
  if (match) {
    const rawSceneNum = match[1];
    const prefixRaw = match[2].toUpperCase().replace(/\.$/, '');
    const remainder = match[3].trim();

    let intExt: SceneIntExt = 'INT';
    if (prefixRaw.includes('INT') && prefixRaw.includes('EXT')) {
      intExt = 'INT/EXT';
    } else if (prefixRaw.includes('I/E')) {
      intExt = 'I/E';
    } else if (prefixRaw.startsWith('EXT')) {
      intExt = 'EXT';
    }

    // Split remainder by standard separators ( - , -- , – , — , / )
    const { location, timeOfDay } = parseLocationAndTime(remainder);

    return {
      isSlugline: true,
      intExt,
      location,
      timeOfDay,
      rawHeading: trimmed,
      sceneNumber: rawSceneNum,
    };
  }

  // 2. Check for Fountain forced sluglines e.g. ".DARK ALLEY - NIGHT"
  const forcedMatch = trimmed.match(FORCED_SLUGLINE_REGEX);
  if (forcedMatch && !trimmed.endsWith('.')) {
    const content = forcedMatch[1].trim();
    // Verify it contains a time of day separator or typical location format
    if (content.includes(' - ') || content.includes(' – ') || content.includes(' — ') || content.includes(' / ')) {
      const { location, timeOfDay } = parseLocationAndTime(content);
      return {
        isSlugline: true,
        intExt: content.startsWith('EXT') ? 'EXT' : 'INT',
        location,
        timeOfDay,
        rawHeading: content,
      };
    }
  }

  return {
    isSlugline: false,
    intExt: 'INT',
    location: '',
    timeOfDay: 'UNSPECIFIED',
    rawHeading: trimmed,
  };
}

function parseLocationAndTime(remainder: string): { location: string; timeOfDay: SceneTimeOfDay } {
  // Common time of day tokens
  const timeTokens: Record<string, SceneTimeOfDay> = {
    'DAY': 'DAY',
    'NIGHT': 'NIGHT',
    'DUSK': 'DUSK',
    'DAWN': 'DAWN',
    'MORNING': 'MORNING',
    'EVENING': 'EVENING',
    'AFTERNOON': 'AFTERNOON',
    'CONTINUOUS': 'CONTINUOUS',
    'LATER': 'LATER',
    'SAME TIME': 'SAME TIME',
    'SUNSET': 'DUSK',
    'SUNRISE': 'DAWN',
    'MIDNIGHT': 'NIGHT',
    'NOON': 'DAY',
    'MAGIC HOUR': 'DUSK',
  };

  // Split on last occurrence of hyphen/dash
  const parts = remainder.split(/\s+[-–—]\s+/);
  if (parts.length > 1) {
    const rawTime = parts[parts.length - 1].trim().toUpperCase();
    const location = parts.slice(0, -1).join(' - ').trim();

    // Check if rawTime matches a known token
    for (const [token, value] of Object.entries(timeTokens)) {
      if (rawTime === token || rawTime.startsWith(token + ' ') || rawTime.endsWith(' ' + token)) {
        return { location, timeOfDay: value };
      }
    }

    // Default with raw location
    return { location: remainder.trim(), timeOfDay: 'UNSPECIFIED' };
  }

  // Check if remainder ends with a known time token directly e.g. "HOTEL ROOM NIGHT"
  const words = remainder.trim().split(/\s+/);
  if (words.length > 1) {
    const lastWord = words[words.length - 1].toUpperCase();
    if (timeTokens[lastWord]) {
      return {
        location: words.slice(0, -1).join(' ').trim(),
        timeOfDay: timeTokens[lastWord],
      };
    }
  }

  return { location: remainder.trim(), timeOfDay: 'UNSPECIFIED' };
}
