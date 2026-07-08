const { listActiveShares } = require('./shareQueries');

function createTransactionsRepository(db) {
  return {
    listShares() {
      return listActiveShares(db).map((share) => ({
        id: share.id,
        share_number: share.share_number,
        nominal_number: share.nominal_number,
        description: share.description,
        material_type: share.material_type,
        measurement_unit: share.measurement_unit,
        material_code: share.material_code,
        projected_quantity: share.projected_quantity,
        accounting_balance: share.accounting_balance,
        charged_quantity: share.charged_quantity,
        requires_composition: share.requires_composition,
        requires_change_sheet: share.requires_change_sheet
      }));
    },

    findShareByNumber(shareNumber) {
      return db.prepare('SELECT * FROM shares WHERE share_number = ?').get(shareNumber);
    },

    listCompositionItems(shareId) {
      return db.prepare(`
        SELECT component_nominal_number, component_description,
               measurement_unit, quantity, not_issued_quantity, notes
        FROM share_composition_items
        WHERE share_id = ?
        ORDER BY line_number, id
      `).all(shareId);
    },

    getNextShareNumber() {
      const row = db
        .prepare(
          `
            SELECT share_number
            FROM shares
            WHERE share_number GLOB '[0-9]*'
            ORDER BY CAST(share_number AS INTEGER) DESC
            LIMIT 1
          `
        )
        .get();
      const next = row ? Number(row.share_number) + 1 : 1;
      return String(next);
    },

    getServiceName() {
      const row = db.prepare('SELECT service_name FROM service_settings WHERE id = 1').get();
      return row ? row.service_name : '';
    },

    listMeasurementUnits() {
      return db
        .prepare(
          `
            SELECT id, name
            FROM measurement_units
            ORDER BY sort_order ASC, name COLLATE NOCASE ASC
          `
        )
        .all();
    },

    listTransactionUnits() {
      return db
        .prepare(
          `
            SELECT id, name
            FROM transaction_units
            ORDER BY sort_order ASC, name COLLATE NOCASE ASC
          `
        )
        .all();
    },

    listMaterialCategories() {
      return db
        .prepare(
          `
            SELECT id, name
            FROM material_categories
            ORDER BY sort_order ASC, name COLLATE NOCASE ASC
          `
        )
        .all();
    },

    createShare(payload) {
      const result = db
        .prepare(
          `
            INSERT INTO shares (
              share_number,
              nominal_number,
              description,
              material_type,
              material_code,
              measurement_unit,
              projected_quantity,
              accounting_balance,
              charged_quantity
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.shareNumber,
          payload.nominalNumber,
          payload.description,
          payload.materialType,
          payload.materialCode || '',
          payload.measurementUnit || '',
          payload.projectedQuantity || 0,
          payload.accountingBalance,
          payload.chargedQuantity
        );
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(result.lastInsertRowid);
    },

    adjustChargedQuantity(shareId, quantityDelta) {
      db.prepare(
        `
          UPDATE shares
          SET charged_quantity = charged_quantity + ?
          WHERE id = ?
        `
      ).run(quantityDelta, shareId);
    },

    adjustAccountingBalance(shareId, quantityDelta) {
      db.prepare(
        `
          UPDATE shares
          SET accounting_balance = accounting_balance + ?
          WHERE id = ?
        `
      ).run(quantityDelta, shareId);
    },

    getNextExhpRegistryNumber(fiscalYear) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(MAX(registry_number), 0) + 1 AS next_number
            FROM exhp_documents
            WHERE fiscal_year = ?
          `
        )
        .get(fiscalYear);
      return Number(row ? row.next_number : 1);
    },

    createExhpDocument(payload) {
      return db
        .prepare(
          `
            INSERT INTO exhp_documents (
              fiscal_year,
              registry_number,
              document_date,
              service_unit,
              issue_reason,
              approval_reference,
              other_support_document,
              notes,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.fiscalYear,
          payload.registryNumber,
          payload.documentDate,
          payload.serviceUnit,
          payload.issueReason,
          payload.approvalReference,
          payload.otherSupportDocument || '',
          payload.notes,
          payload.status
        ).lastInsertRowid;
    },

    createExhpItem(documentId, item, shareId, shareTransactionId) {
      db.prepare(
        `
          INSERT INTO exhp_items (
            exhp_document_id,
            share_id,
            share_number,
            nominal_number,
            description,
            measurement_unit,
            material_type,
            material_code,
            transaction_type,
            quantity,
            supporting_documents,
            share_transaction_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        documentId,
        shareId,
        item.shareNumber,
        item.nominalNumber,
        item.description,
        item.measurementUnit,
        item.materialType || '',
        item.materialCode || '',
        item.transactionType,
        item.quantity,
        item.supportingDocuments || '',
        shareTransactionId
      );
    },

    listExhpDocuments() {
      return db
        .prepare(
          `
            SELECT id, fiscal_year, registry_number, document_date, service_unit,
                   issue_reason, approval_reference, notes, status, support_status
            FROM exhp_documents
            ORDER BY fiscal_year ASC, registry_number ASC
          `
        )
        .all();
    },

    listExhpSupportTemplates() {
      return db.prepare(`
        SELECT template.*, reason.name AS issue_reason
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        ORDER BY reason.sort_order, template.sort_order, template.id
      `).all();
    },

    createExhpDocumentSupports(documentId, issueReason, supports) {
      const provided = new Map((supports || []).map((item) => [Number(item.templateId), item]));
      if (!provided.size) {
        return 0;
      }

      const templates = db.prepare(`
        SELECT template.*
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name = ?
        ORDER BY template.sort_order, template.id
      `).all(issueReason).filter((template) => provided.has(Number(template.id)));
      if (!templates.length) {
        return 0;
      }

      const materialRequirements = db.prepare(`
        SELECT
          MAX(CASE WHEN share.requires_composition = 1 THEN 1 ELSE 0 END) AS requires_composition,
          MAX(CASE WHEN share.requires_change_sheet = 1 THEN 1 ELSE 0 END) AS requires_change_sheet
        FROM exhp_items item
        JOIN shares share ON share.id = item.share_id
        WHERE item.exhp_document_id = ?
      `).get(documentId) || {};
      db.transaction(() => {
        const insert = db.prepare(`
          INSERT INTO exhp_document_supports (
            exhp_document_id, template_id, document_reference, completed, notes, required_override, form_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        templates.forEach((template) => {
          const support = provided.get(Number(template.id)) || {};
          const requiredOverride = template.document_code === 'ΔΥΠ/190'
            ? (materialRequirements.requires_composition ? 1 : 0)
            : template.document_code === 'ΔΥΠ/191'
              ? (materialRequirements.requires_change_sheet ? 1 : 0)
              : null;
          insert.run(
            documentId,
            template.id,
            String(support.documentReference || '').trim(),
            support.completed ? 1 : 0,
            String(support.notes || '').trim(),
            requiredOverride,
            JSON.stringify(support.formData || {})
          );
        });
      })();
      return templates.length;
    },

    listExhpDocumentSupports(documentId) {
      return db.prepare(`
        SELECT support.*, template.document_code, template.title,
               COALESCE(support.required_override, template.required) AS effective_required,
               template.required, template.printable
        FROM exhp_document_supports support
        JOIN exhp_support_templates template ON template.id = support.template_id
        WHERE support.exhp_document_id = ?
        ORDER BY template.sort_order, template.id
      `).all(documentId);
    },

    updateExhpDocumentSupport(id, completed, documentReference, notes) {
      db.prepare(`
        UPDATE exhp_document_supports
        SET completed = ?, document_reference = ?, notes = ?
        WHERE id = ?
      `).run(completed ? 1 : 0, documentReference, notes, id);
    },

    updateExhpOtherSupportDocument(documentId, value) {
      db.prepare(`
        UPDATE exhp_documents
        SET other_support_document = ?
        WHERE id = ?
      `).run(value, documentId);
    },

    updateExhpIndexFields(documentId, field6, field7) {
      db.prepare(`
        UPDATE exhp_documents
        SET index_field_6 = ?,
            index_field_7 = ?
        WHERE id = ?
      `).run(field6, field7, documentId);
    },

    updateAddyIndexFields(documentId, field7, field8, field9) {
      db.prepare(`
        UPDATE addy_documents
        SET index_field_7 = ?,
            index_field_8 = ?,
            index_field_9 = ?
        WHERE id = ?
      `).run(field7, field8, field9, documentId);
    },

    saveExhpDocumentSupportForm(id, formData, documentReference, completed) {
      db.prepare(`
        UPDATE exhp_document_supports
        SET form_data = ?, document_reference = ?, completed = ?
        WHERE id = ?
      `).run(JSON.stringify(formData || {}), documentReference, completed ? 1 : 0, id);
    },

    refreshExhpSupportStatus(documentId) {
      const row = db.prepare(`
        SELECT COUNT(*) AS required_count,
               COALESCE(SUM(CASE WHEN support.completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count
        FROM exhp_document_supports support
        JOIN exhp_support_templates template ON template.id = support.template_id
        WHERE support.exhp_document_id = ?
          AND COALESCE(support.required_override, template.required) = 1
      `).get(documentId);
      const status = Number(row.required_count) === Number(row.completed_count)
        ? 'Πλήρης για ΕΥΣ'
        : 'Ελλιπής';
      db.prepare(`
        UPDATE exhp_documents
        SET support_status = ?,
            status = CASE WHEN ? = 'Πλήρης για ΕΥΣ' THEN 'Οριστική' ELSE 'Προς Συμπλήρωση' END
        WHERE id = ?
      `).run(status, status, documentId);
      return status;
    },

    getExhpDocument(id) {
      return db.prepare('SELECT * FROM exhp_documents WHERE id = ?').get(id);
    },

    listExhpDocumentItems(documentId) {
      return db
        .prepare(
          `
            SELECT *
            FROM exhp_items
            WHERE exhp_document_id = ?
            ORDER BY id ASC
          `
        )
        .all(documentId);
    },

    listExhpMaterialAttachments(documentId) {
      const composition = db.prepare(`
        SELECT item.share_number, item.description AS parent_description,
               component.component_nominal_number, component.component_description,
               component.measurement_unit, component.quantity, component.notes
        FROM exhp_items item
        JOIN share_composition_items component ON component.share_id = item.share_id
        WHERE item.exhp_document_id = ?
        ORDER BY item.id, component.line_number, component.id
      `).all(documentId);
      const changes = db.prepare(`
        SELECT item.share_number, item.description AS parent_description,
               change.change_date, change.order_reference, change.previous_value,
               change.new_value, change.change_reason, change.notes,
               change.component_line_number, change.movement_type, change.quantity
        FROM exhp_items item
        JOIN share_change_sheet_entries change ON change.share_id = item.share_id
        WHERE item.exhp_document_id = ?
        ORDER BY item.id, change.change_date, change.id
      `).all(documentId);
      return { composition, changes };
    },

    listExhpIndexRows(year) {
      return db
        .prepare(
          `
            SELECT id, fiscal_year, registry_number, document_date, issue_reason,
                   index_field_6, index_field_7, status
            FROM exhp_documents
            WHERE fiscal_year = ?
            ORDER BY registry_number ASC
          `
        )
        .all(year);
    },

    ensureTransactionUnit(name) {
      const existing = db.prepare('SELECT id FROM transaction_units WHERE name = ?').get(name);
      if (existing) {
        return existing.id;
      }

      const nextOrder = db
        .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM transaction_units')
        .get().nextOrder;

      return db
        .prepare('INSERT INTO transaction_units (name, sort_order) VALUES (?, ?)')
        .run(name, nextOrder).lastInsertRowid;
    },

    createAddyDocument(payload) {
      return db
        .prepare(
          `
            INSERT INTO addy_documents (document_date, transaction_unit, justification_reference, notes)
            VALUES (?, ?, ?, ?)
          `
        )
        .run(payload.documentDate, payload.transactionUnit, payload.justificationReference, payload.notes).lastInsertRowid;
    },

    createAddyItem(documentId, item, shareId, shareTransactionId) {
      db.prepare(
        `
          INSERT INTO addy_items (
            addy_document_id,
            share_id,
            share_number,
            nominal_number,
            description,
            material_type,
            measurement_unit,
            unit_price,
            transaction_type,
            quantity,
            share_transaction_id,
            composition_snapshot
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        documentId,
        shareId,
        item.shareNumber,
        item.nominalNumber,
        item.description,
        item.materialType,
        item.measurementUnit,
        item.unitPrice,
        item.transactionType,
        item.quantity,
        shareTransactionId,
        item.composition && item.composition.length ? JSON.stringify(item.composition) : ''
      );
    },

    createShareTransaction(payload) {
      return db.prepare(
        `
          INSERT INTO share_transactions (
            share_id,
            transaction_date,
            transaction_unit,
            transaction_type,
            document_reference,
            quantity,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        payload.shareId,
        payload.transactionDate,
        payload.transactionUnit,
        payload.transactionType,
        payload.documentReference,
            payload.quantity,
            payload.notes
      ).lastInsertRowid;
    },

    getShareTransactionSerialForYear(shareId, transactionId, transactionDate) {
      const year = Number(String(transactionDate).slice(0, 4)) || new Date().getFullYear();
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const row = db
        .prepare(
          `
            SELECT COUNT(*) AS serial
            FROM share_transactions
            WHERE share_id = ?
              AND transaction_date BETWEEN ? AND ?
              AND notes <> 'INITIAL_ANNUAL_INVENTORY'
              AND (
                transaction_date < ?
                OR (transaction_date = ? AND id <= ?)
              )
          `
        )
        .get(shareId, start, end, transactionDate, transactionDate, transactionId);
      return row ? row.serial : 1;
    },

    findAddyShareTransaction(shareId, documentId, documentDate, transactionType, quantity) {
      const reference = `ΑΔΔΥ ${documentId} / ${formatRepositoryDate(documentDate)}`;
      return db.prepare(`
        SELECT id
        FROM share_transactions
        WHERE share_id = ?
          AND document_reference = ?
          AND transaction_type = ?
          AND quantity = ?
        ORDER BY id ASC
        LIMIT 1
      `).get(shareId, reference, transactionType, quantity);
    },

    createShareAssignment(payload) {
      db.prepare(
        `
          INSERT INTO share_assignments (
            share_id,
            holder_name,
            department,
            quantity,
            notes
          )
          VALUES (?, ?, ?, ?, ?)
        `
      ).run(payload.shareId, payload.holderName, payload.department, payload.quantity, payload.notes);
    },

    listExternalTransactionIndexRows(year) {
      return db
        .prepare(
          `
            SELECT
              d.id,
              d.document_date,
              d.transaction_unit,
              d.justification_reference,
              d.index_field_7,
              d.index_field_8,
              d.index_field_9,
              d.notes,
              first_item.nominal_number,
              first_item.description,
              first_item.transaction_type,
              (
                SELECT COALESCE(SUM(quantity), 0)
                FROM addy_items
                WHERE addy_document_id = d.id
              ) AS total_quantity
            FROM addy_documents d
            LEFT JOIN addy_items first_item
              ON first_item.id = (
                SELECT id
                FROM addy_items
                WHERE addy_document_id = d.id
                ORDER BY id ASC
                LIMIT 1
              )
            WHERE d.document_date >= ?
              AND d.document_date <= ?
            ORDER BY d.document_date ASC, d.id ASC
          `
        )
        .all(`${year}-01-01`, `${year}-12-31`);
    },

    listAddyDocuments() {
      return db
        .prepare(
          `
            SELECT
              d.id,
              d.document_date,
              d.transaction_unit,
              d.justification_reference,
              d.notes,
              first_item.nominal_number,
              first_item.description,
              first_item.transaction_type,
              (
                SELECT COALESCE(SUM(quantity), 0)
                FROM addy_items
                WHERE addy_document_id = d.id
              ) AS total_quantity
            FROM addy_documents d
            LEFT JOIN addy_items first_item
              ON first_item.id = (
                SELECT id
                FROM addy_items
                WHERE addy_document_id = d.id
                ORDER BY id ASC
                LIMIT 1
              )
            ORDER BY d.id ASC
          `
        )
        .all();
    },

    getAddyDocument(id) {
      return db.prepare('SELECT * FROM addy_documents WHERE id = ?').get(id);
    },

    listAddyDocumentItems(documentId) {
      return db
        .prepare(
          `
            SELECT
              item.id,
              item.share_id,
              item.share_number,
              item.nominal_number,
              item.description,
              item.material_type,
              item.measurement_unit,
              item.unit_price,
              item.transaction_type,
              item.quantity,
              item.share_transaction_id,
              item.composition_snapshot,
              share.share_number AS current_share_number
            FROM addy_items item
            LEFT JOIN shares share ON share.id = item.share_id
            WHERE item.addy_document_id = ?
            ORDER BY item.id ASC
          `
        )
        .all(documentId);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

function formatRepositoryDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

module.exports = {
  createTransactionsRepository
};
