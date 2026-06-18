import React, { useState } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import COLORS from "../constants/colors";
import { auth } from "../firebaseConfig";
import AppButton from "../components/AppButton";
import {
  saveUserProfile,
  uploadProfilePhoto,
} from "../services/userService";
import { normalizeCountryName } from "../constants/countries";

const INTENT_OPTIONS = ["Dating", "Friends", "Both"];
const GENDER_OPTIONS = ["Man", "Woman", "Other", "Prefer not to say"];
const INTERESTED_IN_OPTIONS = ["Men", "Women", "Everyone", "Prefer not to say"];

const THEME = {
  bg: COLORS.background || "#050507",
  bg2: COLORS.mint || "#090D16",
  bg3: COLORS.blush || "#140612",
  card: COLORS.softCard || "#10131C",
  elevatedCard: COLORS.elevatedCard || "#151927",
  border: COLORS.softBorder || "#2A3142",
  text: COLORS.white || "#FFFFFF",
  muted: COLORS.darkBlueGray || "#AAB1C2",
  pink: COLORS.rose || "#F72585",
  blue: COLORS.teal || "#2F80FF",
  errorSoft: COLORS.pinkSoft || "rgba(247,37,133,0.16)",
};

const ERROR_COLOR = THEME.pink;

function cleanText(value) {
  return (value || "").trim();
}

function parseAge(value) {
  return Number.parseInt(cleanText(value), 10);
}

