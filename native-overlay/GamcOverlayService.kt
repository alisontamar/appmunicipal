package bo.gob.cochabamba.guardias.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import kotlin.math.abs
import android.annotation.SuppressLint

/** Sesión que deja guardada JS (setSession) para que el widget pueda mandar el SOS sin abrir la app. */
object OverlayPrefs {
    private const val NOMBRE = "gamc_overlay"

    fun guardar(ctx: Context, token: String, baseUrl: String, turnoId: String) {
        ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE).edit()
            .putString("token", token)
            .putString("baseUrl", baseUrl)
            .putString("turnoId", turnoId)
            .apply()
    }

    fun borrar(ctx: Context) {
        ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun marcarSos(ctx: Context, ahoraMs: Long) {
        ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE).edit().putLong("ultimoSos", ahoraMs).apply()
    }

    fun ultimoSos(ctx: Context): Long =
        ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE).getLong("ultimoSos", 0L)

    fun leer(ctx: Context): Triple<String, String, String>? {
        val p = ctx.getSharedPreferences(NOMBRE, Context.MODE_PRIVATE)
        val token = p.getString("token", null) ?: return null
        val baseUrl = p.getString("baseUrl", null) ?: return null
        val turnoId = p.getString("turnoId", null) ?: return null
        return Triple(token, baseUrl, turnoId)
    }
}

/**
 * Burbuja flotante sobre otras apps. Un toque la despliega con tres acciones:
 * Registrar tarea, Cerrar servicio y SOS. Las dos primeras abren la app en esa
 * pantalla (deep link guardiasgam://widget/...). El SOS se manda directo desde
 * aquí con la sesión guardada; si no hay señal o el token venció, abre la app y
 * el SOS entra por la cola offline de siempre.
 */
