function getClothingItems(db) {
  return db.prepare(`
    SELECT id, name, short_name, category, sort_order, active, created_at
    FROM clothing_items
    WHERE active = 1
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC
  `).all();
}

function addClothingItem(db, data) {
  let itemId;
  try {
    db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO clothing_items (
          name, short_name, category, sort_order, active, created_at
        ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(data.name, data.short_name, data.category, data.sort_order);
      itemId = Number(result.lastInsertRowid);
    })();
    return getClothingItem(db, itemId);
  } catch (error) {
    throw new Error(`Δεν ήταν δυνατή η προσθήκη του είδους ιματισμού: ${error.message}`);
  }
}

function updateClothingItem(db, id, data) {
  db.prepare(`
    UPDATE clothing_items
    SET name = ?,
        short_name = ?,
        category = ?,
        sort_order = ?
    WHERE id = ?
  `).run(data.name, data.short_name, data.category, data.sort_order, id);

  return getClothingItem(db, id);
}

function deleteClothingItem(db, id) {
  db.prepare('DELETE FROM clothing_items WHERE id = ?').run(id);
}

function getDistributionsByExhp(db, exhpId) {
  return db.prepare(`
    SELECT
      distribution.id,
      distribution.exhp_id,
      distribution.distribution_type,
      distribution.subunit,
      distribution.soldier_rank,
      distribution.soldier_name,
      distribution.soldier_sg_sm_sk,
      distribution.esso,
      distribution.release_date,
      distribution.signature,
      distribution.created_at,
      item.id AS distribution_item_id,
      item.clothing_item_id,
      item.quantity,
      clothing.name AS clothing_item_name,
      clothing.short_name AS clothing_item_short_name,
      clothing.category AS clothing_item_category,
      clothing.sort_order AS clothing_item_sort_order
    FROM clothing_distributions distribution
    LEFT JOIN clothing_distribution_items item
      ON item.distribution_id = distribution.id
    LEFT JOIN clothing_items clothing
      ON clothing.id = item.clothing_item_id
    WHERE distribution.exhp_id = ?
    ORDER BY
      distribution.created_at ASC,
      distribution.id ASC,
      clothing.sort_order ASC,
      clothing.name COLLATE NOCASE ASC,
      item.id ASC
  `).all(exhpId);
}

