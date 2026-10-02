package io.github.admwilsonoliveira.treino;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin próprio do app: cronômetro na notificação (tela de bloqueio)
        registerPlugin(TreinoTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
