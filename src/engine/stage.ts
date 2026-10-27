// Fits the fixed 360 x 640 logical frame to the screen, inside the safe area (gdd 11, style guide 5.1).

export const LW = 360;
export const LH = 640;

export interface StageSize {
  /** CSS pixels. */
  width: number;
  height: number;
  dpr: number;
  /** CSS pixels per logical pixel. */
  scale: number;
}

export function fitStage(availWidth: number, availHeight: number, devicePixelRatio: number): StageSize {
  let height = availHeight;
  let width = (height * LW) / LH;
  if (width > availWidth) { width = availWidth; height = (width * LH) / LW; }
  width = Math.floor(width);
  height = Math.floor((width * LH) / LW);
  return { width, height, dpr: Math.min(devicePixelRatio || 1, 2), scale: width / LW };
}
