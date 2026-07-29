/**
 * All gameplay tuning lives here — one file to skim to understand (and
 * change) how the game feels. Values are in DESIGN UNITS (see stage.ts):
 * the screen is always 720 units wide, so "400 units/s" means the same
 * fraction-of-screen speed on every device.
 */

export const CONFIG = {
    /** The runner character. */
    player: {
        /** Fixed screen x of the player (world scrolls past them). */
        x: 190,
        width: 84,
        height: 96,
    },

    /** Jump physics. Down is positive (gameplay y=0 is the ground line). */
    physics: {
        /** Gravity, units/s². Higher = snappier arcs. */
        gravity: 4300,
        /** Initial upward velocity of a jump, units/s. */
        jumpVelocity: 1560,
        /** Releasing mid-rise multiplies upward velocity by this (short hop). */
        jumpCutMultiplier: 0.45,
        /** 2 = double jump. */
        maxJumps: 2,
        /** Grace period after running off a ledge where a jump still counts. */
        coyoteTime: 0.09,
        /** A tap this close before landing fires the instant you land. */
        jumpBufferTime: 0.12,
        /** Terminal fall speed, units/s. */
        maxFallSpeed: 2600,
    },

    /** World scroll speed, units/s. Ramps linearly from start to max. */
    speed: {
        start: 430,
        max: 940,
        /** Seconds of running to reach max speed. */
        rampDuration: 75,
    },

    /** Ground strip anchored to the bottom of the screen. */
    ground: {
        height: 170,
    },

    /**
     * Obstacle spawning. Gaps are speed-scaled (constant reaction TIME, not
     * distance) so the game stays fair as it accelerates.
     */
    spawn: {
        /** Next obstacle arrives between min and max SECONDS after the last. */
        minLead: 0.95,
        maxLead: 1.7,
        /** Hard floor on the gap in units (protects low-speed spawns). */
        minGapUnits: 420,
        /** Obstacle-free runway at the start of a run, in units. */
        safeStartUnits: 1100,
    },

    /**
     * EXAMPLE obstacle archetypes — replace with your own set. `minMeters`
     * gates hard ones out of the early game; `weight` sets relative
     * frequency once unlocked. `safeTop: true` means the player can land on
     * and run along the top — only the SIDES kill (crates look sturdy;
     * spikes are deadly everywhere). New `kind`s also need a display case
     * in obstacles.ts buildNode().
     */
    obstacles: [
        { kind: 'crate', width: 110, height: 110, weight: 4, minMeters: 0, safeTop: true },
        { kind: 'spikes', width: 190, height: 64, weight: 3, minMeters: 120, safeTop: false },
        { kind: 'crateWide', width: 220, height: 110, weight: 2, minMeters: 300, safeTop: true },
        { kind: 'crateTall', width: 110, height: 220, weight: 2, minMeters: 550, safeTop: true },
    ] as const,

    /**
     * Landing assist: touching a safe-top obstacle counts as a landing (not a
     * death) if the player's feet are within this many units of its top while
     * falling — a snap-to-top instead of a corner-clip kill.
     */
    landingAssist: 34,

    /** Coin pickups. */
    coins: {
        size: 56,
        /** Chance an obstacle gets an arc of coins over it. */
        arcChance: 0.5,
        /** Gaps longer than this (units) get a coin row in the middle. */
        rowMinGap: 750,
        rowChance: 0.65,
    },

    /** Score display: design units of travel per "meter". */
    score: {
        unitsPerMeter: 10,
    },

    /** Rewarded-ad placements (systems/ads.ts owns the mechanics). */
    ads: {
        /** Game-wide daily rewarded-watch budget, shared by every placement. */
        maxPerDay: 15,
        /** Only offer the double-coins ad when a run earned at least this. */
        minCoinsToDouble: 10,
    },

    /** Death sequence timing. */
    death: {
        /** Player pops up with this velocity when hit, then falls off-screen. */
        popVelocity: 1150,
        /** Seconds from hit to the game-over screen. */
        duration: 0.85,
    },

    /**
     * Canvas-side palette (Pixi draws with these). The DOM/UI palette is the
     * @theme block in styles/app.css — keep the two in harmony.
     */
    colors: {
        skyTop: 0x8ed1f5,
        skyBottom: 0xfdf0d5,
        cloud: 0xffffff,
        cityFar: 0xa9c1d8,
        hills: 0x7cc47f,
        hillsShade: 0x5da861,
        grass: 0x62b95e,
        grassDark: 0x4a9a48,
        dirt: 0x8a5a3b,
        dirtDark: 0x74492e,
        player: 0xf97350,
        playerDark: 0xd6543a,
        eyeWhite: 0xffffff,
        eyePupil: 0x2b2b3a,
        crate: 0xb98850,
        crateDark: 0x8f6337,
        spike: 0x9aa3b2,
        spikeDark: 0x6d7684,
        coin: 0xfbbf24,
        coinDark: 0xd99e0b,
        coinShine: 0xfde68a,
        dust: 0xd8cfc0,
    },
} as const;

export type ObstacleKind = (typeof CONFIG.obstacles)[number]['kind'];
