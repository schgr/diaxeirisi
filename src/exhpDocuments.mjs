import { escapeHtml } from './ui/components/forms.js';
import { splitOfficerSignature } from './ui/officerSignature.js';

export function renderOfficialUselessProtocol(settings, exhp, data = {}) {
  const serviceName = settings?.serviceInfo?.serviceName || '';
  const financialOfficers = settings?.financialOfficers || {};
  const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];

  return `
    <article class="official-handover-page print-document-area">
      ${pageHeader(
        serviceName,
        'Κ 2334/ΔΥΠ',
        'ΕΦΕΔ 505',
        exhp?.indexNumber ?? exhp?.registryNumber
      )}
      <h1>ΠΡΩΤΟΚΟΛΛΟ<br /><span>ΔΙΑΘΕΣΕΩΣ ΑΝΑΛΩΣΙΜΟΥ ΥΛΙΚΟΥ</span></h1>
      <p>Στ ${fill(data.location, '', 'location')} σήμερα την ${fill(data.day, 'compact', 'day')} του μηνός ${fill(data.month, 'compact', 'month')} του έτους ${fill(fullYear(data.year), 'compact year', 'year')} η υπογεγραμμένη Επιτροπή που συγκροτήθηκε με την ${fill(data.hdmNumber, '', 'hdmNumber')} Η.Δ.Μ. και αποτελείται από τους:</p>
      <p>α. ${fill(data.president, 'long', 'president')} ως Πρόεδρο και</p>
      <p>β. ${fill(data.memberA, 'long', 'memberA')}</p>
      <p>γ. ${fill(data.memberB, 'long', 'memberB')} ως μέλη,</p>
      <p>αφού συνήλθε,</p>
      <h2>Προέβη</h2>
      <p>στη διαπίστωση της καλής διάθεσης των παρακάτω αναλωσίμων υλικών κατά το χρονικό διάστημα από ${fill(displayDate(data.periodFrom), '', 'periodFrom')} έως ${fill(displayDate(data.periodTo), '', 'periodTo')} για τη συντήρηση των Κυρίων Υλικών αυτής.</p>
      <table class="official-handover-table official-exhp-material-table">
        <colgroup>
          <col class="official-exhp-col-serial" />
          <col class="official-exhp-col-nomenclature" />
          <col class="official-exhp-col-description" />
          <col class="official-exhp-col-unit" />
          <col class="official-exhp-col-quantity" />
          <col class="official-exhp-col-price" />
          <col class="official-exhp-col-date" />
          <col class="official-exhp-col-remarks" />
        </colgroup>
        <thead>
          <tr>
            <th>Α/Α</th>
            <th>Αριθμός Ονομαστικού</th>
            <th>Περιγραφή</th>
            <th>Μονάδα Μέτρησης</th>
            <th>Ποσότητα</th>
            <th>Τιμή Κτήσης</th>
            <th>Ημ/νία Κτήσης</th>
            <th>Παρ/σεις</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${materialFill(item.nomenclatureNumber || item.nominalNumber, `items.${index}.nomenclatureNumber`, index, 'nomenclatureNumber', true)}</td>
              <td>${materialFill(item.description, `items.${index}.description`, index, 'description')}</td>
              <td>${materialFill(item.unit || item.measurementUnit, `items.${index}.unit`, index, 'unit')}</td>
              <td>${fill(item.quantity, '', `items.${index}.quantity`)}</td>
              <td>${fill(item.acquisitionPrice, '', `items.${index}.acquisitionPrice`)}</td>
              <td>${fill(displayDate(item.acquisitionDate), '', `items.${index}.acquisitionDate`)}</td>
              <td>${fill(item.remarks || item.notes, '', `items.${index}.remarks`)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p>Η διάθεση των παραπάνω υλικών έγινε καλώς και σύμφωνα με τις ισχύουσες Δγές.</p>
      <p>Αφού συντάχθηκε το παρόν, υπογράφεται όπως παρακάτω:</p>
      <div class="official-handover-approval">
        <div><strong>ΘΕΩΡΗΘΗΚΕ</strong><span>Ο ΔΙΟΙΚΗΤΗΣ</span>${identity(financialOfficers.commander)}</div>
        <div><span>Ο ΔΙΑΧΕΙΡΙΣΤΗΣ</span>${identity(financialOfficers.manager)}</div>
        <div><span>Η ΕΠΙΤΡΟΠΗ</span>${identity(data.committee)}</div>
      </div>
      <div class="official-handover-signatures">
        <div><span>Ο ΠΡΟΕΔΡΟΣ</span>${identity(data.president)}</div>
        <div>
          <span>ΤΑ ΜΕΛΗ</span>
          ${identity(data.memberA)}
          ${identity(data.memberB)}
        </div>
      </div>
    </article>
  `;
}

