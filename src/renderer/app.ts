import './styles/app.css';
import { getActiveBrand, paletteToCssVars } from '../shared/brand';
import { assetUrl } from './brand-assets';

/** Apply the active brand's palette as CSS custom properties. */
function applyBrand(): void {
  const brand = getActiveBrand();
  const root = document.documentElement;
  for (const [key, value] of Object.entries(paletteToCssVars(brand.palette))) {
    root.style.setProperty(key, value);
  }
  document.title = `Griffin Menu Studio — ${brand.displayName}`;
}

function renderScaffold(): void {
  const brand = getActiveBrand();
  const root = document.getElementById('app-root');
  if (!root) return;
  root.innerHTML = `
    <div class="scaffold">
      <img src="${assetUrl(brand.assetKeys.lockup)}" alt="${brand.displayName}" />
      <h1>Menu Studio — rebuild scaffold</h1>
      <p>${brand.displayName}${window.griffin?.isDesktop ? ' · desktop' : ''}</p>
    </div>
  `;
}

applyBrand();
renderScaffold();
