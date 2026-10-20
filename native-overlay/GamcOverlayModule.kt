package bo.gob.cochabamba.guardias.overlay

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Puente JS -> nativo del widget. Expuesto como NativeModules.GamcOverlay. */
class GamcOverlayModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "GamcOverlay"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(ctx))
    }

    @ReactMethod
    fun openOverlaySettings() {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
    }

    /** Guarda la sesión para que el widget pueda mandar el SOS aunque la app esté cerrada. */
    @ReactMethod
    fun setSession(token: String, baseUrl: String, turnoId: String) {
        OverlayPrefs.guardar(ctx, token, baseUrl, turnoId)
    }

    @ReactMethod
    fun clearSession() {
        OverlayPrefs.borrar(ctx)
    }

    @ReactMethod
    fun start(promise: Promise) {
        if (!Settings.canDrawOverlays(ctx)) {
            promise.resolve(false)
            return
        }
        ctx.startForegroundService(Intent(ctx, GamcOverlayService::class.java))
        promise.resolve(true)
    }

    @ReactMethod
    fun stop() {
        ctx.stopService(Intent(ctx, GamcOverlayService::class.java))
    }

    /** Hora (ms) del último SOS enviado desde el widget; 0 si no hubo. */
    @ReactMethod
    fun ultimoSosWidget(promise: Promise) {
        promise.resolve(OverlayPrefs.ultimoSos(ctx).toDouble())
    }
}
