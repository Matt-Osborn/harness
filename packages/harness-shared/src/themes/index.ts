import type { OpenCodeTheme } from '../theme-loader.js';

import github from './github.json' with { type: 'json' };
import matrix from './matrix.json' with { type: 'json' };
import opencode from './opencode.json' with { type: 'json' };
import dracula from './dracula.json' with { type: 'json' };
import tokyonight from './tokyonight.json' with { type: 'json' };
import monokai from './monokai.json' with { type: 'json' };
import flexoki from './flexoki.json' with { type: 'json' };
import carbonfox from './carbonfox.json' with { type: 'json' };
import aura from './aura.json' with { type: 'json' };
import vercel from './vercel.json' with { type: 'json' };
import catppuccin from './catppuccin.json' with { type: 'json' };
import synthwave84 from './synthwave84.json' with { type: 'json' };
import terminal from './terminal.json' with { type: 'json' };
import campbell from './campbell.json' with { type: 'json' };
import harnessCli from './harness-cli.json' with { type: 'json' };
import harness from './harness.json' with { type: 'json' };

export const BUNDLED_THEMES: Record<string, OpenCodeTheme> = {
  github: github as OpenCodeTheme,
  matrix: matrix as OpenCodeTheme,
  opencode: opencode as OpenCodeTheme,
  dracula: dracula as OpenCodeTheme,
  tokyonight: tokyonight as OpenCodeTheme,
  monokai: monokai as OpenCodeTheme,
  flexoki: flexoki as OpenCodeTheme,
  carbonfox: carbonfox as OpenCodeTheme,
  aura: aura as OpenCodeTheme,
  vercel: vercel as OpenCodeTheme,
  catppuccin: catppuccin as OpenCodeTheme,
  synthwave84: synthwave84 as OpenCodeTheme,
  terminal: terminal as OpenCodeTheme,
  campbell: campbell as OpenCodeTheme,
  'harness-cli': harnessCli as OpenCodeTheme,
  harness: harness as OpenCodeTheme,
};
