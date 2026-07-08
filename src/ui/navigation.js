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

export function renderHomeTiles({ container, groups, onNavigate }) {
  container.innerHTML = `
    <section class="home-screen">
      <div class="home-heading">
        <p class="eyebrow">ΑΡΧΙΚΗ</p>
        <h2>Διαχείριση Υλικού</h2>
      </div>
      <div class="home-groups">
        ${groups.map((group) => `
          <section class="home-group">
            <p class="home-group-label">${group.label}</p>
            <div class="home-tile-grid">
              ${group.items.map((item) => `
                <button class="home-tile" data-home-section="${item.id}" type="button">
                  <span>${item.title}</span>
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
