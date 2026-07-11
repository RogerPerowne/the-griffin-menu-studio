# Brand fonts (licensed — not committed)

The renderer bundles these licensed fonts, but the `.otf` files are **git-ignored**
so they are not redistributed via this public repository. They must be present here
on the build machine for `npm run make` / `npm start` to compile.

Required files (exact names, referenced by `../styles/fonts.css`):

| File | Family / weight |
|------|-----------------|
| `BrandonGrotesque-Light.otf` | Brandon 300 |
| `BrandonGrotesque-LightItalic.otf` | Brandon 300 italic |
| `BrandonGrotesque-Regular.otf` | Brandon 400 |
| `BrandonGrotesque-RegularItalic.otf` | Brandon 400 italic |
| `BrandonGrotesque-Medium.otf` | Brandon 500 |
| `BrandonGrotesque-MediumItalic.otf` | Brandon 500 italic |
| `BrandonGrotesque-Bold.otf` | Brandon 700 |
| `AvianoDidone-Bold.otf` | Aviano Didone 700 (menu title + section titles) |

The published app bundle embeds these fonts (app embedding, permitted by the EULA);
the raw files are kept out of source control per the redistribution terms.
