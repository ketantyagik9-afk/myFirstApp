import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import COLORS from "../constants/colors";
import { auth } from "../firebaseConfig";
import {
  getDiscoverCandidates,
  getUserProfile,
  joinPlan,
  getMyBlockedUserIds,
  getMyMatches,
} from "../services/userService";

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function isVibeActive(user) {
  if (!user?.currentVibe) return false;
  if (user.vibeDuration === "always") return true;

  const expiresAt = getDateFromFirestore(user?.vibeExpiresAt);
  if (!expiresAt) return false;

  return expiresAt.getTime() > Date.now();
}

function getDistanceKm(loc1, loc2) {
  if (!loc1 || !loc2) return null;

  if (
    typeof loc1.latitude !== "number" ||
    typeof loc1.longitude !== "number" ||
    typeof loc2.latitude !== "number" ||
    typeof loc2.longitude !== "number"
  ) {
    return null;
  }

  const R = 6371;

  const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.latitude * Math.PI) / 180) *
      Math.cos((loc2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((R * c).toFixed(1));
}

function getUserPhotos(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return user.photos.filter(Boolean);
  }

  if (user?.photoURL) {
    return [user.photoURL];
  }

  return ["https://picsum.photos/500"];
}

function getPhotosParam(user) {
  const photos = getUserPhotos(user);

  if (Array.isArray(photos) && photos.length > 0) {
    return encodeURIComponent(JSON.stringify(photos));
  }

  return "";
}

