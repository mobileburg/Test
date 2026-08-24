package ru.korona.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.graphics.createBitmap
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.IOException
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                KoronaApp()
            }
        }
    }
}

@Composable
private fun KoronaApp() {
    val context = LocalContext.current
    var cameraGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { cameraGranted = it }

    LaunchedEffect(Unit) {
        if (!cameraGranted) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = ComposeColor(0xFF120B1F),
    ) {
        if (cameraGranted) {
            CameraContent()
        } else {
            PermissionContent { permissionLauncher.launch(Manifest.permission.CAMERA) }
        }
    }
}

@Composable
private fun PermissionContent(onRequestPermission: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("♛", color = ComposeColor(0xFFFFD54F), fontSize = 72.sp)
        Spacer(Modifier.height(20.dp))
        Text(
            "Камера нужна, чтобы примерить корону",
            color = ComposeColor.White,
            fontSize = 22.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "Фото обрабатывается только на вашем устройстве.",
            color = ComposeColor(0xFFCEC4DB),
            fontSize = 15.sp,
        )
        Spacer(Modifier.height(28.dp))
        Button(onClick = onRequestPermission) {
            Text("Разрешить камеру")
        }
    }
}

@Composable
private fun CameraContent() {
    val context = LocalContext.current
    val lifecycleOwner = context as LifecycleOwner
    val scope = rememberCoroutineScope()
    var cameraView by remember { mutableStateOf<CameraHostView?>(null) }
    var faceFound by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("Наведите камеру на человека") }
    var isSaving by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                CameraHostView(
                    context = it,
                    lifecycleOwner = lifecycleOwner,
                    onFaceChanged = { found -> faceFound = found },
                ).also { view -> cameraView = view }
            },
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(ComposeColor(0xCC120B1F), ComposeColor.Transparent),
                    ),
                )
                .padding(horizontal = 20.dp, vertical = 18.dp),
        ) {
            Column {
                Text("КОРОНА", color = ComposeColor(0xFFFFD54F), fontSize = 22.sp)
                Text(
                    if (faceFound) "Образ готов — можно сохранить" else message,
                    color = ComposeColor.White,
                    fontSize = 14.sp,
                )
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(ComposeColor.Transparent, ComposeColor(0xE6120B1F)),
                    ),
                )
                .padding(start = 28.dp, end = 28.dp, top = 48.dp, bottom = 28.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                onClick = { cameraView?.switchCamera() },
                modifier = Modifier.size(54.dp),
                shape = CircleShape,
                contentPadding = ButtonDefaults.ContentPadding,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ComposeColor(0xAAFFFFFF),
                    contentColor = ComposeColor(0xFF241433),
                ),
            ) {
                Text("↻", fontSize = 24.sp)
            }

            Button(
                onClick = {
                    val snapshot = cameraView?.captureSnapshot()
                    if (snapshot == null) {
                        message = "Камера ещё готовится"
                        return@Button
                    }
                    isSaving = true
                    scope.launch {
                        runCatching {
                            withContext(Dispatchers.IO) { saveToGallery(context, snapshot) }
                        }.onSuccess {
                            message = "Фото сохранено в галерею"
                        }.onFailure {
                            message = "Не удалось сохранить фото"
                        }
                        isSaving = false
                    }
                },
                enabled = faceFound && !isSaving,
                modifier = Modifier.size(82.dp),
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = ComposeColor(0xFFFFD54F),
                    contentColor = ComposeColor(0xFF241433),
                    disabledContainerColor = ComposeColor(0x66FFFFFF),
                ),
            ) {
                Text(if (isSaving) "…" else "♛", fontSize = 32.sp)
            }

            Box(Modifier.size(54.dp), contentAlignment = Alignment.Center) {
                Text(
                    if (faceFound) "ГОТОВО" else "ЛИЦО",
                    color = if (faceFound) ComposeColor(0xFFFFD54F) else ComposeColor.White,
                    fontSize = 10.sp,
                )
            }
        }
    }
}

private fun saveToGallery(context: Context, bitmap: Bitmap) {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "korona_${System.currentTimeMillis()}.jpg")
        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
        put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/Корона")
        put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Не удалось создать файл")
    try {
        resolver.openOutputStream(uri)?.use { stream ->
            check(bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream))
        } ?: throw IOException("Не удалось открыть файл")
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
    } catch (error: Exception) {
        resolver.delete(uri, null, null)
        throw error
    } finally {
        bitmap.recycle()
    }
}

