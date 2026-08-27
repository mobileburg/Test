import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ru.numismat.app',
  appName: 'Нумизмат',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // Debug APK ходит на HTTP API в LAN; без cleartext Android блокирует запросы.
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#f7f5ef',
  },
}

export default config
