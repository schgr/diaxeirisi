function createSettingsRepository(db) {
  return {
    getServiceSettings() {
      return db.prepare('SELECT * FROM service_settings WHERE id = 1').get();
    },

    updateServiceInfo({ serviceName, serviceLocation, managementType }) {
      db.prepare(
        `
          UPDATE service_settings
          SET service_name = ?,
              service_location = ?,
              management_type = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `
      ).run(serviceName, serviceLocation, managementType);
      return this.getServiceSettings();
    },

    updateFinancialOfficers({ commander, ped, manager }) {
      db.prepare(
        `
          UPDATE service_settings
          SET commander = ?, ped = ?, manager = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `
      ).run(commander, ped, manager);
      return this.getServiceSettings();
    },

    updateAuditSettings(payload) {
      db.prepare(`
        UPDATE service_settings
        SET audit_service_name = ?,
            commander_registry_number = ?,
            commander_tax_number = ?,
            ped_registry_number = ?,
            ped_tax_number = ?,
            manager_registry_number = ?,
            manager_tax_number = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        payload.auditServiceName,
        payload.commanderRegistryNumber,
        payload.commanderTaxNumber,
        payload.pedRegistryNumber,
        payload.pedTaxNumber,
        payload.managerRegistryNumber,
        payload.managerTaxNumber
      );
      return this.getServiceSettings();
    },

    listDepartmentManagers() {
      return db
        .prepare(
          `
            SELECT id, department_name, department_head, sort_order
            FROM department_managers
            ORDER BY sort_order ASC, id ASC
          `
        )
        .all();
    },

    createDepartmentManager(payload) {
      const nextOrder = getNextOrder(db, 'department_managers');
      const result = db
        .prepare(
          `
            INSERT INTO department_managers (department_name, department_head, sort_order)
            VALUES (?, ?, ?)
          `
        )
        .run(payload.departmentName, payload.departmentHead, nextOrder);
      return getById(db, 'department_managers', result.lastInsertRowid);
    },

    updateDepartmentManager(id, payload) {
      db.prepare(
        `
          UPDATE department_managers
          SET department_name = ?, department_head = ?
          WHERE id = ?
        `
      ).run(payload.departmentName, payload.departmentHead, id);
      return getById(db, 'department_managers', id);
    },

    deleteDepartmentManager(id) {
      db.prepare('DELETE FROM department_managers WHERE id = ?').run(id);
    },

    listRanks() {
      return listNamedRecords(db, 'ranks');
    },

    createRank(name) {
      return createNamedRecord(db, 'ranks', name);
    },

    updateRank(id, name) {
      return updateNamedRecord(db, 'ranks', id, name);
    },

    deleteRank(id) {
      db.prepare('DELETE FROM ranks WHERE id = ?').run(id);
    },

    listMeasurementUnits() {
      return db
        .prepare(
          `
            SELECT id, name, code, sort_order
            FROM measurement_units
            ORDER BY sort_order ASC, id ASC
          `
        )
        .all();
    },

    createMeasurementUnit(payload) {
      const nextOrder = getNextOrder(db, 'measurement_units');
      const result = db
        .prepare('INSERT INTO measurement_units (name, code, sort_order) VALUES (?, ?, ?)')
        .run(payload.name, payload.code, nextOrder);
      return getById(db, 'measurement_units', result.lastInsertRowid);
    },

    updateMeasurementUnit(id, payload) {
      db.prepare('UPDATE measurement_units SET name = ?, code = ? WHERE id = ?').run(
        payload.name,
        payload.code,
        id
      );
      return getById(db, 'measurement_units', id);
    },

    deleteMeasurementUnit(id) {
      db.prepare('DELETE FROM measurement_units WHERE id = ?').run(id);
    },

    listTransactionUnits() {
      return listNamedRecords(db, 'transaction_units');
    },

    createTransactionUnit(name) {
      return createNamedRecord(db, 'transaction_units', name);
    },

    updateTransactionUnit(id, name) {
      return updateNamedRecord(db, 'transaction_units', id, name);
    },

    deleteTransactionUnit(id) {
      db.prepare('DELETE FROM transaction_units WHERE id = ?').run(id);
    },

    listMaterialCategories() {
      return listNamedRecords(db, 'material_categories');
    },

    createMaterialCategory(name) {
      return createNamedRecord(db, 'material_categories', name);
    },

    updateMaterialCategory(id, name) {
      return updateNamedRecord(db, 'material_categories', id, name);
    },

    deleteMaterialCategory(id) {
      db.prepare('DELETE FROM material_categories WHERE id = ?').run(id);
    },

    listRequestJustificationCodes() {
      return db
        .prepare(
          `
            SELECT id, code, description, auto_delete_owed, sort_order
            FROM request_justification_codes
            ORDER BY sort_order ASC, id ASC
          `
        )
        .all();
    },

    listRequestIssuingUnits() {
      return listNamedRecords(db, 'request_issuing_units');
    },

    createRequestIssuingUnit(name) {
      return createNamedRecord(db, 'request_issuing_units', name);
    },

    updateRequestIssuingUnit(id, name) {
      return updateNamedRecord(db, 'request_issuing_units', id, name);
    },

    deleteRequestIssuingUnit(id) {
      db.prepare('DELETE FROM request_issuing_units WHERE id = ?').run(id);
    },

    listExhpIssueReasons() {
      return db.prepare(`
        SELECT id, name, sort_order, recommendation_text,
               first_opinion_text, second_opinion_text
        FROM exhp_issue_reasons
        ORDER BY sort_order ASC, id ASC
      `).all();
    },

    createExhpIssueReason(name) {
      return createNamedRecord(db, 'exhp_issue_reasons', name);
    },

    updateExhpIssueReasonTexts(id, payload) {
      db.prepare(`
        UPDATE exhp_issue_reasons
        SET recommendation_text = ?,
            first_opinion_text = ?,
            second_opinion_text = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        payload.recommendationText,
        payload.firstOpinionText,
        payload.secondOpinionText,
        id
      );
      return getById(db, 'exhp_issue_reasons', id);
    },

    deleteExhpIssueReason(id) {
      db.prepare('DELETE FROM exhp_issue_reasons WHERE id = ?').run(id);
    }
  };
}

function listNamedRecords(db, tableName) {
  return db
    .prepare(`SELECT id, name, sort_order FROM ${tableName} ORDER BY sort_order ASC, id ASC`)
    .all();
}

function createNamedRecord(db, tableName, name) {
  const nextOrder = getNextOrder(db, tableName);
  const result = db
    .prepare(`INSERT INTO ${tableName} (name, sort_order) VALUES (?, ?)`)
    .run(name, nextOrder);
  return getById(db, tableName, result.lastInsertRowid);
}

function updateNamedRecord(db, tableName, id, name) {
  db.prepare(`UPDATE ${tableName} SET name = ? WHERE id = ?`).run(name, id);
  return getById(db, tableName, id);
}

function getById(db, tableName, id) {
  return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
}

function getNextOrder(db, tableName) {
  const row = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM ${tableName}`).get();
  return row.nextOrder;
}

module.exports = {
  createSettingsRepository
};
