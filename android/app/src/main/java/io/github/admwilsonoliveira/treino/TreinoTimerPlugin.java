package io.github.admwilsonoliveira.treino;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Notificação fixa com cronômetro, visível na tela de bloqueio.
 * O próprio Android atualiza o relógio (setUsesChronometer), então funciona com o app em segundo plano.
 * - Treino em andamento: conta para cima a partir do início.
 * - Descanso: conta para baixo até o fim e some sozinha (setTimeoutAfter).
 * O alarme sonoro do fim do descanso é agendado pelo plugin LocalNotifications.
 */
@CapacitorPlugin(name = "TreinoTimer")
public class TreinoTimerPlugin extends Plugin {

    private static final String CHANNEL = "treino_cronometro";

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getContext().getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Cronômetro do treino", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Tempo de treino e de descanso na tela de bloqueio");
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();
        int id = call.getInt("id", 4101);
        String title = call.getString("title", "Treino");
        String text = call.getString("text", "");
        Double whenD = call.getDouble("when");
        long when = whenD != null ? whenD.longValue() : System.currentTimeMillis();
        boolean countDown = Boolean.TRUE.equals(call.getBoolean("countDown", false));
        Double timeoutD = call.getDouble("timeoutMs");
        long timeout = timeoutD != null ? timeoutD.longValue() : 0L;

        ensureChannel();

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = null;
        if (open != null) {
            open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_treino)
                .setColor(0xFF0F6B63)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(true)
                .setWhen(when)
                .setUsesChronometer(true)
                .setChronometerCountDown(countDown)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setPriority(NotificationCompat.PRIORITY_LOW);
        if (pi != null) b.setContentIntent(pi);
        if (timeout > 0) b.setTimeoutAfter(timeout);

        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Sem permissão para notificações");
        }
    }

    @PluginMethod
    public void hide(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(call.getInt("id", 4101));
        call.resolve();
    }
}
