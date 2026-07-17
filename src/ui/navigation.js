export function createNavigation({ container, sections, activeSection, onNavigate }) {
  container.innerHTML = '';

  for (const section of sections) {
    if (section.hidden) continue;
    const button = document.createElement('button');
    button.className = `nav-item${section.id === activeSection ? ' active' : ''}`;
    button.type = 'button';
    button.textContent = section.title;
    button.addEventListener('click', () => onNavigate(section.id));
    container.appendChild(button);
  }
}

const HOME_TILE_META = {
  shares: { code: '§ 01-Α', icon: 'ΜΕ' },
  'share-compositions': { code: '§ 01-Σ', icon: 'ΣΜ' },
  transactions: { code: '§ 01-Β', icon: 'ΔΣ' },
  indexes: { code: '§ 01-Γ', icon: 'ΕΥ' },
  charges: { code: '§ 01-Δ', icon: 'ΧΡ' },
  requests: { code: '§ 01-Ε', icon: 'ΑΙ' },
  as: { code: '§ 02-Α', icon: 'ΑΠ' },
  'movement-differences': { code: '§ 02-Β', icon: 'ΔΦ' },
  'administration-handover': { code: '§ 03-Α', icon: 'ΠΠ' },
  'administration-archive': { code: '§ 03-Β', icon: 'ΑΜ' },
  'administration-aggregate-prints': { code: '§ 03-Γ', icon: 'ΣΕ' },
  'administration-serial-numbers': { code: '§ 03-Δ', icon: 'ΣΑ' },
  'settings-general': { code: '§ 04-Α', icon: 'ΓΕ' },
  'settings-personnel': { code: '§ 04-Β', icon: 'ΠΡ' },
  'settings-parameters': { code: '§ 04-Γ', icon: 'ΠΑ' },
  'settings-security': { code: '§ 04-Δ', icon: 'ΑΣ' }
};

export function renderHomeTiles({ container, groups, onNavigate }) {
  container.innerHTML = `
    <section class="home-screen">
      <header class="home-heading corner">
        <div>
          <p class="home-kicker">ΣΧΕΔΙΟ ΛΕΙΤΟΥΡΓΙΑΣ · ΔΙΑΧΕΙΡΙΣΗ ΥΛΙΚΟΥ</p>
          <h2>Διαχείριση υλικού</h2>
          <span class="home-subtitle">Offline-first prototype</span>
        </div>
        <div class="home-title-block" aria-hidden="true">
          <span>Έκδοση</span>
          <strong id="home-version-label"></strong>
        </div>
      </header>
      <div class="home-groups">
        ${groups.map((group, groupIndex) => `
          <section class="home-group corner">
            <div class="home-group-header">
              <p class="home-group-label">${escapeHtml(group.label)}</p>
              <span class="home-zone-tag">§ ${String(groupIndex + 1).padStart(2, '0')}</span>
            </div>
            <div class="home-tile-grid">
              ${group.items.map((item) => `
                <button class="home-tile panel corner" data-home-section="${escapeHtml(item.sectionId || item.id)}" data-home-tab="${escapeHtml(item.tab || '')}" type="button">
                  <span class="home-tile-icon" aria-hidden="true">${escapeHtml(homeTileMeta(item).icon)}</span>
                  <span class="home-tile-title">${escapeHtml(item.title)}</span>
                  <span class="home-tile-code">${escapeHtml(homeTileMeta(item).code)}</span>
                </button>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </section>
  `;

  container.querySelectorAll('[data-home-section]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.homeSection, { tab: button.dataset.homeTab }));
  });
}

function homeTileMeta(item) {
  return HOME_TILE_META[item.id] || { code: '§ 00-Α', icon: 'ΜΝ' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
