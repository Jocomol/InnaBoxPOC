# Event in a Box — localization/spacing polish

Replace only the files contained in this bundle.

Changes:
- Visible product name is now **Event in a Box** (internal technical names such as `TableplanI18n` and existing translation environment variables are intentionally unchanged to avoid unnecessary breakage).
- Generated empty-stock state now re-localizes correctly on EN/DE/FR/IT language changes.
- Improved stock-empty wording in DE/FR/IT.
- Dietary guest-count numbers are centered with extra right padding so they do not sit against native number-input spinner arrows.
- `Bircher Müesli` is curated as `Muesli Bircher aux pommes` (FR) and `Muesli Bircher alla mela` (IT); German keeps the conventional Swiss name.
- Browser dynamic-translation cache namespace bumped so the previous Bircher result is not reused.

No MongoDB changes and no reseed are required.

Rebuild with the localization overlay:

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.localization.yml down
sudo docker compose -f docker-compose.yml -f docker-compose.localization.yml build --no-cache
sudo docker compose -f docker-compose.yml -f docker-compose.localization.yml up -d
```

Then hard-refresh the browser (`Ctrl+Shift+R`).
