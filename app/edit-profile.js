import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { normalizeCountryName } from "../constants/countries";

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

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: "",
    age: "",
    bio: "",
    interestedIn: "",
    gender: "",
    bornCountry: "",
    intent: "",
    photoURL: "",
    photos: [],
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));

      if (snap.exists()) {
        const data = snap.data();

        const safePhotos =
          Array.isArray(data.photos) && data.photos.length > 0
            ? data.photos
            : data.photoURL
            ? [data.photoURL]
            : [];

        setProfile({
          name: data.name || "",
          age: data.age ? String(data.age) : "",
          bio: data.bio || "",
          interestedIn: data.interestedIn || data.interests || "",
          gender: data.gender || "",
          bornCountry: data.bornCountry || "",
          intent: data.intent || "",
          photoURL: data.photoURL || "",
          photos: safePhotos,
        });
      }
    } catch (error) {
      Alert.alert("Error", error?.message || "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
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
        Alert.alert("Invalid age", "Please enter a valid age between 18 and 100.");
        return;
      }

      if (!validBornCountry) {
        Alert.alert(
          "Invalid country",
          "Please enter a real country name for Country of birth."
        );
        return;
      }

      setSaving(true);

      const cleanPhotos = Array.isArray(profile.photos)
        ? profile.photos.filter(Boolean)
        : [];

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          name: cleanName,
          age: parsedAge,
          bio: cleanText(profile.bio),
          interestedIn: cleanText(profile.interestedIn),
          gender: cleanText(profile.gender),
          bornCountry: validBornCountry,
          intent: cleanText(profile.intent).toLowerCase(),
          photoURL: cleanPhotos[0] || cleanText(profile.photoURL),
          photos: cleanPhotos,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      Alert.alert("Saved", "Your profile has been updated.");
      router.back();
    } catch (error) {
      Alert.alert("Save failed", error?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 34, fontWeight: "900", marginTop: 20 }}>
        Edit Profile
      </Text>

      <Text style={{ color: "#666", marginTop: 6, marginBottom: 20 }}>
        Update how people see you.
      </Text>

      <View
        style={{
          backgroundColor: "white",
          borderRadius: 28,
          padding: 18,
          alignItems: "center",
        }}
      >
        <Image
          source={{
            uri:
              profile.photos?.[0] ||
              profile.photoURL ||
              "https://picsum.photos/400",
          }}
          style={{
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: "#eee",
          }}
        />

        <Text style={{ fontSize: 24, fontWeight: "900", marginTop: 14 }}>
          {profile.name || "Your Name"}
        </Text>
      </View>

      <Input label="Name" value={profile.name} onChangeText={(v) => updateField("name", v)} />
      <Input label="Age" value={profile.age} onChangeText={(v) => updateField("age", v)} keyboardType="numeric" />
      <Input label="Bio" value={profile.bio} onChangeText={(v) => updateField("bio", v)} multiline />
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>
          Intent
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
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
        <Text style={{ fontSize: 18, fontWeight: "900" }}>
          Gender
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
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
      />
      <View style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>
          Interested in
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
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

      <TouchableOpacity
        onPress={saveProfile}
        disabled={saving}
        style={{
          marginTop: 30,
          backgroundColor: "#111",
          borderRadius: 999,
          paddingVertical: 16,
          alignItems: "center",
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
          {saving ? "Saving..." : "Save Changes"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Input({ label, value, onChangeText, keyboardType, multiline }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 18, fontWeight: "900" }}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        placeholder={label}
        placeholderTextColor="#999"
        style={{
          backgroundColor: "white",
          borderRadius: 18,
          padding: 15,
          marginTop: 10,
          minHeight: multiline ? 100 : 54,
          color: "#111",
          fontSize: 16,
          borderWidth: 1,
          borderColor: "#eee",
          textAlignVertical: multiline ? "top" : "center",
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
        backgroundColor: selected ? "#111" : "#f2f2f2",
        borderWidth: 1,
        borderColor: selected ? "#111" : "#ddd",
      }}
    >
      <Text style={{ color: selected ? "white" : "#111", fontWeight: "900" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

