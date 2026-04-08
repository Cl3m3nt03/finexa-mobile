import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height:          56,
          paddingBottom:   6,
          paddingTop:      6,
        },
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={22} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={22} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'target' : 'target-outline'} size={22} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />

      {/* ── Hidden Tabs (Fixed bottom bar but no icon) ── */}
      <Tabs.Screen name="simulator"    options={{ href: null }} />
      <Tabs.Screen name="assistant"    options={{ href: null }} />
      <Tabs.Screen name="transactions" options={{ href: null }} />
      <Tabs.Screen name="profile"      options={{ href: null }} />
      <Tabs.Screen name="assets"       options={{ href: null }} />
      <Tabs.Screen name="fiscal"       options={{ href: null }} />
      <Tabs.Screen name="pokemon"      options={{ href: null }} />
      <Tabs.Screen name="settings"     options={{ href: null }} />
    </Tabs>
  )
}
