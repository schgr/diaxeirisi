export function renderPlaceholderPage(container, section) {
  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">Ενότητα</p>
        <h2>${section.title}</h2>
      </div>
    </section>
    <section class="page-panel">
      <h3>Placeholder</h3>
      <p class="muted">Η αρχιτεκτονική θέση της ενότητας έχει δημιουργηθεί και θα συμπληρωθεί σε επόμενη φάση.</p>
    </section>
  `;
}
