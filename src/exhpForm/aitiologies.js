import { createDocZAnalosimo } from './supportingDocs/docZ_analosimo.js';
import { createDocDMetasximatismos } from './supportingDocs/docD_metasximatismos.js';
import { createDocIAPyromaxika } from './supportingDocs/docIA_pyromaxika.js';
import { createDocAAxristo } from './supportingDocs/docA_axristo.js';
import { createDocSTClothingSummary } from './supportingDocs/docST_clothingSummary.js';

export const EXP_AITIOLOGIES = [
  { code: 'a', label: 'Λογιστική τακτοποίηση πάσης φύσεως άχρηστου υλικού', module: createDocAAxristo },
  { code: 'b', label: 'Λογιστική τακτοποίηση διαφορών ομοειδών Υλικών', module: null },
  { code: 'g', label: 'Μεταγραφή υλικών λόγω μεταβολής του Αριθμού Στρατιωτικού', module: null },
  { code: 'd', label: 'Μετασχηματισμός υλικών (κατασκευή - μετασκευή)', module: createDocDMetasximatismos },
  { code: 'e', label: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών', module: null },
  { code: 'st', label: 'Διαγραφή ειδών ιματισμού - υποδήσεως και λοιπών Ατομικών Ειδών - Χρέωση Επιστρεφομένων', module: createDocSTClothingSummary },
  { code: 'z', label: 'Διαγραφή αναλώσιμου υλικού και ειδών σταθερών χορηγήσεων', module: createDocZAnalosimo },
  { code: 'h', label: 'Υποστήριξη συμπληρωματικών εγγραφών', module: null },
  { code: 'th', label: 'Τακτοποίηση διαφορών', module: null },
  { code: 'i', label: 'Διαγραφή Αντ/κών Εμπορίου που δεν υποστηρίζονται από το Σύστημα ΔΜ', module: null },
  { code: 'ia', label: 'Διαγραφή Πυρομαχικών Εκπαιδεύσεως', module: createDocIAPyromaxika },
  { code: 'ib', label: 'Άλλη περίπτωση (κατά διαταγή προϊσταμένης αρχής)', module: null, custom: true }
];

export function getAitiologiaByCode(code) {
  return EXP_AITIOLOGIES.find((item) => item.code === code) || null;
}
