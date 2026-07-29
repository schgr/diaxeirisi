const menuToggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');
const header = document.querySelector('[data-header]');

menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('open', !isOpen);
});

nav?.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  menuToggle?.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
});

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));

function resolveGitHubRepository() {
  const configured = document.documentElement.dataset.githubRepository?.trim();
  if (configured && /^[\w.-]+\/[\w.-]+$/.test(configured)) return configured;

  const hostMatch = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
  const repository = window.location.pathname.split('/').filter(Boolean)[0];
  if (!hostMatch) return '';
  return `${hostMatch[1]}/${repository || `${hostMatch[1]}.github.io`}`;
}

const repository = resolveGitHubRepository();
const downloadLinks = document.querySelectorAll('[data-download-link]');
const sourceLink = document.querySelector('[data-source-link]');
const downloadNote = document.querySelector('[data-download-note]');

if (repository) {
  const repositoryUrl = `https://github.com/${repository}`;
  downloadLinks.forEach((link) => {
    link.href = `${repositoryUrl}/releases/latest`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  if (sourceLink) {
    sourceLink.href = repositoryUrl;
    sourceLink.hidden = false;
  }
} else {
  downloadLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (link.getAttribute('href') !== '#download') return;
      event.preventDefault();
      document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
  if (downloadNote) {
    downloadNote.textContent = 'Μετά τη δημοσίευση στο GitHub Pages, το κουμπί θα συνδεθεί αυτόματα με την τελευταία έκδοση στα Releases.';
  }
}
