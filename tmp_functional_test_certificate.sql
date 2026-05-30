insert into certificate_categories (id, key, name, "nameEn", description, "descriptionEn", "order", "isActive", "createdAt", "updatedAt")
values ('11111111-1111-4111-8111-111111111111', 'codex-test-category', 'Codex Test Certificate', 'Codex Test Certificate', 'Local functional test category', 'Local functional test category', 999, true, now(), now())
on conflict (key) do update set "updatedAt" = now();

insert into certificate_templates (id, "categoryId", name, "nameEn", "templateType", "templateConfigJson", "renderConfigJson", "isActive", version, "createdAt", "updatedAt")
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Codex Test Template', 'Codex Test Template', 'CUSTOM', '{}'::jsonb, '{}'::jsonb, true, 1, now(), now())
on conflict (id) do update set "isActive" = true, "updatedAt" = now();

insert into certificate_definitions (id, "categoryId", "templateId", name, "nameEn", "issueRule", "approvalMode", "verificationMode", "isActive", "createdAt", "updatedAt")
values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Codex Test Definition', 'Codex Test Definition', '{}'::jsonb, 'manual', 'PUBLIC_CODE', true, now(), now())
on conflict (id) do update set "isActive" = true, "updatedAt" = now();
