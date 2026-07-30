const migrations031To040 = [
  {
    version: 31,
    name: 'addy_composition_snapshot',
    up: `
      ALTER TABLE addy_items
      ADD COLUMN composition_snapshot TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 32,
    name: 'restrict_exhp_composition_supports_and_add_other_document',
    up: `
      ALTER TABLE exhp_documents
      ADD COLUMN other_support_document TEXT NOT NULL DEFAULT '';

      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE template.document_code IN ('ΔΥΠ/190', 'ΔΥΠ/191')
          AND reason.name NOT LIKE 'Συλλογές Εργαλείων%'
      );

      DELETE FROM exhp_support_templates
      WHERE id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE template.document_code IN ('ΔΥΠ/190', 'ΔΥΠ/191')
          AND reason.name NOT LIKE 'Συλλογές Εργαλείων%'
      );

      UPDATE exhp_documents
      SET support_status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM exhp_document_supports support
          JOIN exhp_support_templates template ON template.id = support.template_id
          WHERE support.exhp_document_id = exhp_documents.id
            AND COALESCE(support.required_override, template.required) = 1
            AND support.completed = 0
        ) THEN 'Ελλιπής'
        ELSE 'Πλήρης για ΕΥΣ'
      END;

      UPDATE exhp_documents
      SET status = CASE
        WHEN support_status = 'Πλήρης για ΕΥΣ' THEN 'Οριστική'
        ELSE 'Προς Συμπλήρωση'
      END;
    `
  },
  {
    version: 33,
    name: 'exhp_reason_recommendations',
    up: `
      ALTER TABLE exhp_issue_reasons
      ADD COLUMN recommendation_text TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_issue_reasons
      ADD COLUMN first_opinion_text TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_issue_reasons
      ADD COLUMN second_opinion_text TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 34,
    name: 'exhp_item_share_transaction_link',
    up: `
      ALTER TABLE exhp_items
      ADD COLUMN share_transaction_id INTEGER REFERENCES share_transactions(id);

      CREATE INDEX idx_exhp_items_share_transaction
      ON exhp_items (share_transaction_id);
    `
  },
  {
    version: 35,
    name: 'inventory_counting_committee',
    up: `
      ALTER TABLE inventory_sessions
      ADD COLUMN committee_president_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_president_name TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_a_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_a_name TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_b_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_b_name TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 36,
    name: 'management_type_setting',
    up: `
      ALTER TABLE service_settings
      ADD COLUMN management_type TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 37,
    name: 'internal_item_composition_snapshot',
    up: `
      ALTER TABLE internal_items
      ADD COLUMN composition_snapshot TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 38,
    name: 'exhp_index_fields',
    up: `
      ALTER TABLE exhp_documents
      ADD COLUMN index_field_6 TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_documents
      ADD COLUMN index_field_7 TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 39,
    name: 'addy_index_fields',
    up: `
      ALTER TABLE addy_documents
      ADD COLUMN index_field_7 TEXT NOT NULL DEFAULT '';

      ALTER TABLE addy_documents
      ADD COLUMN index_field_8 TEXT NOT NULL DEFAULT '';

      ALTER TABLE addy_documents
      ADD COLUMN index_field_9 TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 40,
    name: 'general_management_handover_protocol_data',
    up: `
      ALTER TABLE general_management_handovers
      ADD COLUMN protocol_data TEXT NOT NULL DEFAULT '{}';
    `
  }
];

module.exports = { migrations031To040 };
