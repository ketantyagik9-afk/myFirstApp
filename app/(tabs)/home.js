import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import COLORS from "../../constants/colors";
import { auth } from "../../firebaseConfig";
import {
  updateMyVibe,
  updateUserOnlineStatus,
  savePushToken,
} from "../../services/userService";

import { registerForPushNotificationsAsync } from "../../services/notificationService";

const VIBES = [
  { label: "☕ Coffee", mood: "chill", activity: "coffee" },
  { label: "🍸 Drinks", mood: "social", activity: "drinks" },
  { label: "🍽 Dinner", mood: "romantic", activity: "dinner" },
  { label: "🎬 Movie", mood: "relaxed", activity: "movie" },
  { label: "🚶 Walk", mood: "calm", activity: "walk" },
  { label: "🏋️ Gym", mood: "active", activity: "gym" },
  { label: "📚 Study", mood: "focused", activity: "study" },
  { label: "🎮 Gaming", mood: "fun", activity: "gaming" },
  { label: "Brunch", mood: "social", activity: "brunch" },
  { label: "Lunch", mood: "casual", activity: "lunch" },
  { label: "Shopping", mood: "fun", activity: "shopping" },
  { label: "Live Music", mood: "social", activity: "live music" },
  { label: "Dancing", mood: "fun", activity: "dancing" },
  { label: "Beach", mood: "relaxed", activity: "beach" },
  { label: "Hiking", mood: "active", activity: "hiking" },
  { label: "Art Gallery", mood: "creative", activity: "art gallery" },
  { label: "Festival", mood: "social", activity: "festival" },
  { label: "Language Exchange", mood: "curious", activity: "language exchange" },
  { label: "Food Crawl", mood: "adventurous", activity: "food crawl" },
  { label: "Networking", mood: "focused", activity: "networking" },
];

const DURATIONS = [
  { label: "4 Hours", value: "4hours" },
  { label: "Whole Day", value: "wholeDay" },
  { label: "Always", value: "always" },
];

