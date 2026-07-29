/**
 * EXAMPLE skin catalog — 5 palette-swap skins for the procedurally drawn
 * runner, sold by the cosmetics shop (ui/Shop.tsx).
 *
 * ADAPT: this is replaceable example content, and so is the whole system:
 *   - Make it yours: change names/palettes/prices, add more entries (the
 *     shop renders this list as-is), add hat kinds in textures.ts.
 *   - Different cosmetics (trails, backgrounds...)? Keep the same shape:
 *     id + cost + whatever data your renderer needs.
 *   - No cosmetics in your game? Delete this file, ui/Shop.tsx, the skin
 *     fields in state/save.ts and state/store.ts, and the SHOP button.
 * The default (first, cost 0) skin is always owned (save.ts seeds it).
 */

/** Accessory drawn on top of the character (textures.ts drawHat). */
export type HatKind = 'sweatband' | 'sprout' | 'crown' | 'headband' | 'antenna';

export interface Skin {
    id: string;
    name: string;
    /** Coin price. 0 = free/default. */
    cost: number;
    /** Body fill color (Pixi hex number). */
    body: number;
    /** Accent color: feet, trim. */
    accent: number;
    /** Signature accessory. */
    hat: HatKind;
    /** Accessory main color. */
    hatColor: number;
    /** Accessory secondary color (trim, jewels...). */
    hatColor2: number;
}

export const DEFAULT_SKIN_ID = 'scout';

export const SKINS: Skin[] = [
    { id: 'scout', name: 'Scout', cost: 0, body: 0xf97350, accent: 0xd6543a, hat: 'sweatband', hatColor: 0xffffff, hatColor2: 0xd6543a },
    { id: 'minty', name: 'Minty', cost: 25, body: 0x4ade80, accent: 0x22a355, hat: 'sprout', hatColor: 0x16a34a, hatColor2: 0x14532d },
    { id: 'goldie', name: 'Goldie', cost: 75, body: 0xfbbf24, accent: 0xd99e0b, hat: 'crown', hatColor: 0xfff1a8, hatColor2: 0xef4444 },
    { id: 'ninja', name: 'Ninja', cost: 200, body: 0x475569, accent: 0x1f2937, hat: 'headband', hatColor: 0xdc2626, hatColor2: 0x991b1b },
    { id: 'cosmo', name: 'Cosmo', cost: 500, body: 0x6366f1, accent: 0x312e81, hat: 'antenna', hatColor: 0xfde047, hatColor2: 0x94a3b8 },
];

/** Look up a skin, falling back to the default for unknown/legacy ids. */
export function getSkin(id: string): Skin {
    return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

/** CSS hex for a Pixi color number (for React previews of the same palette). */
export function cssColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}