export function renderOfficialAmmoConsumptionCertificate(settings, exhp, data = {}) {
  const serviceName = settings?.serviceInfo?.serviceName || '';
  const financialOfficers = settings?.financialOfficers || {};
  const consumedItems = normalizeFiveItems(
    data.consumedItems || data.items?.filter((item) => item.itemType === 'consumed')
  );
  const emptyItems = normalizeFiveItems(
    data.emptyItems || data.items?.filter((item) => item.itemType === 'empty')
  );
  const officerRankName = data.officerRankName
    || [data.officerRank, data.officerName].filter(Boolean).join(' - ');
  const officerSignature = data.officerSignature
    || [data.officerName, data.officerRank].filter(Boolean).join(' - ');

  return `
    <article class="official-handover-page print-document-area">
      ${pageHeader(
        serviceName,
        '',
        'ΔΥΠ/192',
        exhp?.indexNumber ?? exhp?.registryNumber
      )}
      <h1>ΠΙΣΤΟΠΟΙΗΤΙΚΟ<br /><span>ΚΑΤΑΝΑΛΩΣΕΩΣ ΠΥΡΟΜΑΧΙΚΩΝ</span></h1>
      <p>Ο υπογεγραμμένος (Βαθμός - Ονοματεπώνυμο) ${fill(officerRankName, 'long', 'officerRankName')} Αξκός Επόπτης Βολής (ή εκπαιδευτής αντικειμένων Ναρκοπολέμου, Καταστροφών κλπ) του (Μονάδα ή Τμήμα Μονάδας) ${fill(data.unit || serviceName, 'long', 'unit')} και υπεύθυνος για την κατανάλωση των πυρομαχικών, για την εκπαιδευτική βολή (ή την πρακτική εξάσκηση στα εν λόγω αντικείμενα) της Μονάδας (ή του Τμήματος Μονάδας), που πραγματοποιήθηκε την ${fill(displayDate(data.date || data.firingDate), '', 'date')} ημέρα της εβδομάδας ${fill(data.dayOfWeek, '', 'dayOfWeek')}</p>
      <h2>ΠΙΣΤΟΠΟΙΩ</h2>
      <p>1. Ότι καταναλώθηκαν τα παρακάτω κατά είδος πυρομαχικά εκπαιδεύσεως:</p>
      ${renderLetteredItems(consumedItems, 'consumedItems')}
      <p>2. Από την κατανάλωση των παραπάνω πυρομαχικών περισυλλέχθηκαν και παραδόθηκαν στη Γενική Διαχείριση Υλικού τα παρακάτω κενά συσκευασίας (κάλυκες, φορείς, κιβώτια συσκευασίας κλπ):</p>
      ${renderLetteredItems(emptyItems, 'emptyItems')}
      <p>Αφού συντάχθηκε το παρόν σε ${fill(data.copiesCount, 'compact', 'copiesCount')} αντίγραφα, υπογράφεται όπως παρακάτω:</p>
      <div class="official-handover-approval">
        <div><strong>ΘΕΩΡΗΘΗΚΕ</strong><span>Ο ΠΕΔ</span>${identity(financialOfficers.ped)}</div>
        <div><span>ΜΕΡΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ</span>${identity(data.partialManager)}</div>
        <div><span>ΑΞΚΟΣ ΒΟΛΗΣ Ή ΕΚΠΤΗΣ</span>${identity(officerSignature)}</div>
      </div>
    </article>
  `;
}

