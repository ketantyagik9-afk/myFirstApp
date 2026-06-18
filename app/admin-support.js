import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";

import { auth } from "../firebaseConfig";
import {
  getAdminSupportRequests,
  isCurrentUserAdmin,
  updateSupportRequestStatus,
} from "../services/userService";

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatRequestTime(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Unknown time";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSupportScreen() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadSupportRequests();
  }, []);

  const loadSupportRequests = async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      const allowed = await isCurrentUserAdmin(auth.currentUser.uid);

      if (!allowed) {
        Alert.alert("Admin only", "You do not have admin access.");
        router.back();
        return;
      }

      const result = await getAdminSupportRequests(auth.currentUser.uid);
      setRequests(Array.isArray(result) ? result : []);
    } catch (error) {
      Alert.alert("Support error", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (request, status) => {
    try {
      if (!auth.currentUser?.uid || !request?.id) return;

      await updateSupportRequestStatus(auth.currentUser.uid, request.id, status);
      await loadSupportRequests();

      Alert.alert(
        status === "closed" ? "Request closed" : "Request reopened",
        "Support request updated."
      );
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Something went wrong.");
    }
  };

  if (loading) {
    return (
      <View style={center}>
        <Text style={title}>Loading support...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 20, paddingTop: 58, paddingBottom: 60 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>Back</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 34, fontWeight: "900", marginTop: 20 }}>
        Support Requests
      </Text>

      <Text style={{ color: "#666", marginTop: 6 }}>
        Read messages users send from the Support Center.
      </Text>

      {requests.length === 0 ? (
        <View style={card}>
          <Text style={{ fontSize: 20, fontWeight: "900" }}>
            No support requests yet
          </Text>
        </View>
      ) : (
        requests.map((request) => {
          const isClosed = request?.status === "closed";

          return (
            <View key={request.id} style={card}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "900" }}>
                    {request.user?.name || "Unknown user"}
                  </Text>

                  <Text style={{ color: "#666", marginTop: 4 }}>
                    {request.email || request.user?.email || "No email"}
                  </Text>
                </View>

                <View
                  style={[
                    statusBadge,
                    { backgroundColor: isClosed ? "#e5e5e5" : "#dff7f5" },
                  ]}
                >
                  <Text
                    style={{
                      color: isClosed ? "#555" : "#047c72",
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    {isClosed ? "CLOSED" : "OPEN"}
                  </Text>
                </View>
              </View>

              <Text style={{ color: "#999", marginTop: 10, fontWeight: "800" }}>
                {formatRequestTime(request.createdAt)}
              </Text>

              <Text style={{ color: "#111", marginTop: 12, fontWeight: "900" }}>
                Topic: {request.topic || "Other"}
              </Text>

              <Text
                style={{
                  color: "#333",
                  marginTop: 8,
                  lineHeight: 22,
                  fontWeight: "600",
                }}
              >
                {request.message || "No message written."}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  updateStatus(request, isClosed ? "open" : "closed")
                }
                style={[
                  fullButton,
                  { backgroundColor: isClosed ? "#111" : "#18c964" },
                ]}
              >
                <Text style={fullButtonText}>
                  {isClosed ? "Reopen Request" : "Mark Closed"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
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
  marginTop: 16,
};

const statusBadge = {
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 6,
};

const fullButton = {
  marginTop: 16,
  borderRadius: 999,
  paddingVertical: 13,
  alignItems: "center",
};

const fullButtonText = {
  color: "white",
  fontWeight: "900",
};
