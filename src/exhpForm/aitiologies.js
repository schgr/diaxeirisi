import { createDocZAnalosimo } from './supportingDocs/docZ_analosimo.js';
import { createDocDMetasximatismos } from './supportingDocs/docD_metasximatismos.js';
import { createDocIAPyromaxika } from './supportingDocs/docIA_pyromaxika.js';
import { createDocAAxristo } from './supportingDocs/docA_axristo.js';
import { createDocSTClothingSummary } from './supportingDocs/docST_clothingSummary.js';

export const EXP_AITIOLOGIES = [
  { code: 'a', label: 'Λογιστική Τακτοποίηση Πάσης Φύσεως Άχρηστου Υλικού', module: createDocAAxristo },
  { code: 'b', label: 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών', module: null },
  { code: 'g', label: 'Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού', module: null },
  { code: 'd', label: 'Μετασχηματισμός Υλικών (Κατασκευή - Μετασκευή)', module: createDocDMetasximatismos },
  { code: 'e', label: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών', module: null },
  { code: 'st', label: 'Διαγραφή Ειδών Ιματισμού - Υποδήσεως Και Λοιπών Ατομικών Ειδών - Χρέωση Επιστρεφομένων', module: createDocSTClothingSummary },
  { code: 'z', label: 'Διαγραφή Αναλώσιμου Υλικού Και Ειδών Σταθερών Χορηγήσεων', module: createDocZAnalosimo },
  { code: 'h', label: 'Υποστήριξη Συμπληρωματικών Εγγραφών', module: null },
  { code: 'th', label: 'Τακτοποίηση Διαφορών', module: null },
  { code: 'i', label: 'Διαγραφή Αντ/κών Εμπορίου Που Δεν Υποστηρίζονται Από Το Σύστημα ΔΜ', module: null },
  { code: 'ia', label: 'Διαγραφή Πυρομαχικών Εκπαιδεύσεως', module: createDocIAPyromaxika },
  { code: 'ib', label: 'Άλλη Περίπτωση (Κατά Διαταγή Προϊσταμένης Αρχής)', module: null, custom: true }
];

export function getAitiologiaByCode(code) {
  return EXP_AITIOLOGIES.find((item) => item.code === code) || null;
}