export default function ProfileSetupScreen() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [intent, setIntent] = useState("");
  const [gender, setGender] = useState("");
  const [bornCountry, setBornCountry] = useState("");
  const [interestedIn, setInterestedIn] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;

      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateTextField = (key, setter, value) => {
    setter(value);
    clearFieldError(key);
  };

  const updateChoice = (key, setter, value) => {
    setter(value);
    clearFieldError(key);
  };

  const uploadSelectedPhoto = async (imageUri) => {
    try {
      if (!auth.currentUser?.uid || !imageUri) return;

      setUploadingPhoto(true);

      const uploadedPhotoURL = await uploadProfilePhoto(
        auth.currentUser.uid,
        imageUri
      );

      setPhotoURL(uploadedPhotoURL);
      clearFieldError("photoURL");
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error?.message || "Could not upload profile picture."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickProfilePhoto = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
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

      await uploadSelectedPhoto(result.assets?.[0]?.uri);
    } catch (error) {
      Alert.alert(
        "Gallery error",
        error?.message || "Could not choose this photo."
      );
    }
  };

  const takeProfilePhoto = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled) return;

      await uploadSelectedPhoto(result.assets?.[0]?.uri);
    } catch (error) {
      Alert.alert("Camera error", error?.message || "Could not take a photo.");
    }
  };

  const chooseProfilePhotoOption = () => {
    if (uploadingPhoto) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takeProfilePhoto();
          if (buttonIndex === 2) pickProfilePhoto();
        }
      );
      return;
    }

    Alert.alert("Profile Picture", "Choose an option", [
      { text: "Take Photo", onPress: takeProfilePhoto },
      { text: "Choose from Gallery", onPress: pickProfilePhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveProfile = async () => {
    try {
      if (saving || uploadingPhoto) return;

      const user = auth.currentUser;

      if (!user?.uid) {
        router.replace("/login");
        return;
      }

      const cleanName = cleanText(name);
      const cleanAge = cleanText(age);
      const parsedAge = parseAge(cleanAge);
      const cleanIntent = cleanText(intent);
      const cleanGender = cleanText(gender);
      const cleanBornCountry = cleanText(bornCountry);
      const validBornCountry = normalizeCountryName(cleanBornCountry);
      const cleanInterestedIn = cleanText(interestedIn);
      const cleanPhotoURL = cleanText(photoURL);

      const nextErrors = {};

      if (!cleanName) {
        nextErrors.name = "Name is required.";
      } else if (cleanName.length < 2) {
        nextErrors.name = "Name is too short.";
      }

      if (!cleanAge) {
        nextErrors.age = "Age is required.";
      } else if (Number.isNaN(parsedAge)) {
        nextErrors.age = "Age must be a number.";
      } else if (parsedAge < 18) {
        nextErrors.age = "You must be at least 18.";
      } else if (parsedAge > 100) {
        nextErrors.age = "Please enter a realistic age.";
      }

      if (!cleanIntent) nextErrors.intent = "Choose your intent.";
      if (!cleanGender) nextErrors.gender = "Choose your gender.";

      if (!cleanBornCountry) {
        nextErrors.bornCountry = "Country of birth is required.";
      } else if (!validBornCountry) {
        nextErrors.bornCountry = "Please enter a real country name.";
      }

      if (!cleanInterestedIn) {
        nextErrors.interestedIn = "Choose who you are interested in.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        Alert.alert(
          "Check highlighted fields",
          "Please fix the highlighted fields before saving."
        );
        return;
      }

      setFieldErrors({});
      setSaving(true);

      await saveUserProfile(user.uid, {
        email: user.email || "",
        name: cleanName,
        age: parsedAge,
        intent: cleanIntent.toLowerCase(),
        gender: cleanGender,
        bornCountry: validBornCountry,
        interestedIn: cleanInterestedIn,
        photoURL: cleanPhotoURL,
        photos: cleanPhotoURL ? [cleanPhotoURL] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isOnline: true,
      });

      router.replace("/home");
    } catch (error) {
      Alert.alert("Profile error", error?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: THEME.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingTop: 70, paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 34, fontWeight: "900", color: THEME.text }}>
          Set up your profile
        </Text>

        <Text style={{ marginTop: 10, color: THEME.muted, lineHeight: 22 }}>
          Add the basics so people nearby can discover your vibe safely.
        </Text>

        <SetupInput
          label="Name"
          value={name}
          onChangeText={(value) => updateTextField("name", setName, value)}
          placeholder="Your name"
          error={fieldErrors.name}
        />

        <SetupInput
          label="Age"
          value={age}
          onChangeText={(value) => updateTextField("age", setAge, value)}
          placeholder="Your age"
          keyboardType="numeric"
          error={fieldErrors.age}
        />

        <ChoiceGroup label="Intent" error={fieldErrors.intent}>
          {INTENT_OPTIONS.map((option) => (
            <PreferenceChip
              key={option}
              label={option}
              selected={intent === option}
              hasError={!!fieldErrors.intent}
              onPress={() => updateChoice("intent", setIntent, option)}
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup label="Gender" error={fieldErrors.gender}>
          {GENDER_OPTIONS.map((option) => (
            <PreferenceChip
              key={option}
              label={option}
              selected={gender === option}
              hasError={!!fieldErrors.gender}
              onPress={() => updateChoice("gender", setGender, option)}
            />
          ))}
        </ChoiceGroup>

        <SetupInput
          label="Country of birth"
          value={bornCountry}
          onChangeText={(value) =>
            updateTextField("bornCountry", setBornCountry, value)
          }
          placeholder="India, Australia, United States..."
          error={fieldErrors.bornCountry}
        />

        <ChoiceGroup label="Interested in" error={fieldErrors.interestedIn}>
          {INTERESTED_IN_OPTIONS.map((option) => (
            <PreferenceChip
              key={option}
              label={option}
              selected={interestedIn === option}
              hasError={!!fieldErrors.interestedIn}
              onPress={() =>
                updateChoice("interestedIn", setInterestedIn, option)
              }
            />
          ))}
        </ChoiceGroup>

        <View style={{ marginTop: 18 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: THEME.text,
              marginBottom: 8,
            }}
          >
            Profile picture
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={uploadingPhoto}
            onPress={chooseProfilePhotoOption}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: THEME.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: THEME.border,
              padding: 14,
            }}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: "#ddd",
                }}
              />
            ) : (
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: THEME.elevatedCard,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
                  +
                </Text>
              </View>
            )}

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: THEME.text, fontSize: 16, fontWeight: "900" }}>
                {photoURL ? "Change Profile Picture" : "Add Profile Picture"}
              </Text>

              <Text style={{ color: THEME.muted, marginTop: 4, fontWeight: "700" }}>
                Take a photo or choose from gallery
              </Text>
            </View>

            {uploadingPhoto ? (
              <ActivityIndicator color={THEME.text} />
            ) : (
              <Text style={{ color: THEME.text, fontSize: 26, fontWeight: "900" }}>
                ›
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 26 }}>
          <AppButton
            title={saving ? "Saving..." : "Continue"}
            onPress={handleSaveProfile}
            disabled={saving || uploadingPhoto}
            backgroundColor={THEME.pink}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SetupInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "900",
          color: error ? ERROR_COLOR : "#111",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={THEME.muted}
        keyboardType={keyboardType || "default"}
        autoCapitalize={keyboardType === "numeric" ? "none" : "words"}
        style={{
          backgroundColor: error ? THEME.errorSoft : THEME.card,
          borderWidth: 1,
          borderColor: error ? ERROR_COLOR : THEME.border,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 14,
          color: THEME.text,
          fontSize: 16,
          fontWeight: "700",
        }}
      />

      <FieldError message={error} />
    </View>
  );
}

function ChoiceGroup({ label, error, children }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "900",
          color: error ? ERROR_COLOR : "#111",
          marginBottom: 10,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          borderWidth: error ? 1 : 0,
          borderColor: error ? ERROR_COLOR : "transparent",
          backgroundColor: error ? THEME.errorSoft : "transparent",
          borderRadius: 18,
          padding: error ? 8 : 0,
        }}
      >
        {children}
      </View>

      <FieldError message={error} />
    </View>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <Text style={{ color: ERROR_COLOR, fontWeight: "800", marginTop: 6 }}>
      {message}
    </Text>
  );
}

function PreferenceChip({ label, selected, hasError, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        marginRight: 10,
        marginBottom: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: selected ? "#111" : "white",
        borderWidth: 1,
        borderColor: selected ? "#111" : hasError ? ERROR_COLOR : "#ddd",
      }}
    >
      <Text
        style={{
          color: selected ? "white" : "#111",
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
