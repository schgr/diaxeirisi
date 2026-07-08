function createAnnualAccountsRepository(db) {
  return {
    getPackageByYear(year) {
      return db.prepare('SELECT * FROM annual_account_packages WHERE fiscal_year = ?').get(year);
    },

    getPackageById(id) {
      return db.prepare('SELECT * FROM annual_account_packages WHERE id = ?').get(id);
    },

    createPackage(payload) {
      return db.prepare(`
        INSERT INTO annual_account_packages (
          fiscal_year, audit_service_name, submission_due_date,
          accountable_manager, accountable_manager_registry_number,
          accountable_manager_tax_number, manager_term
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.fiscalYear,
        payload.auditServiceName,
        payload.submissionDueDate,
        payload.accountableManager,
        payload.accountableManagerRegistryNumber,
        payload.accountableManagerTaxNumber,
        payload.managerTerm
      ).lastInsertRowid;
    },

    insertCheck(packageId, key, title) {
      db.prepare(`
        INSERT INTO annual_account_checks (package_id, check_key, title)
        VALUES (?, ?, ?)
      `).run(packageId, key, title);
    },

    listChecks(packageId) {
      return db.prepare(`
        SELECT * FROM annual_account_checks WHERE package_id = ? ORDER BY id
      `).all(packageId);
    },

    updateCheck(packageId, key, completed, notes) {
      db.prepare(`
        UPDATE annual_account_checks
        SET completed = ?, notes = ?
        WHERE package_id = ? AND check_key = ?
      `).run(completed ? 1 : 0, notes, packageId, key);
    },

    updatePackage(packageId, payload) {
      db.prepare(`
        UPDATE annual_account_packages
        SET audit_service_name = ?,
            committee_order_reference = ?,
            protocol_reference = ?,
            accountable_manager = ?,
            accountable_manager_registry_number = ?,
            accountable_manager_tax_number = ?,
            manager_term = ?,
            notes = ?
        WHERE id = ?
      `).run(
        payload.auditServiceName,
        payload.committeeOrderReference,
        payload.protocolReference,
        payload.accountableManager,
        payload.accountableManagerRegistryNumber,
        payload.accountableManagerTaxNumber,
        payload.managerTerm,
        payload.notes,
        packageId
      );
    },

    submitPackage(packageId, submissionDate) {
      db.transaction(() => {
        db.prepare(`
          UPDATE annual_account_packages
          SET status = 'Υποβλήθηκε', submission_date = ?
          WHERE id = ?
        `).run(submissionDate, packageId);
        db.prepare(`
          UPDATE exhp_documents SET submitted_to_eus = 1
          WHERE fiscal_year = (SELECT fiscal_year FROM annual_account_packages WHERE id = ?)
        `).run(packageId);
      })();
    },

    getAutomaticMetrics(year) {
      const scalar = (sql, ...params) => Number(db.prepare(sql).get(...params).count || 0);
      return {
        movedShares: scalar(`
          SELECT COUNT(DISTINCT share_id) AS count FROM share_transactions
          WHERE transaction_date BETWEEN ? AND ?
        `, `${year}-01-01`, `${year}-12-31`),
        openingInventories: scalar(`
          SELECT COUNT(*) AS count FROM inventory_sessions
          WHERE status = 'Ολοκληρωμένη' AND fiscal_year IN (?, ?)
        `, year - 1, year),
        closingInventories: scalar(`
          SELECT COUNT(*) AS count FROM inventory_sessions
          WHERE status = 'Ολοκληρωμένη' AND fiscal_year = ?
        `, year),
        addyDocuments: scalar(`
          SELECT COUNT(*) AS count FROM addy_documents
          WHERE document_date BETWEEN ? AND ?
        `, `${year}-01-01`, `${year}-12-31`),
        exhpDocuments: scalar('SELECT COUNT(*) AS count FROM exhp_documents WHERE fiscal_year = ?', year),
        incompleteExhp: scalar(`
          SELECT COUNT(*) AS count FROM exhp_documents
          WHERE fiscal_year = ? AND support_status <> 'Πλήρης για ΕΥΣ'
        `, year),
        differenceProtocols: scalar(`
          SELECT COUNT(*) AS count FROM movement_difference_protocols WHERE fiscal_year = ?
        `, year),
        handovers: scalar(`
          SELECT COUNT(*) AS count FROM general_management_handovers
          WHERE fiscal_year = ? AND status = 'Ολοκληρωμένη'
        `, year)
      };
    },

    getServiceSettings() {
      return db.prepare('SELECT * FROM service_settings WHERE id = 1').get();
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = { createAnnualAccountsRepository };