function getVibeTimeText(user) {
  if (user?.vibeDuration === "always") return "Always active";

  const expiresAt = getDateFromFirestore(user?.vibeExpiresAt);
  if (!expiresAt) return "Active now";

  const minutesLeft = Math.max(
    0,
    Math.round((expiresAt.getTime() - Date.now()) / 60000)
  );

  if (minutesLeft <= 0) return "Expired";

  if (minutesLeft >= 60) {
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;

    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} left`;
    }

    return `${hours}h ${minutes}m left`;
  }

  return `${minutesLeft} min left`;
}

function getAvailabilityLabel(value) {
  if (value === "freeNow") return "Free now";
  if (value === "tonight") return "Tonight";
  if (value === "weekend") return "This weekend";
  if (value === "anytime") return "Anytime";
  return "Free now";
}

function formatDistance(distance) {
  if (distance === null) return "Nearby";
  if (distance < 1) return "< 1 km away";
  return `${distance} km away`;
}

function isNewVibe(user) {
  const vibeUpdatedAt = getDateFromFirestore(user?.vibeUpdatedAt);

  if (!vibeUpdatedAt) return false;

  const diffMinutes = (Date.now() - vibeUpdatedAt.getTime()) / (1000 * 60);

  return diffMinutes <= 10;
}

function normalizeGender(value) {
  const normalized = (value || "").toLowerCase().trim();

  if (["man", "male", "men"].includes(normalized)) return "man";
  if (["woman", "female", "women"].includes(normalized)) return "woman";
  if (normalized === "other") return "other";
  if (normalized === "prefer not to say") return "private";

  return "";
}

function interestedInAllowsGender(interestedIn, gender) {
  const preference = (interestedIn || "").toLowerCase().trim();
  const normalizedGender = normalizeGender(gender);

  if (!preference || preference === "prefer not to say") return true;
  if (!normalizedGender || normalizedGender === "private") return true;
  if (preference === "men") return normalizedGender === "man";
  if (preference === "women") return normalizedGender === "woman";
  if (preference === "other") return normalizedGender === "other";

  return true;
}

function matchesGenderPreference(user, myProfile) {
  if (!myProfile) return true;

  return (
    interestedInAllowsGender(myProfile?.interestedIn, user?.gender) &&
    interestedInAllowsGender(user?.interestedIn, myProfile?.gender)
  );
}

export default function NearbyFeedScreen() {
  const [loading, setLoading] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [activeNearbyCount, setActiveNearbyCount] = useState(0);
  const [newVibesCount, setNewVibesCount] = useState(0);

  const loadNearbyFeed = useCallback(async (showLoader = true) => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      const currentUserId = auth.currentUser.uid;
      const me = await getUserProfile(currentUserId);
      const currentLocation = me?.location || null;

      const [candidateUsers, blockedUserIds, matchedUsers] = await Promise.all([
        getDiscoverCandidates({
          currentUserId,
          centerLocation: currentLocation,
          radiusKm: 25,
          limitCount: 80,
        }),
        getMyBlockedUserIds(currentUserId),
        getMyMatches(currentUserId),
      ]);
      const matchedUserIds = matchedUsers.map((user) => user.id);

      const activeNearbyUsers = candidateUsers
        .filter((user) => user.id !== currentUserId)
        .filter((user) => !blockedUserIds.includes(user?.id))
        .filter((user) => !matchedUserIds.includes(user?.id))
        .filter((user) => matchesGenderPreference(user, me))
        .filter((user) => isVibeActive(user))
        .map((user) => ({
          ...user,
          distanceKm: getDistanceKm(currentLocation, user.location),
        }))
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });

      setNearbyUsers(activeNearbyUsers);
      setActiveNearbyCount(activeNearbyUsers.length);

      const recentVibes = activeNearbyUsers.filter((user) => isNewVibe(user));
      setNewVibesCount(recentVibes.length);

      setLastUpdated(new Date());
    } catch (error) {
      Alert.alert(
        "Nearby feed error",
        error?.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNearbyFeed();

    const timer = setInterval(() => {
      loadNearbyFeed(false);
    }, 10000);

    return () => clearInterval(timer);
  }, [loadNearbyFeed]);

  const openProfile = (user) => {
    if (!user?.id) return;
    router.push(`/user-profile?userId=${encodeURIComponent(user.id)}`);
  };

  const openChat = (user) => {
    if (!auth.currentUser?.uid || !user?.id) return;

    const chatId = [auth.currentUser.uid, user.id].sort().join("_");
    const mainPhoto = getUserPhotos(user)[0] || "";
    const photosParam = getPhotosParam(user);

    router.push(
      `/chat?chatId=${chatId}&name=${encodeURIComponent(
        user.name || "User"
      )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
    );
  };

  const handleJoinPlan = async (user) => {
    try {
      if (!auth.currentUser?.uid || !user?.id) return;

      await joinPlan(auth.currentUser.uid, user.id, user);

      Alert.alert(
        "Joined plan",
        `You joined ${user.name || "this user's"} vibe.`
      );

      openChat(user);
    } catch (error) {
      Alert.alert("Join failed", error?.message || "Something went wrong.");
    }
  };

  const lastUpdatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 50,
          paddingBottom: 20,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.black }}>
            ‹ Back
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            marginTop: 20,
            fontSize: 34,
            fontWeight: "900",
            color: COLORS.black,
          }}
        >
          People Near You
        </Text>

        <Text
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 6,
            lineHeight: 22,
          }}
        >
          Live nearby activity happening around you right now.
        </Text>

        <View
          style={{
            marginTop: 18,
            backgroundColor: COLORS.teal,
            borderRadius: 30,
            padding: 18,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontSize: 14,
              fontWeight: "900",
              opacity: 0.88,
            }}
          >
            LIVE ACTIVITY
          </Text>

          <Text
            style={{
              marginTop: 10,
              color: COLORS.white,
              fontSize: 30,
              fontWeight: "900",
            }}
          >
            {activeNearbyCount}
          </Text>

          <Text
            style={{
              color: COLORS.white,
              marginTop: 4,
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            active vibe{activeNearbyCount === 1 ? "" : "s"} nearby
          </Text>

          <View
            style={{
              marginTop: 16,
              backgroundColor: "rgba(255,255,255,0.14)",
              borderRadius: 20,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: COLORS.white,
                fontWeight: "900",
                fontSize: 22,
              }}
            >
              {newVibesCount}
            </Text>

            <Text
              style={{
                color: "rgba(255,255,255,0.85)",
                marginTop: 4,
                fontWeight: "700",
              }}
            >
              new vibe{newVibesCount === 1 ? "" : "s"} in last 10 minutes
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: "#999",
            marginTop: 12,
            fontWeight: "700",
          }}
        >
          {lastUpdatedText
            ? `Last updated ${lastUpdatedText}`
            : "Preparing feed..."}
        </Text>

        <TouchableOpacity
          onPress={() => loadNearbyFeed(true)}
          style={{
            marginTop: 16,
            backgroundColor: COLORS.teal,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "900" }}>
            Refresh Nearby
          </Text>
        </TouchableOpacity>

        {loading ? (
          <View
            style={{
              marginTop: 22,
              backgroundColor: COLORS.softCard,
              borderRadius: 30,
              padding: 24,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={COLORS.teal} />
            <Text
              style={{
                marginTop: 12,
                fontSize: 18,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              Loading nearby vibes...
            </Text>
          </View>
        ) : nearbyUsers.length === 0 ? (
          <View
            style={{
              marginTop: 22,
              backgroundColor: COLORS.softCard,
              borderRadius: 30,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.black }}>
              No nearby vibes yet
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Ask a test user to activate a vibe nearby.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 20 }}>
            {nearbyUsers.map((user) => {
              const mainPhoto = getUserPhotos(user)[0];

              return (
                <View
                  key={user.id}
                  style={{
                    backgroundColor: COLORS.softCard,
                    borderRadius: 30,
                    marginBottom: 16,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 4,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => openProfile(user)}
                  >
                    <Image
                      source={{ uri: mainPhoto }}
                      style={{
                        width: "100%",
                        height: 230,
                        backgroundColor: "#dbe3ea",
                      }}
                    />
                  </TouchableOpacity>

                  <View style={{ padding: 16 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => openProfile(user)}
                        style={{ flex: 1, paddingRight: 10 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 26,
                              fontWeight: "900",
                              color: COLORS.black,
                            }}
                          >
                            {user.name || "User"}
                            {user.age ? `, ${user.age}` : ""}
                          </Text>

                          {user?.verified && (
                            <View
                              style={{
                                marginLeft: 8,
                                backgroundColor: COLORS.teal,
                                borderRadius: 999,
                                paddingHorizontal: 9,
                                paddingVertical: 4,
                              }}
                            >
                              <Text
                                style={{
                                  color: COLORS.white,
                                  fontWeight: "900",
                                  fontSize: 11,
                                }}
                              >
                                VERIFIED
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text
                          style={{
                            marginTop: 5,
                            color: COLORS.darkBlueGray,
                            fontWeight: "800",
                          }}
                        >
                          {formatDistance(user.distanceKm)}
                        </Text>
                      </TouchableOpacity>

                      <View
                        style={{
                          backgroundColor: COLORS.blueSoft,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.teal,
                            fontWeight: "900",
                            fontSize: 12,
                          }}
                        >
                          {getVibeTimeText(user)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        marginTop: 14,
                        backgroundColor: COLORS.elevatedCard,
                        borderRadius: 20,
                        padding: 13,
                        borderWidth: 1,
                        borderColor: "#dbe3ea",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: COLORS.black,
                        }}
                      >
                        {user.currentVibe || "Active vibe"}
                      </Text>

                      <Text
                        style={{
                          marginTop: 6,
                          color: COLORS.darkBlueGray,
                          lineHeight: 21,
                          fontWeight: "600",
                        }}
                      >
                        {user.vibePlan || "No plan text yet."}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <Text style={availabilityTagStyle}>
                        {getAvailabilityLabel(user.availability)}
                      </Text>

                      <Text style={tagStyle}>{user.intent || "No intent"}</Text>
                      <Text style={tagStyle}>{user.mood || "No mood"}</Text>
                      <Text style={tagStyle}>
                        {user.activity || "No activity"}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        marginTop: 16,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleJoinPlan(user)}
                        style={{
                          flex: 1,
                          backgroundColor: COLORS.teal,
                          borderRadius: 999,
                          paddingVertical: 14,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.white,
                            fontWeight: "900",
                          }}
                        >
                          Join Plan
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openProfile(user)}
                        style={{
                          flex: 1,
                          backgroundColor: COLORS.elevatedCard,
                          borderRadius: 999,
                          paddingVertical: 14,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: "#dbe3ea",
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.black,
                            fontWeight: "900",
                          }}
                        >
                          Profile
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const tagStyle = {
  backgroundColor: COLORS.blueSoft,
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 999,
  fontWeight: "800",
  color: COLORS.darkBlueGray,
  overflow: "hidden",
};

const availabilityTagStyle = {
  backgroundColor: COLORS.teal,
  color: COLORS.white,
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 999,
  fontWeight: "900",
  overflow: "hidden",
};
