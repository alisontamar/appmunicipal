'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface MensajeWidget {
  texto: string;
  color: `#${string}`;
}

interface Props {
  enServicio: boolean;
  /** Mensaje temporal (p. ej. "SOS enviado") que reemplaza a los botones. */
  mensaje?: MensajeWidget | null;
}

/** Botón del widget: un bloque de color con una etiqueta, que dispara `clickAction`. */
function Boton({
  texto,
  color,
  clickAction,
  clickActionData,
  flex = 1,
}: {
  texto: string;
  color: `#${string}`;
  clickAction: string;
  clickActionData?: Record<string, unknown>;
  flex?: number;
}) {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      style={{
        flex,
        height: 'match_parent',
        backgroundColor: color,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TextWidget
        text={texto}
        style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' }}
      />
    </FlexWidget>
  );
}

/**
 * Widget de pantalla de inicio. Los widgets no admiten hooks ni estado: se
 * redibuja entero cada vez que cambia el servicio (ver actualizarWidget).
 *
 * - En servicio: SOS (se envía directo, sin abrir la app) + Registrar incidente.
 * - Fuera de servicio: los mismos dos botones en gris; al tocarlos avisan que hay
 *   que iniciar servicio desde la app (no hay SOS ni incidente sin turno).
 */
export function GuardiaWidget({ enServicio, mensaje }: Props) {
  // Arreglo en vez de fragmentos (<>…</>): el árbol del widget no los soporta y,
  // si se usan, el widget se queda en blanco al dibujarse.
  const botones = mensaje
    ? [<Boton key="msg" texto={mensaje.texto} color={mensaje.color} clickAction="OPEN_APP" />]
    : enServicio
      ? [
          <Boton key="sos" texto="SOS" color="#E53935" clickAction="SOS" flex={1} />,
          <Boton
            key="inc"
            texto="Registrar incidente"
            color="#BF9466"
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'guardiasgam://incidente' }}
            flex={2}
          />,
        ]
      : [
          <Boton key="sos" texto="SOS" color="#6B7280" clickAction="SOS" flex={1} />,
          <Boton key="inc" texto="Registrar incidente" color="#6B7280" clickAction="INCIDENTE" flex={2} />,
        ];

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 8,
        padding: 8,
        backgroundColor: '#141312',
        borderRadius: 22,
      }}
    >
      {botones}
    </FlexWidget>
  );
}
