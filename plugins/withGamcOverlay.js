/**
 * Config plugin del widget de ronda (overlay Android).
 *
 * Al hacer `expo prebuild` / build de EAS:
 *  1. Agrega los permisos de superposición y el servicio en AndroidManifest.xml.
 *  2. Copia los archivos Kotlin de `native-overlay/` al paquete de la app.
 *  3. Registra GamcOverlayPackage en MainApplication.kt.
 */
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PAQUETE = 'bo.gob.cochabamba.guardias';
const CARPETA_OVERLAY = path.join(...PAQUETE.split('.'), 'overlay');
const ARCHIVOS_KT = ['GamcOverlayPackage.kt', 'GamcOverlayModule.kt', 'GamcOverlayService.kt'];
const PERMISOS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
];
const SERVICIO = '.overlay.GamcOverlayService';

function conPermisosYServicio(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const nombre of PERMISOS) {
      if (!manifest['uses-permission'].some((u) => u.$['android:name'] === nombre)) {
        manifest['uses-permission'].push({ $: { 'android:name': nombre } });
      }
    }
    const app = manifest.application[0];
    app.service = app.service || [];
    if (!app.service.some((s) => s.$['android:name'] === SERVICIO)) {
      app.service.push({
        $: {
          'android:name': SERVICIO,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'location',
        },
      });
    }
    return c;
  });
}

function conArchivosKotlin(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const destino = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', CARPETA_OVERLAY);
      fs.mkdirSync(destino, { recursive: true });
      for (const archivo of ARCHIVOS_KT) {
        const origen = path.join(c.modRequest.projectRoot, 'native-overlay', archivo);
        fs.copyFileSync(origen, path.join(destino, archivo));
      }
      return c;
    },
  ]);
}

function conPaqueteRegistrado(config) {
  return withMainApplication(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes('GamcOverlayPackage')) {
      src = src.replace(/^(package .*)$/m, `$1\n\nimport ${PAQUETE}.overlay.GamcOverlayPackage`);
      src = src.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        (m) => `${m}\n              add(GamcOverlayPackage())`,
      );
    }
    c.modResults.contents = src;
    return c;
  });
}

module.exports = (config) => conPaqueteRegistrado(conArchivosKotlin(conPermisosYServicio(config)));