@SuppressLint("ViewConstructor")
private class CameraHostView(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    private val onFaceChanged: (Boolean) -> Unit,
) : FrameLayout(context) {
    private val previewView = PreviewView(context).apply {
        layoutParams = LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        scaleType = PreviewView.ScaleType.FILL_CENTER
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    }
    private val overlay = RoyalOverlayView(context)
    private val executor = Executors.newSingleThreadExecutor()
    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setMinFaceSize(0.12f)
            .enableTracking()
            .build(),
    )
    private val controller = LifecycleCameraController(context)
    private var frontCamera = false
    private var lastFaceState = false

    init {
        addView(previewView)
        addView(
            overlay,
            LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        controller.setEnabledUseCases(CameraController.IMAGE_ANALYSIS)
        controller.imageAnalysisBackpressureStrategy = ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST
        controller.setImageAnalysisAnalyzer(executor, ::analyze)
        controller.cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        previewView.controller = controller
        controller.bindToLifecycle(lifecycleOwner)
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }
        val rotation = imageProxy.imageInfo.rotationDegrees
        val inputImage = InputImage.fromMediaImage(mediaImage, rotation)
        detector.process(inputImage)
            .addOnSuccessListener { faces ->
                val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                val rotated = rotation == 90 || rotation == 270
                val sourceWidth = if (rotated) imageProxy.height else imageProxy.width
                val sourceHeight = if (rotated) imageProxy.width else imageProxy.height
                post {
                    overlay.updateFace(face, sourceWidth, sourceHeight, frontCamera)
                    val found = face != null
                    if (found != lastFaceState) {
                        lastFaceState = found
                        onFaceChanged(found)
                    }
                }
            }
            .addOnFailureListener {
                post { overlay.updateFace(null, 1, 1, frontCamera) }
            }
            .addOnCompleteListener { imageProxy.close() }
    }

    fun switchCamera() {
        val requestedFrontCamera = !frontCamera
        val selector = if (requestedFrontCamera) {
            CameraSelector.DEFAULT_FRONT_CAMERA
        } else {
            CameraSelector.DEFAULT_BACK_CAMERA
        }
        runCatching { controller.cameraSelector = selector }
            .onSuccess { frontCamera = requestedFrontCamera }
    }

    fun captureSnapshot(): Bitmap? {
        if (width == 0 || height == 0) return null
        val preview = previewView.bitmap ?: return null
        return createBitmap(width, height).also { output ->
            val canvas = Canvas(output)
            canvas.drawBitmap(preview, null, Rect(0, 0, width, height), null)
            overlay.render(canvas)
        }
    }

    override fun onDetachedFromWindow() {
        controller.clearImageAnalysisAnalyzer()
        detector.close()
        executor.shutdown()
        super.onDetachedFromWindow()
    }
}

