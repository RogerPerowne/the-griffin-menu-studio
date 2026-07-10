import './styles/splash.css';
import { getActiveBrand, paletteToCssVars } from '../shared/brand';
import { assetUrl } from './brand-assets';

const brand = getActiveBrand();
const root = document.documentElement;
for (const [key, value] of Object.entries(paletteToCssVars(brand.palette))) {
  root.style.setProperty(key, value);
}

const logo = document.getElementById('splash-logo') as HTMLImageElement | null;
if (logo) logo.src = assetUrl(brand.assetKeys.lockup);
