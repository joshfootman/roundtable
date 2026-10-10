# roundtable

Generated from the current project, including edits awaiting autosave. Return to the [theme index](../themes.md). Install the selected fonts and icons using the setup below; assets are acquired separately from their official sources.

## Font and icon setup

Follow [asset installation](../assets.md) when implementing this theme. Download and configure the selected free assets from their official sources; no font files or icon artwork are bundled. Weights below are the authored requests: load matching static faces or a variable range and report any unavailable weight. Register the exact family aliases below, or map the role tokens to the loader’s actual family.

| Selected font | Roles | Weights | Family stack | Setup |
| --- | --- | --- | --- | --- |
| <code>Geist</code> (free) | brand, ui, editorial, data | 500, 600 | <code>"Sidebar Geist", sans-serif</code> | Download and load [Geist](https://vercel.com/font) in the app. |

### Icons

Selected: [Central](https://iconists.co/central), outlined. Use the user’s licensed Central artwork if supplied under the [vendor license](https://iconists.co/license). Otherwise install [Lucide](https://lucide.dev/guide/react/getting-started) (React: <code>lucide-react</code>) and wire it into the app’s icon adapter. Tell the user that Lucide is active and that they can license Central at the vendor link, add its files to the app’s icon asset location, and update that adapter to restore Central.

Preserve icon size, color, weight, style, and accessible names. Match the selected style only where the pack supports it; Lucide’s official pack supplies outlines, so report a filled-style gap rather than claiming exact filled artwork. Keep existing package versions and add only missing packages using the receiving project’s package manager.

## Foundations

```json
{
  "name": "roundtable",
  "text": {
    "xxs": {
      "size": 8,
      "lineHeight": 12
    },
    "xs": {
      "size": 10,
      "lineHeight": 14
    },
    "s": {
      "size": 12,
      "lineHeight": 18
    },
    "m": {
      "size": 14,
      "lineHeight": 22
    },
    "l": {
      "size": 22,
      "lineHeight": 30
    },
    "xl": {
      "size": 35,
      "lineHeight": 39
    },
    "xxl": {
      "size": 49,
      "lineHeight": 53
    }
  },
  "fonts": {
    "ui": {
      "family": "\"Sidebar Geist\", sans-serif",
      "weights": {
        "heavy": 600,
        "medium": 600,
        "regular": 500
      }
    },
    "data": {
      "family": "\"Sidebar Geist\", sans-serif",
      "weights": {
        "heavy": 600,
        "medium": 600,
        "regular": 500
      }
    },
    "brand": {
      "family": "\"Sidebar Geist\", sans-serif",
      "weights": {
        "heavy": 600,
        "medium": 600,
        "regular": 500
      }
    },
    "editorial": {
      "family": "\"Sidebar Geist\", sans-serif",
      "weights": {
        "heavy": 600,
        "medium": 600,
        "regular": 500
      }
    }
  },
  "border": {
    "l": 0,
    "m": 0,
    "s": 0,
    "none": 0
  },
  "radius": {
    "l": 20,
    "m": 16,
    "s": 12,
    "xl": 28,
    "xs": 6,
    "full": 9999,
    "zero": 0
  },
  "shadows": {
    "l": {
      "x": 0,
      "y": 16,
      "blur": 48,
      "color": {
        "light": "neutral-10",
        "dark": "neutral-1"
      },
      "spread": 0,
      "opacity": 0
    },
    "m": {
      "x": 0,
      "y": 8,
      "blur": 24,
      "color": {
        "light": "neutral-10",
        "dark": "neutral-1"
      },
      "spread": 0,
      "opacity": 12
    },
    "s": {
      "x": 0,
      "y": 2,
      "blur": 4,
      "color": {
        "light": "neutral-10",
        "dark": "neutral-1"
      },
      "spread": 0,
      "opacity": 0
    }
  },
  "spacing": {
    "l": 16,
    "m": 11,
    "s": 8,
    "xl": 22,
    "xs": 5,
    "xxl": 32,
    "xxs": 3,
    "zero": 0
  },
  "animation": {
    "large": {
      "easing": [
        0.22,
        1,
        0.36,
        1
      ],
      "duration": 360
    },
    "easing": [
      0.16,
      1,
      0.3,
      1
    ],
    "duration": 200,
    "popupScale": 0.96,
    "pressDistance": 1
  },
  "iconStyle": "outlined",
  "iconFamily": "Central",
  "neutralTone": "neutral",
  "buttonRadius": "s",
  "colorEmphasis": 100,
  "letterSpacing": {
    "l": 0.01,
    "m": 0,
    "s": -0.01,
    "xl": 0.02,
    "xs": -0.02
  },
  "primaryActionColor": "color-1"
}
```

## light CSS variables

Define these in the app’s existing theme scope for this mode. Keep component styles linked to the variables.

| Variable | Value |
| --- | --- |
| `--theme-name` | roundtable |
| `--theme-icon-family` | Central |
| `--theme-icon-style` | outlined |
| `--toolbar-divider-bleed` | 0 |
| `--focus-ring-outline` | initial |
| `--icon-stroke-width` | 2.5 |
| `--icon-light-display` | none |
| `--icon-regular-display` | none |
| `--icon-bold-display` | inline |
| `--motion-duration` | 200ms |
| `--motion-easing` | cubic-bezier(0.16, 1, 0.3, 1) |
| `--motion-type` | easing |
| `--motion-visual-duration` | 0.2 |
| `--motion-bounce` | 0.2 |
| `--motion-enabled` | 1 |
| `--motion-small-iterations` | infinite |
| `--motion-large-duration` | 360ms |
| `--motion-large-easing` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--motion-large-type` | easing |
| `--motion-large-visual-duration` | 0.36 |
| `--motion-large-bounce` | 0.2 |
| `--motion-large-iterations` | infinite |
| `--motion-popup-scale` | 0.96 |
| `--motion-press-distance` | 1px |
| `--option-badge-background` | #202020 |
| `--option-badge-foreground` | #ffffff |
| `--navigation-active-foreground` | #ffffff |
| `--emphasis-chart-fill` | #20202033 |
| `--emphasis-balance-background` | #f4eee0 |
| `--emphasis-rewards-background` | #f4f4f4 |
| `--emphasis-icon-background` | #f4f4f4 |
| `--emphasis-icon-foreground` | #000000 |
| `--emphasis-type-background` | #f4f4f4 |
| `--emphasis-type-foreground` | #000000 |
| `--navigation-active-background` | #202020 |
| `--surface-raised-image` | none |
| `--surface-raised-shadow` | 0 0 0 0 transparent |
| `--surface-recessed-image` | none |
| `--surface-recessed-shadow` | 0 0 0 0 transparent |
| `--space-zero` | 0px |
| `--space-xxs` | 3px |
| `--space-xs` | 5px |
| `--space-s` | 8px |
| `--space-m` | 11px |
| `--space-l` | 16px |
| `--space-xl` | 22px |
| `--space-xxl` | 32px |
| `--tracking-xs` | -0.02em |
| `--tracking-s` | -0.01em |
| `--tracking-m` | 0em |
| `--tracking-l` | 0.01em |
| `--tracking-xl` | 0.02em |
| `--size-xxs` | 8px |
| `--line-xxs` | 12px |
| `--letter-spacing-xxs` | 0.02em |
| `--size-xs` | 10px |
| `--line-xs` | 14px |
| `--letter-spacing-xs` | 0.01em |
| `--size-s` | 12px |
| `--line-s` | 18px |
| `--letter-spacing-s` | 0.01em |
| `--size-m` | 14px |
| `--line-m` | 22px |
| `--letter-spacing-m` | 0em |
| `--size-l` | 22px |
| `--line-l` | 30px |
| `--letter-spacing-l` | -0.01em |
| `--size-xl` | 35px |
| `--line-xl` | 39px |
| `--letter-spacing-xl` | -0.01em |
| `--size-xxl` | 49px |
| `--line-xxl` | 53px |
| `--letter-spacing-xxl` | -0.02em |
| `--radius-zero` | 0px |
| `--radius-xs` | 6px |
| `--radius-s` | 12px |
| `--radius-m` | 16px |
| `--radius-l` | 20px |
| `--radius-xl` | 28px |
| `--radius-full` | 9999px |
| `--border-none` | 0px |
| `--border-s` | 0px |
| `--border-m` | 0px |
| `--border-l` | 0px |
| `--border-default-color` | #e7e7e733 |
| `--border-shadow-none` | 0 0 0 0 transparent |
| `--border-shadow-s` | 0 0 0 0 transparent |
| `--border-shadow-m` | 0 0 0 0 transparent |
| `--border-shadow-l` | 0 0 0 0 transparent |
| `--font-ui` | "Sidebar Geist", sans-serif |
| `--weight-ui-regular` | 500 |
| `--weight-ui-medium` | 600 |
| `--weight-ui-heavy` | 600 |
| `--font-brand` | "Sidebar Geist", sans-serif |
| `--weight-brand-regular` | 500 |
| `--weight-brand-medium` | 600 |
| `--weight-brand-heavy` | 600 |
| `--font-editorial` | "Sidebar Geist", sans-serif |
| `--weight-editorial-regular` | 500 |
| `--weight-editorial-medium` | 600 |
| `--weight-editorial-heavy` | 600 |
| `--font-data` | "Sidebar Geist", sans-serif |
| `--weight-data-regular` | 500 |
| `--weight-data-medium` | 600 |
| `--weight-data-heavy` | 600 |
| `--color-none` | transparent |
| `--color-1` | #202020 |
| `--color-1-transparent` | #20202033 |
| `--color-2` | #73b8f0 |
| `--color-2-transparent` | #73b8f033 |
| `--color-3` | #eac35b |
| `--color-3-transparent` | #eac35b33 |
| `--color-4` | #f4eee0 |
| `--color-4-transparent` | #f4eee033 |
| `--neutral-1` | #ffffff |
| `--neutral-1-transparent` | #ffffff33 |
| `--neutral-2` | #fbfbfb |
| `--neutral-2-transparent` | #fbfbfb33 |
| `--neutral-3` | #f4f4f4 |
| `--neutral-3-transparent` | #f4f4f433 |
| `--neutral-4` | #e7e7e7 |
| `--neutral-4-transparent` | #e7e7e733 |
| `--neutral-5` | #cdcdcd |
| `--neutral-5-transparent` | #cdcdcd33 |
| `--neutral-6` | #a1a1a1 |
| `--neutral-6-transparent` | #a1a1a133 |
| `--neutral-7` | #7d7d7d |
| `--neutral-7-transparent` | #7d7d7d33 |
| `--neutral-8` | #555555 |
| `--neutral-8-transparent` | #55555533 |
| `--neutral-9` | #333333 |
| `--neutral-9-transparent` | #33333333 |
| `--neutral-10` | #000000 |
| `--neutral-10-transparent` | #00000033 |
| `--success` | #00906c |
| `--success-transparent` | #00906c33 |
| `--warning` | #ffea00 |
| `--warning-transparent` | #ffea0033 |
| `--error` | #fc032d |
| `--error-transparent` | #fc032d33 |
| `--shadow-none` | none |
| `--shadow-s` | 0px 2px 4px 0px #00000000 |
| `--shadow-m` | 0px 2px 6px 0px #0000000d, 0px 8px 24px 0px #00000013 |
| `--shadow-l` | 0px 16px 48px 0px #00000000 |
| `--cte-canvas` | #ffffff |
| `--cte-surface` | #fbfbfb |
| `--cte-surface-muted` | #f4f4f4 |
| `--cte-text` | #000000 |
| `--cte-text-muted` | #7d7d7d |
| `--cte-border` | #e7e7e733 |
| `--cte-accent` | #202020 |
| `--cte-accent-text` | #ffffff |
| `--cte-danger` | #fc032d |
| `--cte-focus` | #202020 |
| `--cte-font` | "Sidebar Geist", sans-serif |
| `--cte-font-size` | 12px |
| `--cte-font-weight` | 500 |
| `--cte-line-height` | 18px |
| `--cte-letter-spacing` | 0.01em |
| `--cte-detail-font-size` | 10px |
| `--cte-detail-line-height` | 14px |
| `--cte-detail-letter-spacing` | 0.01em |

## dark CSS variables

Define these in the app’s existing theme scope for this mode. Keep component styles linked to the variables.

| Variable | Value |
| --- | --- |
| `--theme-name` | roundtable |
| `--theme-icon-family` | Central |
| `--theme-icon-style` | outlined |
| `--toolbar-divider-bleed` | 0 |
| `--focus-ring-outline` | initial |
| `--icon-stroke-width` | 2.5 |
| `--icon-light-display` | none |
| `--icon-regular-display` | none |
| `--icon-bold-display` | inline |
| `--motion-duration` | 200ms |
| `--motion-easing` | cubic-bezier(0.16, 1, 0.3, 1) |
| `--motion-type` | easing |
| `--motion-visual-duration` | 0.2 |
| `--motion-bounce` | 0.2 |
| `--motion-enabled` | 1 |
| `--motion-small-iterations` | infinite |
| `--motion-large-duration` | 360ms |
| `--motion-large-easing` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--motion-large-type` | easing |
| `--motion-large-visual-duration` | 0.36 |
| `--motion-large-bounce` | 0.2 |
| `--motion-large-iterations` | infinite |
| `--motion-popup-scale` | 0.96 |
| `--motion-press-distance` | 1px |
| `--option-badge-background` | #f4eee0 |
| `--option-badge-foreground` | #ffffff |
| `--navigation-active-foreground` | #ffffff |
| `--emphasis-chart-fill` | #f4eee033 |
| `--emphasis-balance-background` | #202020 |
| `--emphasis-rewards-background` | #2b2b2b |
| `--emphasis-icon-background` | #2b2b2b |
| `--emphasis-icon-foreground` | #ffffff |
| `--emphasis-type-background` | #2b2b2b |
| `--emphasis-type-foreground` | #ffffff |
| `--navigation-active-background` | #f4eee0 |
| `--surface-raised-image` | none |
| `--surface-raised-shadow` | 0 0 0 0 transparent |
| `--surface-recessed-image` | none |
| `--surface-recessed-shadow` | 0 0 0 0 transparent |
| `--space-zero` | 0px |
| `--space-xxs` | 3px |
| `--space-xs` | 5px |
| `--space-s` | 8px |
| `--space-m` | 11px |
| `--space-l` | 16px |
| `--space-xl` | 22px |
| `--space-xxl` | 32px |
| `--tracking-xs` | -0.02em |
| `--tracking-s` | -0.01em |
| `--tracking-m` | 0em |
| `--tracking-l` | 0.01em |
| `--tracking-xl` | 0.02em |
| `--size-xxs` | 8px |
| `--line-xxs` | 12px |
| `--letter-spacing-xxs` | 0.02em |
| `--size-xs` | 10px |
| `--line-xs` | 14px |
| `--letter-spacing-xs` | 0.01em |
| `--size-s` | 12px |
| `--line-s` | 18px |
| `--letter-spacing-s` | 0.01em |
| `--size-m` | 14px |
| `--line-m` | 22px |
| `--letter-spacing-m` | 0em |
| `--size-l` | 22px |
| `--line-l` | 30px |
| `--letter-spacing-l` | -0.01em |
| `--size-xl` | 35px |
| `--line-xl` | 39px |
| `--letter-spacing-xl` | -0.01em |
| `--size-xxl` | 49px |
| `--line-xxl` | 53px |
| `--letter-spacing-xxl` | -0.02em |
| `--radius-zero` | 0px |
| `--radius-xs` | 6px |
| `--radius-s` | 12px |
| `--radius-m` | 16px |
| `--radius-l` | 20px |
| `--radius-xl` | 28px |
| `--radius-full` | 9999px |
| `--border-none` | 0px |
| `--border-s` | 0px |
| `--border-m` | 0px |
| `--border-l` | 0px |
| `--border-default-color` | #3d3d3d33 |
| `--border-shadow-none` | 0 0 0 0 transparent |
| `--border-shadow-s` | 0 0 0 0 transparent |
| `--border-shadow-m` | 0 0 0 0 transparent |
| `--border-shadow-l` | 0 0 0 0 transparent |
| `--font-ui` | "Sidebar Geist", sans-serif |
| `--weight-ui-regular` | 500 |
| `--weight-ui-medium` | 600 |
| `--weight-ui-heavy` | 600 |
| `--font-brand` | "Sidebar Geist", sans-serif |
| `--weight-brand-regular` | 500 |
| `--weight-brand-medium` | 600 |
| `--weight-brand-heavy` | 600 |
| `--font-editorial` | "Sidebar Geist", sans-serif |
| `--weight-editorial-regular` | 500 |
| `--weight-editorial-medium` | 600 |
| `--weight-editorial-heavy` | 600 |
| `--font-data` | "Sidebar Geist", sans-serif |
| `--weight-data-regular` | 500 |
| `--weight-data-medium` | 600 |
| `--weight-data-heavy` | 600 |
| `--color-none` | transparent |
| `--color-1` | #f4eee0 |
| `--color-1-transparent` | #f4eee033 |
| `--color-2` | #73b8f0 |
| `--color-2-transparent` | #73b8f033 |
| `--color-3` | #eac35b |
| `--color-3-transparent` | #eac35b33 |
| `--color-4` | #202020 |
| `--color-4-transparent` | #20202033 |
| `--neutral-1` | #000000 |
| `--neutral-1-transparent` | #00000033 |
| `--neutral-2` | #202020 |
| `--neutral-2-transparent` | #20202033 |
| `--neutral-3` | #2b2b2b |
| `--neutral-3-transparent` | #2b2b2b33 |
| `--neutral-4` | #3d3d3d |
| `--neutral-4-transparent` | #3d3d3d33 |
| `--neutral-5` | #565656 |
| `--neutral-5-transparent` | #56565633 |
| `--neutral-6` | #838383 |
| `--neutral-6-transparent` | #83838333 |
| `--neutral-7` | #ababab |
| `--neutral-7-transparent` | #ababab33 |
| `--neutral-8` | #cfcfcf |
| `--neutral-8-transparent` | #cfcfcf33 |
| `--neutral-9` | #f4f4f4 |
| `--neutral-9-transparent` | #f4f4f433 |
| `--neutral-10` | #ffffff |
| `--neutral-10-transparent` | #ffffff33 |
| `--success` | #00906c |
| `--success-transparent` | #00906c33 |
| `--warning` | #ffea00 |
| `--warning-transparent` | #ffea0033 |
| `--error` | #fc032d |
| `--error-transparent` | #fc032d33 |
| `--shadow-none` | none |
| `--shadow-s` | 0px 2px 4px 0px #00000000 |
| `--shadow-m` | 0px 2px 6px 0px #0000000d, 0px 8px 24px 0px #00000013 |
| `--shadow-l` | 0px 16px 48px 0px #00000000 |
| `--cte-canvas` | #000000 |
| `--cte-surface` | #202020 |
| `--cte-surface-muted` | #2b2b2b |
| `--cte-text` | #ffffff |
| `--cte-text-muted` | #ababab |
| `--cte-border` | #3d3d3d33 |
| `--cte-accent` | #f4eee0 |
| `--cte-accent-text` | #000000 |
| `--cte-danger` | #fc032d |
| `--cte-focus` | #f4eee0 |
| `--cte-font` | "Sidebar Geist", sans-serif |
| `--cte-font-size` | 12px |
| `--cte-font-weight` | 500 |
| `--cte-line-height` | 18px |
| `--cte-letter-spacing` | 0.01em |
| `--cte-detail-font-size` | 10px |
| `--cte-detail-line-height` | 14px |
| `--cte-detail-letter-spacing` | 0.01em |

## Authored component assignments

These are project edits. The [component reference](roundtable-components.md) includes the effective assignments with defaults and shared parts resolved.

```json
{
  "componentTokens": {
    "button:ghost:rest": {
      "paddingX": "l",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "button:danger:rest": {
      "paddingX": "l",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "input:default:rest": {
      "paddingX": "m",
      "background": "neutral-3",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "button:outline:rest": {
      "paddingX": "l",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "button:primary:rest": {
      "paddingX": "l",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "select:default:rest": {
      "paddingX": "m",
      "background": "neutral-3",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "button:secondary:rest": {
      "paddingX": "l",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "combobox:default:rest": {
      "paddingX": "m",
      "background": "neutral-3",
      "paddingTop": "s",
      "paddingBottom": "s"
    },
    "menu:default:part:option:rest": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    },
    "slider:default:part:thumb:rest": {
      "controlSize": "l"
    },
    "slider:default:part:track:rest": {
      "controlSize": "xl"
    },
    "switch:default:part:control:rest": {
      "controlSize": "xl"
    },
    "combobox:default:part:option:rest": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    },
    "menu:default:part:option:selected": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    },
    "otp-field:default:part:input:rest": {
      "paddingX": "s",
      "paddingTop": "xs",
      "paddingLeft": "s",
      "paddingRight": "s",
      "paddingBottom": "xs"
    },
    "checkbox:default:part:control:rest": {
      "controlSize": "l"
    },
    "autocomplete:default:part:input:rest": {
      "paddingX": "s",
      "paddingTop": "s",
      "paddingLeft": "s",
      "paddingRight": "s",
      "paddingBottom": "s"
    },
    "autocomplete:default:part:option:rest": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    },
    "combobox:default:part:option:selected": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    },
    "autocomplete:default:part:popover:rest": {
      "radius": "s"
    },
    "autocomplete:default:part:option:selected": {
      "paddingX": "xs",
      "paddingTop": "xs",
      "paddingLeft": "xs",
      "paddingRight": "xs",
      "paddingBottom": "xs"
    }
  },
  "componentVariants": {}
}
```