function AnimatedChip({ label, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const content = (
    <Text
      style={{
        color: COLORS.white,
        fontWeight: "800",
        fontSize: 14,
      }}
    >
      {label}
    </Text>
  );

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        marginRight: 10,
        marginBottom: 10,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={{
          borderRadius: 999,
          backgroundColor: selected ? "transparent" : COLORS.softCard,
          borderWidth: 1,
          borderColor: selected ? "transparent" : COLORS.softBorder,
          shadowColor: selected ? COLORS.rose : "#9FB0CC",
          shadowOpacity: selected ? 0.18 : 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: selected ? 3 : 1,
        }}
      >
        {selected ? (
          <LinearGradient
            colors={[COLORS.rose, COLORS.teal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 999,
            }}
          >
            {content}
          </LinearGradient>
        ) : (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 999,
            }}
          >
            {content}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [vibePickerOpen, setVibePickerOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("4hours");
  const [planText, setPlanText] = useState("");
  const [savingVibe, setSavingVibe] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 7,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const initialize = async () => {
      try {
        if (auth.currentUser?.uid) {
          await updateUserOnlineStatus(auth.currentUser.uid, true);

          const token = await registerForPushNotificationsAsync(
            auth.currentUser.uid
          );

          if (token) {
            await savePushToken(auth.currentUser.uid, token);
          }
        }
      } catch (error) {
        console.log("Init error:", error.message);
      }
    };

    initialize();
  }, []);

  const handleSetVibe = async () => {
    try {
      if (savingVibe) return;

      if (!selectedVibe) {
        Alert.alert("Choose a vibe", "Choose a vibe first.");
        return;
      }

      if (!auth.currentUser?.uid) return;

      setSavingVibe(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = null;

      if (status === "granted") {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (location?.coords) {
            coords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
          }
        } catch (locationError) {
          console.log("Current location error:", locationError.message);

          const lastKnownLocation =
            await Location.getLastKnownPositionAsync();

          if (lastKnownLocation?.coords) {
            coords = {
              latitude: lastKnownLocation.coords.latitude,
              longitude: lastKnownLocation.coords.longitude,
            };
          }
        }
      }

      Animated.sequence([
        Animated.spring(buttonScale, {
          toValue: 0.96,
          useNativeDriver: true,
        }),

        Animated.spring(buttonScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      await updateMyVibe(
        auth.currentUser.uid,
        selectedVibe,
        selectedDuration,
        planText,
        coords
      );

      router.push("/discover");
    } catch (error) {
      console.log("Set vibe error:", error.message);
      Alert.alert("Could not update vibe", error?.message || "Please try again.");
    } finally {
      setSavingVibe(false);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 60,
          paddingBottom: 120,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              backgroundColor: "transparent",
              borderRadius: 28,
              padding: 0,
              minHeight: 150,
              overflow: "hidden",
              shadowColor: "#9FB0CC",
              shadowOpacity: 0,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 0,
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -18,
                bottom: -18,
                width: 118,
                height: 118,
                borderRadius: 59,
                backgroundColor: COLORS.blueSoft,
                opacity: 0,
              }}
            />

            <View
              style={{
                position: "absolute",
                right: 58,
                bottom: 18,
                width: 82,
                height: 82,
                borderRadius: 41,
                backgroundColor: COLORS.pinkSoft,
                opacity: 0,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: COLORS.rose,
                  fontWeight: "900",
                  letterSpacing: 0,
                  fontSize: 13,
                }}
              >
                CLIQZEE
              </Text>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => router.push("/notifications")}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: COLORS.softCard,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                  shadowColor: "#8EA4C8",
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 2,
                }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={COLORS.black}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: COLORS.rose,
                  }}
                />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                marginTop: 12,
                fontSize: 36,
                lineHeight: 42,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              {"What's your "}
              <Text style={{ color: COLORS.rose }}>vibe</Text> today?
            </Text>

            <Text
              style={{
                display: "none",
                marginTop: 8,
                fontSize: 36,
                lineHeight: 42,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              What’s your vibe today?
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: COLORS.darkBlueGray,
                lineHeight: 24,
                fontSize: 15,
              }}
            >
              Meet nearby people instantly based on your mood, vibe and plans.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            marginTop: 28,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              fontSize: 18,
              color: COLORS.black,
              marginBottom: 14,
            }}
          >
            Select Your Vibe
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setVibePickerOpen((prev) => !prev)}
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              paddingHorizontal: 18,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              shadowColor: "#9FB0CC",
              shadowOpacity: 0.12,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 7 },
              elevation: 2,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: selectedVibe ? COLORS.black : COLORS.darkBlueGray,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                {selectedVibe?.label || "Select Your Vibe"}
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: COLORS.darkBlueGray,
                  marginTop: 4,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Tap to choose what you want to do
              </Text>
            </View>

            <Text
              style={{
                color: COLORS.rose,
                fontWeight: "900",
                fontSize: 24,
                lineHeight: 24,
                transform: [{ rotate: vibePickerOpen ? "180deg" : "0deg" }],
              }}
            >
              ⌄
            </Text>
          </TouchableOpacity>

          {vibePickerOpen ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: COLORS.softCard,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: COLORS.softBorder,
                maxHeight: 250,
                overflow: "hidden",
              }}
            >
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                {VIBES.map((vibe) => {
                  const selected = selectedVibe?.label === vibe.label;

                  return (
                    <TouchableOpacity
                      key={vibe.label}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedVibe(vibe);
                        setVibePickerOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 15,
                        backgroundColor: selected
                          ? COLORS.pinkSoft
                          : COLORS.softCard,
                        borderBottomWidth: 1,
                        borderBottomColor: COLORS.softBorder,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: selected ? COLORS.rose : COLORS.black,
                          fontWeight: selected ? "900" : "800",
                          fontSize: 15,
                          flex: 1,
                          paddingRight: 12,
                        }}
                      >
                        {vibe.label}
                      </Text>

                      {selected ? (
                        <Text
                          style={{
                            color: COLORS.rose,
                            fontWeight: "900",
                            fontSize: 16,
                          }}
                        >
                          Selected
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          style={{
            marginTop: 22,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              fontSize: 18,
              color: COLORS.black,
              marginBottom: 14,
            }}
          >
            Active duration
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {DURATIONS.map((duration) => (
              <AnimatedChip
                key={duration.value}
                label={duration.label}
                selected={selectedDuration === duration.value}
                onPress={() => setSelectedDuration(duration.value)}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            marginTop: 22,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              fontSize: 18,
              color: COLORS.black,
              marginBottom: 14,
            }}
          >
            Add a plan
          </Text>

          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              shadowColor: "#9FB0CC",
              shadowOpacity: 0.08,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }}
          >
            <TextInput
              value={planText}
              onChangeText={setPlanText}
              placeholder="Coffee at 4pm?"
              placeholderTextColor="#8b98a5"
              multiline
              style={{
                color: COLORS.black,
                fontSize: 16,
                minHeight: 90,
                textAlignVertical: "top",
              }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={{
            marginTop: 26,
            opacity: fadeAnim,
            transform: [{ scale: buttonScale }],
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSetVibe}
            style={{
              backgroundColor: "transparent",
              borderRadius: 999,
              paddingVertical: 0,
              alignItems: "center",
              shadowColor: COLORS.rose,
              shadowOpacity: 0.24,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 7 },
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={[COLORS.rose, COLORS.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: "100%",
                borderRadius: 999,
                paddingVertical: 18,
                alignItems: "center",
              }}
            >
            <Text
              style={{
                color: COLORS.white,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              Set My Vibe 🔥
            </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ marginTop: 18 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push("/discover")}
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 999,
              paddingVertical: 17,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.softBorder,
            }}
          >
            <Text
              style={{
                color: COLORS.black,
                fontWeight: "900",
                fontSize: 15,
              }}
            >
              Explore Nearby Vibes ✨
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}