function createDistribution(db, data) {
  let savedId;
  try {
    db.transaction(() => {
      if (data.id) {
        updateDistributionHeader(db, data.id, data);
        db.prepare(
          'DELETE FROM clothing_distribution_items WHERE distribution_id = ?'
        ).run(data.id);
        savedId = data.id;
      } else {
        const result = db.prepare(`
          INSERT INTO clothing_distributions (
            exhp_id, distribution_type, subunit, soldier_rank, soldier_name,
            soldier_sg_sm_sk, esso, release_date, signature, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          data.exhp_id,
          data.distribution_type,
          data.subunit,
          data.soldier_rank,
          data.soldier_name,
          data.soldier_sg_sm_sk,
          data.esso,
          data.release_date,
          data.signature
        );
        savedId = Number(result.lastInsertRowid);
      }

      insertDistributionItems(db, savedId, data.items);
    })();
    return getDistribution(db, savedId);
  } catch (error) {
    throw new Error(`Δεν ήταν δυνατή η αποθήκευση της χορήγησης ιματισμού: ${error.message}`);
  }
}

function updateDistribution(db, id, data) {
  return createDistribution(db, { ...data, id });
}

function deleteDistribution(db, id) {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM clothing_distributions WHERE id = ?').run(id);
    })();
  } catch (error) {
    throw new Error(`Δεν ήταν δυνατή η διαγραφή της χορήγησης ιματισμού: ${error.message}`);
  }
}

function getDistributionSummary(db, month, year) {
  const monthText = String(month).padStart(2, '0');
  const periodPrefix = `${year}-${monthText}`;
  return db.prepare(`
    SELECT
      distribution.subunit,
      distribution.distribution_type,
      clothing.id AS clothing_item_id,
      clothing.name AS clothing_item_name,
      clothing.short_name AS clothing_item_short_name,
      clothing.category AS clothing_item_category,
      clothing.sort_order AS clothing_item_sort_order,
      SUM(item.quantity) AS total_quantity,
      COUNT(DISTINCT distribution.id) AS distribution_count
    FROM clothing_distributions distribution
    JOIN clothing_distribution_items item
      ON item.distribution_id = distribution.id
    JOIN clothing_items clothing
      ON clothing.id = item.clothing_item_id
    WHERE substr(distribution.created_at, 1, 7) = ?
    GROUP BY
      distribution.subunit,
      distribution.distribution_type,
      clothing.id,
      clothing.name,
      clothing.short_name,
      clothing.category,
      clothing.sort_order
    ORDER BY
      distribution.subunit COLLATE NOCASE ASC,
      clothing.sort_order ASC,
      clothing.name COLLATE NOCASE ASC,
      distribution.distribution_type ASC
  `).all(periodPrefix);
}

function createClothingRepository(db) {
  return {
    getClothingItems: () => getClothingItems(db),
    addClothingItem: (data) => addClothingItem(db, data),
    updateClothingItem: (id, data) => updateClothingItem(db, id, data),
    deleteClothingItem: (id) => deleteClothingItem(db, id),
    getClothingItem: (id) => getClothingItem(db, id),
    getExhp: (id) => getExhp(db, id),
    getDistribution: (id) => getDistribution(db, id),
    getDistributionsByExhp: (exhpId) => getDistributionsByExhp(db, exhpId),
    createDistribution: (data) => createDistribution(db, data),
    updateDistribution: (id, data) => updateDistribution(db, id, data),
    deleteDistribution: (id) => deleteDistribution(db, id),
    getDistributionSummary: (month, year) => getDistributionSummary(db, month, year)
  };
}

function getClothingItem(db, id) {
  return db.prepare(`
    SELECT id, name, short_name, category, sort_order, active, created_at
    FROM clothing_items
    WHERE id = ?
  `).get(id);
}

function getExhp(db, id) {
  return db.prepare('SELECT id FROM exhp_documents WHERE id = ?').get(id);
}

function getDistribution(db, id) {
  const header = db.prepare(`
    SELECT *
    FROM clothing_distributions
    WHERE id = ?
  `).get(id);
  if (!header) return null;

  return {
    ...header,
    items: db.prepare(`
      SELECT
        item.id,
        item.clothing_item_id,
        item.quantity,
        clothing.name AS clothing_item_name,
        clothing.short_name AS clothing_item_short_name,
        clothing.category AS clothing_item_category,
        clothing.sort_order AS clothing_item_sort_order
      FROM clothing_distribution_items item
      JOIN clothing_items clothing ON clothing.id = item.clothing_item_id
      WHERE item.distribution_id = ?
      ORDER BY clothing.sort_order ASC, clothing.name COLLATE NOCASE ASC, item.id ASC
    `).all(id)
  };
}

function updateDistributionHeader(db, id, data) {
  db.prepare(`
    UPDATE clothing_distributions
    SET exhp_id = ?,
        distribution_type = ?,
        subunit = ?,
        soldier_rank = ?,
        soldier_name = ?,
        soldier_sg_sm_sk = ?,
        esso = ?,
        release_date = ?,
        signature = ?
    WHERE id = ?
  `).run(
    data.exhp_id,
    data.distribution_type,
    data.subunit,
    data.soldier_rank,
    data.soldier_name,
    data.soldier_sg_sm_sk,
    data.esso,
    data.release_date,
    data.signature,
    id
  );
}

function insertDistributionItems(db, distributionId, items) {
  const insert = db.prepare(`
    INSERT INTO clothing_distribution_items (
      distribution_id, clothing_item_id, quantity
    ) VALUES (?, ?, ?)
  `);
  items.forEach((item) => {
    insert.run(distributionId, item.clothing_item_id, item.quantity);
  });
}

module.exports = {
  addClothingItem,
  createClothingRepository,
  createDistribution,
  deleteClothingItem,
  deleteDistribution,
  getClothingItems,
  getDistributionSummary,
  getDistributionsByExhp,
  updateClothingItem,
  updateDistribution
};
