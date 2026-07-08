const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId } = require('../core/validation');
const { createAnnualAccountsRepository } = require('../db/annualAccountsRepository');
const { ANNUAL_ACCOUNT_CHECKS } = require('../accounts/annualAccountRules');

const AUTOMATIC_CHECKS = new Set([
  'moved-shares',
  'opening-inventory',
  'closing-inventory',
  'external-debits',
  'external-index',
  'exhp-folder',
  'exhp-index',
  'difference-protocols',
  'difference-index'
]);

function createAnnualAccountsService(db) {
  const repository = createAnnualAccountsRepository(db);

  return {
    getPackage(year = new Date().getFullYear() - 1) {
      const fiscalYear = Number(year);
      if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
        throw new AppError('Το οικονομικό έτος δεν είναι έγκυρο.', 'VALIDATION_ERROR');
      }
      let pkg = repository.getPackageByYear(fiscalYear);
      if (!pkg) {
        const settings = repository.getServiceSettings();
        repository.transaction(() => {
          const packageId = repository.createPackage({
            fiscalYear,
            auditServiceName: settings.audit_service_name || '',
            submissionDueDate: `${fiscalYear + 1}-02-28`,
            accountableManager: settings.manager || '',
            accountableManagerRegistryNumber: settings.manager_registry_number || '',
            accountableManagerTaxNumber: settings.manager_tax_number || '',
            managerTerm: ''
          });
          ANNUAL_ACCOUNT_CHECKS.forEach(([key, title]) => repository.insertCheck(packageId, key, title));
        });
        pkg = repository.getPackageByYear(fiscalYear);
      }
      return refreshAndMap(repository, pkg);
    },

    updatePackage(id, payload) {
      const packageId = requirePositiveId(id);
      repository.updatePackage(packageId, {
        auditServiceName: optionalText(payload.auditServiceName),
        committeeOrderReference: optionalText(payload.committeeOrderReference),
        protocolReference: optionalText(payload.protocolReference),
        accountableManager: optionalText(payload.accountableManager),
        accountableManagerRegistryNumber: optionalText(payload.accountableManagerRegistryNumber),
        accountableManagerTaxNumber: optionalText(payload.accountableManagerTaxNumber),
        managerTerm: optionalText(payload.managerTerm),
        notes: optionalText(payload.notes)
      });
      return { message: 'Τα στοιχεία του φακέλου ΕΥΣ αποθηκεύτηκαν.' };
    },

    updateCheck(packageId, key, payload) {
      const id = requirePositiveId(packageId);
      if (AUTOMATIC_CHECKS.has(key)) {
        throw new AppError('Ο συγκεκριμένος έλεγχος ενημερώνεται αυτόματα από τις καταχωρίσεις.', 'VALIDATION_ERROR');
      }
      repository.updateCheck(id, key, Boolean(payload.completed), optionalText(payload.notes));
      return { message: 'Ο έλεγχος φακέλου ενημερώθηκε.' };
    },

    submitPackage(id, submissionDate) {
      const packageId = requirePositiveId(id);
      const pkg = repository.getPackageById(packageId);
      if (!pkg) throw new AppError('Ο φάκελος λογοδοσίας δεν βρέθηκε.', 'NOT_FOUND');
      const refreshed = refreshAndMap(repository, pkg);
      if (!refreshed.complete) {
        throw new AppError('Ο φάκελος δεν μπορεί να υποβληθεί όσο υπάρχουν ελλείψεις.', 'VALIDATION_ERROR');
      }
      const date = optionalText(submissionDate) || new Date().toISOString().slice(0, 10);
      repository.submitPackage(packageId, date);
      return { message: 'Η υποβολή του λογαριασμού προς το ΕΥΣ καταχωρίστηκε.' };
    }
  };
}

function refreshAndMap(repository, pkg) {
  const metrics = repository.getAutomaticMetrics(Number(pkg.fiscal_year));
  const settings = repository.getServiceSettings();
  const automatic = {
    'moved-shares': metrics.movedShares > 0,
    'opening-inventory': metrics.openingInventories > 0 || metrics.handovers > 0,
    'closing-inventory': metrics.closingInventories > 0,
    'external-debits': metrics.addyDocuments > 0,
    'external-index': metrics.addyDocuments > 0,
    'exhp-folder': metrics.exhpDocuments === 0 || metrics.incompleteExhp === 0,
    'exhp-index': metrics.exhpDocuments >= 0,
    'difference-protocols': metrics.differenceProtocols >= 0,
    'difference-index': metrics.differenceProtocols >= 0
  };
  Object.entries(automatic).forEach(([key, completed]) => {
    repository.updateCheck(pkg.id, key, completed, automaticNote(key, metrics));
  });
  const checks = repository.listChecks(pkg.id).map((row) => ({
    key: row.check_key,
    title: row.title,
    completed: Boolean(row.completed),
    automatic: AUTOMATIC_CHECKS.has(row.check_key),
    notes: row.notes
  }));
  return {
    id: pkg.id,
    fiscalYear: pkg.fiscal_year,
    auditServiceName: pkg.audit_service_name,
    submissionDueDate: pkg.submission_due_date,
    submissionDate: pkg.submission_date,
    committeeOrderReference: pkg.committee_order_reference,
    protocolReference: pkg.protocol_reference,
    accountableManager: pkg.accountable_manager,
    accountableManagerRegistryNumber: pkg.accountable_manager_registry_number,
    accountableManagerTaxNumber: pkg.accountable_manager_tax_number,
    managerTerm: pkg.manager_term,
    serviceName: settings.service_name || '',
    commander: settings.commander || '',
    commanderRegistryNumber: settings.commander_registry_number || '',
    commanderTaxNumber: settings.commander_tax_number || '',
    ped: settings.ped || '',
    pedRegistryNumber: settings.ped_registry_number || '',
    pedTaxNumber: settings.ped_tax_number || '',
    status: pkg.status,
    notes: pkg.notes,
    metrics,
    checks,
    complete: checks.every((check) => check.completed),
    overdue: !pkg.submission_date && new Date().toISOString().slice(0, 10) > pkg.submission_due_date
  };
}

function automaticNote(key, metrics) {
  const notes = {
    'moved-shares': `${metrics.movedShares} Μερίδες με κίνηση`,
    'opening-inventory': `${metrics.openingInventories} απογραφές, ${metrics.handovers} παραδόσεις`,
    'closing-inventory': `${metrics.closingInventories} τελικές απογραφές`,
    'external-debits': `${metrics.addyDocuments} ΑΔΔΥ`,
    'external-index': `${metrics.addyDocuments} εγγραφές`,
    'exhp-folder': `${metrics.exhpDocuments} ΕΧΠ, ${metrics.incompleteExhp} ελλιπείς`,
    'exhp-index': `${metrics.exhpDocuments} εγγραφές`,
    'difference-protocols': `${metrics.differenceProtocols} πρωτόκολλα`,
    'difference-index': `${metrics.differenceProtocols} εγγραφές`
  };
  return notes[key] || '';
}

module.exports = { createAnnualAccountsService };
