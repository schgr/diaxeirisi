const RANK_PATTERN = `(?:${[
  'Ανθλγός', 'ΑΝΘΛΓΟΣ', 'Υπλγός', 'ΥΠΛΓΟΣ', 'Λγός', 'ΛΓΟΣ',
  'Τχης', 'ΤΧΗΣ', 'Ανχης', 'ΑΝΧΗΣ', 'Σχης', 'ΣΧΗΣ',
  'Αλχίας', 'ΑΛΧΙΑΣ', 'Επχίας', 'ΕΠΧΙΑΣ', 'Ανθστής', 'ΑΝΘΣΤΗΣ',
  'Ανθσγός', 'ΑΝΘΣΓΟΣ', 'Υπσγός', 'ΥΠΣΓΟΣ', 'Σγός', 'ΣΓΟΣ',
  'Επγός', 'ΕΠΓΟΣ', 'Αντισμχος', 'ΑΝΤΙΣΜΧΟΣ', 'Σμχος', 'ΣΜΧΟΣ'
].join('|')})`;

export function splitOfficerSignature(value) {
  const text = String(value || '').trim();
  if (!text) return { name: '', rank: '' };

  const rankPrefix = text.match(new RegExp(`^(${RANK_PATTERN}\\s*(?:\\([^)]*\\))?)\\s+(.+)$`, 'i'));
  if (rankPrefix) {
    return { name: formatOfficerName(rankPrefix[2]), rank: formatOfficerRank(rankPrefix[1]) };
  }

  const rankSuffix = text.match(new RegExp(`\\s(${RANK_PATTERN}\\s*(?:\\([^)]*\\))?)$`, 'i'));
  if (rankSuffix) {
    return { name: formatOfficerName(text.slice(0, rankSuffix.index)), rank: formatOfficerRank(rankSuffix[1]) };
  }

  const parts = text.split(/\s*(?:\r?\n| - |,|\/)\s*/).filter(Boolean);
  return {
    name: formatOfficerName(parts[0]),
    rank: formatOfficerRank(parts.slice(1).join(' '))
  };
}

export function formatOfficerName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .replace(/(^|[\s\u2010-\u2015-])(\p{L})/gu, (_match, prefix, letter) =>
      `${prefix}${letter.toLocaleUpperCase('el-GR')}`
    );
}

export function formatOfficerRank(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^([^\s(]+)(.*)$/u);
  if (!match) return text;
  const rank = match[1].toLocaleLowerCase('el-GR');
  return `${rank.charAt(0).toLocaleUpperCase('el-GR')}${rank.slice(1)}${match[2]}`;
}
