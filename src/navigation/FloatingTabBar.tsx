import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { colors, radius, spacing } from '@/theme';
import type { TabsParamList } from './types';

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
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
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
            <TabItem
              key={route.key}
              focused={focused}
              icon={ICONS[route.name as keyof TabsParamList] ?? 'ellipse'}
              label={label}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
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
            paddingHorizontal: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 16] }),
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
