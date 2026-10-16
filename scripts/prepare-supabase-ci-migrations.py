#!/usr/bin/env python3
"""Normalize legacy Supabase migration filenames inside ephemeral CI only.

The repository contains early migrations whose filenames predate Supabase CLI's
strict unique-version convention (for example 20261003_001_*.sql and several
20261009_*.sql files). Production history is already valid and must not be
renamed. This script runs only in the disposable GitHub Actions checkout and
maps legacy filenames to the exact remote migration versions when known.

Unknown legacy migrations fail closed instead of inventing an order.
"""

from pathlib import Path
import re

MIGRATIONS = Path("supabase/migrations")

REMOTE_VERSIONS = {
    "bc_gestao_core": "20261009123429",
    "bc_gestao_security_hardening": "20261009123831",
    "bc_gestao_policy_hardening": "20261009130130",
    "bc_gestao_phase3_agenda_atendimento": "20261009222431",
    "bc_gestao_phase3_rpc_hardening": "20261009222722",
    "bc_gestao_phase4_shared_clients_audit": "20261010033945",
    "bc_gestao_phase4_rpc_grants_fix": "20261010112042",
    "bc_gestao_phase5_financial_foundation": "20261010215148",
    "bc_gestao_phase5_receipts_rpc": "20261010215228",
    "bc_gestao_phase5_books_rpc": "20261010215325",
    "bc_gestao_phase5_payouts_rpc": "20261010215406",
    "bc_gestao_phase5_audit_hardening": "20261010215422",
    "bc_gestao_phase5_audit_hardening_followup": "20261010215558",
    "bc_gestao_phase5_receipt_book_guard": "20261011191037",
    "bc_gestao_phase6a_client_core": "20261012033813",
    "bc_gestao_phase6a_client_photo": "20261012033834",
    "bc_gestao_phase6a_photo_created_by_index": "20261012034133",
    "bc_gestao_phase6b_anamnese_core": "20261012150055",
    "bc_gestao_phase6b_alertas": "20261012150205",
    "bc_gestao_phase6b_documentos_assinaturas": "20261012150326",
    "bc_gestao_phase6b_remote_links": "20261012150423",
    "bc_gestao_phase6b_signature_read": "20261012150436",
    "bc_gestao_phase6b_signature_storage_guard": "20261012151016",
    "bc_gestao_phase6c_procedure_library": "20261012230720",
    "bc_gestao_phase6c_procedure_name_snapshot": "20261012230906",
    "bc_gestao_phase6c_procedure_performance_hardening": "20261012231406",
    "bc_gestao_phase6c_catalog_seed": "20261012232442",
    "bc_gestao_phase6c_dynamic_protocols": "20261012232627",
    "bc_gestao_phase6c_procedure_defaults": "20261012233206",
    "bc_gestao_phase6c_documents": "20261013003656",
    "bc_gestao_phase6c_consent_rpc_grants_fix": "20261013004353",
    "bc_gestao_phase6c_treatment_core": "20261013004837",
    "bc_gestao_phase6c_document_column_compat": "20261013012904",
    "bc_gestao_phase6c_procedure_list_execution": "20261013013637",
    "bc_gestao_phase6c_treatment_get_consent": "20261013013744",
    "bc_gestao_phase6c_appointment_clinical_context": "20261013014456",
    "bc_gestao_phase6c_treatment_performance": "20261013015657",
    "bc_gestao_allow_pdf_in_private_storage": "20261013115815",
    "bc_gestao_phase6d_photos": "20261013183842",
    "bc_gestao_phase6d_products": "20261013183934",
    "bc_gestao_phase6d_equipment": "20261013184019",
    "bc_gestao_phase6d_intercurrences": "20261013184103",
    "bc_gestao_phase6d_treatment_integration": "20261013184142",
    "bc_gestao_phase6d_security_hardening": "20261013184155",
    "bc_gestao_consent_v2_botox": "20261013193427",
    "bc_gestao_consent_v2_filler": "20261013195810",
    "bc_gestao_bioestimulador_consent": "20261014134602",
    "bc_gestao_client_files": "20261014134643",
    "bc_gestao_client_document_feed": "20261014134705",
    "bc_gestao_quick_visit": "20261014134932",
    "bc_gestao_quick_visit_request_key": "20261014134950",
    "bc_gestao_quick_visit_options": "20261014135011",
    "bc_gestao_treatment_reports": "20261014135117",
    "bc_gestao_external_consents": "20261014135211",
    "bc_gestao_client_central_hardening": "20261014135242",
    "bc_gestao_storage_photo_policy_hotfix": "20261014172456",
    "bc_gestao_anamnese_remote_schema_hotfix": "20261014173632",
}


def target_version(prefix: str, logical_name: str) -> str:
    if len(prefix) == 14:
        return prefix

    numbered = re.fullmatch(r"(\d{3})_(.+)", logical_name)
    if numbered:
        # Legacy pre-BC migrations already encode their order as 001, 002, ...
        return f"{prefix}{int(numbered.group(1)) * 100:06d}"

    mapped = REMOTE_VERSIONS.get(logical_name)
    if mapped:
        return mapped

    raise SystemExit(
        f"Legacy migration {prefix}_{logical_name}.sql has no verified CI order mapping. "
        "Add its real remote version before replaying migrations."
    )


def main() -> None:
    files = sorted(MIGRATIONS.glob("*.sql"))
    targets: list[tuple[Path, Path, str]] = []
    seen_versions: dict[str, Path] = {}

    for path in files:
        match = re.fullmatch(r"(\d{8,14})_(.+)\.sql", path.name)
        if not match:
            raise SystemExit(f"Unexpected migration filename: {path.name}")

        prefix, logical_name = match.groups()
        version = target_version(prefix, logical_name)
        previous = seen_versions.get(version)
        if previous:
            raise SystemExit(
                f"Duplicate normalized migration version {version}: {previous.name} and {path.name}"
            )
        seen_versions[version] = path
        targets.append((path, path.with_name(f"{version}_{logical_name}.sql"), version))

    # Two-phase rename avoids collisions with existing target names.
    staged: list[tuple[Path, Path]] = []
    for index, (source, target, _version) in enumerate(targets):
        if source == target:
            continue
        temp = source.with_name(f".ci-migration-{index:04d}.sql")
        source.rename(temp)
        staged.append((temp, target))

    for temp, target in staged:
        temp.rename(target)

    ordered = sorted(MIGRATIONS.glob("*.sql"))
    versions = [path.name.split("_", 1)[0] for path in ordered]
    if len(versions) != len(set(versions)):
        raise SystemExit("Normalized migration versions are not unique")
    if any(len(version) != 14 for version in versions):
        raise SystemExit("Every CI migration version must be a 14-digit timestamp")

    print(f"Prepared {len(ordered)} migrations for ephemeral Supabase replay.")
    print(f"First: {ordered[0].name}")
    print(f"Last:  {ordered[-1].name}")


if __name__ == "__main__":
    main()
