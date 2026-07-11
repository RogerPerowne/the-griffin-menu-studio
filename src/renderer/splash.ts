import './styles/splash.css';
import { getActiveBrand, paletteToCssVars } from '../shared/brand';
import { assetUrl } from './brand-assets';

const brand = getActiveBrand();
const root = document.documentElement;
for (const [key, value] of Object.entries(paletteToCssVars(brand.palette))) {
  root.style.setProperty(key, value);
}

// Drive the crest as a CSS mask so it renders crisp at any DPI and takes the
// brand-pink fill — no upscaled raster (the old lockup <img> pixelated).
const crest = assetUrl(brand.assetKeys.crest);
if (crest) root.style.setProperty('--crest-url', `url("${crest}")`);

const status = document.getElementById('splash-status');
window.griffinSplash?.onStatus((label) => {
  if (status) status.textContent = label;
});

window.griffinSplash?.onHide(() => {
  document.body.classList.add('leaving');
});
