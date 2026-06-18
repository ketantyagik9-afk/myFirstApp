import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import COLORS from "../constants/colors";
import { signupUser } from "../services/authService";
import { auth } from "../firebaseConfig";
import { saveUserProfile } from "../services/userService";

const THEME = {
  bg: COLORS.background || "#050507",
  bg2: COLORS.mint || "#090D16",
  bg3: COLORS.blush || "#140612",
  card: THEME.card || "#10131C",
  elevatedCard: COLORS.elevatedCard || "#151927",
  border: THEME.border || "#2A3142",
  text: THEME.text || "#FFFFFF",
  muted: COLORS.darkBlueGray || "#AAB1C2",
  pink: COLORS.rose || "#F72585",
  blue: COLORS.teal || "#2F80FF",
  errorSoft: THEME.pinkSoft || "rgba(247,37,133,0.16)",
};

const ERROR_COLOR = THEME.pink;

function cleanText(value) {
  return (value || "").trim();
}

function AuthInput({ value, onChangeText, placeholder, secureTextEntry, error }) {
  return (
    <View style={{ marginTop: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={THEME.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={{
          backgroundColor: error ? THEME.errorSoft : THEME.card,
          borderWidth: 1,
          borderColor: error ? ERROR_COLOR : THEME.border,
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 15,
          color: THEME.text,
          fontSize: 16,
          fontWeight: "700",
        }}
      />

      <FieldError message={error} />
    </View>
  );
}

function CheckRow({ checked, onPress, children, error }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 14,
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: error
          ? ERROR_COLOR
          : checked
          ? THEME.pink
          : THEME.border,
        backgroundColor: error ? THEME.errorSoft : THEME.card,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: checked ? THEME.pink : THEME.muted,
          backgroundColor: checked ? THEME.pink : "transparent",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 10,
          marginTop: 1,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={16} color="white" /> : null}
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
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

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOver18, setIsOver18] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;

      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    clearFieldError("email");
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    clearFieldError("password");
  };

  const toggleOver18 = () => {
    setIsOver18((prev) => !prev);
    clearFieldError("isOver18");
  };

  const toggleAcceptedTerms = () => {
    setAcceptedTerms((prev) => !prev);
    clearFieldError("acceptedTerms");
  };

  const handleSignup = async () => {
    try {
      if (loading) return;

      const cleanEmail = cleanText(email).toLowerCase();
      const nextErrors = {};

      if (!cleanEmail) {
        nextErrors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        nextErrors.email = "Enter a valid email address.";
      }

      if (!password) {
        nextErrors.password = "Password is required.";
      } else if (password.length < 6) {
        nextErrors.password = "Use at least 6 characters.";
      }

      if (!isOver18) {
        nextErrors.isOver18 = "Confirm you are 18 or older.";
      }

      if (!acceptedTerms) {
        nextErrors.acceptedTerms = "Accept the terms to continue.";
      }

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        Alert.alert(
          "Check highlighted fields",
          "Please fix the highlighted fields before signing up."
        );
        return;
      }

      setFieldErrors({});
      setLoading(true);

      const userCredential = await signupUser(cleanEmail, password);
      const user = userCredential?.user || auth.currentUser;

      if (!user?.uid) {
        throw new Error("Could not create your account. Please try again.");
      }

      await saveUserProfile(user.uid, {
        email: user.email || cleanEmail,
        isOver18: true,
        acceptedTerms: true,
        profileComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      router.replace("/profile-setup");
    } catch (error) {
      Alert.alert("Signup failed", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[THEME.bg, THEME.bg2, THEME.bg3]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 74, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: THEME.card,
              borderWidth: 1,
              borderColor: THEME.border,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 34,
            }}
          >
            <Ionicons name="chevron-back" size={28} color={THEME.text} />
          </TouchableOpacity>

          <Text
            style={{
              color: THEME.pink,
              fontSize: 15,
              fontWeight: "900",
              letterSpacing: 1.2,
            }}
          >
            JOIN CLIQZEE
          </Text>

          <Text
            style={{
              color: THEME.text,
              fontSize: 46,
              lineHeight: 52,
              fontWeight: "900",
              marginTop: 12,
            }}
          >
            Create your account.
          </Text>

          <Text
            style={{
              color: THEME.muted,
              fontSize: 17,
              lineHeight: 25,
              marginTop: 14,
              fontWeight: "700",
            }}
          >
            Start matching through nearby plans, shared vibes, and real-time
            connections.
          </Text>

          <View style={{ marginTop: 30 }}>
            <AuthInput
              value={email}
              onChangeText={handleEmailChange}
              placeholder="Email"
              error={fieldErrors.email}
            />

            <AuthInput
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="Password"
              secureTextEntry
              error={fieldErrors.password}
            />
          </View>

          <View style={{ marginTop: 18 }}>
            <CheckRow
              checked={isOver18}
              onPress={toggleOver18}
              error={fieldErrors.isOver18}
            >
              <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 15 }}>
                I confirm I am 18 or older
              </Text>
              <Text style={{ color: THEME.muted, marginTop: 4, lineHeight: 20 }}>
                CliqZee is only for adults. Your age may be checked during review or
                safety processes.
              </Text>
            </CheckRow>
            <FieldError message={fieldErrors.isOver18} />

            <CheckRow
              checked={acceptedTerms}
              onPress={toggleAcceptedTerms}
              error={fieldErrors.acceptedTerms}
            >
              <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 15 }}>
                I agree to the Terms, Privacy Policy, and Community Guidelines
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
                <TouchableOpacity onPress={() => router.push("/terms")}>
                  <Text style={{ color: THEME.pink, fontWeight: "900" }}>Terms</Text>
                </TouchableOpacity>
                <Text style={{ color: THEME.muted }}>  •  </Text>
                <TouchableOpacity onPress={() => router.push("/privacy")}>
                  <Text style={{ color: THEME.pink, fontWeight: "900" }}>Privacy</Text>
                </TouchableOpacity>
                <Text style={{ color: THEME.muted }}>  •  </Text>
                <TouchableOpacity onPress={() => router.push("/guidelines")}>
                  <Text style={{ color: THEME.pink, fontWeight: "900" }}>
                    Guidelines
                  </Text>
                </TouchableOpacity>
              </View>
            </CheckRow>
            <FieldError message={fieldErrors.acceptedTerms} />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSignup}
            disabled={loading}
            style={{
              marginTop: 28,
              borderRadius: 999,
              overflow: "hidden",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <LinearGradient
              colors={[THEME.pink, THEME.blue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 17, alignItems: "center" }}
            >
              {loading ? (
                <ActivityIndicator color={THEME.text} />
              ) : (
                <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 16 }}>
                  Create Account
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.replace("/login")}
            style={{
              marginTop: 14,
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: THEME.border,
              backgroundColor: THEME.card,
            }}
          >
            <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 15 }}>
              I already have an account
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
