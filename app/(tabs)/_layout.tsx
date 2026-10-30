import { router, Tabs } from 'expo-router';
import { Calendar, ClipboardList, Home, Plus, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, typography } from '@/lib/theme';

/**
 * Tab bar layout per CLAUDE.md §5 and design handoff §3.5.
 *   Home · Jobs · (FAB slot) · Calendar · Customers
 * The FAB is an overlay that opens /quote/new and is available from every tab.
 */
export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.goldDark,
          tabBarInactiveTintColor: colors.ink3,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Home size={24} color={color} strokeWidth={2} />,
          }}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} strokeWidth={2} />,
            // Pad the inner side of this tab so its icon/label sit further
            // from the centre FAB and give it room to breathe.
            tabBarItemStyle: { paddingRight: FAB_BREATHING_ROOM },
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color }) => <Calendar size={24} color={color} strokeWidth={2} />,
            tabBarItemStyle: { paddingLeft: FAB_BREATHING_ROOM },
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: 'Customers',
            tabBarIcon: ({ color }) => <Users size={24} color={color} strokeWidth={2} />,
          }}
        />
      </Tabs>

      <Pressable
        accessibilityLabel="New quote. Double-tap to start a new AI-generated quote."
        accessibilityRole="button"
        style={styles.fab}
        onPress={() => router.push('/quote/new')}
      >
        <Plus size={28} color={colors.ink} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const FAB_SIZE = 72;
const TAB_BAR_HEIGHT = 96;
// Horizontal pad applied to the inner edge of the two tabs adjacent to the
// FAB (Jobs on the left, Calendar on the right). Padding biases the centred
// content toward the outer edge, so the visual shift is roughly half this.
const FAB_BREATHING_ROOM = 32;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    backgroundColor: colors.surface,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TAB_BAR_HEIGHT - FAB_SIZE / 2 + 8,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.goldDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
