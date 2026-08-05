const migrations065 = [
  {
    version: 65,
    name: 'weapon_registry_nine_fields',
    up: `
      ALTER TABLE share_weapon_registry_entries
      ADD COLUMN details TEXT NOT NULL DEFAULT '';

      ALTER TABLE share_weapon_registry_entries
      ADD COLUMN delivered_outside_unit TEXT NOT NULL DEFAULT '';
    `
  }
];

module.exports = { migrations065 };
