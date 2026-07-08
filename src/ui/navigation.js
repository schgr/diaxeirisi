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
  shares: { code: '§ 01-Α', icon: 'MR' },
  transactions: { code: '§ 01-Β', icon: 'DX' },
  indexes: { code: '§ 01-Γ', icon: 'EV' },
  charges: { code: '§ 01-Δ', icon: 'XR' },
  requests: { code: '§ 01-Ε', icon: 'AI' },
  as: { code: '§ 02-Α', icon: 'AP' },
  'movement-differences': { code: '§ 02-Β', icon: 'DF' },
  administration: { code: '§ 03-Α', icon: 'DG' },
  settings: { code: '§ 04-Α', icon: 'ST' }
};

export function renderHomeTiles({ container, groups, onNavigate }) {
  container.innerHTML = `
    <section class="home-screen">
      <header class="home-heading corner">
        <div>
          <p class="home-kicker">ΣΧΕΔΙΟ ΛΕΙΤΟΥΡΓΙΑΣ</p>
          <h2>Διαχείριση Υλικού</h2>
        </div>
        <div class="home-title-block" aria-hidden="true">
          <span>BLUEPRINT</span>
          <strong>V10</strong>
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
                <button class="home-tile panel corner" data-home-section="${escapeHtml(item.id)}" type="button">
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
    button.addEventListener('click', () => onNavigate(button.dataset.homeSection));
  });
}

function homeTileMeta(item) {
  return HOME_TILE_META[item.id] || { code: '§ 00-Α', icon: 'MN' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
