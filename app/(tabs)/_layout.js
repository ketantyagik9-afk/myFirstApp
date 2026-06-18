import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import COLORS from "../../constants/colors";

function TabIcon({ name, color, size }) {
  return <Ionicons name={name} size={size || 22} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: COLORS.softCard,
          borderTopWidth: 1,
          borderTopColor: COLORS.softBorder,
          shadowColor: "#8EA4C8",
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarActiveTintColor: COLORS.rose,
        tabBarInactiveTintColor: COLORS.darkBlueGray,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="liked" options={{ href: null }} />

      <Tabs.Screen
        name="home"
        options={{
          title: "Vibe",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="flame" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="compass-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="liked-you"
        options={{
          title: "Connect",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="heart-circle-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="my-plans"
        options={{
          title: "Plans",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
