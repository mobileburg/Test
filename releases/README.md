# Android-сборки

Новая установочная сборка: **`numismat-1.0.2.apk`**

- тип: release, не debuggable
- `applicationId`: `ru.numismat.app`
- `versionName`: 1.0.2, `versionCode`: 3
- подпись: постоянный ключ `android/keystore/numismat-upload.jks` (v1+v2+v3)
- API: `https://app-66ba5c12d8dc.vibecode.bitrix24.tech`
- Android 7.0+

Если телефон пишет «не установлено», удалите старую «Нумизмат» и поставьте эту сборку заново. Старые debug-APK подписаны другим ключом, Android не даёт обновить их поверх.

Старые файлы оставлены для сравнения и больше не рекомендуются:

- `numismat-1.0-debug.apk` — debug без кабинета, SHA-256 `da517c884d73b995846ca81dab979c00fcb0f52e3886e1e5e48a1ff3ef5fe121`
- `numismat-1.0-debug-public.apk` — debug с кабинетами, SHA-256 `c6fb549e3cd18231671d3b1619569e06e8283249b16e877f7f89b82599cc2e5d`
