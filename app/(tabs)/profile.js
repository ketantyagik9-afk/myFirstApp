import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  View,
  Text,
  ScrollView,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";

import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "../../firebaseConfig";
import { normalizeCountryName } from "../../constants/countries";
import {
  updateUserLocation,
  updateUserOnlineStatus,
  getMyBlockedUserIds,
  unblockUser,
  createSupportRequest,
  createDataDeletionRequest,
  markAccountForDeletion,
  isCurrentUserAdmin,
  requestPhotoVerification,
  uploadProfilePhoto,
} from "../../services/userService";

function cleanText(value) {
  return (value || "").trim();
}

function parseAge(value) {
  const cleanValue = cleanText(value);
  if (!/^\d+$/.test(cleanValue)) return NaN;
  return Number(cleanValue);
}

const INTERESTED_IN_OPTIONS = [
  "Men",
  "Women",
  "Other",
  "Prefer not to say",
];

const INTENT_OPTIONS = [
  { label: "Dating", value: "dating" },
  { label: "Friends", value: "friends" },
  { label: "Relationship", value: "relationship" },
  { label: "Casual", value: "casual" },
  { label: "Open to see", value: "open to see" },
];

const GENDER_OPTIONS = [
  "Man",
  "Woman",
  "Other",
  "Prefer not to say",
];

