const { parseStoredJson } = require('../utils/safeJson');

const DOCUMENT_TYPES = ['useless_material_a', 'useless_material_b', 'ammo_consumption', 'transformation_materials', 'clothing_monthly_summary'];

const ALLOWED_TABLE_NAMES = new Set([
  'exhp_document_useless_a',
  'exhp_document_useless_b',
  'exhp_document_ammo'
]);

function assertAllowedTableName(tableName) {
  if (!ALLOWED_TABLE_NAMES.has(tableName)) {
    throw new Error(`Unsupported EXHP document table: ${tableName}`);
  }
}

function getDocumentsByExhpId(db, exhpId) {
  return db.prepare(`
    SELECT id, exhp_id, document_type, created_at, updated_at
    FROM exhp_support_documents
    WHERE exhp_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(exhpId);
}

function createDocument(db, exhpId, documentType) {
  db.prepare(`
    INSERT INTO exhp_support_documents (exhp_id, document_type, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(exhpId, documentType);
  return db.prepare(`
    SELECT id, exhp_id, document_type, created_at, updated_at
    FROM exhp_support_documents
    WHERE exhp_id = ?
      AND document_type = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(exhpId, documentType);
}

function deleteDocument(db, documentId) {
  return db.prepare('DELETE FROM exhp_support_documents WHERE id = ?').run(documentId);
}

function saveUselessA(db, documentId, data) {
  let headerId;
  db.transaction(() => {
    headerId = upsertUselessAHeader(db, documentId, data);
    db.prepare('DELETE FROM exhp_document_useless_a_items WHERE document_id = ?').run(headerId);

    const insert = db.prepare(`
      INSERT INTO exhp_document_useless_a_items (
        document_id, aa, share_number, nomenclature_number, description, unit,
        quantity, acquisition_price, acquisition_date, remarks
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    (data.items || []).forEach((item) => {
      insert.run(
        headerId,
        item.aa,
        item.shareNumber,
        item.nomenclatureNumber,
        item.description,
        item.unit,
        item.quantity,
        item.acquisitionPrice,
        item.acquisitionDate,
        item.remarks
      );
    });

    touchDocument(db, documentId);
  })();

  return getUselessA(db, documentId);
}

function getUselessA(db, documentId) {
  const header = db.prepare(`
    SELECT *
    FROM exhp_document_useless_a
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (!header) {
    return null;
  }

  return {
    ...header,
    items: db.prepare(`
      SELECT *
      FROM exhp_document_useless_a_items
      WHERE document_id = ?
      ORDER BY aa ASC, id ASC
    `).all(header.id)
  };
}

function saveUselessB(db, documentId, data) {
  let headerId;
  db.transaction(() => {
    headerId = upsertUselessBHeader(db, documentId, data);
    db.prepare('DELETE FROM exhp_document_useless_b_items WHERE document_id = ?').run(headerId);

    const insert = db.prepare(`
      INSERT INTO exhp_document_useless_b_items (
        document_id, aa, share_number, nomenclature_number, description, unit,
        qty_primary, qty_secondary, diff_plus, diff_minus
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    (data.items || []).forEach((item) => {
      insert.run(
        headerId,
        item.aa,
        item.shareNumber,
        item.nomenclatureNumber,
        item.description,
        item.unit,
        item.qtyPrimary,
        item.qtySecondary,
        item.diffPlus,
        item.diffMinus
      );
    });

    touchDocument(db, documentId);
  })();

  return getUselessB(db, documentId);
}

function getUselessB(db, documentId) {
  const header = db.prepare(`
    SELECT *
    FROM exhp_document_useless_b
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (!header) {
    return null;
  }

  return {
    ...header,
    items: db.prepare(`
      SELECT *
      FROM exhp_document_useless_b_items
      WHERE document_id = ?
      ORDER BY aa ASC, id ASC
    `).all(header.id)
  };
}

function saveAmmo(db, documentId, data) {
  let headerId;
  db.transaction(() => {
    headerId = upsertAmmoHeader(db, documentId, data);
    db.prepare('DELETE FROM exhp_document_ammo_items WHERE document_id = ?').run(headerId);

    const insert = db.prepare(`
      INSERT INTO exhp_document_ammo_items (
        document_id, item_type, share_number, nomenclature_number, description, unit, quantity
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    (data.items || []).forEach((item) => {
      insert.run(
        headerId,
        item.itemType,
        item.shareNumber,
        item.nomenclatureNumber,
        item.description,
        item.unit,
        item.quantity
      );
    });

    touchDocument(db, documentId);
  })();

  return getAmmo(db, documentId);
}

function getAmmo(db, documentId) {
  const header = db.prepare(`
    SELECT *
    FROM exhp_document_ammo
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (!header) {
    return null;
  }

  return {
    ...header,
    items: db.prepare(`
      SELECT *
      FROM exhp_document_ammo_items
      WHERE document_id = ?
      ORDER BY id ASC
    `).all(header.id)
  };
}

function saveGeneric(db, documentId, data) {
  db.prepare(`
    INSERT INTO exhp_document_generic_forms (document_id, data_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(documentId, JSON.stringify(data || {}));
  touchDocument(db, documentId);
  return getGeneric(db, documentId);
}

function getGeneric(db, documentId) {
  const row = db.prepare(`
    SELECT document_id, data_json, updated_at
    FROM exhp_document_generic_forms
    WHERE document_id = ?
  `).get(documentId);
  if (!row) return null;
  const data = parseStoredJson(row.data_json, {}, 'EXHP document data');
  return {
    documentId: row.document_id,
    data,
    updatedAt: row.updated_at
  };
}

function createExhpDocumentsRepository(db) {
  return {
    getDocumentsByExhpId: (exhpId) => getDocumentsByExhpId(db, exhpId),
    createDocument: (exhpId, documentType) => createDocument(db, exhpId, documentType),
    deleteDocument: (documentId) => deleteDocument(db, documentId),
    saveUselessA: (documentId, data) => saveUselessA(db, documentId, data),
    getUselessA: (documentId) => getUselessA(db, documentId),
    saveUselessB: (documentId, data) => saveUselessB(db, documentId, data),
    getUselessB: (documentId) => getUselessB(db, documentId),
    saveAmmo: (documentId, data) => saveAmmo(db, documentId, data),
    getAmmo: (documentId) => getAmmo(db, documentId),
    saveGeneric: (documentId, data) => saveGeneric(db, documentId, data),
    getGeneric: (documentId) => getGeneric(db, documentId),
    getUselessStatements: (exhpId) => getUselessStatements(db, exhpId),
    saveUselessStatement: (exhpId, formKey, data) => saveUselessStatement(db, exhpId, formKey, data),
    getDocument: (documentId) => getDocument(db, documentId),
    getExhp: (exhpId) => getExhp(db, exhpId)
  };
}

function getUselessStatements(db, exhpId) {
  return db.prepare(`
    SELECT form_key, data_json
    FROM exhp_useless_statement_forms
    WHERE exhp_id = ?
    ORDER BY form_key
  `).all(exhpId);
}

function saveUselessStatement(db, exhpId, formKey, data) {
  db.prepare(`
    INSERT INTO exhp_useless_statement_forms (exhp_id, form_key, data_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(exhp_id, form_key) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(exhpId, formKey, JSON.stringify(data || {}));
  return db.prepare(`
    SELECT form_key, data_json
    FROM exhp_useless_statement_forms
    WHERE exhp_id = ? AND form_key = ?
  `).get(exhpId, formKey);
}

function getDocument(db, documentId) {
  return db.prepare(`
    SELECT id, exhp_id, document_type, created_at, updated_at
    FROM exhp_support_documents
    WHERE id = ?
  `).get(documentId);
}

function getExhp(db, exhpId) {
  return db.prepare('SELECT id FROM exhp_documents WHERE id = ?').get(exhpId);
}

function upsertUselessAHeader(db, documentId, data) {
  const existing = db.prepare(`
    SELECT id
    FROM exhp_document_useless_a
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (existing) {
    db.prepare(`
      UPDATE exhp_document_useless_a
      SET location = ?,
          date = ?,
          hdm_number = ?,
          president = ?,
          member_a = ?,
          member_b = ?,
          period_from = ?,
          period_to = ?
      WHERE id = ?
    `).run(
      data.location,
      data.date,
      data.hdmNumber,
      data.president,
      data.memberA,
      data.memberB,
      data.periodFrom,
      data.periodTo,
      existing.id
    );
    return existing.id;
  }

  db.prepare(`
    INSERT INTO exhp_document_useless_a (
      document_id, location, date, hdm_number, president,
      member_a, member_b, period_from, period_to
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    data.location,
    data.date,
    data.hdmNumber,
    data.president,
    data.memberA,
    data.memberB,
    data.periodFrom,
    data.periodTo
  );
  return getHeaderId(db, 'exhp_document_useless_a', documentId);
}

function upsertUselessBHeader(db, documentId, data) {
  const existing = db.prepare(`
    SELECT id
    FROM exhp_document_useless_b
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (existing) {
    db.prepare(`
      UPDATE exhp_document_useless_b
      SET president = ?,
          member_a = ?,
          member_b = ?,
          commander = ?,
          general_manager = ?,
          useless_manager = ?
      WHERE id = ?
    `).run(
      data.president,
      data.memberA,
      data.memberB,
      data.commander,
      data.generalManager,
      data.uselessManager,
      existing.id
    );
    return existing.id;
  }

  db.prepare(`
    INSERT INTO exhp_document_useless_b (
      document_id, president, member_a, member_b,
      commander, general_manager, useless_manager
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    data.president,
    data.memberA,
    data.memberB,
    data.commander,
    data.generalManager,
    data.uselessManager
  );
  return getHeaderId(db, 'exhp_document_useless_b', documentId);
}

function upsertAmmoHeader(db, documentId, data) {
  const existing = db.prepare(`
    SELECT id
    FROM exhp_document_ammo
    WHERE document_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(documentId);

  if (existing) {
    db.prepare(`
      UPDATE exhp_document_ammo
      SET officer_rank = ?,
          officer_name = ?,
          unit = ?,
          firing_date = ?,
          day_of_week = ?,
          copies_count = ?
      WHERE id = ?
    `).run(
      data.officerRank,
      data.officerName,
      data.unit,
      data.firingDate,
      data.dayOfWeek,
      data.copiesCount,
      existing.id
    );
    return existing.id;
  }

  db.prepare(`
    INSERT INTO exhp_document_ammo (
      document_id, officer_rank, officer_name, unit,
      firing_date, day_of_week, copies_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    documentId,
    data.officerRank,
    data.officerName,
    data.unit,
    data.firingDate,
    data.dayOfWeek,
    data.copiesCount
  );
  return getHeaderId(db, 'exhp_document_ammo', documentId);
}

function touchDocument(db, documentId) {
  db.prepare(`
    UPDATE exhp_support_documents
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(documentId);
}

function getHeaderId(db, tableName, documentId) {
  assertAllowedTableName(tableName);
  const row = db.prepare(`
    SELECT id
    FROM ${tableName}
    WHERE document_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(documentId);
  return row ? row.id : null;
}

module.exports = {
  DOCUMENT_TYPES,
  createExhpDocumentsRepository,
  getDocumentsByExhpId,
  createDocument,
  deleteDocument,
  saveUselessA,
  getUselessA,
  saveUselessB,
  getUselessB,
  saveAmmo,
  getAmmo,
  saveGeneric,
  getGeneric
};
