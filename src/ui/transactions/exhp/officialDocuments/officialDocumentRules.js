

export const USELESS_MATERIAL_FORMS = [
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_inspection', label: 'Πρωτόκολλο Επιθεώρησης', kind: 'primary' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_a', label: 'Κατάσταση Α — Υγειονομική Ταφή', code: 'Α', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΦΕΡΘΟΥΝ ΣΕ ΧΩΡΟΥΣ ΥΓΕΙΟΝΟΜΙΚΗΣ ΤΑΦΗΣ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_b', label: 'Κατάσταση Β — Πρώτες Ύλες', code: 'Β', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΤΡΑΠΟΥΝ ΣΕ ΠΡΩΤΕΣ ΥΛΕΣ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_d2', label: 'Κατάσταση Δ2 — Ηλεκτρικές Στήλες', code: 'Δ2', title: 'ΗΛΕΚΤΡΙΚΕΣ ΣΤΗΛΕΣ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΠΑΡΑΔΟΘΟΥΝ' },
  { group: 'Πρωτοβάθμια Επιτροπή', key: 'primary_d3', label: 'Κατάσταση Δ3 — Ελαστικά Επίσωτρα', code: 'Δ3', title: 'ΕΛΑΣΤΙΚΑ ΕΠΙΣΩΤΡΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΠΑΡΑΔΟΘΟΥΝ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'differences', label: 'Πρωτόκολλο Διαφορών', kind: 'differences' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_inspection', label: 'Πρωτόκολλο Επιθεώρησης', kind: 'inspection' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_a', label: 'Κατάσταση Α — Μεταφέρθηκαν σε Ταφή', code: 'Α', title: 'ΥΛΙΚΑ ΠΟΥ ΜΕΤΑΦΕΡΘΗΚΑΝ ΣΕ ΧΩΡΟΥΣ ΥΓΕΙΟΝΟΜΙΚΗΣ ΤΑΦΗΣ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_b', label: 'Κατάσταση Β — Μετατράπηκαν σε Πρώτες Ύλες', code: 'Β', title: 'ΥΛΙΚΑ ΠΟΥ ΜΕΤΑΤΡΑΠΗΚΑΝ ΣΕ ΠΡΩΤΕΣ ΥΛΕΣ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_d2', label: 'Κατάσταση Δ2 — Παραδόθηκαν', code: 'Δ2', title: 'ΗΛΕΚΤΡΙΚΕΣ ΣΤΗΛΕΣ ΠΟΥ ΠΑΡΑΔΟΘΗΚΑΝ' },
  { group: 'Δευτεροβάθμια Επιτροπή', key: 'secondary_d3', label: 'Κατάσταση Δ3 — Παραδόθηκαν', code: 'Δ3', title: 'ΕΛΑΣΤΙΚΑ ΕΠΙΣΩΤΡΑ ΠΟΥ ΠΑΡΑΔΟΘΗΚΑΝ' }
];

export function prepareUselessProtocolData(data) {
  const [year = '', month = '', day = ''] = String(data.date || '').slice(0, 10).split('-');
  const monthNames = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  return {
    ...data,
    day: data.day || day,
    month: data.month || monthNames[Number(month)] || month,
    year: data.year || year
  };
}

export function officialExhpDocumentTitle(type) {
  return type === 'useless_material_a'
    ? 'ΕΦΕΔ 505 — Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού'
    : 'ΔΥΠ/192 — Πιστοποιητικό Καταναλώσεως Πυρομαχικών';
}

export function isUselessMaterialReason(value) {
  const normalized = normalizeForReason(value);
  return normalized.includes('λογιστικη τακτοποιηση') && normalized.includes('αχρηστου');
}

export function isAmmoConsumptionReason(value) {
  const normalized = normalizeForReason(value);
  return normalized.includes('διαγραφη') && normalized.includes('πυρομαχικων');
}

function normalizeForReason(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/αχρηστου|αχρηστου/g, 'αχρηστου');
}
