const migrations070 = [
  {
    version: 70,
    name: 'seed_regulation_and_book_material_categories',
    up: `
      INSERT OR IGNORE INTO material_categories (name, sort_order)
      VALUES
        ('Κανονισμοί', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM material_categories)),
        ('Βιβλία', (SELECT COALESCE(MAX(sort_order), 0) + 2 FROM material_categories));
    `
  }
];

module.exports = { migrations070 };
