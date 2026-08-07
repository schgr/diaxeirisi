const { AppError } = require('../core/errorHandler');
const { parseStoredJson } = require('../utils/safeJson');
const { createInternalRepository } = require('../db/internalRepository');
const { validateInternalMovement } = require('../transactions/internalValidation');

function createInternalService(db) {
  const repository = createInternalRepository(db);

  return {
    getReferenceData() {
      const serviceSettings = repository.getServiceSettings();
      return {
        shares: repository.listShares().map((row) => ({
          ...mapShare(row),
          composition: repository.listCompositionItems(row.id).map((item) => ({
            componentNominalNumber: item.component_nominal_number,
            componentDescription: item.component_description,
            measurementUnit: item.measurement_unit
          }))
        })),
        departmentManagers: repository.listDepartmentManagers().map((row) => ({
          id: row.id,
          departmentName: row.department_name,
          departmentHead: row.department_head
        })),
        today: new Date().toISOString().slice(0, 10),
        serviceName: serviceSettings ? serviceSettings.service_name : '',
        financialManager: serviceSettings ? serviceSettings.manager : ''
      };
    },

    saveMovement(payload) {
      const movement = validateInternalMovement(payload);
      const share = repository.getShare(movement.shareId);
      const department = repository.getDepartmentManager(movement.departmentManagerId);

      if (!share) {
        throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      }
      if (!department) {
        throw new AppError('Η Μερική Διαχείριση δεν βρέθηκε.', 'NOT_FOUND');
      }

      let composition = [];
      if (share.requires_composition) {
        const expectedComposition = repository.listCompositionItems(share.id);
        if (
          !expectedComposition.length ||
          movement.composition.length !== expectedComposition.length
        ) {
          throw new AppError(
            'Συμπλήρωσε ποσότητα για όλα τα υλικά της σύνθεσης.',
            'VALIDATION_ERROR'
          );
        }
        composition = expectedComposition.map((component, index) => ({
          componentNominalNumber: component.component_nominal_number,
          componentDescription: component.component_description,
          measurementUnit: component.measurement_unit,
          quantity: movement.composition[index].quantity
        }));
      }

      const departmentBalance = repository.getDepartmentShareBalance(department.id, share.id);

      if (movement.movementType === 'Επιστροφή' && movement.quantity > departmentBalance) {
        throw new AppError('Η Μερική Διαχείριση δεν έχει επαρκή χρεωμένη ποσότητα.', 'VALIDATION_ERROR');
      }

      let documentId;
      let serialNumber;
      repository.transaction(() => {
        serialNumber = repository.getNextSerial(movement.fiscalYear);
        documentId = repository.createDocument({
          ...movement,
          serialNumber,
          departmentName: department.department_name,
          departmentHead: department.department_head
        });
        repository.createItem(documentId, {
          ...movement,
          composition,
          shareNumber: share.share_number,
          nominalNumber: share.nominal_number,
          description: share.description,
          measurementUnit: share.measurement_unit
        });
        repository.adjustChargedQuantity(
          share.id,
          movement.movementType === 'Χορήγηση' ? movement.quantity : -movement.quantity
        );
      });

      return {
        id: documentId,
        serialNumber,
        message: `Η εσωτερική κίνηση ${serialNumber}/${movement.fiscalYear} αποθηκεύτηκε.`
      };
    },

    listMovements(year = new Date().getFullYear()) {
      return repository.listDocuments(Number(year)).map((row) => ({
        id: row.id,
        serialNumber: row.serial_number,
        documentDate: row.document_date,
        departmentName: row.department_name,
        departmentHead: row.department_head,
        movementType: row.movement_type,
        shareNumber: row.share_number,
        nominalNumber: row.nominal_number,
        description: row.description,
        measurementUnit: row.measurement_unit,
        quantity: Number(row.quantity),
        projectedQuantity: Number(row.projected_quantity || 0),
        runningBalance: Number(row.running_balance || 0),
        notes: row.notes
      }));
    },

    listDepartmentBalances(departmentManagerId) {
      const departmentId = Number(departmentManagerId);
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        throw new AppError('Επίλεξε Μερική Διαχείριση.', 'VALIDATION_ERROR');
      }
      const compositionByShare = aggregateCompositionMovements(
        repository.listDepartmentCompositionMovements(departmentId)
      );
      return repository.listDepartmentBalances(departmentId).map((row, index) => ({
        serialNumber: index + 1,
        shareId: row.share_id,
        shareNumber: row.share_number,
        nominalNumber: row.nominal_number,
        description: row.description,
        measurementUnit: row.measurement_unit,
        projectedQuantity: Number(row.projected_quantity || 0),
        issuedQuantity: Number(row.issued_quantity || 0),
        returnedQuantity: Number(row.returned_quantity || 0),
        finalQuantity: Number(row.final_quantity || 0),
        lastIssueDate: row.last_issue_date || '',
        lastReturnDate: row.last_return_date || '',
        materialSerialNumbers: repository
          .listShareSerialNumbers(row.share_id)
          .map((entry) => String(entry.serial_number || '').trim())
          .filter(Boolean),
        ammunitionBatchNumbers: repository
          .listShareAmmunitionBatches(row.share_id, row.department_name)
          .map((entry) => String(entry.batch_number || '').trim())
          .filter(Boolean),
        composition: compositionByShare.get(Number(row.share_id)) || []
      }));
    }
  };
}

function mapShare(row) {
  return {
    id: row.id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    accountingBalance: Number(row.accounting_balance),
    chargedQuantity: Number(row.charged_quantity),
    availableQuantity: Number(row.accounting_balance) - Number(row.charged_quantity),
    requiresComposition: Boolean(row.requires_composition)
  };
}

function aggregateCompositionMovements(rows) {
  const byShare = new Map();
  rows.forEach((row) => {
    const snapshot = parseStoredJson(row.composition_snapshot, [], 'composition snapshot');
    if (!Array.isArray(snapshot)) return;

    const shareId = Number(row.share_id);
    if (!byShare.has(shareId)) byShare.set(shareId, new Map());
    const components = byShare.get(shareId);
    snapshot.forEach((item) => {
      const key = [
        item.componentNominalNumber || '',
        item.componentDescription || '',
        item.measurementUnit || ''
      ].join('\u0000');
      if (!components.has(key)) {
        components.set(key, {
          componentNominalNumber: item.componentNominalNumber || '',
          componentDescription: item.componentDescription || '',
          measurementUnit: item.measurementUnit || '',
          issuedQuantity: 0,
          returnedQuantity: 0,
          finalQuantity: 0
        });
      }
      const component = components.get(key);
      const quantity = Number(item.quantity || 0);
      if (row.movement_type === 'Χορήγηση') {
        component.issuedQuantity += quantity;
        component.finalQuantity += quantity;
      } else {
        component.returnedQuantity += quantity;
        component.finalQuantity -= quantity;
      }
    });
  });

  return new Map(
    [...byShare.entries()].map(([shareId, components]) => [
      shareId,
      [...components.values()]
    ])
  );
}

module.exports = {
  createInternalService
};
