function listActiveShares(db) {
  return db
    .prepare(
      `
        SELECT
          id,
          share_number,
          nominal_number,
          description,
          material_type,
          measurement_unit,
          material_code,
          projected_quantity,
          accounting_balance,
          charged_quantity,
          archive_reason,
          requires_composition,
          requires_change_sheet
        FROM shares
        WHERE archive_status = 'Ενεργή'
        ORDER BY
          CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
          CAST(share_number AS INTEGER) ASC,
          share_number COLLATE NOCASE ASC,
          id ASC
      `
    )
    .all();
}

module.exports = {
  listActiveShares
};
