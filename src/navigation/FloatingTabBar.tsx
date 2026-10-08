import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { useShift } from '@/context/ShiftContext';
import { CopilotStep, Walkthroughable } from '@/tutorial/Tutorial';
import type { AppStackParamList, TabsParamList } from './types';

/** Diámetro del botón central de "Registrar incidente". */
const CENTER_SIZE = 64;
/** Cuánto sobresale el botón central por encima de la píldora. */
const CENTER_RAISE = 26;

/** Ícono por pestaña. */
const ICONS: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
  HomeTab: 'home',
  MapTab: 'map',
  HistoryTab: 'time',
  ProfileTab: 'person',
};

/**
 * Tab bar flotante tipo "píldora": la pestaña activa se expande en una
 * cápsula blanca con ícono + etiqueta; las inactivas muestran solo el ícono.
 * La transición al tocar es suave (cápsula + etiqueta animadas).
 *
 * Al centro hay un botón sobresaliente de "Registrar incidente" que abre directo
 * la cámara. Está dentro del área de la barra (no fuera de ella) porque Android
 * no entrega toques a elementos que se salen de los límites de su contenedor.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { enServicio } = useShift();

  const abrirIncidente = () => {
    // La barra vive dentro del navegador de pestañas; las pantallas de reporte
    // están en el stack padre, y navigate sube hasta encontrarlas.
    const stack = navigation as unknown as NativeStackNavigationProp<AppStackParamList>;
    if (!enServicio) {
      Alert.alert(
        'Registrar incidente',
        'Para registrar un incidente primero debe iniciar servicio.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Iniciar servicio', onPress: () => stack.navigate('StartServiceCamera') },
        ],
      );
      return;
    }
    stack.navigate('IncidentCamera');
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
      <View style={styles.stage}>
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <React.Fragment key={route.key}>
                {/* Hueco bajo el botón central, entre las dos primeras y las dos últimas pestañas. */}
                {index === 2 ? <View style={styles.centerGap} /> : null}
                <TabItem
                  focused={focused}
                  icon={ICONS[route.name as keyof TabsParamList] ?? 'ellipse'}
                  label={label}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.centerWrap} pointerEvents="box-none">
          {/* Paso del tutorial: en servicio va despues de "Cerrar servicio" (5) y antes del SOS (7). */}
          <CopilotStep
            order={enServicio ? 6 : 5}
            name="incidente"
            text={
              enServicio
                ? 'Botón central: registra un incidente al instante. Abre la cámara, toma varias fotos y completa el reporte.'
                : 'Botón central: aquí registrarás los incidentes (abre la cámara y completa el reporte). Se activa cuando inicias el servicio.'
            }
          >
            <Walkthroughable style={styles.centerTarget}>
            <Pressable
              onPress={abrirIncidente}
              accessibilityRole="button"
              accessibilityLabel="Registrar incidente"
              hitSlop={6}
              style={({ pressed }) => [
                styles.centerButton,
                !enServicio && styles.centerButtonOff,
                pressed && styles.centerPressed,
              ]}
            >
              <Ionicons name="alert" size={30} color={colors.white} />
            </Pressable>
            </Walkthroughable>
          </CopilotStep>
        </View>
      </View>
    </View>
  );
}

interface TabItemProps {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ focused, icon, label, onPress, onLongPress }: TabItemProps) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [focused, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', colors.white],
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          styles.item,
          {
            backgroundColor,
            paddingHorizontal: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 14] }),
          },
        ]}
      >
        {/* Cross-fade de dos íconos: animar el color del propio Ionicons rompe en la
            nueva arquitectura (setNativeProps), así que se cruzan por opacidad. */}
        <View style={styles.iconBox}>
          <Animated.View style={{ opacity: anim }}>
            <Ionicons name={icon} size={22} color={colors.navy900} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.iconBox,
              { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}
          >
            <Ionicons name={icon} size={22} color="rgba(255,255,255,0.55)" />
          </Animated.View>
        </View>

        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              opacity: anim,
              maxWidth: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 96] }),
              marginLeft: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.transparent,
  },
  // Contiene la barra y el botón central; deja arriba el espacio por el que el botón sobresale.
  stage: { paddingTop: CENTER_RAISE },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navy900,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  centerGap: { width: CENTER_SIZE },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  centerTarget: { width: CENTER_SIZE, height: CENTER_SIZE },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    // El aro del color del fondo recorta visualmente la píldora alrededor del botón.
    borderWidth: 5,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  centerButtonOff: { backgroundColor: colors.offDuty },
  centerPressed: { transform: [{ scale: 0.95 }] },
  pressable: { borderRadius: radius.pill },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  iconBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  label: {
    color: colors.navy900,
    fontWeight: '700',
    fontSize: 13,
    overflow: 'hidden',
  },
});