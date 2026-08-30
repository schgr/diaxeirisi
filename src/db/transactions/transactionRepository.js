const { listActiveShares } = require('../shareQueries');
const { optionalText, requireText } = require('../../core/validation');
const { AppError } = require('../../core/errorHandler');

const ALLOWED_TABLE_NAMES = new Set([
  'share_assignments',
  'share_composition_items',
  'share_change_sheet_entries',
  'share_serial_numbers',
  'share_ammunition_batches',
  'share_training_ammunition_batches'
]);

function assertAllowedTableName(tableName) {
  if (!ALLOWED_TABLE_NAMES.has(tableName)) {
    throw new Error(`Unsupported transactions table: ${tableName}`);
  }
}

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

    getFiscalYearArchive(year) {
      return db.prepare(`
        SELECT archive_snapshot
        FROM fiscal_year_closures
        WHERE fiscal_year = ?
      `).get(year);
    },

    isFiscalYearClosed(year) {
      return Boolean(db.prepare(`
        SELECT 1 FROM fiscal_year_closures WHERE fiscal_year = ?
      `).get(year));
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

    listInternalCompositionMovements() {
      return db.prepare(`
        SELECT item.share_id, document.movement_type, item.composition_snapshot
        FROM internal_items item
        JOIN internal_documents document ON document.id = item.internal_document_id
        WHERE TRIM(COALESCE(item.composition_snapshot, '')) <> ''
        ORDER BY document.document_date, document.id, item.id
      `).all();
    },

    listDepartmentManagers() {
      return db.prepare(`
        SELECT id, department_name, department_head
        FROM department_managers
        ORDER BY sort_order, id
      `).all();
    },

    getDepartmentShareBalance(departmentManagerId, shareId) {
      const row = db.prepare(`
        SELECT COALESCE(SUM(
          CASE WHEN document.movement_type = 'Χορήγηση' THEN item.quantity ELSE -item.quantity END
        ), 0) AS balance
        FROM internal_items item
        JOIN internal_documents document ON document.id = item.internal_document_id
        WHERE document.department_manager_id = ? AND item.share_id = ?
      `).get(departmentManagerId, shareId);
      return Number(row?.balance || 0);
    },

    deleteInternalMovementsByReference(reference) {
      const movements = db.prepare(`
        SELECT item.share_id, item.quantity, document.movement_type
        FROM internal_items item
        JOIN internal_documents document ON document.id = item.internal_document_id
        WHERE document.notes = ?
      `).all(reference);
      for (const movement of movements) {
        const delta = movement.movement_type === 'Χορήγηση'
          ? -Number(movement.quantity)
          : Number(movement.quantity);
        db.prepare('UPDATE shares SET charged_quantity = charged_quantity + ? WHERE id = ?')
          .run(delta, movement.share_id);
      }
      db.prepare('DELETE FROM internal_documents WHERE notes = ?').run(reference);
      return movements.length;
    },

    getNextInternalSerial(fiscalYear) {
      const row = db.prepare(`
        SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
        FROM internal_documents
        WHERE fiscal_year = ?
      `).get(fiscalYear);
      return Number(row?.next_serial || 1);
    },

    createInternalDocument(payload) {
      return db.prepare(`
        INSERT INTO internal_documents (
          fiscal_year, serial_number, document_date, department_manager_id,
          department_name, department_head, movement_type, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.fiscalYear,
        payload.serialNumber,
        payload.documentDate,
        payload.departmentManagerId,
        payload.departmentName,
        payload.departmentHead,
        payload.movementType,
        payload.notes
      ).lastInsertRowid;
    },

    createInternalItem(documentId, payload) {
      db.prepare(`
        INSERT INTO internal_items (
          internal_document_id, share_id, share_number, nominal_number,
          description, measurement_unit, quantity, composition_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        documentId,
        payload.shareId,
        payload.shareNumber,
        payload.nominalNumber,
        payload.description,
        payload.measurementUnit,
        payload.quantity,
        payload.composition?.length ? JSON.stringify(payload.composition) : ''
      );
    },

    adjustChargedQuantity(shareId, delta) {
      db.prepare('UPDATE shares SET charged_quantity = charged_quantity + ? WHERE id = ?')
        .run(delta, shareId);
    },

    listCompositionChangeSheetEntries() {
      return db.prepare(`
        SELECT entry.share_id,
               entry.movement_type,
               entry.quantity,
               component.component_nominal_number,
               component.component_description
        FROM share_change_sheet_entries entry
        JOIN share_composition_items component
          ON component.share_id = entry.share_id
         AND component.line_number = entry.component_line_number
        WHERE COALESCE(entry.quantity, 0) <> 0
        ORDER BY entry.change_date, entry.id
      `).all();
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

    listCommerceCompanies() {
      return db
        .prepare(
          `
            SELECT id, name, tax_number AS taxNumber, address
            FROM commerce_companies
            ORDER BY sort_order ASC, id ASC
          `
        )
        .all();
    },

    createCommerceCompany({ name, taxNumber = '', address = '' } = {}) {
      const validatedName = requireText(name, 'Επωνυμία');
      const validatedTaxNumber = optionalText(taxNumber);
      const validatedAddress = optionalText(address);
      const nextOrder = db
        .prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS nextOrder FROM commerce_companies')
        .get().nextOrder;
      const result = db
        .prepare(
          'INSERT INTO commerce_companies (name, tax_number, address, sort_order) VALUES (?, ?, ?, ?)'
        )
        .run(validatedName, validatedTaxNumber, validatedAddress, nextOrder);
      return {
        id: Number(result.lastInsertRowid),
        name: validatedName,
        taxNumber: validatedTaxNumber,
        address: validatedAddress
      };
    },

    updateCommerceCompany(id, { name, taxNumber = '', address = '' }) {
      const validatedName = requireText(name, 'Επωνυμία');
      const validatedTaxNumber = optionalText(taxNumber);
      const validatedAddress = optionalText(address);
      db.prepare('UPDATE commerce_companies SET name = ?, tax_number = ?, address = ? WHERE id = ?')
        .run(validatedName, validatedTaxNumber, validatedAddress, id);
    },

    deleteCommerceCompany(id) {
      const inUse = db.prepare('SELECT COUNT(*) AS count FROM addy_documents WHERE commerce_company_id = ?')
        .get(id).count;
      if (inUse > 0) {
        throw new AppError(
          'Η επιχείρηση χρησιμοποιείται ήδη σε καταχωρημένα ΑΔΔΥ και δεν μπορεί να διαγραφεί.',
          'COMMERCE_COMPANY_IN_USE'
        );
      }
      db.prepare('DELETE FROM commerce_companies WHERE id = ?').run(id);
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
              charged_quantity,
              archive_reason,
              requires_composition,
              requires_change_sheet
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          payload.chargedQuantity,
          payload.excludeFromInventory ? 'EXCLUDE_FROM_INVENTORY' : '',
          payload.requiresComposition ? 1 : 0,
          payload.requiresChangeSheet ? 1 : 0
        );
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(result.lastInsertRowid);
    },

    replaceCompositionItems(shareId, items) {
      db.prepare('DELETE FROM share_composition_items WHERE share_id = ?').run(shareId);
      const insert = db.prepare(`
        INSERT INTO share_composition_items (
          share_id, line_number, component_nominal_number, component_description,
          measurement_unit, quantity, not_issued_quantity, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((item, index) => insert.run(
        shareId,
        index + 1,
        item.componentNominalNumber,
        item.componentDescription,
        item.measurementUnit,
        item.projectedQuantity,
        item.notIssuedQuantity || 0,
        item.notes || ''
      ));
    },

    createTransferredShare(sourceShareId, newShareNumber, newNominalNumber) {
      const result = db.prepare(`
        INSERT INTO shares (
          share_number, nominal_number, description, material_type, material_code,
          main_material_number, measurement_unit, projected_quantity,
          accounting_balance, charged_quantity, unit_price, photo_path,
          archive_status, archived_at, archive_reason, requires_composition,
          requires_change_sheet, requires_serial_number, requires_weapon_registry,
          requires_ammunition_batch_book, requires_training_ammunition_batch_book,
          previous_share_number
        )
        SELECT ?, ?, description, material_type, material_code,
               main_material_number, measurement_unit, projected_quantity,
               0, charged_quantity, unit_price, photo_path,
               'Ενεργή', NULL, '', requires_composition,
               requires_change_sheet, requires_serial_number, requires_weapon_registry,
               requires_ammunition_batch_book, requires_training_ammunition_batch_book,
               ''
        FROM shares
        WHERE id = ?
      `).run(newShareNumber, newNominalNumber, sourceShareId);
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(result.lastInsertRowid);
    },

    moveCurrentShareState(sourceShareId, targetShare) {
      db.prepare(`
        UPDATE internal_items
        SET share_id = ?, share_number = ?, nominal_number = ?,
            description = ?, measurement_unit = ?
        WHERE share_id = ?
      `).run(
        targetShare.id,
        targetShare.share_number,
        targetShare.nominal_number,
        targetShare.description,
        targetShare.measurement_unit,
        sourceShareId
      );
      for (const table of [
        'share_assignments',
        'share_composition_items',
        'share_change_sheet_entries',
        'share_serial_numbers',
        'share_ammunition_batches',
        'share_training_ammunition_batches'
      ]) {
        assertAllowedTableName(table);
        db.prepare(`UPDATE ${table} SET share_id = ? WHERE share_id = ?`)
          .run(targetShare.id, sourceShareId);
      }
    },

    keepTransferredShareActive(shareId) {
      db.prepare(`
        UPDATE shares
        SET accounting_balance = 0, charged_quantity = 0,
            archive_status = 'Ενεργή', archived_at = NULL, archive_reason = ''
        WHERE id = ?
      `).run(shareId);
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
            SELECT MIN(candidate) AS next_number
            FROM (
              SELECT 1 AS candidate
              UNION ALL
              SELECT registry_number + 1 AS candidate
              FROM exhp_documents
              WHERE fiscal_year = ?
            ) AS candidates
            WHERE NOT EXISTS (
              SELECT 1
              FROM exhp_documents AS document
              WHERE document.fiscal_year = ?
                AND document.registry_number = candidates.candidate
            )
          `
        )
        .get(fiscalYear, fiscalYear);
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
            share_transaction_id,
            composition_snapshot
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        shareTransactionId,
        item.composition && item.composition.length ? JSON.stringify(item.composition) : ''
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

    listExhpOfficialSupportDocuments(documentId) {
      return db.prepare(`
        SELECT id, document_type
        FROM exhp_support_documents
        WHERE exhp_id = ?
        ORDER BY created_at, id
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

    getShareById(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    countShareTransactionsExcluding(shareId, transactionIds = []) {
      const ids = transactionIds.map(Number).filter(Number.isInteger);
      const exclusion = ids.length
        ? `AND id NOT IN (${ids.map(() => '?').join(', ')})`
        : '';
      return Number(db.prepare(`
        SELECT COUNT(*) AS total
        FROM share_transactions
        WHERE share_id = ?
        ${exclusion}
      `).get(shareId, ...ids)?.total || 0);
    },

    findSubsequentShareTransaction(transactionIds = []) {
      const ids = transactionIds.map(Number).filter(Number.isInteger);
      if (!ids.length) return null;
      const placeholders = ids.map(() => '?').join(', ');
      return db.prepare(`
        SELECT
          source.share_id AS share_id,
          source.transaction_date AS source_date,
          source.id AS source_transaction_id,
          later.transaction_date AS later_date,
          later.id AS later_transaction_id
        FROM share_transactions source
        JOIN share_transactions later ON later.share_id = source.share_id
          AND later.id NOT IN (${placeholders})
          AND (
            later.transaction_date > source.transaction_date
            OR (later.transaction_date = source.transaction_date AND later.id > source.id)
          )
        WHERE source.id IN (${placeholders})
        ORDER BY later.transaction_date ASC, later.id ASC
        LIMIT 1
      `).get(...ids, ...ids) || null;
    },

    deleteExhpDocument(documentId) {
      db.prepare('DELETE FROM exhp_documents WHERE id = ?').run(documentId);
    },

    deleteShareTransactions(transactionIds = []) {
      const ids = transactionIds.map(Number).filter(Number.isInteger);
      if (!ids.length) return;
      db.prepare(`DELETE FROM share_transactions WHERE id IN (${ids.map(() => '?').join(', ')})`)
        .run(...ids);
    },

    rollbackTransferredShare(sourceShareId, targetShareId, balance, documentReference) {
      const source = db.prepare('SELECT * FROM shares WHERE id = ?').get(sourceShareId);
      const target = db.prepare('SELECT * FROM shares WHERE id = ?').get(targetShareId);
      if (!source || !target) throw new Error('Δεν ήταν δυνατή η επαναφορά των μερίδων της ΕΧΠ.');
      db.prepare(`
        UPDATE internal_items
        SET share_id = ?, share_number = ?, nominal_number = ?,
            description = ?, measurement_unit = ?
        WHERE share_id = ?
      `).run(
        source.id,
        source.share_number,
        source.nominal_number,
        source.description,
        source.measurement_unit,
        target.id
      );
      for (const table of [
        'share_assignments',
        'share_composition_items',
        'share_change_sheet_entries',
        'share_serial_numbers',
        'share_ammunition_batches',
        'share_training_ammunition_batches'
      ]) {
        assertAllowedTableName(table);
        db.prepare(`UPDATE ${table} SET share_id = ? WHERE share_id = ?`)
          .run(source.id, target.id);
      }
      db.prepare(`
        UPDATE shares
        SET accounting_balance = ?,
            charged_quantity = ?,
            archive_status = 'Ενεργή',
            archived_at = NULL,
            archive_reason = ''
        WHERE id = ?
      `).run(balance, target.charged_quantity, source.id);
      db.prepare(`
        DELETE FROM share_archive_events
        WHERE share_id = ?
          AND reason LIKE ?
      `).run(source.id, `%${documentReference}%`);
      db.prepare('DELETE FROM shares WHERE id = ?').run(target.id);
    },

    updateExhpMetadata(documentId, payload) {
      db.prepare(`
        UPDATE exhp_documents
        SET fiscal_year = ?,
            registry_number = ?,
            document_date = ?
        WHERE id = ?
      `).run(
        payload.fiscalYear,
        payload.registryNumber,
        payload.documentDate,
        documentId
      );
      db.prepare(`
        UPDATE share_transactions
        SET transaction_date = ?,
            document_reference = ?
        WHERE id IN (
          SELECT share_transaction_id
          FROM exhp_items
          WHERE exhp_document_id = ?
            AND share_transaction_id IS NOT NULL
        )
      `).run(
        payload.documentDate,
        `ΕΧΠ ${payload.registryNumber}/${payload.fiscalYear}`,
        documentId
      );
    },

    updateExhpItemQuantity(itemId, shareTransactionId, quantity) {
      db.prepare(`
        UPDATE exhp_items
        SET quantity = ?
        WHERE id = ?
      `).run(quantity, itemId);
      if (shareTransactionId) {
        db.prepare(`
          UPDATE share_transactions
          SET quantity = ?
          WHERE id = ?
        `).run(quantity, shareTransactionId);
      }
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

    listExhpFinancialYearMovementRows(year, transactionType) {
      return db.prepare(`
        SELECT item.id, item.share_id, item.share_number, item.description, item.transaction_type,
               item.quantity, item.share_transaction_id,
               document.document_date, document.fiscal_year, document.registry_number
        FROM exhp_items item
        JOIN exhp_documents document ON document.id = item.exhp_document_id
        WHERE document.fiscal_year = ?
          AND item.transaction_type = ?
        ORDER BY document.document_date ASC, item.id ASC
      `).all(year, transactionType);
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
      const nextId = db.prepare(`
        SELECT MIN(candidate.id) AS next_id
        FROM (SELECT 1 AS id UNION ALL SELECT id + 1 FROM addy_documents) AS candidate
        WHERE candidate.id NOT IN (SELECT id FROM addy_documents)
      `).get().next_id;

      db.prepare(
        `INSERT INTO addy_documents (
          id, document_date, transaction_unit, justification_reference, notes,
          invoice_number, invoice_date, commerce_company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        nextId,
        payload.documentDate,
        payload.transactionUnit,
        payload.justificationReference,
        payload.notes,
        payload.invoiceNumber || null,
        payload.invoiceDate || null,
        payload.commerceCompanyId || null
      );

      return nextId;
    },

    createAddyItem(documentId, item, shareId, shareTransactionId) {
      return db.prepare(
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
      ).lastInsertRowid;
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

    findExhpShareTransaction(shareId, registryNumber, fiscalYear, transactionType, quantity) {
      return db.prepare(`
        SELECT id
        FROM share_transactions
        WHERE share_id = ?
          AND document_reference = ?
          AND transaction_type = ?
          AND quantity = ?
        ORDER BY id ASC
        LIMIT 1
      `).get(shareId, `ΕΧΠ ${registryNumber}/${fiscalYear}`, transactionType, quantity);
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
              d.id AS document_id,
              item.id AS item_id,
              d.document_date,
              d.transaction_unit,
              d.justification_reference,
              d.index_field_7,
              d.index_field_8,
              d.index_field_9,
              d.notes,
              item.nominal_number,
              item.description,
              item.transaction_type,
              (
                SELECT COALESCE(SUM(quantity), 0)
                FROM addy_items
                WHERE addy_document_id = d.id
              ) AS total_quantity
            FROM addy_documents d
            LEFT JOIN addy_items item ON item.addy_document_id = d.id
            WHERE d.document_date >= ?
              AND d.document_date <= ?
            ORDER BY d.document_date ASC, d.id ASC, item.id ASC
          `
        )
        .all(`${year}-01-01`, `${year}-12-31`);
    },

    listAddyFinancialYearMovementRows(year, transactionType) {
      return db.prepare(`
        WITH ranked_documents AS (
          SELECT document.*,
                 ROW_NUMBER() OVER (ORDER BY document.document_date ASC, document.id ASC) AS registry_number
          FROM addy_documents document
          WHERE document.document_date BETWEEN ? AND ?
        )
        SELECT item.id, item.share_id, item.share_number, item.description, item.transaction_type,
               item.quantity, item.share_transaction_id,
               document.id AS document_id, document.document_date, document.transaction_unit,
               document.registry_number
        FROM addy_items item
        JOIN ranked_documents document ON document.id = item.addy_document_id
        WHERE item.transaction_type = ?
        ORDER BY document.document_date ASC, item.id ASC
      `).all(`${year}-01-01`, `${year}-12-31`, transactionType);
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
              d.invoice_number,
              d.invoice_date,
              d.commerce_company_id,
              company.name AS commerce_company_name,
              company.tax_number AS commerce_company_tax_number,
              company.address AS commerce_company_address,
              first_item.nominal_number,
              first_item.description,
              first_item.transaction_type,
              (
                SELECT COALESCE(SUM(quantity), 0)
                FROM addy_items
                WHERE addy_document_id = d.id
              ) AS total_quantity
            FROM addy_documents d
            LEFT JOIN commerce_companies company ON company.id = d.commerce_company_id
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
      return db.prepare(`
        SELECT
          document.*,
          company.name AS commerce_company_name,
          company.tax_number AS commerce_company_tax_number,
          company.address AS commerce_company_address
        FROM addy_documents document
        LEFT JOIN commerce_companies company ON company.id = document.commerce_company_id
        WHERE document.id = ?
      `).get(id);
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
              share_transaction.id AS existing_share_transaction_id,
              item.composition_snapshot,
              share.share_number AS current_share_number
            FROM addy_items item
            LEFT JOIN shares share ON share.id = item.share_id
            LEFT JOIN share_transactions share_transaction ON share_transaction.id = item.share_transaction_id
            WHERE item.addy_document_id = ?
            ORDER BY item.id ASC
          `
        )
        .all(documentId);
    },

    updateAddyDocumentNotes(documentId, notes) {
      db.prepare('UPDATE addy_documents SET notes = ? WHERE id = ?')
        .run(notes, documentId);
      db.prepare(`
        UPDATE share_transactions
        SET notes = ?
        WHERE id IN (
          SELECT share_transaction_id
          FROM addy_items
          WHERE addy_document_id = ?
            AND share_transaction_id IS NOT NULL
        )
      `).run(notes, documentId);
    },

    updateAddyDocumentIdAndDate(documentId, newId, newDate) {
      db.prepare('UPDATE addy_documents SET id = ?, document_date = ? WHERE id = ?')
        .run(newId, newDate, documentId);
    },

    updateAddyItemQuantity(itemId, shareTransactionId, quantity) {
      db.prepare('UPDATE addy_items SET quantity = ? WHERE id = ?')
        .run(quantity, itemId);
      if (shareTransactionId) {
        db.prepare('UPDATE share_transactions SET quantity = ? WHERE id = ?')
          .run(quantity, shareTransactionId);
      }
    },

    deleteAddyItem(itemId) {
      db.prepare('DELETE FROM addy_items WHERE id = ?').run(itemId);
    },

    deleteAddyDocument(documentId) {
      db.prepare('DELETE FROM addy_items WHERE addy_document_id = ?').run(documentId);
      db.prepare('DELETE FROM addy_documents WHERE id = ?').run(documentId);
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