private class RoyalOverlayView(context: Context) : android.view.View(context) {
    private val gold = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 200, 45) }
    private val darkGold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(177, 116, 15)
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }
    private val ruby = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(174, 24, 65) }
    private val mantle = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(91, 27, 126) }
    private val fur = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(250, 245, 230) }
    private val spot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(35, 24, 35) }
    private var faceFrame: FaceFrame? = null
    private var smoothRect: RectF? = null

    fun updateFace(face: Face?, sourceWidth: Int, sourceHeight: Int, mirrored: Boolean) {
        faceFrame = face?.let {
            FaceFrame(RectF(it.boundingBox), sourceWidth.toFloat(), sourceHeight.toFloat(), mirrored)
        }
        if (face == null) smoothRect = null
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        render(canvas)
    }

    fun render(canvas: Canvas) {
        val frame = faceFrame ?: return
        val scale = maxOf(width / frame.sourceWidth, height / frame.sourceHeight)
        val offsetX = (width - frame.sourceWidth * scale) / 2f
        val offsetY = (height - frame.sourceHeight * scale) / 2f
        val raw = if (frame.mirrored) {
            RectF(
                width - (frame.rect.right * scale + offsetX),
                frame.rect.top * scale + offsetY,
                width - (frame.rect.left * scale + offsetX),
                frame.rect.bottom * scale + offsetY,
            )
        } else {
            RectF(
                frame.rect.left * scale + offsetX,
                frame.rect.top * scale + offsetY,
                frame.rect.right * scale + offsetX,
                frame.rect.bottom * scale + offsetY,
            )
        }
        val previous = smoothRect
        val face = if (previous == null) {
            raw
        } else {
            RectF(
                previous.left * 0.65f + raw.left * 0.35f,
                previous.top * 0.65f + raw.top * 0.35f,
                previous.right * 0.65f + raw.right * 0.35f,
                previous.bottom * 0.65f + raw.bottom * 0.35f,
            )
        }
        smoothRect = face
        drawMantle(canvas, face)
        drawCrown(canvas, face)
    }

    private fun drawCrown(canvas: Canvas, face: RectF) {
        val w = face.width()
        val left = face.centerX() - w * 0.68f
        val right = face.centerX() + w * 0.68f
        val baseY = face.top + w * 0.02f
        val topY = face.top - w * 0.72f
        val crown = Path().apply {
            moveTo(left, baseY)
            lineTo(left + w * 0.08f, topY + w * 0.18f)
            lineTo(left + w * 0.33f, topY + w * 0.42f)
            lineTo(face.centerX(), topY)
            lineTo(right - w * 0.33f, topY + w * 0.42f)
            lineTo(right - w * 0.08f, topY + w * 0.18f)
            lineTo(right, baseY)
            close()
        }
        canvas.drawPath(crown, gold)
        canvas.drawPath(crown, darkGold)
        canvas.drawRoundRect(
            RectF(left, baseY - w * 0.13f, right, baseY + w * 0.05f),
            w * 0.05f,
            w * 0.05f,
            darkGold.apply { style = Paint.Style.FILL },
        )
        val gemRadius = w * 0.055f
        listOf(-0.38f, 0f, 0.38f).forEach { position ->
            canvas.drawCircle(face.centerX() + w * position, baseY - w * 0.04f, gemRadius, ruby)
        }
        darkGold.style = Paint.Style.STROKE
    }

    private fun drawMantle(canvas: Canvas, face: RectF) {
        val w = face.width()
        val shoulderY = face.bottom + w * 0.15f
        val left = face.centerX() - w * 1.5f
        val right = face.centerX() + w * 1.5f
        val bottom = height.toFloat() + w * 0.2f
        val robe = Path().apply {
            moveTo(face.centerX() - w * 0.38f, shoulderY)
            cubicTo(left + w * 0.3f, shoulderY, left, bottom - w, left, bottom)
            lineTo(right, bottom)
            cubicTo(right, bottom - w, right - w * 0.3f, shoulderY, face.centerX() + w * 0.38f, shoulderY)
            close()
        }
        canvas.drawPath(robe, mantle)

        val collar = Path().apply {
            moveTo(face.centerX() - w * 0.95f, shoulderY)
            quadTo(face.centerX() - w * 0.35f, shoulderY - w * 0.2f, face.centerX(), shoulderY + w * 0.28f)
            quadTo(face.centerX() + w * 0.35f, shoulderY - w * 0.2f, face.centerX() + w * 0.95f, shoulderY)
            lineTo(face.centerX() + w * 0.68f, shoulderY + w * 0.28f)
            quadTo(face.centerX(), shoulderY + w * 0.62f, face.centerX() - w * 0.68f, shoulderY + w * 0.28f)
            close()
        }
        canvas.drawPath(collar, fur)
        for (index in -3..3) {
            val x = face.centerX() + index * w * 0.22f
            canvas.drawOval(
                RectF(x - w * 0.025f, shoulderY + w * 0.13f, x + w * 0.025f, shoulderY + w * 0.24f),
                spot,
            )
        }
        canvas.drawLine(left + w * 0.22f, shoulderY + w * 0.42f, left + w * 0.05f, bottom, gold.apply {
            strokeWidth = w * 0.055f
            style = Paint.Style.STROKE
        })
        canvas.drawLine(right - w * 0.22f, shoulderY + w * 0.42f, right - w * 0.05f, bottom, gold)
        gold.style = Paint.Style.FILL
    }
}

private data class FaceFrame(
    val rect: RectF,
    val sourceWidth: Float,
    val sourceHeight: Float,
    val mirrored: Boolean,
)
