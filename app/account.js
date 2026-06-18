import React, { useEffect, useState } from "react";
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
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import COLORS from "../constants/colors";
import { auth, db } from "../firebaseConfig";

function formatDate(value) {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";

  return parsed.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProviderText(user) {
  const providers = Array.isArray(user?.providerData)
    ? user.providerData.map((provider) => provider.providerId).filter(Boolean)
    : [];

  if (providers.includes("password")) return "Email and password";
  if (providers.length > 0) return providers.join(", ");
  return "Email and password";
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: COLORS.white, fontWeight: "900", marginBottom: 8 }}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.darkBlueGray}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || "default"}
        autoCapitalize="none"
        style={{
          backgroundColor: COLORS.softCard,
          borderColor: COLORS.softBorder,
          borderWidth: 1,
          borderRadius: 22,
          color: COLORS.white,
          fontSize: 16,
          paddingHorizontal: 16,
          paddingVertical: 15,
        }}
      />
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View
      style={{
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.softBorder,
      }}
    >
      <Text style={{ color: COLORS.darkBlueGray, fontSize: 13, fontWeight: "800" }}>
        {label}
      </Text>
      <Text style={{ color: COLORS.white, marginTop: 5, fontSize: 15, fontWeight: "900" }}>
        {value || "Not available"}
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const user = auth.currentUser;

  useEffect(() => {
    const loadAccount = async () => {
      try {
        if (!auth.currentUser?.uid) {
          router.replace("/login");
          return;
        }

        await reload(auth.currentUser).catch(() => {});

        const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        const data = userSnap.exists() ? userSnap.data() || {} : {};

        setProfileData(data);
        setEmail(auth.currentUser.email || data.email || "");
        setPhone(data.phoneNumber || data.contactPhone || "");
      } catch (error) {
        Alert.alert("Account error", error?.message || "Could not load account.");
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, []);

  const reauthenticate = async () => {
    if (!auth.currentUser?.email) {
      throw new Error("Your account has no email attached.");
    }

    if (!currentPassword) {
      throw new Error("Enter your current password first.");
    }

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );

    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const saveAccount = async () => {
    try {
      if (!auth.currentUser?.uid) return;
      if (saving) return;

      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();
      const emailChanged = cleanEmail && cleanEmail !== auth.currentUser.email;

      setSaving(true);

      if (emailChanged) {
        await reauthenticate();
        await updateEmail(auth.currentUser, cleanEmail);
        await sendEmailVerification(auth.currentUser).catch(() => {});
      }

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          email: cleanEmail || auth.currentUser.email || "",
          phoneNumber: cleanPhone,
          accountUpdatedAt: new Date(),
        },
        { merge: true }
      );

      setCurrentPassword("");

      Alert.alert(
        "Account saved",
        emailChanged
          ? "Your email was updated. Please check your inbox for verification."
          : "Your account details were updated."
      );
    } catch (error) {
      Alert.alert("Save failed", error?.message || "Could not update account.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      const targetEmail = (email || auth.currentUser?.email || "").trim();

      if (!targetEmail) {
        Alert.alert("Missing email", "Add your email first.");
        return;
      }

      await sendPasswordResetEmail(auth, targetEmail);
      Alert.alert("Reset sent", "Check your email for a password reset link.");
    } catch (error) {
      Alert.alert("Reset failed", error?.message || "Could not send reset email.");
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      if (newPassword.length < 6) {
        Alert.alert("Password too short", "Use at least 6 characters.");
        return;
      }

      setSaving(true);
      await reauthenticate();
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");

      Alert.alert("Password changed", "Your password was updated safely.");
    } catch (error) {
      Alert.alert("Password failed", error?.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.background, "#080B14", "#130613"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={COLORS.rose} />
        <Text style={{ color: COLORS.white, marginTop: 12, fontWeight: "900" }}>
          Loading account...
        </Text>
      </LinearGradient>
    );
  }

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
            padding: 22,
            paddingTop: 56,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.82}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: COLORS.softCard,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <Text
            style={{
              color: COLORS.rose,
              fontSize: 13,
              fontWeight: "900",
              letterSpacing: 0.8,
              marginTop: 24,
            }}
          >
            MY ACCOUNT
          </Text>

          <Text
            style={{
              color: COLORS.white,
              fontSize: 38,
              lineHeight: 42,
              fontWeight: "900",
              marginTop: 10,
            }}
          >
            Login and contact details.
          </Text>

          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              padding: 18,
              marginTop: 24,
            }}
          >
            <InfoRow label="User ID" value={user?.uid} />
            <InfoRow label="Sign-in method" value={getProviderText(user)} />
            <InfoRow
              label="Email verified"
              value={user?.emailVerified ? "Verified" : "Not verified"}
            />
            <InfoRow
              label="Account created"
              value={formatDate(user?.metadata?.creationTime)}
            />
            <InfoRow
              label="Last sign in"
              value={formatDate(user?.metadata?.lastSignInTime)}
            />
            <InfoRow
              label="Profile status"
              value={profileData?.accountStatus || "active"}
            />
          </View>

          <View
            style={{
              backgroundColor: "rgba(16,19,28,0.74)",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              padding: 18,
              marginTop: 18,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "900" }}>
              Update details
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                lineHeight: 21,
                marginTop: 6,
                fontWeight: "700",
              }}
            >
              Email changes require your current password. Phone number is saved
              as contact info only.
            </Text>

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
            />

            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Optional phone number"
              keyboardType="phone-pad"
            />

            <Field
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Required for email or password changes"
              secureTextEntry
            />

            <TouchableOpacity
              onPress={saveAccount}
              disabled={saving}
              activeOpacity={0.9}
              style={{
                borderRadius: 999,
                overflow: "hidden",
                marginTop: 18,
                opacity: saving ? 0.65 : 1,
              }}
            >
              <LinearGradient
                colors={[COLORS.rose, COLORS.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  minHeight: 56,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 16 }}>
                  {saving ? "Saving..." : "Save Account Details"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: "rgba(16,19,28,0.74)",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
              padding: 18,
              marginTop: 18,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: "900" }}>
              Password
            </Text>

            <Field
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              secureTextEntry
            />

            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={saving}
              activeOpacity={0.85}
              style={{
                marginTop: 16,
                backgroundColor: COLORS.softCard,
                borderColor: COLORS.softBorder,
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: "900" }}>
                Change Password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePasswordReset}
              activeOpacity={0.85}
              style={{
                marginTop: 12,
                backgroundColor: COLORS.pinkSoft,
                borderColor: "rgba(247,37,133,0.35)",
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: COLORS.rose, fontWeight: "900" }}>
                Send Password Reset Email
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
