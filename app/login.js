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
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";

import COLORS from "../constants/colors";
import { auth } from "../firebaseConfig";
import { loginUser } from "../services/authService";

function AuthInput({ value, onChangeText, placeholder, secureTextEntry }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.darkBlueGray}
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      keyboardType={placeholder.toLowerCase().includes("email") ? "email-address" : "default"}
      style={{
        backgroundColor: COLORS.softCard,
        borderColor: COLORS.softBorder,
        borderWidth: 1,
        borderRadius: 24,
        color: COLORS.white,
        fontSize: 16,
        paddingHorizontal: 18,
        paddingVertical: 16,
        marginTop: 12,
      }}
    />
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  const handleLogin = async () => {
    try {
      if (loading) return;

      if (!cleanEmail || !password) {
        Alert.alert("Missing details", "Please enter email and password.");
        return;
      }

      setLoading(true);
      await loginUser(cleanEmail, password);
      router.replace("/home");
    } catch (error) {
      Alert.alert("Login failed", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      if (!cleanEmail) {
        Alert.alert("Enter email", "Type your email first, then tap reset.");
        return;
      }

      await sendPasswordResetEmail(auth, cleanEmail);
      Alert.alert("Reset sent", "Check your email for a password reset link.");
    } catch (error) {
      Alert.alert("Reset failed", error?.message || "Could not send reset email.");
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, "#080B14", "#130613"]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 22,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              color: COLORS.rose,
              fontSize: 14,
              fontWeight: "900",
              letterSpacing: 1,
            }}
          >
            CLIQZEE
          </Text>

          <Text
            style={{
              color: COLORS.white,
              fontSize: 44,
              lineHeight: 48,
              fontWeight: "900",
              marginTop: 14,
            }}
          >
            Your vibe.{"\n"}Your people.
          </Text>

          <Text
            style={{
              color: COLORS.darkBlueGray,
              fontSize: 16,
              lineHeight: 24,
              marginTop: 14,
              fontWeight: "700",
            }}
          >
            Sign in to set your vibe, discover nearby people, and keep your
            plans moving.
          </Text>

          <View
            style={{
              backgroundColor: "rgba(16,19,28,0.74)",
              borderRadius: 30,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              padding: 18,
              marginTop: 30,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "900" }}>
              Welcome back
            </Text>

            <AuthInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
            />

            <AuthInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />

            <TouchableOpacity
              onPress={handlePasswordReset}
              activeOpacity={0.82}
              style={{ alignSelf: "flex-end", marginTop: 8 }}
            >
              <Text style={{ color: COLORS.rose, fontWeight: "900" }}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
              style={{
                borderRadius: 999,
                overflow: "hidden",
                marginTop: 18,
                opacity: loading ? 0.65 : 1,
              }}
            >
              <LinearGradient
                colors={[COLORS.rose, COLORS.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  minHeight: 58,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 17,
                      fontWeight: "900",
                    }}
                  >
                    Log In
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/signup")}
            activeOpacity={0.86}
            style={{
              backgroundColor: COLORS.softCard,
              borderColor: COLORS.softBorder,
              borderWidth: 1,
              borderRadius: 999,
              alignItems: "center",
              paddingVertical: 16,
              marginTop: 16,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 15 }}>
              Create New Account
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
