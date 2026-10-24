-- Public invoker wrappers must reach only these existing guarded entrypoints.
-- Their active-staff, management and clinical-author checks remain authoritative.
-- Internal validators, raw tables, anonymous callers and creation-role projections are unchanged.
revoke all on function
 private.bc_clinical_product_list_impl(boolean),
 private.bc_clinical_product_upsert_impl(uuid,jsonb),
 private.bc_clinical_product_lot_list_impl(uuid,boolean),
 private.bc_clinical_product_lot_upsert_impl(uuid,jsonb),
 private.bc_treatment_product_usage_list_impl(uuid),
 private.bc_treatment_product_usage_add_impl(uuid,uuid,uuid,numeric,text),
 private.bc_treatment_product_usage_remove_impl(uuid),
 private.bc_clinical_equipment_list_impl(boolean),
 private.bc_clinical_equipment_upsert_impl(uuid,jsonb),
 private.bc_treatment_equipment_usage_list_impl(uuid),
 private.bc_treatment_equipment_usage_add_impl(uuid,uuid,jsonb),
 private.bc_treatment_equipment_usage_remove_impl(uuid),
 private.bc_treatment_photo_list_impl(uuid),
 private.bc_treatment_photo_register_impl(uuid,text,text,bigint,text,text,text,text,timestamptz),
 private.bc_treatment_photo_void_impl(uuid,text),
 private.bc_treatment_intercurrence_list_impl(uuid),
 private.bc_treatment_intercurrence_create_impl(uuid,text,text,text,text,timestamptz),
 private.bc_treatment_intercurrence_update_draft_impl(uuid,jsonb),
 private.bc_intercurrence_add_update_impl(uuid,text,text),
 private.bc_treatment_confirm_open_intercurrences_impl(uuid)
from public, anon;
grant execute on function
 private.bc_clinical_product_list_impl(boolean),
 private.bc_clinical_product_upsert_impl(uuid,jsonb),
 private.bc_clinical_product_lot_list_impl(uuid,boolean),
 private.bc_clinical_product_lot_upsert_impl(uuid,jsonb),
 private.bc_treatment_product_usage_list_impl(uuid),
 private.bc_treatment_product_usage_add_impl(uuid,uuid,uuid,numeric,text),
 private.bc_treatment_product_usage_remove_impl(uuid),
 private.bc_clinical_equipment_list_impl(boolean),
 private.bc_clinical_equipment_upsert_impl(uuid,jsonb),
 private.bc_treatment_equipment_usage_list_impl(uuid),
 private.bc_treatment_equipment_usage_add_impl(uuid,uuid,jsonb),
 private.bc_treatment_equipment_usage_remove_impl(uuid),
 private.bc_treatment_photo_list_impl(uuid),
 private.bc_treatment_photo_register_impl(uuid,text,text,bigint,text,text,text,text,timestamptz),
 private.bc_treatment_photo_void_impl(uuid,text),
 private.bc_treatment_intercurrence_list_impl(uuid),
 private.bc_treatment_intercurrence_create_impl(uuid,text,text,text,text,timestamptz),
 private.bc_treatment_intercurrence_update_draft_impl(uuid,jsonb),
 private.bc_intercurrence_add_update_impl(uuid,text,text),
 private.bc_treatment_confirm_open_intercurrences_impl(uuid)
to authenticated;
