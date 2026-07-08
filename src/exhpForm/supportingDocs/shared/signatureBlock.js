import { escapeHtml } from '../../../ui/components/forms.js';

export const DEFAULT_SIGNATURE_ROLES = [
  { key: 'commander', label: 'Ο ΔΙΟΙΚΗΤΗΣ' },
  { key: 'manager', label: 'Ο ΔΙΑΧΕΙΡΙΣΤΗΣ' },
  { key: 'committeePresident', label: 'Ο ΠΡΟΕΔΡΟΣ ΕΠΙΤΡΟΠΗΣ' },
  { key: 'committeeMembers', label: 'ΤΑ ΜΕΛΗ' }
];

export function renderSignatureBlock(roles = DEFAULT_SIGNATURE_ROLES, signatures = {}) {
  const normalizedRoles = Array.isArray(roles) && roles.length ? roles : DEFAULT_SIGNATURE_ROLES;
  const committee = getCommitteeRoles(normalizedRoles, signatures);
  const topRoles = committee
    ? normalizedRoles.filter((role) => !committee.keys.has(getRoleKey(role)))
    : normalizedRoles;

  return `
    <section class="exhp-signature-block">
      ${topRoles.map((role, index) => {
        const key = typeof role === 'string' ? role : role.key;
        const label = typeof role === 'string' ? role : role.label;
        const value = signatures[key] ?? role.value ?? '';
        return `
          <div class="exhp-signature-slot" data-signature-role="${escapeHtml(key || label)}">
            ${renderRoleHeader(label, index === 0)}
            ${renderSignatureName(value)}
          </div>
        `;
      }).join('')}
      ${committee ? renderCommitteeSlot(committee) : ''}
    </section>
  `;
}

export function parseRankAndName(fullString = '') {
  const value = String(fullString || '').trim().replace(/\s+/g, ' ');
  if (!value) return { rank: '', name: '' };

  const tokens = value.split(' ');
  const firstToken = tokens[0] || '';
  if (!isLikelyRankToken(firstToken) || tokens.length < 2) {
    return { rank: '', name: value };
  }

  let rankTokenCount = 1;
  while (
    rankTokenCount < tokens.length - 1 &&
    (/^\(.+\)$/.test(tokens[rankTokenCount]) || isRankQualifier(tokens[rankTokenCount]))
  ) {
    rankTokenCount += 1;
  }

  return {
    rank: tokens.slice(0, rankTokenCount).join(' '),
    name: tokens.slice(rankTokenCount).join(' ')
  };
}

function renderRoleHeader(label = '', includeTheorisi = false) {
  const { article, title } = splitRoleLabel(label);
  if (includeTheorisi) {
    return `
      <span class="exhp-signature-theorisi">ΘΕΩΡΗΘΗΚΕ</span>
      <span>${escapeHtml(article)}</span>
      <span>${escapeHtml(title)}</span>
    `;
  }
  return `
    <span>${escapeHtml(article)}</span>
    <span>${escapeHtml(title)}</span>
  `;
}

function renderSignatureName(value = '') {
  const parsed = parseRankAndName(value);
  if (!parsed.name && !parsed.rank) {
    return '<strong class="exhp-signature-name"></strong>';
  }
  if (!parsed.rank) {
    return `<strong class="exhp-signature-name"><span>${escapeHtml(parsed.name)}</span></strong>`;
  }
  return `
    <strong class="exhp-signature-name">
      <span>${escapeHtml(parsed.name)}</span>
      <span>${escapeHtml(parsed.rank)}</span>
    </strong>
  `;
}

function renderCommitteeSlot(committee) {
  const members = normalizeCommitteeMembers(committee.members);
  return `
    <div class="exhp-signature-slot exhp-signature-committee-slot" data-signature-role="committee">
      <span>${escapeHtml(committee.titleLabel)}</span>
      <div class="exhp-signature-committee-grid">
        <div class="exhp-signature-committee-president">
          ${renderRoleHeader(committee.presidentLabel, false)}
          ${renderSignatureName(committee.president)}
        </div>
        <div class="exhp-signature-committee-members">
          <span>${escapeHtml(committee.membersLabel)}</span>
          <div class="exhp-signature-member-stack">
            ${members.map((member) => renderSignatureName(member)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getCommitteeRoles(roles, signatures) {
  const titleRole = roles.find((role) => getRoleKey(role) === 'committeeTitle');
  const presidentRole = roles.find((role) => getRoleKey(role) === 'committeePresident');
  const membersRole = roles.find((role) => getRoleKey(role) === 'committeeMembers');
  if (!presidentRole || !membersRole) return null;

  return {
    keys: new Set([titleRole ? 'committeeTitle' : '', 'committeePresident', 'committeeMembers']),
    titleLabel: titleRole ? getRoleLabel(titleRole) : 'Η ΕΠΙΤΡΟΠΗ',
    presidentLabel: getRoleLabel(presidentRole),
    membersLabel: getRoleLabel(membersRole),
    president: signatures.committeePresident ?? presidentRole.value ?? '',
    members: signatures.committeeMembers ?? membersRole.value ?? ''
  };
}

function normalizeCommitteeMembers(value = '') {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(/\s*\/\s*/).filter(Boolean);
}

function splitRoleLabel(label = '') {
  const value = String(label || '').trim();
  const match = value.match(/^(Ο|Η|ΤΑ|ΟΙ)\s+(.+)$/i);
  if (!match) return { article: '', title: value };
  return { article: match[1], title: match[2] };
}

function getRoleKey(role) {
  return typeof role === 'string' ? role : role.key;
}

function getRoleLabel(role) {
  return typeof role === 'string' ? role : role.label;
}

function isLikelyRankToken(token = '') {
  const normalized = normalizeRankToken(token);
  return [
    'στγος',
    'αντγος',
    'υπτγος',
    'ταξχος',
    'σχης',
    'ανχης',
    'τχης',
    'λγος',
    'υπλγος',
    'ανθλγος',
    'ανθστης',
    'αλχιας',
    'επχιας',
    'λχιας',
    'δνεας',
    'λοχιας',
    'δεας',
    'σττης'
  ].includes(normalized);
}

function isRankQualifier(token = '') {
  return ['ε.α.', 'εα', 'ΠΒ', 'ΠΖ', 'ΤΘ', 'ΜΧ', 'ΥΠ', 'Ο'].includes(token);
}

function normalizeRankToken(token = '') {
  return String(token || '')
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\s]/g, '');
}
