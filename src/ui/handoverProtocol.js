import { escapeHtml } from './components/forms.js';
import { formatDate } from './components/format.js';
import { splitOfficerSignature } from './officerSignature.js';

export function renderOfficialHandoverProtocol(settings, handover) {
  const data = handover.protocolData || {};
  const assistants = Array.from({ length: 3 }, (_, index) => data.assistants?.[index] || {});
  const serviceName = settings.serviceInfo.serviceName || '';
  const serviceLocation = settings.serviceInfo.serviceLocation || '';
  const financialOfficers = settings.financialOfficers || {};
  const outgoingOfficer = financialOfficers.manager || handover.outgoingOfficer;
  const deliveryDate = handover.completionDate || handover.startDate;

  return `
    <article class="official-handover-page print-document-area">
      ${pageHeader(serviceName)}
      <h1>ΠΡΩΤΟΚΟΛΛΟ<br /><span>ΠΑΡΑΔΟΣΗΣ ΚΑΙ ΠΑΡΑΛΑΒΗΣ ΔΙΑΧΕΙΡΙΣΗΣ ΓΕΝΙΚΟΥ ΔΙΑΧΕΙΡΙΣΤΗ</span></h1>
      <p>Στ ${fill(serviceLocation)} σήμερα την ${fill(formatDate(deliveryDate))}, οι υπογεγραμμένοι:</p>
      <p>α. ${fill(outgoingOfficer, 'long')}</p>
      <p>β. ${fill(handover.incomingOfficer, 'long')}</p>
      <p>προβήκαμε ο μεν πρώτος στην παράδοση, ο δε δεύτερος στην παραλαβή της Γενικής Διαχειρίσεως, σε εκτέλεση της ${fill(handover.orderReference)} Διαταγής, όπως παρακάτω:</p>
      <h2>1. ΥΛΙΚΟ</h2>
      <p>α. Όλο το παραδιδόμενο υλικό εμφανίζεται στη με ημερομηνία ${fill(data.inventoryStatementDate)} υπόλοιπα Μερίδων του Καθολικού Υλικού, τα οποία διαμορφώθηκαν μετά την τακτοποίηση των αναφερομένων στο Μέρος 2 του παρόντος διαφορών.</p>
      <p>Οι παραπάνω μερίδες, αριθμημένες από τον αύξ. αριθμό ${fill(data.shareRangeFrom)} έως ${fill(data.shareRangeTo)}, ελέγχθηκαν με αντιπαραβολή προς το Μητρώο Μερίδων και βρέθηκαν να είναι «ΚΑΛΩΣ», καλύπτουν δε το σύνολο του υλικού.</p>
      <p>β. Τα παραδιδόμενα υπόλοιπα είναι κατανεμημένα στους παρακάτω Βοηθούς Γενικού Διαχειριστή:</p>
      <table class="official-handover-table">
        <thead><tr><th>Α/Α</th><th>Βαθμός</th><th>Ονοματεπώνυμο Βοηθού</th><th>Κατηγορίες Υλικού</th><th>Σύνολο Μερίδων</th></tr></thead>
        <tbody>${assistants.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.rank || '')}</td><td>${escapeHtml(item.name || '')}</td><td>${escapeHtml(item.categories || '')}</td><td>Από ${escapeHtml(item.shareRangeFrom || '')}<br />Έως ${escapeHtml(item.shareRangeTo || '')}</td></tr>`).join('')}</tbody>
      </table>
    </article>

    <article class="official-handover-page print-document-area">
      ${pageHeader(serviceName)}
      <p>Τα παραδιδόμενα υπόλοιπα περιλαμβάνουν το σύνολο του υλικού που βρίσκεται στην αποθήκη του παραδίδοντος και αυτό που είναι χρεωμένο με Δελτία Δοσοληψιών στους Μερικούς Διαχειριστές.</p>
      <p>γ. Οι παραπάνω βοηθοί βεβαιώνουν την ύπαρξη του υλικού που είναι χρεωμένο σε αυτούς.</p>
      <p>δ. Έγινε δειγματοληπτική καταμέτρηση του υλικού των Μερίδων:</p>
      <div class="official-handover-writing">${multiline(data.sampleCountingDetails, 3)}</div>
      <p>δηλαδή σε ποσοστό ${fill(data.samplePercentageWords)} (ολογράφως) ${fill(data.samplePercentageNumber)} (αριθμητικώς) επί του συνόλου των Μερίδων.</p>
      <p class="official-choice"><span class="official-box ${data.fullCountCompleted ? 'checked' : ''}"></span> Καταμετρήθηκε το σύνολο του υλικού και διαπιστώθηκαν οι αναγραφόμενες διαφορές.</p>
      <p>ε. Παραδόθηκαν στον παραλαμβάνοντα τα Δελτία Δοσοληψιών των Μερικών Διαχειρίσεων και τα εκκρεμούντα αντίτυπα των Δελτίων Χορηγήσεως.</p>
      <h2>2. ΔΙΑΦΟΡΕΣ</h2>
      <p>α. <strong>Πλεονάσματα:</strong> ${fill(data.surplusesReference, 'long')}</p>
      <p>β. <strong>Ελλείμματα:</strong> ${fill(data.deficitsReference, 'long')}</p>
      <h2>3. ΔΙΑΠΙΣΤΩΣΕΙΣ ΓΙΑ ΤΟ ΥΛΙΚΟ</h2>
      <p>α. <strong>Απογραφή Υλικού:</strong> ${fill(data.inventoryInspectionReference)} Ημερομηνία: ${fill(data.inventoryInspectionDate)} Είδος απογραφής: ${fill(data.inventoryInspectionType)}</p>
      <p>β. <strong>Οικονομικός Έλεγχος:</strong> ${fill(data.financialInspectionReference)} Ημερομηνία: ${fill(data.financialInspectionDate)} Είδος ελέγχου: ${fill(data.financialInspectionType)}</p>
      <p>γ. <strong>Αποθήκες</strong></p>
      <p>(1) Ύπαρξη ιδιαίτερης αποθήκης εύφλεκτου υλικού:
        <span class="official-box ${data.separateStorage === 'yes' ? 'checked' : ''}"></span> ΝΑΙ
        <span class="official-box ${data.separateStorage === 'no' ? 'checked' : ''}"></span> ΟΧΙ
      </p>
      <p>Εφόσον ΝΑΙ, περιγραφή: ${fill(data.separateStorageDescription, 'long')}</p>
      <p>(2) Ασφαλής διαφύλαξη Υλικών Υψηλής Αξίας: ${fill(data.highValueSecurity, 'long')}</p>
      <p>(3) Ειδικά μέτρα ασφαλείας καυσίμων: ${fill(data.fuelSecurity, 'long')}</p>
    </article>

    <article class="official-handover-page print-document-area">
      ${pageHeader(serviceName)}
      <h2>6. ΔΙΑΧΕΙΡΙΣΗ ΥΛΙΚΟΥ</h2>
      <p>Εκκρεμότητες: ${fill(data.managementPending || handover.pendingDocuments, 'long')}</p>
      <h2>4. ΠΑΡΑΤΗΡΗΣΕΙΣ ΠΑΡΑΛΑΜΒΑΝΟΝΤΟΣ</h2>
      <div class="official-handover-writing">${multiline(data.receivingObservations || handover.incomingObservations, 5)}</div>
      <h2>5. ΠΑΡΑΤΗΡΗΣΕΙΣ ΠΑΡΑΔΙΔΟΝΤΟΣ</h2>
      <div class="official-handover-writing">${multiline(data.outgoingObservations || handover.outgoingObservations, 5)}</div>
      <div class="official-handover-approval">
        <div><strong>ΘΕΩΡΗΘΗΚΕ</strong><span>Ο ΔΙΟΙΚΗΤΗΣ</span>${identity(financialOfficers.commander)}</div>
        <div><span>Ο ΠΕΔ</span>${identity(financialOfficers.ped)}</div>
        <div><span>Ο ΠΡΟΪΣΤ. ΛΟΓΙΣΤ.</span>${identity(data.accountingSupervisor)}</div>
        <div><span>ΟΙ ΒΟΗΘΟΙ ΓΕΝ. ΔΧΣΤΗ</span>${identity(data.generalManagerAssistants || data.inventoryCommitteePresident)}</div>
      </div>
      <div class="official-handover-signatures">
        <div><span>Ο ΠΑΡΑΛΑΜΒΑΝΩΝ</span>${identity(handover.incomingOfficer)}</div>
        <div><span>Ο ΠΑΡΑΔΙΔΩΝ</span>${identity(outgoingOfficer)}</div>
      </div>
    </article>
  `;
}

function pageHeader(serviceName) {
  return `<div class="official-handover-top"><span>1. ΜΟΝΑΔΑ ${escapeHtml(serviceName)}</span><span><strong>Κ 2329/ΔΥΠ</strong><br />ΕΦΕΔ 500</span></div>`;
}

function fill(value, className = '') {
  return `<span class="official-fill ${className}">${escapeHtml(value || '')}</span>`;
}

function multiline(value, lines) {
  const content = escapeHtml(value || '');
  return Array.from({ length: lines }, (_, index) => `<span>${index === 0 ? content : ''}</span>`).join('');
}

function identity(value) {
  const officer = splitOfficerSignature(value || '');
  return `<strong>${escapeHtml(officer.name)}</strong><em>${escapeHtml(officer.rank)}</em>`;
}