export function renderOfficialUselessDifferencesProtocol(settings, exhp, data = {}) {
  const serviceName = settings?.serviceInfo?.serviceName || '';
  const items = Array.isArray(data.items) ? data.items : [];
  return `
    <article class="official-handover-page print-document-area">
      ${pageHeader(serviceName, '', 'ΠΡΩΤΟΚΟΛΛΟ ΔΙΑΦΟΡΩΝ', exhp?.indexNumber ?? exhp?.registryNumber)}
      <h1>ΠΡΩΤΟΚΟΛΛΟ<br /><span>ΔΙΑΦΟΡΩΝ ΔΕΥΤΕΡΟΒΑΘΜΙΑΣ ΕΠΙΤΡΟΠΗΣ</span></h1>
      <p>Η Επιτροπή αποτελούμενη από τους ${fill(data.president, 'long', 'president')}, ${fill(data.memberA, 'long', 'memberA')} και ${fill(data.memberB, 'long', 'memberB')} διαπίστωσε τις παρακάτω διαφορές:</p>
      <table class="official-handover-table"><thead><tr><th>Α/Α</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσ. Πρωτοβάθμιας</th><th>Ποσ. Δευτεροβάθμιας</th><th>Διαφορά (+)</th><th>Διαφορά (-)</th></tr></thead>
      <tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${fill(item.nomenclatureNumber)}</td><td>${fill(item.description)}</td><td>${fill(item.unit)}</td><td>${fill(item.qtyPrimary)}</td><td>${fill(item.qtySecondary)}</td><td>${fill(item.diffPlus)}</td><td>${fill(item.diffMinus)}</td></tr>`).join('')}</tbody></table>
      <div class="official-handover-approval"><div><span>Ο ΔΚΤΗΣ</span>${identity(data.commander)}</div><div><span>Ο ΓΕΝ. ΔΙΑΧΕΙΡΙΣΤΗΣ</span>${identity(data.generalManager)}</div><div><span>Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ</span>${identity(data.uselessManager)}</div><div><span>Η ΕΠΙΤΡΟΠΗ</span></div></div>
    </article>
  `;
}

export function renderClothingDisposalStatement(settings, exhp, data = {}, statementCode = '', statementTitle = '') {
  const serviceName = settings?.serviceInfo?.serviceName || '';
  const items = Array.isArray(data.items) ? data.items : [];
  return `
    <article class="official-handover-page print-document-area disposal-statement-page">
      ${pageHeader(serviceName, '', `ΚΑΤΑΣΤΑΣΗ «${statementCode}»`, exhp?.indexNumber ?? exhp?.registryNumber)}
      <h1>ΚΑΤΑΣΤΑΣΗ «${escapeHtml(statementCode)}»<br /><span>${escapeHtml(statementTitle)} (Υπόδειγμα)</span></h1>
      <table class="official-handover-table disposal-statement-table">
        <thead><tr><th>Α/Α</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσότητα Αριθμ.</th><th>Ποσότητα Ολογράφως</th><th>Τιμή Κτήσης</th><th>Ημ/νία Κτήσης</th><th>Παρατηρήσεις</th></tr></thead>
        <tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td>${fill(item.nomenclatureNumber || item.nominalNumber)}</td><td>${fill(item.description)}</td><td>${fill(item.unit || item.measurementUnit)}</td><td>${fill(item.quantity)}</td><td>${fill(item.quantityWords)}</td><td>${fill(item.acquisitionPrice)}</td><td>${fill(displayDate(item.acquisitionDate))}</td><td>${fill(item.remarks)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="official-handover-approval"><div><span>Ο ΔΙΑΧΣΤΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ</span>${identity(data.uselessManager)}</div><div><span>Η ΕΠΙΤΡΟΠΗ<br />Ο ΠΡΟΕΔΡΟΣ / ΤΑ ΜΕΛΗ</span>${identity(data.president)}</div></div>
      <p class="official-centered-note">Βεβαιώνεται η ορθότητα-πληρότητα των αναγραφομένων στοιχείων</p>
      <div class="official-handover-signatures"><div><span>Ο ΠΡΟΪΣΤΑΜΕΝΟΣ ΛΟΓΙΣΤΗΡΙΟΥ</span>${identity(data.accountingHead)}</div></div>
    </article>
  `;
}

function pageHeader(serviceName, formReference, formCode, exhpIndexNumber) {
  return `
    <div class="official-handover-top">
      <span>1. ΜΟΝΑΔΑ ${fill(serviceName, '', 'serviceUnit')} (2) Α/Α ΕΧΠ ${fill(exhpIndexNumber, '', 'indexNumber')}</span>
      <span>${formReference ? `<strong>${escapeHtml(formReference)}</strong><br />` : ''}${escapeHtml(formCode)}</span>
    </div>
  `;
}

function fill(value, className = '', fieldName = '') {
  const fieldAttribute = fieldName ? ` data-field="${escapeHtml(fieldName)}"` : '';
  const classes = ['official-fill', className].filter(Boolean).join(' ');
  return `<span class="${classes}"${fieldAttribute}>${escapeHtml(value ?? '')}</span>`;
}

function materialFill(value, fieldName, itemIndex, materialKey, isNominalCell = false) {
  return `<span class="official-fill" data-field="${escapeHtml(fieldName)}">${escapeHtml(value ?? '')}</span>`;
}

function multiline(value, lines) {
  const content = escapeHtml(value || '');
  return Array.from(
    { length: lines },
    (_, index) => `<span>${index === 0 ? content : ''}</span>`
  ).join('');
}

function identity(value) {
  const officer = splitOfficerSignature(value || '');
  return `<strong>${escapeHtml(officer.name)}</strong><em>${escapeHtml(officer.rank)}</em>`;
}

function normalizeFiveItems(items) {
  const source = Array.isArray(items) ? items : [];
  return Array.from({ length: 5 }, (_, index) => source[index] || {});
}

function renderLetteredItems(items, fieldPrefix) {
  const letters = ['α', 'β', 'γ', 'δ', 'ε'];
  return items.map((item, index) => `
    <p>${letters[index]}. ${fill(item.description, 'long', `${fieldPrefix}.${index}.description`)} .......... ${fill(item.quantity, '', `${fieldPrefix}.${index}.quantity`)}</p>
  `).join('');
}

function fullYear(value) {
  const year = String(value || '').trim();
  if (!year) return '';
  return year.length === 2 ? `20${year}` : year;
}

function displayDate(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}
