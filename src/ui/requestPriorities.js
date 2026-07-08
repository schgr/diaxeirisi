export const requestPriorityColumns = [
  { key: 'i', label: 'I', formation: 'Δ΄ΣΣ  Ι ΜΠ\nΣΧΗΜΑΤΙΣΜΟΙ ΝΗΣΙΩΝ\nΕΙΔ. ΔΥΝΑΜΕΙΣ\nΜ/Κ , ΤΘΤ' },
  { key: 'ii', label: 'II', formation: 'Γ΄ΣΣ' },
  { key: 'iii', label: 'III', formation: 'ΑΣΔΥΣ\nΜΕΡΥΠ' },
  { key: 'iv', label: 'IV', formation: 'ΚΛΑΔΟΙ ΕΔ\nΛΟΙΠΕΣ\nΥΠΗΡΕΣΙΕΣ' }
];

export const requestPriorityRows = [
  {
    urgency: 'Α',
    description: 'Ακινησία MLRS, HAWK, RADAR, Κρίσιμο ανταλλακτικό Α/Φ-Ε/Π',
    codes: ['01', '03', '05', '20']
  },
  {
    urgency: 'Β',
    description: 'Ακινησία / μη λειτουργία Πυροβόλων, Αρμάτων Σ/Α., Α/Α',
    codes: ['07', '09', '11', '20']
  },
  {
    urgency: 'Γ',
    description: 'Ακινησία / μη λειτουργία Φορ. Ομαδ. Οπλισμού Ειδ. Οχημάτων',
    codes: ['12', '13', '14', '20']
  },
  {
    urgency: 'Δ',
    description: 'Αναπλήρωση Αποθεμάτων Συντήρησης - Ανακατασκευών',
    codes: ['15', '16', '17', '20']
  }
];

export function listRequestPriorityOptions() {
  return requestPriorityRows.flatMap((row) =>
    requestPriorityColumns.map((column, index) => ({
      code: row.codes[index],
      label: `${row.codes[index]} - ${row.urgency} / ${column.label} - ${row.description}`
    }))
  );
}

export function listRequestPriorityOptionGroups() {
  return requestPriorityColumns.map((column, columnIndex) => ({
    key: column.key,
    label: `Προτεραιότητα Σχηματισμού ${column.label}`,
    formation: column.formation,
    options: requestPriorityRows.map((row) => ({
      code: row.codes[columnIndex],
      label: `${row.codes[columnIndex]} - ${row.urgency} - ${row.description}`
    }))
  }));
}
