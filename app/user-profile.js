import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc } from "firebase/firestore";

import COLORS from "../constants/colors";
import { db, auth } from "../firebaseConfig";
import { blockUser, getMyMatchIds, reportUser } from "../services/userService";
import { isCliqzeePlusActive } from "../services/subscriptionService";

function getParamString(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

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

function getPhotos(user) {
  if (Array.isArray(user?.photos) && user.photos.length > 0) {
    return user.photos.filter(Boolean);
  }

  if (user?.photoURL) {
    return [user.photoURL];
  }

  return ["https://picsum.photos/500"];
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const userId = getParamString(params.userId);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [canViewFullProfile, setCanViewFullProfile] = useState(false);

  const loadUserProfile = useCallback(async () => {
    try {
      if (!userId) {
        Alert.alert("Error", "Missing user profile.");
        router.back();
        return;
      }

      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        router.replace("/login");
        return;
      }

      const [snap, matchIds, plusActive] = await Promise.all([
        getDoc(doc(db, "users", userId)),
        getMyMatchIds(currentUserId).catch(() => []),
        isCliqzeePlusActive(currentUserId).catch(() => false),
      ]);

      if (!snap.exists()) {
        Alert.alert("Not found", "User profile not found.");
        router.back();
        return;
      }

      setUser({
        id: snap.id,
        ...snap.data(),
      });
      setCanViewFullProfile(
        currentUserId === snap.id || plusActive || matchIds.includes(snap.id)
      );
    } catch (error) {
      Alert.alert("Profile error", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleBlockUser = async () => {
    try {
      if (!auth.currentUser?.uid || !user?.id) return;

      await blockUser(auth.currentUser.uid, user.id);

      Alert.alert("User blocked", "You will no longer see this user.");

      router.back();
    } catch (error) {
      Alert.alert("Block failed", error?.message || "Something went wrong.");
    }
  };

  const handleReportUser = async () => {
    try {
      if (!auth.currentUser?.uid || !user?.id) return;

      await reportUser(auth.currentUser.uid, user.id, "Inappropriate behavior");

      Alert.alert(
        "User reported",
        "Thanks for helping keep the community safe."
      );
    } catch (error) {
      Alert.alert("Report failed", error?.message || "Something went wrong.");
    }
  };

  const handleUpgradePress = () => {
    router.push("/plus");
  };

  const photos = getPhotos(user);
  const activePhoto = photos[photoIndex] || photos[0];
  const activeVibe = isVibeActive(user);

  const goPreviousPhoto = () => {
    if (photos.length <= 1) return;

    setPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goNextPhoto = () => {
    if (photos.length <= 1) return;

    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.mint, COLORS.background]}
        style={{
          flex: 1,
          justifyContent: "center",
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
          Loading profile...
        </Text>
      </LinearGradient>
    );
  }

  if (!user) return null;

  if (!canViewFullProfile) {
    return (
      <LinearGradient
        colors={[COLORS.background, COLORS.mint, COLORS.background]}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View>
            <Image
              source={{ uri: activePhoto }}
              blurRadius={16}
              style={{
                width: "100%",
                height: 500,
                backgroundColor: "#dbe3ea",
              }}
            />

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                position: "absolute",
                top: 50,
                left: 18,
                backgroundColor: "rgba(0,0,0,0.7)",
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                {"<"}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              marginTop: -34,
              backgroundColor: COLORS.background,
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              padding: 22,
            }}
          >
            <Text
              style={{ color: COLORS.black, fontSize: 34, fontWeight: "900" }}
            >
              {user.name || "User"}
              {user.age ? `, ${user.age}` : ""}
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 8,
                lineHeight: 22,
                fontWeight: "700",
              }}
            >
              Connect first or unlock Cliqzee Plus to view the full profile.
            </Text>

            {activeVibe ? (
              <View
                style={{
                  marginTop: 18,
                  backgroundColor: COLORS.softCard,
                  borderRadius: 24,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.softBorder,
                }}
              >
                <Text
                  style={{
                    color: COLORS.black,
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  Current vibe
                </Text>

                <Text
                  style={{
                    color: COLORS.darkBlueGray,
                    marginTop: 6,
                    fontWeight: "700",
                  }}
                >
                  {user.currentVibe}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleUpgradePress}
              style={{
                marginTop: 22,
                backgroundColor: COLORS.rose,
                borderRadius: 999,
                paddingVertical: 16,
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
                Unlock with Cliqzee Plus
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginTop: 12,
                backgroundColor: COLORS.softCard,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.softBorder,
              }}
            >
              <Text
                style={{
                  color: COLORS.black,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                Keep Discovering
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View>
        <Image
          source={{ uri: activePhoto }}
          style={{
            width: "100%",
            height: 520,
            backgroundColor: "#dbe3ea",
          }}
        />

        {photos.length > 1 && (
          <>
            <TouchableOpacity
              onPress={goPreviousPhoto}
              activeOpacity={1}
              style={{
                position: "absolute",
                left: 0,
                top: 80,
                bottom: 80,
                width: "45%",
              }}
            />

            <TouchableOpacity
              onPress={goNextPhoto}
              activeOpacity={1}
              style={{
                position: "absolute",
                right: 0,
                top: 80,
                bottom: 80,
                width: "45%",
              }}
            />

            <View
              style={{
                position: "absolute",
                top: 58,
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
                        : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: "absolute",
            top: 50,
            left: 18,
            backgroundColor: "rgba(0,0,0,0.7)",
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: COLORS.white, fontSize: 24, fontWeight: "900" }}
          >
            ‹
          </Text>
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={[COLORS.background, COLORS.mint, COLORS.background]}
        style={{
          marginTop: -34,
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          padding: 22,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Text style={{ fontSize: 36, fontWeight: "900", color: COLORS.black }}>
            {user.name || "User"}
            {user.age ? `, ${user.age}` : ""}
          </Text>

          {user?.verified && (
            <View
              style={{
                marginLeft: 10,
                backgroundColor: COLORS.teal,
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
                VERIFIED
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: user.isOnline ? COLORS.lime : "#aaa",
              marginRight: 7,
            }}
          />

          <Text
            style={{
              color: user.isOnline ? COLORS.lime : "#777",
              fontWeight: "900",
            }}
          >
            {user.isOnline ? "Online now" : "Offline"}
          </Text>
        </View>

        {activeVibe && (
          <View
            style={{
              marginTop: 18,
              backgroundColor: COLORS.teal,
              borderRadius: 24,
              padding: 16,
            }}
          >
            <Text
              style={{ color: COLORS.white, fontSize: 18, fontWeight: "900" }}
            >
              Current vibe
            </Text>

            <Text
              style={{
                color: "rgba(255,255,255,0.88)",
                marginTop: 6,
                fontWeight: "700",
              }}
            >
              {user.currentVibe}
            </Text>

            {user.vibePlan ? (
              <Text
                style={{
                  color: COLORS.white,
                  marginTop: 10,
                  lineHeight: 21,
                }}
              >
                {user.vibePlan}
              </Text>
            ) : null}
          </View>
        )}

        <InfoCard title="Bio" value={user.bio || "No bio added yet."} />
        <InfoCard title="Gender" value={user.gender || "No gender added."} />
        <InfoCard
          title="Interested in"
          value={user.interestedIn || user.interests || "No preference added."}
        />
        <InfoCard
          title="Country of birth"
          value={user.bornCountry || "No country added yet."}
        />
        <InfoCard title="Intent" value={user.intent || "No intent added."} />

        <View style={{ marginTop: 28 }}>
          <TouchableOpacity
            onPress={handleBlockUser}
            style={{
              backgroundColor: COLORS.teal,
              borderRadius: 999,
              paddingVertical: 16,
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
              Block User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReportUser}
            style={{
              marginTop: 12,
              backgroundColor: COLORS.rose,
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.rose,
            }}
          >
            <Text
              style={{
                color: COLORS.white,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              Report User
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

function InfoCard({ title, value }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.softCard,
        borderRadius: 24,
        padding: 18,
        marginTop: 16,
        borderWidth: 1,
        borderColor: "#dbe3ea",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.black }}>
        {title}
      </Text>

      <Text
        style={{
          color: COLORS.darkBlueGray,
          marginTop: 8,
          fontSize: 15,
          lineHeight: 22,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
