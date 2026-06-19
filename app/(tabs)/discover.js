import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "../../firebaseConfig";
import {
  getDiscoverCandidates,
  getUserProfile,
  joinPlan,
  likeUser,
  getMyBlockedUserIds,
  getMyMatchIds,
} from "../../services/userService";

import COLORS from "../../constants/colors";
import { normalizeCountryName } from "../../constants/countries";
import { playMatchWhistle } from "../../services/soundService";

import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const CARD_IMAGE_HEIGHT = Math.min(430, SCREEN_HEIGHT * 0.52);

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "Any distance", value: null },
];

const CULTURAL_OPTIONS = [
  { label: "Open to all backgrounds", value: "any" },
  { label: "Same as me", value: "same" },
  { label: "Specific country", value: "specific" },
];

function showError(title, error) {
  Alert.alert(title, error?.message || "Something went wrong.");
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

function RadiusChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        marginRight: 8,
        backgroundColor: selected ? COLORS.rose : COLORS.softCard,
        borderWidth: 1,
        borderColor: selected ? COLORS.rose : COLORS.softBorder,
      }}
    >
      <Text
        style={{
          color: selected ? COLORS.white : COLORS.black,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SimilarVibesRow({ users }) {
  const visibleUsers = Array.isArray(users) ? users.slice(0, 5) : [];

  if (visibleUsers.length === 0) return null;

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: COLORS.black, fontSize: 13, fontWeight: "900" }}>
        Nearby active vibes
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingRight: 10 }}
      >
        {visibleUsers.map((user) => {
          const photo = getUserPhotos(user)[0];

          return (
            <TouchableOpacity
              key={user.id}
              activeOpacity={0.85}
              onPress={() =>
                router.push(`/user-profile?userId=${encodeURIComponent(user.id)}`)
              }
              style={{ width: 66, marginRight: 14, alignItems: "center" }}
            >
              <View>
                <Image
                  source={{ uri: photo }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderWidth: 2,
                    borderColor: COLORS.rose,
                    backgroundColor: COLORS.softBorder,
                  }}
                />

                {user?.isOnline && (
                  <View
                    style={{
                      position: "absolute",
                      right: 2,
                      bottom: 2,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#18c964",
                      borderWidth: 2,
                      borderColor: COLORS.white,
                    }}
                  />
                )}
              </View>

              <Text
                numberOfLines={1}
                style={{
                  marginTop: 6,
                  color: COLORS.black,
                  fontSize: 12,
                  fontWeight: "900",
                }}
              >
                {user.name || "User"}
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: COLORS.darkBlueGray,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {user.activity || user.currentVibe || "Vibe"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getDistanceKm(loc1, loc2) {
  if (!loc1 || !loc2) return null;

  if (
    typeof loc1.latitude !== "number" ||
    typeof loc1.longitude !== "number"
  ) {
    return null;
  }

  if (
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

function compareUsersByDistance(a, b, myLocation) {
  if (!myLocation) return 0;

  const distanceA = getDistanceKm(myLocation, a?.location);
  const distanceB = getDistanceKm(myLocation, b?.location);

  if (distanceA === null && distanceB === null) return 0;
  if (distanceA === null) return 1;
  if (distanceB === null) return -1;

  return distanceA - distanceB;
}

function sortUsersByVibeThenDistance(users, myLocation, myProfile) {
  const myVibeKey = getUserVibeKey(myProfile);

  return [...users].sort((a, b) => {
    if (myVibeKey) {
      const aMatchesVibe = getUserVibeKey(a) === myVibeKey ? 0 : 1;
      const bMatchesVibe = getUserVibeKey(b) === myVibeKey ? 0 : 1;

      if (aMatchesVibe !== bMatchesVibe) {
        return aMatchesVibe - bMatchesVibe;
      }
    }

    return compareUsersByDistance(a, b, myLocation);
  });
}

function normalizeVibeKey(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUserVibeKey(user) {
  return normalizeVibeKey(user?.activity || user?.currentVibe);
}

function formatVibeName(value) {
  const key = normalizeVibeKey(value);

  if (!key) return "your vibe";

  return key
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCountry(value) {
  const normalized = cleanCountry(value)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    america: "united states",
    american: "united states",
    usa: "united states",
    us: "united states",
    "u s": "united states",
    "u s a": "united states",
    "united states of america": "united states",
    indian: "india",
    indians: "india",
    kiwi: "new zealand",
    "new zealander": "new zealand",
    australian: "australia",
    aussie: "australia",
    british: "united kingdom",
    britain: "united kingdom",
    english: "united kingdom",
  };

  return aliases[normalized] || normalized;
}

function cleanCountry(value) {
  return (value || "").trim();
}

function matchesCulturalPreference(user, myProfile) {
  const preference = myProfile?.culturalPreference || "any";

  if (preference === "any") return true;

  const userCountry = normalizeCountry(user?.bornCountry);

  if (!userCountry) return false;

  if (preference === "same") {
    const myCountry = normalizeCountry(myProfile?.bornCountry);
    return !!myCountry && userCountry === myCountry;
  }

  if (preference === "specific") {
    const preferredCountry = normalizeCountry(myProfile?.preferredCultureCountry);
    return !!preferredCountry && userCountry === preferredCountry;
  }

  return true;
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

function getCulturalPreferenceText(myProfile) {
  const preference = myProfile?.culturalPreference || "any";

  if (preference === "same") {
    return `Showing same background: ${
      cleanCountry(myProfile?.bornCountry) || "your country of birth"
    }`;
  }

  if (preference === "specific") {
    return `Showing background: ${
      cleanCountry(myProfile?.preferredCultureCountry) || "selected country"
    }`;
  }

  return "Open to all backgrounds";
}

function formatLastSeen(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Last seen recently";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  return "Last seen earlier";
}

function hasMyActiveVibe(user) {
  if (!user?.currentVibe) return false;
  if (user.vibeDuration === "always") return true;

  const expiresAt = getDateFromFirestore(user?.vibeExpiresAt);
  if (!expiresAt) {
    const updatedAt = getDateFromFirestore(user?.vibeUpdatedAt);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return !!updatedAt && updatedAt.getTime() > oneDayAgo;
  }

  return expiresAt.getTime() > Date.now();
}

function isVibeActive(user) {
  if (!user?.currentVibe) return false;
  if (user.vibeDuration === "always") return true;

  const expiresAt = getDateFromFirestore(user.vibeExpiresAt);
  if (!expiresAt) {
    const updatedAt = getDateFromFirestore(user?.vibeUpdatedAt);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    return !!updatedAt && updatedAt.getTime() > oneDayAgo;
  }

  return expiresAt.getTime() > Date.now();
}

function getVibeText(user) {
  if (!user?.currentVibe) return "Active vibe";

  if (user.vibeDuration === "always") {
    return `${user.currentVibe} always active`;
  }

  const expiresAt = getDateFromFirestore(user.vibeExpiresAt);
  if (!expiresAt) return `${user.currentVibe}`;

  const minutesLeft = Math.max(
    0,
    Math.round((expiresAt.getTime() - Date.now()) / 60000)
  );

  if (minutesLeft >= 60) {
    const hoursLeft = Math.ceil(minutesLeft / 60);
    return `${user.currentVibe} for ${hoursLeft} hour${
      hoursLeft > 1 ? "s" : ""
    }`;
  }

  return `${user.currentVibe} for ${minutesLeft} min`;
}

function OnlineStatus({ user }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: user?.isOnline ? COLORS.lime : "#cbd5e1",
          marginRight: 6,
        }}
      />

      <Text
        style={{
          color: user?.isOnline ? COLORS.lime : "#e2e8f0",
          fontWeight: "800",
        }}
      >
        {user?.isOnline ? "Online now" : formatLastSeen(user?.lastSeen)}
      </Text>
    </View>
  );
}

function ProfileCard({ user, myLocation, isBackCard = false }) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(0);
  }, [user?.id]);

  if (!user) return null;

  const photos = getUserPhotos(user);
  const activePhoto = photos[photoIndex] || photos[0];
  const distance = getDistanceKm(myLocation, user.location);

  const goPreviousPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goNextPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  return (
    <View
      style={{
        borderRadius: 28,
        backgroundColor: COLORS.softCard,
        overflow: "hidden",
        transform: [
          { scale: isBackCard ? 0.92 : 1 },
          { translateY: isBackCard ? 18 : 0 },
        ],
        opacity: isBackCard ? 0.72 : 1,
        shadowColor: "#000",
        shadowOpacity: isBackCard ? 0.06 : 0.22,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 14 },
        elevation: isBackCard ? 2 : 10,
      }}
    >
      <Image
        source={{ uri: activePhoto }}
        style={{
          width: "100%",
          height: CARD_IMAGE_HEIGHT,
          backgroundColor: COLORS.softBorder,
        }}
      />

      {!isBackCard && photos.length > 1 && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            onPress={goPreviousPhoto}
            style={{
              position: "absolute",
              left: 0,
              top: 60,
              bottom: 120,
              width: "45%",
            }}
          />

          <TouchableOpacity
            activeOpacity={1}
            onPress={goNextPhoto}
            style={{
              position: "absolute",
              right: 0,
              top: 60,
              bottom: 120,
              width: "45%",
            }}
          />

          <View
            style={{
              position: "absolute",
              top: 10,
              left: 18,
              right: 18,
              flexDirection: "row",
              gap: 5,
            }}
          >
            {photos.map((_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor:
                    index === photoIndex
                      ? COLORS.white
                      : "rgba(255,255,255,0.35)",
                }}
              />
            ))}
          </View>
        </>
      )}

      <View
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          display: "none",
          backgroundColor: "rgba(80,201,194,0.92)",
          paddingHorizontal: 13,
          paddingVertical: 8,
          borderRadius: 999,
          maxWidth: "58%",
        }}
      >
        <Text numberOfLines={1} style={{ color: COLORS.white, fontWeight: "900" }}>
          🔥 {getVibeText(user)}
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          display: "none",
          backgroundColor: "rgba(255,255,255,0.95)",
          paddingHorizontal: 13,
          paddingVertical: 8,
          borderRadius: 999,
        }}
      >
        <Text style={{ color: COLORS.darkBlueGray, fontWeight: "900" }}>
          {distance !== null
            ? distance < 1
              ? "📍 < 1 km"
              : `📍 ${distance} km`
            : "📍 Nearby"}
        </Text>
      </View>

      <LinearGradient
        colors={[
          "transparent",
          "rgba(91,105,118,0.35)",
          "rgba(91,105,118,0.92)",
        ]}
        locations={[0, 0.34, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 22,
          paddingTop: 110,
        }}
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
            style={{ fontSize: 36, fontWeight: "900", color: COLORS.white }}
          >
            {user.name || "No name"}
            {user.age ? `, ${user.age}` : ""}
          </Text>

          {user?.verified && (
            <View
              style={{
                marginLeft: 10,
                backgroundColor: COLORS.rose,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontWeight: "900",
                  fontSize: 12,
                }}
              >
                ✓ VERIFIED
              </Text>
            </View>
          )}
        </View>

        <OnlineStatus user={user} />

        {distance !== null && (
          <Text
            style={{
              color: COLORS.white,
              marginTop: 8,
              fontWeight: "800",
              fontSize: 14,
            }}
          >
            {distance < 1
              ? "Less than 1 km away"
              : `${distance} km away from you`}
          </Text>
        )}

        {user.vibePlan ? (
          <Text
            numberOfLines={2}
            style={{
              color: COLORS.white,
              marginTop: 10,
              fontSize: 15,
              lineHeight: 21,
              fontWeight: "700",
            }}
          >
            {user.vibePlan}
          </Text>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
            gap: 8,
          }}
        >
          <Text style={tagStyle}>{user.intent || "No intent"}</Text>
          <Text style={tagStyle}>{user.mood || "No mood"}</Text>
          <Text style={tagStyle}>{user.activity || "No activity"}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function DiscoverScreen() {
  const [allActiveUsers, setAllActiveUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myLocation, setMyLocation] = useState(null);
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [matchedUser, setMatchedUser] = useState(null);
  const [lastSwipedIndex, setLastSwipedIndex] = useState(null);
  const [matchType, setMatchType] = useState("yeah");
  const [myProfile, setMyProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [moveVisible, setMoveVisible] = useState(false);
  const [vibeFallbackText, setVibeFallbackText] = useState("");
  const [preferenceFallbackText, setPreferenceFallbackText] = useState("");
  const [draftCulturalPreference, setDraftCulturalPreference] = useState("any");
  const [draftPreferredCultureCountry, setDraftPreferredCultureCountry] =
    useState("");
  const [savingFilters, setSavingFilters] = useState(false);

  const isMountedRef = useRef(true);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    isMountedRef.current = true;

    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadUsers = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setIsLoading(true);
      }

      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      const currentUserId = auth.currentUser.uid;
      const currentUserProfilePromise = getUserProfile(currentUserId);
      const blockedUserIdsPromise = getMyBlockedUserIds(currentUserId);
      const currentUserProfile = await currentUserProfilePromise;
      const mySavedLocation = currentUserProfile?.location || null;
      const currentVibeKey = getUserVibeKey(currentUserProfile);
      const matchedUserIdsPromise = getMyMatchIds(
        currentUserId,
        currentVibeKey
      ).catch((error) => {
        console.log("Discover match filter skipped:", error.message);
        return [];
      });
      const queryRadius =
        selectedRadius === null ? null : Math.max(selectedRadius, 50);
      const [candidateUsers, blockedUserIds, matchedUserIds] = await Promise.all([
        getDiscoverCandidates({
          currentUserId,
          centerLocation: mySavedLocation,
          radiusKm: queryRadius,
          limitCount: selectedRadius === null ? 100 : 80,
        }),
        blockedUserIdsPromise,
        matchedUserIdsPromise,
      ]);

      if (!isMountedRef.current) return;

      setMyLocation(mySavedLocation);
      setMyProfile(currentUserProfile || null);

      const baseActiveUsers = candidateUsers.filter(
        (user) =>
          user?.id !== currentUserId &&
          !blockedUserIds.includes(user?.id) &&
          !matchedUserIds.includes(user?.id) &&
          user?.currentVibe &&
          isVibeActive(user)
      );

      const preferredActiveUsers = baseActiveUsers.filter(
        (user) =>
          matchesCulturalPreference(user, currentUserProfile) &&
          matchesGenderPreference(user, currentUserProfile)
      );

      const activeUsers =
        preferredActiveUsers.length > 0 ? preferredActiveUsers : baseActiveUsers;

      console.log("Discover counts", {
        candidates: candidateUsers.length,
        baseActive: baseActiveUsers.length,
        preferredActive: preferredActiveUsers.length,
        blocked: blockedUserIds.length,
        matched: matchedUserIds.length,
        radius: selectedRadius,
      });

      setPreferenceFallbackText(
        preferredActiveUsers.length === 0 && baseActiveUsers.length > 0
          ? "Your preferences are hiding active vibes, so we are showing nearby active vibes instead."
          : ""
      );

      const sortedUsers = sortUsersByVibeThenDistance(
        activeUsers,
        mySavedLocation,
        currentUserProfile
      );

      setAllActiveUsers(sortedUsers);
    } catch (error) {
      showError("Discover error", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [selectedRadius]);

  useFocusEffect(
    useCallback(() => {
      if (!auth.currentUser) {
        router.replace("/login");
        return undefined;
      }

      loadUsers(false);
      return undefined;
    }, [loadUsers])
  );

  const resetCardPosition = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [translateX, translateY]);

  const openFilters = () => {
    setDraftCulturalPreference(myProfile?.culturalPreference || "any");
    setDraftPreferredCultureCountry(myProfile?.preferredCultureCountry || "");
    setFilterVisible(true);
  };

  const applyFilters = async () => {
    try {
      if (!auth.currentUser?.uid) return;
      if (savingFilters) return;

      const normalizedCountry = normalizeCountryName(
        draftPreferredCultureCountry
      );

      if (draftCulturalPreference === "specific" && !normalizedCountry) {
        Alert.alert(
          "Invalid country",
          "Please enter a real country name for the background filter."
        );
        return;
      }

      setSavingFilters(true);

      const updatedPreference = {
        culturalPreference: draftCulturalPreference || "any",
        preferredCultureCountry:
          draftCulturalPreference === "specific" ? normalizedCountry : "",
      };

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        updatedPreference,
        { merge: true }
      );

      setMyProfile((prev) => ({
        ...(prev || {}),
        ...updatedPreference,
      }));

      setFilterVisible(false);
      await loadUsers(false);
    } catch (error) {
      showError("Filter error", error);
    } finally {
      setSavingFilters(false);
    }
  };

  const applyRadiusFilter = useCallback(() => {
    let result = Array.isArray(allActiveUsers) ? allActiveUsers : [];
    const noticeParts = [];

    if (preferenceFallbackText) {
      noticeParts.push(preferenceFallbackText);
    }

    if (selectedRadius !== null && myLocation) {
      const usersWithinRadius = result.filter((user) => {
        const distance = getDistanceKm(myLocation, user?.location);
        return distance !== null && distance <= selectedRadius;
      });

      const usersWithoutDistance = result.filter(
        (user) => getDistanceKm(myLocation, user?.location) === null
      );

      if (usersWithinRadius.length > 0) {
        result = usersWithinRadius;
      } else if (result.length > 0) {
        result = sortUsersByVibeThenDistance(result, myLocation, myProfile);
        noticeParts.push(
          `No active vibes within ${selectedRadius} km. Showing the closest active vibes instead.`
        );
      } else {
        result = usersWithoutDistance;
      }
    }

    result = sortUsersByVibeThenDistance(result, myLocation, myProfile);

    const myVibeKey = getUserVibeKey(myProfile);

    if (myVibeKey && result.length > 0) {
      const matchingVibes = result.filter(
        (user) => getUserVibeKey(user) === myVibeKey
      );
      const otherVibes = result.filter(
        (user) => getUserVibeKey(user) !== myVibeKey
      );

      if (matchingVibes.length > 0) {
        result = [...matchingVibes, ...otherVibes];
      } else {
        result = otherVibes;
        noticeParts.push(
          `No one nearby is looking for ${formatVibeName(
            myProfile?.activity || myProfile?.currentVibe
          )} right now. Here are other active vibes near you.`
        );
      }
    }

    setVibeFallbackText(noticeParts.join(" "));

    if (!isMountedRef.current) return;

    setUsers(result);
    setCurrentIndex(0);
    setLastSwipedIndex(null);
    resetCardPosition();
  }, [
    allActiveUsers,
    myLocation,
    myProfile,
    preferenceFallbackText,
    resetCardPosition,
    selectedRadius,
  ]);

  useEffect(() => {
    applyRadiusFilter();
  }, [applyRadiusFilter]);

  const nextCard = () => {
    if (!isMountedRef.current) return;

    setLastSwipedIndex(currentIndex);
    setCurrentIndex((prev) => prev + 1);
    setIsSwiping(false);
    resetCardPosition();
  };

  const handleUndo = () => {
    if (lastSwipedIndex === null || isSwiping) return;

    setCurrentIndex(lastSwipedIndex);
    setLastSwipedIndex(null);
    resetCardPosition();
  };

  const getCurrentUserSafe = () => {
    return users[currentIndex] || null;
  };

  const handleJoinPlan = async () => {
    try {
      if (isSwiping) return;

      const user = getCurrentUserSafe();
      if (!user || !auth.currentUser?.uid) return;

      await joinPlan(auth.currentUser.uid, user.id, user);

      const chatId = [auth.currentUser.uid, user.id].sort().join("_");
      const photosParam = getPhotosParam(user);
      const mainPhoto = getUserPhotos(user)[0] || "";

      router.push(
        `/chat?chatId=${encodeURIComponent(chatId)}&name=${encodeURIComponent(
          user.name || "User"
        )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
      );
    } catch (error) {
      showError("Join failed", error);
    }
  };

  const MOVE_OPTIONS = [
    { emoji: "😍", label: "You're cute" },
    { emoji: "🤝", label: "Want to be friends" },
    { emoji: "❤️", label: "I like you" },
    { emoji: "☕", label: "Coffee?" },
    { emoji: "🌙", label: "Let's go out" },
    { emoji: "⭐", label: "Super Yeah" },
  ];

  const handleMakeMove = async (option) => {
    setMoveVisible(false);
    if (option.label === "Super Yeah") {
      swipeSuperYeah();
    } else {
      await handleYeah();
    }
  };

  const handleYeah = async () => {
    try {
      const user = getCurrentUserSafe();
      if (!user || !auth.currentUser?.uid) {
        setIsSwiping(false);
        resetCardPosition();
        return;
      }

      const result = await likeUser(auth.currentUser.uid, user.id);

      if (!isMountedRef.current) return;

      if (result?.matched) {
        await playMatchWhistle();
        setMatchType("yeah");
        setMatchedUser(user);
        setIsSwiping(false);
        return;
      }

      nextCard();
    } catch (error) {
      setIsSwiping(false);
      resetCardPosition();
      showError("Yeah failed", error);
    }
  };

  const handleSuperYeah = async () => {
    try {
      const user = getCurrentUserSafe();
      if (!user || !auth.currentUser?.uid) {
        setIsSwiping(false);
        resetCardPosition();
        return;
      }

      const result = await likeUser(auth.currentUser.uid, user.id);

      if (!isMountedRef.current) return;

      if (result?.matched) {
        await playMatchWhistle();
        setMatchType("super");
        setMatchedUser(user);
        setIsSwiping(false);
        return;
      }

      nextCard();
    } catch (error) {
      setIsSwiping(false);
      resetCardPosition();
      showError("Super Yeah failed", error);
    }
  };

  const handleNah = () => {
    nextCard();
  };

  const swipeYeah = () => {
    if (isSwiping || !getCurrentUserSafe()) return;

    setIsSwiping(true);
    translateX.value = withSpring(SCREEN_WIDTH * 1.4);
    runOnJS(handleYeah)();
  };

  const swipeNah = () => {
    if (isSwiping || !getCurrentUserSafe()) return;

    setIsSwiping(true);
    translateX.value = withSpring(-SCREEN_WIDTH * 1.4);
    runOnJS(handleNah)();
  };

  const swipeSuperYeah = () => {
    if (isSwiping || !getCurrentUserSafe()) return;

    setIsSwiping(true);
    translateY.value = withSpring(-SCREEN_HEIGHT * 1.1);
    runOnJS(handleSuperYeah)();
  };

  const keepSwipingAfterMatch = () => {
    setMatchedUser(null);
    nextCard();
  };

  const startChatWithMatch = () => {
    if (!matchedUser || !auth.currentUser?.uid) return;

    const chatId = [auth.currentUser.uid, matchedUser.id].sort().join("_");
    const userToChat = matchedUser;
    const photosParam = getPhotosParam(userToChat);
    const mainPhoto = getUserPhotos(userToChat)[0] || "";

    setMatchedUser(null);
    nextCard();

    router.push(
      `/chat?chatId=${encodeURIComponent(chatId)}&name=${encodeURIComponent(
        userToChat.name || "User"
      )}&photoURL=${encodeURIComponent(mainPhoto)}&photos=${photosParam}`
    );
  };

  const onGestureEvent = (event) => {
    if (isSwiping || matchedUser) return;

    translateX.value = event.nativeEvent.translationX;
    translateY.value = event.nativeEvent.translationY;
  };

  const onHandlerEnd = () => {
    if (isSwiping || matchedUser || !getCurrentUserSafe()) {
      resetCardPosition();
      return;
    }

    if (translateY.value < -120) {
      setIsSwiping(true);
      translateY.value = withSpring(-SCREEN_HEIGHT * 1.1);
      runOnJS(handleSuperYeah)();
    } else if (translateX.value > 120) {
      setIsSwiping(true);
      translateX.value = withSpring(SCREEN_WIDTH * 1.4);
      runOnJS(handleYeah)();
    } else if (translateX.value < -120) {
      setIsSwiping(true);
      translateX.value = withSpring(-SCREEN_WIDTH * 1.4);
      runOnJS(handleNah)();
    } else {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-18, 0, 18]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const yeahLabelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [30, 130],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ rotate: "-14deg" }],
    };
  });

  const nahLabelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-130, -30],
      [1, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ rotate: "14deg" }],
    };
  });

  const superYeahLabelStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [-140, -40],
      [1, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: 1.05 }],
    };
  });

  const currentUser = users[currentIndex] || null;
  const nextUser = users[currentIndex + 1] || null;
  const visibleSimilarUsers = users.slice(currentIndex, currentIndex + 6);

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{
        flex: 1,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingTop: 58,
          paddingBottom: 12,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => loadUsers(true)}
            tintColor={COLORS.rose}
            colors={[COLORS.rose, COLORS.teal]}
          />
        }
      >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 34,
            fontWeight: "900",
            color: COLORS.black,
          }}
        >
          Discover
        </Text>

        <TouchableOpacity
          onPress={openFilters}
          disabled={isLoading}
          style={{
            backgroundColor: COLORS.softCard,
            borderRadius: 18,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: COLORS.softBorder,
            opacity: isLoading ? 0.65 : 1,
            shadowColor: "#9FB0CC",
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 2,
          }}
        >
          <Ionicons name="options-outline" size={22} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      <Text style={{ color: COLORS.darkBlueGray, marginTop: 5, fontSize: 15 }}>
        {vibeFallbackText ? "Other nearby vibes" : "Similar vibes first"}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ display: "none", marginTop: 14, maxHeight: 44 }}
      >
        {RADIUS_OPTIONS.map((option) => (
          <RadiusChip
            key={option.label}
            label={option.label}
            selected={selectedRadius === option.value}
            onPress={() => setSelectedRadius(option.value)}
          />
        ))}
      </ScrollView>

      <SimilarVibesRow users={visibleSimilarUsers} />

      {!!vibeFallbackText && (
        <View
          style={{
            marginTop: 14,
            backgroundColor: COLORS.blueSoft,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(47,128,255,0.32)",
            padding: 14,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontSize: 14,
              fontWeight: "800",
              lineHeight: 20,
            }}
          >
            {vibeFallbackText}
          </Text>
        </View>
      )}

      <Text style={{ display: "none", color: COLORS.darkBlueGray, marginTop: 8, fontSize: 13 }}>
        Showing {users.length} active vibe{users.length === 1 ? "" : "s"}
      </Text>

      <Text style={{ display: "none", color: COLORS.darkBlueGray, marginTop: 4, fontSize: 13 }}>
        {getCulturalPreferenceText(myProfile)}
      </Text>

      {hasMyActiveVibe(myProfile) ? (
        <View
          style={{
            display: "none",
            marginTop: 14,
            backgroundColor: COLORS.rose,
            borderRadius: 28,
            padding: 18,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontSize: 20,
              fontWeight: "900",
            }}
          >
            Your vibe is active
          </Text>

          <Text
            style={{
              color: COLORS.white,
              marginTop: 8,
              lineHeight: 21,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {myProfile?.currentVibe || "Your vibe"} is now visible to other
            people. Discover only shows other users, not your own profile.
          </Text>
        </View>
      ) : (
        <View
          style={{
            display: "none",
            marginTop: 14,
            backgroundColor: COLORS.darkBlueGray,
            borderRadius: 28,
            padding: 18,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontSize: 20,
              fontWeight: "900",
            }}
          >
            You’re browsing quietly 👀
          </Text>

          <Text
            style={{
              color: "#e2e8f0",
              marginTop: 8,
              lineHeight: 21,
              fontSize: 14,
            }}
          >
            Set your vibe so people around you can discover your plans too.
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/")}
            style={{
              marginTop: 16,
              backgroundColor: COLORS.softCard,
              paddingVertical: 13,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: COLORS.darkBlueGray,
                fontWeight: "900",
                fontSize: 15,
              }}
            >
              Choose My Vibe 🔥
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1, justifyContent: "center" }}>
        {!currentUser ? (
          <View
            style={{
              backgroundColor: COLORS.softCard,
              padding: 24,
              borderRadius: 28,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              shadowColor: "#8EA4C8",
              shadowOpacity: 0.1,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: COLORS.pinkSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Ionicons
                name={isLoading ? "hourglass-outline" : "options-outline"}
                size={25}
                color={COLORS.rose}
              />
            </View>

            <Text style={{ fontSize: 24, fontWeight: "900", color: COLORS.black }}>
              {isLoading ? "Loading nearby vibes..." : "No active vibes found"}
            </Text>

            {!isLoading && (
              <Text
                style={{
                  color: COLORS.darkBlueGray,
                  marginTop: 10,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                {vibeFallbackText
                  ? vibeFallbackText
                  : (myProfile?.culturalPreference || "any") !== "any"
                  ? "Your cultural background filter may be hiding active vibes. Open filters and choose Open to all backgrounds to see more people."
                  : "Try a larger radius or wait for someone nearby to set a vibe."}
              </Text>
            )}

            {!isLoading && (
              <>
                <TouchableOpacity
                  onPress={openFilters}
                  activeOpacity={0.86}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    backgroundColor: COLORS.rose,
                    borderRadius: 999,
                    paddingVertical: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={COLORS.white}
                  />
                  <Text
                    style={{
                      color: COLORS.white,
                      marginLeft: 7,
                      fontWeight: "900",
                      fontSize: 15,
                    }}
                  >
                    Open Filters
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/home")}
                  activeOpacity={0.86}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    backgroundColor: COLORS.blueSoft,
                    borderRadius: 999,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.teal,
                      fontWeight: "900",
                      fontSize: 15,
                    }}
                  >
                    Set or Refresh My Vibe
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <>
            {nextUser && (
              <View style={{ position: "absolute", width: "100%", top: 32 }}>
                <ProfileCard
                  user={nextUser}
                  myLocation={myLocation}
                  isBackCard
                />
              </View>
            )}

            <PanGestureHandler
              enabled={!isSwiping && !matchedUser}
              onGestureEvent={onGestureEvent}
              onEnded={onHandlerEnd}
            >
              <Animated.View style={cardStyle}>
                <View>
                  <ProfileCard user={currentUser} myLocation={myLocation} />

                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        top: 70,
                        left: 30,
                        borderWidth: 4,
                        borderColor: COLORS.rose,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        backgroundColor: "rgba(255,255,255,0.86)",
                      },
                      yeahLabelStyle,
                    ]}
                  >
                    <Text
                      style={{
                        color: COLORS.rose,
                        fontSize: 34,
                        fontWeight: "900",
                      }}
                    >
                      YEAH
                    </Text>
                  </Animated.View>

                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        top: 70,
                        right: 30,
                        borderWidth: 4,
                        borderColor: COLORS.darkBlueGray,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        backgroundColor: "rgba(255,255,255,0.86)",
                      },
                      nahLabelStyle,
                    ]}
                  >
                    <Text
                      style={{
                        color: COLORS.darkBlueGray,
                        fontSize: 34,
                        fontWeight: "900",
                      }}
                    >
                      NAH
                    </Text>
                  </Animated.View>

                  <Animated.View
                    style={[
                      {
                        position: "absolute",
                        top: 42,
                        alignSelf: "center",
                        borderWidth: 4,
                        borderColor: COLORS.teal,
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        paddingVertical: 7,
                        backgroundColor: "rgba(255,255,255,0.86)",
                      },
                      superYeahLabelStyle,
                    ]}
                  >
                    <Text
                      style={{
                        color: COLORS.teal,
                        fontSize: 27,
                        fontWeight: "900",
                      }}
                    >
                      SUPER YEAH ⭐
                    </Text>
                  </Animated.View>
                </View>
              </Animated.View>
            </PanGestureHandler>
          </>
        )}
      </View>

      {currentUser && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            paddingBottom: 18,
            paddingHorizontal: 20,
            opacity: isSwiping ? 0.6 : 1,
          }}
        >
          <TouchableOpacity
            onPress={swipeNah}
            disabled={isSwiping}
            style={actionButton}
          >
            <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.darkBlueGray }}>
              X
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMoveVisible(true)}
            disabled={isSwiping}
            style={{
              flex: 1,
              height: 58,
              borderRadius: 999,
              backgroundColor: COLORS.rose,
              justifyContent: "center",
              alignItems: "center",
              shadowColor: COLORS.rose,
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "900", color: COLORS.white }}>
              Make a Move 🔥
            </Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>

      <Modal
        transparent
        visible={filterVisible}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: "900", color: COLORS.black }}>
              Filters
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 6,
                lineHeight: 21,
                fontWeight: "700",
              }}
            >
              {getCulturalPreferenceText(myProfile)}
            </Text>

            <Text
              style={{
                marginTop: 20,
                marginBottom: 12,
                fontSize: 17,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              Cultural background
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CULTURAL_OPTIONS.map((option) => (
                <RadiusChip
                  key={option.value}
                  label={option.label}
                  selected={draftCulturalPreference === option.value}
                  onPress={() => setDraftCulturalPreference(option.value)}
                />
              ))}
            </View>

            {draftCulturalPreference === "specific" ? (
              <TextInput
                value={draftPreferredCultureCountry}
                onChangeText={setDraftPreferredCultureCountry}
                placeholder="India, Australia, United States..."
                placeholderTextColor="#8b98a5"
                style={{
                  marginTop: 12,
                  backgroundColor: COLORS.background,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  color: COLORS.black,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              />
            ) : null}

            <Text
              style={{
                marginTop: 20,
                marginBottom: 12,
                fontSize: 17,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              Distance
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {RADIUS_OPTIONS.map((option) => (
                <RadiusChip
                  key={option.label}
                  label={option.label}
                  selected={selectedRadius === option.value}
                  onPress={() => setSelectedRadius(option.value)}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={applyFilters}
              disabled={savingFilters}
              style={{
                marginTop: 24,
                backgroundColor: savingFilters ? "#94a3b8" : COLORS.rose,
                borderRadius: 999,
                paddingVertical: 15,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 16 }}>
                {savingFilters ? "Saving..." : "Apply Filters"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                marginTop: 12,
                backgroundColor: COLORS.elevatedCard,
                borderRadius: 999,
                paddingVertical: 15,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.black, fontWeight: "900", fontSize: 16 }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={moveVisible}
        animationType="slide"
        onRequestClose={() => setMoveVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.black, marginBottom: 6 }}>
              Make a Move 🔥
            </Text>
            <Text style={{ color: COLORS.darkBlueGray, fontWeight: "700", marginBottom: 20 }}>
              What's your vibe with {currentUser?.name || "this person"}?
            </Text>

            {MOVE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.label}
                onPress={() => handleMakeMove(option)}
                activeOpacity={0.82}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: COLORS.background,
                  borderRadius: 18,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                }}
              >
                <Text style={{ fontSize: 26, marginRight: 14 }}>{option.emoji}</Text>
                <Text style={{ fontSize: 17, fontWeight: "800", color: COLORS.black }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setMoveVisible(false)}
              style={{
                marginTop: 6,
                backgroundColor: COLORS.elevatedCard,
                borderRadius: 999,
                paddingVertical: 15,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.black, fontWeight: "900", fontSize: 16 }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={!!matchedUser} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.82)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 34,
              padding: 24,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: "900", color: COLORS.black }}>
              {matchType === "super" ? "Super Match ⭐" : "It’s a Match 🔥"}
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                fontSize: 16,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              You and {matchedUser?.name || "this person"} both said{" "}
              {matchType === "super" ? "Super Yeah" : "Yeah"}.
            </Text>

            <TouchableOpacity
              onPress={startChatWithMatch}
              style={{
                marginTop: 26,
                width: "100%",
                backgroundColor: COLORS.rose,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: "900" }}>
                Start Chat 💬
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={keepSwipingAfterMatch}
              style={{
                marginTop: 12,
                width: "100%",
                backgroundColor: COLORS.pinkSoft,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.darkBlueGray, fontSize: 16, fontWeight: "900" }}>
                Keep Swiping
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const actionButton = {
  width: 58,
  height: 58,
  borderRadius: 29,
  backgroundColor: COLORS.softCard,
  justifyContent: "center",
  alignItems: "center",
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 4,
};

const tagStyle = {
  backgroundColor: "rgba(255,255,255,0.2)",
  color: COLORS.white,
  paddingHorizontal: 10,
  paddingVertical: 7,
  borderRadius: 999,
  fontWeight: "800",
  overflow: "hidden",
};
