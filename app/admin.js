import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { auth } from "../firebaseConfig";
import {
  isCurrentUserAdmin,
  getAdminSupportRequests,
  getAdminUsers,
  setUserBanStatus,
  setUserVerifiedStatus,
  rejectUserVerification,
} from "../services/userService";

export default function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState([]);
  const [openSupportCount, setOpenSupportCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadAdmin();
    }, [])
  );

  const loadAdmin = async () => {
    try {
      setLoading(true);

      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      const allowed = await isCurrentUserAdmin(auth.currentUser.uid);
      setIsAdmin(allowed);

      if (!allowed) {
        Alert.alert("Admin only", "You do not have admin access.");
        router.back();
        return;
      }

      const [result, supportRequests] = await Promise.all([
        getAdminUsers(auth.currentUser.uid),
        getAdminSupportRequests(auth.currentUser.uid),
      ]);

      setUsers(Array.isArray(result) ? result : []);
      setOpenSupportCount(
        (Array.isArray(supportRequests) ? supportRequests : []).filter(
          (request) => request?.status !== "closed"
        ).length
      );
    } catch (error) {
      Alert.alert("Admin error", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (user) => {
    try {
      const shouldBan = !(user?.banned || user?.accountStatus === "banned");

      await setUserBanStatus(auth.currentUser.uid, user.id, shouldBan);
      await loadAdmin();

      Alert.alert(
        shouldBan ? "User banned 🚫" : "User unbanned ✅",
        `${user.name || "User"} updated.`
      );
    } catch (error) {
      Alert.alert("Action failed", error?.message || "Something went wrong.");
    }
  };

  const approveVerification = async (user) => {
    try {
      await setUserVerifiedStatus(auth.currentUser.uid, user.id, true);
      await loadAdmin();

      Alert.alert("Verified ✅", `${user.name || "User"} is now verified.`);
    } catch (error) {
      Alert.alert("Action failed", error?.message || "Something went wrong.");
    }
  };

  const removeVerification = async (user) => {
    try {
      await setUserVerifiedStatus(auth.currentUser.uid, user.id, false);
      await loadAdmin();

      Alert.alert("Removed", "Verification removed.");
    } catch (error) {
      Alert.alert("Action failed", error?.message || "Something went wrong.");
    }
  };

  const rejectVerification = async (user) => {
    try {
      await rejectUserVerification(auth.currentUser.uid, user.id);
      await loadAdmin();

      Alert.alert("Rejected", "Verification request rejected.");
    } catch (error) {
      Alert.alert("Action failed", error?.message || "Something went wrong.");
    }
  };

  if (loading) {
    return (
      <View style={center}>
        <Text style={title}>Loading admin...</Text>
      </View>
    );
  }

  if (!isAdmin) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 20, paddingTop: 58, paddingBottom: 60 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 34, fontWeight: "900", marginTop: 20 }}>
        Admin Dashboard
      </Text>

      <Text style={{ color: "#666", marginTop: 6 }}>
        Moderate users, reports, bans, and photo verification.
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/admin-reports")}
        style={blackButton}
      >
        <Text style={blackButtonText}>Review Reports 🚨</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/admin-support")}
        style={blackButton}
      >
        <Text style={blackButtonText}>
          Support Requests ({openSupportCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/admin-errors")}
        style={blackButton}
      >
        <Text style={blackButtonText}>Crash Logs</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 22, fontWeight: "900", marginTop: 28 }}>
        Users
      </Text>

      {users.map((user) => {
        const banned = user?.banned || user?.accountStatus === "banned";
        const pending = user?.verificationStatus === "pending";
        const rejected = user?.verificationStatus === "rejected";
        const photo =
          user?.verificationPhotoURL ||
          user?.photos?.[0] ||
          user?.photoURL ||
          "";

        return (
          <View key={user.id} style={card}>
            <Text style={{ fontSize: 20, fontWeight: "900" }}>
              {user.name || "No name"}
              {user.verified ? "  ✓" : ""}
            </Text>

            <Text style={{ color: "#666", marginTop: 4 }}>
              {user.email || "No email"}
            </Text>

            <Text
              style={{
                marginTop: 6,
                fontWeight: "900",
                color: banned ? "#d11a2a" : "#18c964",
              }}
            >
              {banned ? "BANNED" : "ACTIVE"}
            </Text>

            <Text
              style={{
                marginTop: 6,
                fontWeight: "900",
                color: user.verified
                  ? "#1d9bf0"
                  : pending
                  ? "#f59e0b"
                  : rejected
                  ? "#d11a2a"
                  : "#777",
              }}
            >
              Verification:{" "}
              {user.verified
                ? "APPROVED"
                : pending
                ? "PENDING"
                : rejected
                ? "REJECTED"
                : "NOT REQUESTED"}
            </Text>

            {photo ? (
              <Image
                source={{ uri: photo }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 18,
                  backgroundColor: "#eee",
                  marginTop: 12,
                }}
              />
            ) : null}

            {pending ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => approveVerification(user)}
                  style={[smallButton, { backgroundColor: "#1d9bf0" }]}
                >
                  <Text style={smallButtonText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => rejectVerification(user)}
                  style={[smallButton, { backgroundColor: "#d11a2a" }]}
                >
                  <Text style={smallButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() =>
                    user.verified
                      ? removeVerification(user)
                      : approveVerification(user)
                  }
                  style={[smallButton, { backgroundColor: "#111" }]}
                >
                  <Text style={smallButtonText}>
                    {user.verified ? "Unverify" : "Verify"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => toggleBan(user)}
                  style={[
                    smallButton,
                    { backgroundColor: banned ? "#18c964" : "#d11a2a" },
                  ]}
                >
                  <Text style={smallButtonText}>
                    {banned ? "Unban" : "Ban"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const center = {
  flex: 1,
  backgroundColor: "#f7f7f7",
  justifyContent: "center",
  alignItems: "center",
};

const title = {
  fontSize: 22,
  fontWeight: "900",
};

const card = {
  backgroundColor: "white",
  borderRadius: 22,
  padding: 16,
  marginTop: 14,
};

const blackButton = {
  marginTop: 22,
  backgroundColor: "#111",
  borderRadius: 999,
  paddingVertical: 16,
  alignItems: "center",
};

const blackButtonText = {
  color: "white",
  fontWeight: "900",
  fontSize: 16,
};

const smallButton = {
  flex: 1,
  borderRadius: 999,
  paddingVertical: 12,
  alignItems: "center",
};

const smallButtonText = {
  color: "white",
  fontWeight: "900",
};
