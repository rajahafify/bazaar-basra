// World palette (style guide 4.3) plus the few in-between shades the prototype used.

export const C = {
  sky: 0xe8cd9c, sand: 0xd8b685, sandDark: 0xc9a573, paving: 0xcfae80,
  brickA: 0xc59a6a, brickB: 0xb5875a, brickC: 0xd3aa79,
  door: 0x5a3b26, wood: 0x7a5232, woodDark: 0x5b3b22, reed: 0xa88c52,
  palm: 0x56723c, palmDark: 0x3f5a2e, trunk: 0x8a6a45, river: 0x5a8f99,
  indigo: 0x3d4f7c, madder: 0xa8432f, saffron: 0xd9a431, clay: 0xb4643f, offWhite: 0xe9dcc0,
  date: 0x5e2f1c, leather: 0x8a5a33, straw: 0xd8c27a, lamp: 0xffc46b,
  skins: [0x9c6b4a, 0x8a5b3c, 0xb07c55, 0x7a4e33, 0xa87452] as const,
  robes: [0xece3d0, 0x8a7a5a, 0x5b6f7a, 0xa8432f, 0x6b5a3e, 0xd9c7a2, 0x3d4f7c, 0x7d8c5c] as const,
  canopies: [0xa8432f, 0x3d4f7c, 0xd9a431, 0xece3d0, 0x6f7f4a, 0x8a4a5a] as const,
};

export const UI = {
  parch: '#f2e4c4', parchDark: '#e2cfa4', ink: '#3a2a1a', inkSoft: '#6b5639', panel: '#4a3423', panelEdge: '#2e2015',
  gold: '#c79232', green: '#5f8a3e', red: '#b04a32', grey: '#8d8172', saffron: '#d9a431', silver: '#d8d2c2',
} as const;