const SUPPORT_TOPICS = [
  {
    label: "Login",
    answer:
      "Check that your email and password are correct. If you forgot your password, use the reset option on the login screen.",
  },
  {
    label: "Profile",
    answer:
      "You can update your photos, gender, intent, and country of birth from this Profile tab. Cultural background filters are now in Discover.",
  },
  {
    label: "Safety",
    answer:
      "If someone makes you uncomfortable, open their profile and use Block User or Report User. Blocked users cannot contact you.",
  },
  {
    label: "Payments",
    answer:
      "Paid features are not fully live yet. If you see a payment issue during testing, send it to support and we will review it.",
  },
  {
    label: "Bug",
    answer:
      "For bugs, describe what happened, what screen you were on, and what you expected instead.",
  },
  {
    label: "Other",
    answer:
      "Tell us what you need help with and support will review your request.",
  },
];

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [blockedUsersVisible, setBlockedUsersVisible] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [selectedSupportTopic, setSelectedSupportTopic] = useState(
    SUPPORT_TOPICS[0]
  );
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    interestedIn: "",
    gender: "",
    bornCountry: "",
    intent: "",
    culturalPreference: "any",
    preferredCultureCountry: "",
    photoURL: "",
    photos: [],
    bio: "",
    verified: false,
    verificationStatus: "",
    verificationPhotoURL: "",
    photoVisibility: "everyone",
  });
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(20))[0];

  const loadProfile = useCallback(async () => {
    try {
      setIsAdmin(false);

      const currentUserId = auth.currentUser?.uid;

      if (!currentUserId) {
        router.replace("/login");
        return;
      }

      const userRef = doc(db, "users", currentUserId);
      const snap = await getDoc(userRef);

      if (!snap.exists()) return;

      const data = snap.data() || {};

      const safePhotos =
        Array.isArray(data.photos) && data.photos.length > 0
          ? data.photos.filter(Boolean)
          : data.photoURL
          ? [data.photoURL]
          : [];

      if (auth.currentUser?.uid !== currentUserId) return;

      setProfile({
        name: data.name || "",
        age: data.age ? String(data.age) : "",
        interestedIn: data.interestedIn || data.interests || "",
        gender: data.gender || "",
        bornCountry: data.bornCountry || "",
        intent: data.intent || "",
        culturalPreference: data.culturalPreference || "any",
        preferredCultureCountry: data.preferredCultureCountry || "",
        photoURL: data.photoURL || "",
        photos: safePhotos,
        bio: data.bio || "",
        verified: !!data.verified,
        verificationStatus: data.verificationStatus || "",
        verificationPhotoURL: data.verificationPhotoURL || "",
        photoVisibility: data.photoVisibility || "everyone",
      });

      const adminCheck = await isCurrentUserAdmin(currentUserId);

      if (auth.currentUser?.uid === currentUserId) {
        setIsAdmin(adminCheck);
      }
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestAndSaveLocation = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") return;

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = currentLocation?.coords?.latitude;
      const longitude = currentLocation?.coords?.longitude;

      if (typeof latitude !== "number" || typeof longitude !== "number") return;

      await updateUserLocation(auth.currentUser.uid, latitude, longitude);
    } catch (error) {
      console.log("Location error:", error.message);
    }
  }, []);

  const startProfileScreen = useCallback(async () => {
    await loadProfile();
    requestAndSaveLocation();
  }, [loadProfile, requestAndSaveLocation]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(false);

      if (!user?.uid) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      setLoading(true);
      startProfileScreen();
    });

    return unsubscribe;
  }, [startProfileScreen]);

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
        speed: 14,
        bounciness: 7,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const updateField = (key, value) => {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const pickImage = async () => {
  try {
    if (!auth.currentUser?.uid) return;

    if (profile.photos.length >= 6) {
      Alert.alert("Limit reached", "Maximum 6 photos allowed.");
      return;
    }

    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Photo library permission is required."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) return;

    const imageUri = result.assets?.[0]?.uri;

    if (!imageUri) return;

    Alert.alert("Uploading...", "Please wait while photo uploads.");

    const uploadedPhotoURL = await uploadProfilePhoto(
      auth.currentUser.uid,
      imageUri
    );

    setProfile((prev) => ({
      ...prev,
      photoURL: prev.photoURL || uploadedPhotoURL,
      photos: [...prev.photos, uploadedPhotoURL],
    }));

    Alert.alert("Uploaded ✅", "Photo uploaded successfully.");
  } catch (error) {
    Alert.alert(
      "Upload failed",
      error?.message || "Could not upload image."
    );
  }
};

  const removePhoto = (index) => {
    const updated = [...profile.photos];
    updated.splice(index, 1);

    setProfile((prev) => ({
      ...prev,
      photos: updated,
      photoURL: updated[0] || "",
    }));
  };

  const openBlockedUsers = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const blockedIds = await getMyBlockedUserIds(auth.currentUser.uid);
      const users = [];

      for (const blockedUserId of blockedIds) {
        const userSnap = await getDoc(doc(db, "users", blockedUserId));

        if (userSnap.exists()) {
          users.push({
            id: userSnap.id,
            ...userSnap.data(),
          });
        }
      }

      setBlockedUsers(users);
      setBlockedUsersVisible(true);
    } catch (error) {
      Alert.alert(
        "Blocked users error",
        error?.message || "Could not load blocked users."
      );
    }
  };

  const handleUnblock = async (targetUserId) => {
    try {
      if (!auth.currentUser?.uid || !targetUserId) return;

      await unblockUser(auth.currentUser.uid, targetUserId);

      setBlockedUsers((prev) =>
        prev.filter((user) => user.id !== targetUserId)
      );

      Alert.alert("Unblocked ✅", "User has been unblocked.");
    } catch (error) {
      Alert.alert("Unblock failed", error?.message || "Something went wrong.");
    }
  };

  const handleVerificationRequest = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const mainPhoto = profile.photos?.[0] || profile.photoURL || "";

      await requestPhotoVerification(auth.currentUser.uid, mainPhoto);

      Alert.alert(
        "Verification requested ✅",
        "Your main profile photo has been sent for admin review."
      );

      await loadProfile();
    } catch (error) {
      Alert.alert(
        "Verification failed",
        error?.message || "Could not request verification."
      );
    }
  };

  const handleDataDeletionRequest = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      await createDataDeletionRequest(
        auth.currentUser.uid,
        auth.currentUser.email || ""
      );

      Alert.alert(
        "Request submitted",
        "Your data deletion request has been saved."
      );
    } catch (error) {
      Alert.alert(
        "Request failed",
        error?.message || "Could not submit deletion request."
      );
    }
  };

  const handleSupportRequest = async () => {
    try {
      if (!auth.currentUser?.uid) return;
      if (supportSubmitting) return;

      setSupportSubmitting(true);

      await createSupportRequest(
        auth.currentUser.uid,
        auth.currentUser.email || "",
        selectedSupportTopic?.label || "Other",
        cleanText(supportMessage)
      );

      Alert.alert(
        "Support request sent",
        "We saved your request for review."
      );

      setSupportMessage("");
      setSupportVisible(false);
    } catch (error) {
      Alert.alert(
        "Support failed",
        error?.message || "Could not send support request."
      );
    } finally {
      setSupportSubmitting(false);
    }
  };

  const handleAccountDeletionRequest = async () => {
    Alert.alert(
      "Delete account?",
      "This will request account deletion and mark your account for removal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request deletion",
          style: "destructive",
          onPress: async () => {
            try {
              if (!auth.currentUser?.uid) return;

              await markAccountForDeletion(
                auth.currentUser.uid,
                auth.currentUser.email || ""
              );

              Alert.alert(
                "Deletion requested",
                "Your account deletion request has been saved."
              );

              router.replace("/login");
            } catch (error) {
              Alert.alert(
                "Deletion failed",
                error?.message || "Could not request account deletion."
              );
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      if (auth.currentUser?.uid) {
        await updateUserOnlineStatus(auth.currentUser.uid, false);
      }

      await signOut(auth);

      router.replace("/login");
    } catch (error) {
      console.log("Logout error:", error.message);
      Alert.alert("Logout failed", error?.message || "Could not log out.");
    }
  };

  const saveProfile = async () => {
    try {
      if (!auth.currentUser?.uid) return;
      if (saving) return;

      const cleanName = cleanText(profile.name);
      const cleanAge = cleanText(profile.age);
      const parsedAge = parseAge(cleanAge);
      const cleanBornCountry = cleanText(profile.bornCountry);
      const validBornCountry = normalizeCountryName(cleanBornCountry);

      if (!cleanName) {
        Alert.alert("Missing name", "Please enter your name.");
        return;
      }

      if (Number.isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
        Alert.alert(
          "Invalid age",
          "Please enter a valid age between 18 and 100."
        );
        return;
      }

      if (!validBornCountry) {
        Alert.alert(
          "Invalid country",
          "Please enter a real country name for Country of birth."
        );
        return;
      }

      const cleanPhotos = Array.isArray(profile.photos)
        ? profile.photos.filter(Boolean)
        : [];

      setSaving(true);

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          name: cleanName,
          age: parsedAge,
          interestedIn: cleanText(profile.interestedIn),
          gender: cleanText(profile.gender),
          bornCountry: validBornCountry,
          intent: cleanText(profile.intent).toLowerCase(),
          photoURL:
  cleanPhotos[0]?.startsWith("https://")
    ? cleanPhotos[0]
    : profile.photoURL?.startsWith("https://")
    ? profile.photoURL
    : "",
          photos: cleanPhotos.filter((photo) =>
  photo?.startsWith("https://")
),
          bio: cleanText(profile.bio),
          photoVisibility: profile.photoVisibility || "everyone",
          updatedAt: new Date(),
        },
        { merge: true }
      );

      Alert.alert("Saved", "Your profile has been updated.");
      await loadProfile();
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900", fontSize: 18 }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  const mainPhoto =
    profile.photos?.[0] || profile.photoURL || "https://picsum.photos/400";

  const verificationText = profile.verified
    ? "Verified Profile ✓"
    : profile.verificationStatus === "pending"
    ? "Verification Pending"
    : profile.verificationStatus === "rejected"
    ? "Verification Rejected"
    : "Not Verified";

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingTop: 60,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={{ fontSize: 34, fontWeight: "900", color: COLORS.black }}>
          Profile
        </Text>

        <Text style={{ color: COLORS.darkBlueGray, marginTop: 6, marginBottom: 20 }}>
          Edit how people see you.
        </Text>

        <View
          style={{
            backgroundColor: COLORS.softCard,
            borderRadius: 30,
            padding: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: COLORS.softBorder,
            shadowColor: "#8EA4C8",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={[COLORS.rose, COLORS.teal]}
            style={{
              width: 142,
              height: 142,
              borderRadius: 71,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={{ uri: mainPhoto }}
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: COLORS.softBorder,
                borderWidth: 4,
                borderColor: COLORS.white,
              }}
            />
          </LinearGradient>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 26, fontWeight: "900", color: COLORS.black }}>
              {profile.name || "Your Name"}
            </Text>

            {profile.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.rose}
                style={{ marginLeft: 7 }}
              />
            ) : null}
          </View>

          <Text style={{ color: COLORS.darkBlueGray, marginTop: 4, fontWeight: "700" }}>
            {profile.intent || "dating / friends"}
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              marginTop: 13,
            }}
          >
            <Text style={profilePill}>{profile.bornCountry || "Country"}</Text>
            <Text style={profilePill}>
              {profile.interestedIn ? `Into ${profile.interestedIn}` : "Interested in"}
            </Text>
            <Text style={profilePill}>{profile.gender || "Gender"}</Text>
          </View>

          <View
            style={{
              marginTop: 14,
              backgroundColor: profile.verified ? COLORS.rose : COLORS.blueSoft,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontWeight: "900",
                fontSize: 13,
                color: profile.verified ? COLORS.white : COLORS.teal,
              }}
            >
              {verificationText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setPrivacyVisible(true)}
          style={{
            marginTop: 16,
            backgroundColor: COLORS.softCard,
            borderRadius: 999,
            paddingVertical: 14,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1,
            borderColor: COLORS.softBorder,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>
              {profile.photoVisibility === "blurred" ? "🔒" : profile.photoVisibility === "matches" ? "💬" : "🌐"}
            </Text>
            <View>
              <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 15 }}>
                Photo Privacy
              </Text>
              <Text style={{ color: COLORS.darkBlueGray, fontSize: 12, marginTop: 2 }}>
                {profile.photoVisibility === "blurred"
                  ? "Blurred for everyone"
                  : profile.photoVisibility === "matches"
                  ? "Visible only to matches"
                  : "Visible to everyone"}
              </Text>
            </View>
          </View>
          <Text style={{ color: COLORS.darkBlueGray, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 22 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.black }}>
            Photos
          </Text>

          <Text style={{ color: "#777", marginTop: 5 }}>
            Add up to 6 photos. First photo is your main profile photo.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 14 }}
          >
            {profile.photos.map((photo, index) => (
              <View
                key={`${photo}-${index}`}
                style={{
                  marginRight: 14,
                  position: "relative",
                }}
              >
                <Image
                  source={{ uri: photo }}
                  style={{
                    width: 112,
                    height: 150,
                    borderRadius: 30,
                    backgroundColor: "#ddd",
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 5,
                  }}
                />

                <TouchableOpacity
                  onPress={() => removePhoto(index)}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    backgroundColor: "rgba(0,0,0,0.8)",
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={pickImage}
              style={{
                width: 112,
                height: 150,
                borderRadius: 28,
                backgroundColor: COLORS.elevatedCard,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 30 }}>＋</Text>
              <Text style={{ fontWeight: "800", marginTop: 6 }}>Add</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            onPress={handleVerificationRequest}
            disabled={profile.verified || profile.verificationStatus === "pending"}
            style={{
              marginTop: 16,
              backgroundColor:
                profile.verified || profile.verificationStatus === "pending"
                  ? "#aaa"
                  : COLORS.teal,
              paddingVertical: 15,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>
              {profile.verified
                ? "Already Verified ✓"
                : profile.verificationStatus === "pending"
                ? "Verification Pending"
                : "Request Photo Verification ✓"}
            </Text>
          </TouchableOpacity>

          {profile.verificationStatus === "rejected" ? (
            <Text
              style={{
                marginTop: 8,
                color: "#d11a2a",
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Your last verification request was rejected. You can update your
              photo and request again.
            </Text>
          ) : null}
        </View>

        <Input
          label="Name"
          value={profile.name}
          onChangeText={(v) => updateField("name", v)}
          placeholder="Your name"
        />

        <Input
          label="Age"
          value={profile.age}
          onChangeText={(v) => updateField("age", v)}
          placeholder="Your age"
          keyboardType="numeric"
        />

        <Input
          label="Bio"
          value={profile.bio}
          onChangeText={(v) => updateField("bio", v)}
          placeholder="Write something about yourself"
          multiline
        />

        <View style={{ display: "none", marginTop: 18 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.black,
              marginBottom: 8,
            }}
          >
            Intent
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {INTENT_OPTIONS.map((option) => (
              <PreferenceChip
                key={option.value}
                label={option.label}
                selected={profile.intent === option.value}
                onPress={() => updateField("intent", option.value)}
              />
            ))}
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.black,
              marginBottom: 8,
            }}
          >
            Gender
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {GENDER_OPTIONS.map((option) => (
              <PreferenceChip
                key={option}
                label={option}
                selected={profile.gender === option}
                onPress={() => updateField("gender", option)}
              />
            ))}
          </View>
        </View>

        <Input
          label="Country of birth"
          value={profile.bornCountry}
          onChangeText={(v) => updateField("bornCountry", v)}
          placeholder="India, Australia, United States..."
        />

        <View style={{ marginTop: 18 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.black,
              marginBottom: 8,
            }}
          >
            Interested in
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {INTERESTED_IN_OPTIONS.map((option) => (
              <PreferenceChip
                key={option}
                label={option}
                selected={profile.interestedIn === option}
                onPress={() => updateField("interestedIn", option)}
              />
            ))}
          </View>
        </View>

        <View
          style={{
            marginTop: 28,
            backgroundColor: COLORS.softCard,
            borderRadius: 30,
            padding: 18,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.black }}>
            Safety Center 🛡️
          </Text>

          <Text style={{ color: "#666", marginTop: 6, lineHeight: 21 }}>
            Control who can contact you and learn basic safety tips.
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/plus")}
            style={plusButton}
          >
            <Text style={plusButtonText}>Unlock CliqZee Plus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openBlockedUsers}
            style={safetyBlackButton}
          >
            <Text style={safetyBlackButtonText}>Blocked Users 🚫</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/account")}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>My Account</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push("/admin")}
              style={adminButton}
            >
              <Text style={adminButtonText}>Admin Dashboard 👑</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setSupportVisible(true)}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>Support Center</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSafetyVisible(true)}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>Safety Tips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/terms")}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>Terms & Conditions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/privacy")}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/guidelines")}
            style={safetyGrayButton}
          >
            <Text style={safetyGrayButtonText}>Community Guidelines</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDataDeletionRequest}
            style={{
              marginTop: 18,
              backgroundColor: "#fff7ed",
              paddingVertical: 15,
              borderRadius: 999,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#fed7aa",
            }}
          >
            <Text style={{ color: "#9a3412", fontWeight: "900", fontSize: 15 }}>
              Request Data Deletion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAccountDeletionRequest}
            style={{
              marginTop: 12,
              backgroundColor: COLORS.rose,
              paddingVertical: 15,
              borderRadius: 999,
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.rose,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 15 }}>
              Delete Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{
              marginTop: 12,
              backgroundColor: COLORS.darkBlueGray,
              paddingVertical: 15,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 15 }}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={saveProfile}
          disabled={saving}
          style={{
            marginTop: 16,
            backgroundColor: saving ? "#777" : COLORS.teal,
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
            {saving ? "Saving..." : "Save Profile"}
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <Modal
        visible={safetyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSafetyVisible(false)}
      >
        <View style={modalBackdrop}>
          <View style={modalSheet}>
            <Text style={modalTitle}>Safety Tips 🛡️</Text>

            <SafetyTip
              title="Meet in public"
              text="Choose busy, public places when meeting someone for the first time."
            />

            <SafetyTip
              title="Protect personal details"
              text="Do not share your home address, banking details, passwords, or private documents."
            />

            <SafetyTip
              title="Trust your gut"
              text="If something feels wrong, leave the conversation and block or report the user."
            />

            <SafetyTip
              title="Tell someone"
              text="Let a friend know where you are going before meeting someone new."
            />

            <TouchableOpacity
              onPress={() => setSafetyVisible(false)}
              style={closeButton}
            >
              <Text style={closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={supportVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setSupportVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          style={modalBackdrop}
        >
          <View style={keyboardAwareModalSheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <Text style={modalTitle}>Support Center</Text>

              <Text style={{ color: "#666", marginTop: 6, marginBottom: 14 }}>
                Choose a topic to see quick help, or send a support request.
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {SUPPORT_TOPICS.map((topic) => (
                  <PreferenceChip
                    key={topic.label}
                    label={topic.label}
                    selected={selectedSupportTopic?.label === topic.label}
                    onPress={() => setSelectedSupportTopic(topic)}
                  />
                ))}
              </View>

              <View
                style={{
                  backgroundColor: COLORS.background,
                  borderRadius: 18,
                  padding: 14,
                  marginTop: 12,
                }}
              >
                <Text
                  style={{ fontWeight: "900", color: COLORS.black, fontSize: 16 }}
                >
                  {selectedSupportTopic?.label || "Support"}
                </Text>

                <Text
                  style={{
                    color: COLORS.darkBlueGray,
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  {selectedSupportTopic?.answer}
                </Text>
              </View>

              <TextInput
                value={supportMessage}
                onChangeText={setSupportMessage}
                placeholder="Still need help? Write your message here."
                placeholderTextColor="#999"
                multiline
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={{
                  backgroundColor: COLORS.softCard,
                  borderRadius: 20,
                  padding: 14,
                  color: COLORS.black,
                  fontSize: 15,
                  minHeight: 120,
                  textAlignVertical: "top",
                  borderWidth: 1,
                  borderColor: "#dbe3ea",
                  marginTop: 14,
                }}
              />

              <TouchableOpacity
                onPress={Keyboard.dismiss}
                style={{
                  alignSelf: "flex-end",
                  marginTop: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: COLORS.darkBlueGray, fontWeight: "900" }}>
                  Done typing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSupportRequest}
                disabled={supportSubmitting}
                style={{
                  marginTop: 8,
                  backgroundColor: supportSubmitting ? "#777" : COLORS.teal,
                  paddingVertical: 15,
                  borderRadius: 999,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: "white", fontWeight: "900", fontSize: 15 }}
                >
                  {supportSubmitting ? "Sending..." : "Send to Support"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setSupportVisible(false);
                }}
                style={closeButton}
              >
                <Text style={closeButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={privacyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={modalBackdrop}>
          <View style={modalSheet}>
            <Text style={modalTitle}>Photo Privacy 🔒</Text>
            <Text style={{ color: COLORS.darkBlueGray, marginTop: 6, marginBottom: 18 }}>
              Choose who can see your photos clearly.
            </Text>

            {[
              { key: "everyone", emoji: "🌐", label: "Visible to everyone", desc: "All users can see your photos." },
              { key: "blurred", emoji: "🔒", label: "Blurred for everyone", desc: "Photos are blurred for all users." },
              { key: "matches", emoji: "💬", label: "Visible only to matches", desc: "Only your matches can see your photos." },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={() => {
                  updateField("photoVisibility", option.key);
                  setPrivacyVisible(false);
                  setDoc(
                    doc(db, "users", auth.currentUser.uid),
                    { photoVisibility: option.key },
                    { merge: true }
                  ).catch(() => {});
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 20,
                  marginBottom: 10,
                  backgroundColor:
                    profile.photoVisibility === option.key
                      ? COLORS.pinkSoft
                      : COLORS.background,
                  borderWidth: 1,
                  borderColor:
                    profile.photoVisibility === option.key
                      ? COLORS.rose
                      : COLORS.softBorder,
                }}
              >
                <Text style={{ fontSize: 26, marginRight: 14 }}>{option.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 16 }}>
                    {option.label}
                  </Text>
                  <Text style={{ color: COLORS.darkBlueGray, fontSize: 13, marginTop: 2 }}>
                    {option.desc}
                  </Text>
                </View>
                {profile.photoVisibility === option.key && (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.rose} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setPrivacyVisible(false)}
              style={closeButton}
            >
              <Text style={closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={blockedUsersVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockedUsersVisible(false)}
      >
        <View style={modalBackdrop}>
          <View style={modalSheet}>
            <Text style={modalTitle}>Blocked Users</Text>

            <Text style={{ color: "#666", marginTop: 6, marginBottom: 18 }}>
              Users you blocked.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {blockedUsers.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: COLORS.black,
                    }}
                  >
                    No blocked users
                  </Text>
                </View>
              ) : (
                blockedUsers.map((user) => (
                  <View
                    key={user.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 14,
                      backgroundColor: COLORS.background,
                      borderRadius: 28,
                      padding: 12,
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          user?.photos?.[0] ||
                          user?.photoURL ||
                          "https://picsum.photos/200",
                      }}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 29,
                        backgroundColor: "#ddd",
                      }}
                    />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: COLORS.black,
                        }}
                      >
                        {user.name || "User"}
                      </Text>

                      <Text style={{ color: "#777", marginTop: 4 }}>
                        {user.intent || "No intent"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleUnblock(user.id)}
                      style={{
                        backgroundColor: COLORS.teal,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "900" }}>
                        Unblock
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setBlockedUsersVisible(false)}
              style={closeButton}
            >
              <Text style={closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function SafetyTip({ title, text }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.background,
        borderRadius: 18,
        padding: 14,
        marginTop: 12,
      }}
    >
      <Text style={{ fontWeight: "900", color: COLORS.black, fontSize: 16 }}>
        {title}
      </Text>

      <Text style={{ color: COLORS.darkBlueGray, marginTop: 5, lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: COLORS.black,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={keyboardType || "default"}
        multiline={!!multiline}
        style={{
          backgroundColor: COLORS.softCard,
          borderRadius: 28,
          padding: 15,
          color: COLORS.black,
          fontSize: 16,
          minHeight: multiline ? 90 : 54,
          textAlignVertical: multiline ? "top" : "center",
          borderWidth: 1,
          borderColor: "#dbe3ea",
        }}
      />
    </View>
  );
}

function PreferenceChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginRight: 8,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: selected ? COLORS.rose : COLORS.softCard,
        borderWidth: 1,
        borderColor: selected ? COLORS.rose : COLORS.softBorder,
      }}
    >
      <Text
        style={{
          color: COLORS.white,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const safetyBlackButton = {
  marginTop: 16,
  backgroundColor: COLORS.rose,
  paddingVertical: 15,
  borderRadius: 999,
  alignItems: "center",
};

const safetyBlackButtonText = {
  color: "white",
  fontWeight: "900",
  fontSize: 15,
};

const plusButton = {
  marginTop: 16,
  backgroundColor: COLORS.rose,
  paddingVertical: 15,
  borderRadius: 999,
  alignItems: "center",
  shadowColor: "#f72585",
  shadowOpacity: 0.25,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

const plusButtonText = {
  color: "white",
  fontWeight: "900",
  fontSize: 15,
};

const adminButton = {
  marginTop: 12,
  backgroundColor: "#7c3aed",
  paddingVertical: 15,
  borderRadius: 999,
  alignItems: "center",
};

const adminButtonText = {
  color: "white",
  fontWeight: "900",
  fontSize: 15,
};

const safetyGrayButton = {
  marginTop: 12,
  backgroundColor: COLORS.background,
  paddingVertical: 15,
  borderRadius: 999,
  alignItems: "center",
  borderWidth: 1,
  borderColor: COLORS.softBorder,
};

const safetyGrayButtonText = {
  color: COLORS.black,
  fontWeight: "900",
  fontSize: 15,
};

const profilePill = {
  backgroundColor: COLORS.pinkSoft,
  color: COLORS.rose,
  paddingHorizontal: 11,
  paddingVertical: 7,
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "900",
  overflow: "hidden",
};

const modalBackdrop = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "flex-end",
};

const modalSheet = {
  backgroundColor: COLORS.softCard,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  padding: 20,
  maxHeight: "80%",
};

const keyboardAwareModalSheet = {
  backgroundColor: COLORS.softCard,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  padding: 20,
  maxHeight: "88%",
};

const modalTitle = {
  fontSize: 28,
  fontWeight: "900",
  color: COLORS.black,
};

const closeButton = {
  marginTop: 16,
  backgroundColor: COLORS.elevatedCard,
  paddingVertical: 15,
  borderRadius: 999,
  alignItems: "center",
};

const closeButtonText = {
  color: COLORS.black,
  fontWeight: "900",
};