class GamcOverlayService : Service() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val red = Executors.newSingleThreadExecutor()
    private var wm: WindowManager? = null
    private var raiz: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var panel: LinearLayout? = null
    private var sosBtn: TextView? = null
    private var expandido = false
    private var sosConfirmarHasta = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        crearCanal()
        val notificacion = construirNotificacion()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notificacion, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIF_ID, notificacion)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (raiz == null) mostrarWidget()
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        try {
            raiz?.let { wm?.removeView(it) }
        } catch (e: Exception) {
            // La vista ya no estaba agregada; nada que limpiar.
        }
        raiz = null
        red.shutdownNow()
        super.onDestroy()
    }

    private fun mostrarWidget() {
        val gestor = getSystemService(WINDOW_SERVICE) as WindowManager
        wm = gestor

        val burbuja = TextView(this).apply {
            text = "!"
            setTextColor(Color.WHITE)
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = fondo(Color.parseColor("#BF9466"), 1000f)
            layoutParams = LinearLayout.LayoutParams(dp(56), dp(56))
            setOnTouchListener(arrastrable())
        }

        val pnl = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            background = fondo(Color.parseColor("#1C1A19"), dp(16).toFloat())
            setPadding(dp(8), dp(8), dp(8), dp(8))
            addView(boton("Registrar tarea", "#BF9466") { cerrarPanelYAbrir("tarea") })
            addView(boton("Cerrar servicio", "#374151") { cerrarPanelYAbrir("cerrar") })
            val sos = boton("SOS", "#E53935") { tocarSos() }
            sosBtn = sos
            addView(sos)
        }
        panel = pnl

        val vista = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(burbuja)
            addView(pnl)
        }
        raiz = vista

        val parametros = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            tipoVentana(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = dp(8)
            y = dp(240)
        }
        params = parametros
        gestor.addView(vista, parametros)
    }

    /** Arrastra la burbuja; un toque sin mover la separa en desplegar/plegar el panel. */
    private fun arrastrable(): View.OnTouchListener = object : View.OnTouchListener {
        private var x0 = 0
        private var y0 = 0
        private var tx = 0f
        private var ty = 0f
        private var movido = false

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            val p = params ?: return false
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    x0 = p.x
                    y0 = p.y
                    tx = e.rawX
                    ty = e.rawY
                    movido = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - tx
                    val dy = e.rawY - ty
                    if (abs(dx) > 12 || abs(dy) > 12) movido = true
                    p.x = x0 + dx.toInt()
                    p.y = y0 + dy.toInt()
                    raiz?.let { wm?.updateViewLayout(it, p) }
                }
                MotionEvent.ACTION_UP -> {
                    if (!movido) alternarPanel()
                }
            }
            return true
        }
    }

    private fun alternarPanel() {
        expandido = !expandido
        panel?.visibility = if (expandido) View.VISIBLE else View.GONE
    }

    private fun cerrarPanelYAbrir(accion: String) {
        expandido = false
        panel?.visibility = View.GONE
        abrirApp(accion)
    }

    /** Primer toque pide confirmación; el segundo (dentro de 3 s) envía. */
    private fun tocarSos() {
        val ahora = System.currentTimeMillis()
        if (ahora > sosConfirmarHasta) {
            sosConfirmarHasta = ahora + 3000
            sosBtn?.text = "Toca otra vez"
            mainHandler.postDelayed({
                if (System.currentTimeMillis() >= sosConfirmarHasta) {
                    sosBtn?.text = "SOS"
                }
            }, 3100)
            return
        }
        sosConfirmarHasta = 0
        sosBtn?.text = "Enviando…"
        enviarSos()
    }

    private fun enviarSos() {
        val sesion = OverlayPrefs.leer(this)
        if (sesion == null) {
            fallbackApp()
            return
        }
        val (token, baseUrl, turnoId) = sesion
        red.execute {
            val ubicacion = ultimaUbicacion()
            val enviado = ubicacion != null && postSos(baseUrl, token, turnoId, ubicacion)
            if (enviado) OverlayPrefs.marcarSos(this, System.currentTimeMillis())
            mainHandler.post {
                if (enviado) {
                    sosBtn?.text = "SOS enviado"
                    mainHandler.postDelayed({
                        sosBtn?.text = "SOS"
                    }, 4000)
                } else {
                    fallbackApp()
                }
            }
        }
    }

    /** Sin sesión, sin ubicación reciente o sin señal: la app toma el SOS (y lo encola si hace falta). */
    private fun fallbackApp() {
        expandido = false
        panel?.visibility = View.GONE
        sosBtn?.text = "SOS"
        abrirApp("sos")
    }

    private fun postSos(baseUrl: String, token: String, turnoId: String, ubicacion: Location): Boolean {
        val conexion = URL("$baseUrl/telemetry").openConnection() as HttpURLConnection
        return try {
            conexion.requestMethod = "POST"
            conexion.connectTimeout = 8000
            conexion.readTimeout = 8000
            conexion.doOutput = true
            conexion.setRequestProperty("Content-Type", "application/json")
            conexion.setRequestProperty("Accept", "application/json")
            conexion.setRequestProperty("Authorization", "Bearer $token")
            val cuerpo = JSONObject()
                .put("turnoId", turnoId)
                .put("lat", ubicacion.latitude)
                .put("lng", ubicacion.longitude)
                .put("esSos", true)
                .put("sosEstado", "pendiente")
                .put("capturadoEn", isoAhora())
            conexion.outputStream.use { it.write(cuerpo.toString().toByteArray(Charsets.UTF_8)) }
            conexion.responseCode in 200..299
        } catch (e: Exception) {
            false
        } finally {
            conexion.disconnect()
        }
    }

    @SuppressLint("MissingPermission")
    private fun ultimaUbicacion(): Location? {
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val ahora = System.currentTimeMillis()
        return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { proveedor ->
                try {
                    lm.getLastKnownLocation(proveedor)
                } catch (e: SecurityException) {
                    null
                }
            }
            .filter { ahora - it.time < UBICACION_MAX_MS }
            .maxByOrNull { it.time }
    }

    private fun isoAhora(): String {
        val formato = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formato.timeZone = TimeZone.getTimeZone("UTC")
        return formato.format(Date())
    }

    private fun abrirApp(accion: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("guardiasgam://widget/$accion"))
        intent.setPackage(packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    private fun boton(texto: String, colorHex: String, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = texto
            setTextColor(Color.WHITE)
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(12), dp(12), dp(12))
            background = fondo(Color.parseColor(colorHex), dp(12).toFloat())
            layoutParams = LinearLayout.LayoutParams(dp(176), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, dp(4), 0, dp(4))
            }
            setOnClickListener { onClick() }
        }

    private fun dp(valor: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, valor.toFloat(), resources.displayMetrics).toInt()

    private fun fondo(color: Int, radioPx: Float): GradientDrawable =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = radioPx
        }

    @Suppress("DEPRECATION")
    private fun tipoVentana(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun crearCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canal = NotificationChannel(CANAL_ID, "Widget de ronda", NotificationManager.IMPORTANCE_LOW)
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(canal)
    }

    private fun construirNotificacion(): Notification =
        NotificationCompat.Builder(this, CANAL_ID)
            .setContentTitle("Widget de ronda activo")
            .setContentText("Acceso rápido a tarea, cierre y SOS sobre otras apps.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()

    companion object {
        private const val NOTIF_ID = 4107
        private const val CANAL_ID = "gamc_widget"
        /** Una ubicación más vieja que esto no se usa para el SOS (se cae al flujo de la app). */
        private const val UBICACION_MAX_MS = 120_000L
    }
}
