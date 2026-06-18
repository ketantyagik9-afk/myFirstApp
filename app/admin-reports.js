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
  isCurrentUserAdmin,
  getAdminReports,
  updateReportStatus,
  setUserBanStatus,
} from "../services/userService";

export default function AdminReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
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

      const result = await getAdminReports(auth.currentUser.uid);
      setReports(Array.isArray(result) ? result : []);
    } catch (error) {
      Alert.alert("Reports error", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const markReviewed = async (report) => {
    try {
      if (!report?.id) return;

      if (report?.status === "reviewed" || report?.status === "action_taken") {
        Alert.alert("Already handled", "This report has already been handled.");
        return;
      }

      await updateReportStatus(auth.currentUser.uid, report.id, "reviewed");
      await loadReports();

      Alert.alert("Reviewed ✅", "Report marked as reviewed.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Something went wrong.");
    }
  };

  const banReportedUser = async (report) => {
    try {
      if (!report?.reportedUserId) return;

      const alreadyBanned =
        report?.reportedUser?.banned === true ||
        report?.reportedUser?.accountStatus === "banned" ||
        report?.status === "action_taken";

      if (alreadyBanned) {
        Alert.alert("Already banned", "This user/report already has action taken.");
        return;
      }

      await setUserBanStatus(auth.currentUser.uid, report.reportedUserId, true);
      await updateReportStatus(auth.currentUser.uid, report.id, "action_taken");
      await loadReports();

      Alert.alert("User banned 🚫", "Reported user has been banned.");
    } catch (error) {
      Alert.alert("Failed", error?.message || "Something went wrong.");
    }
  };

  if (loading) {
    return (
      <View style={center}>
        <Text style={title}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 20, paddingTop: 58, paddingBottom: 60 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900" }}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 34, fontWeight: "900", marginTop: 20 }}>
        Reports
      </Text>

      <Text style={{ color: "#666", marginTop: 6 }}>
        Review reported users and take action.
      </Text>

      {reports.length === 0 ? (
        <View style={card}>
          <Text style={{ fontSize: 20, fontWeight: "900" }}>
            No reports yet
          </Text>
        </View>
      ) : (
        reports.map((report) => {
          const alreadyHandled =
            report?.status === "reviewed" || report?.status === "action_taken";

          const alreadyBanned =
            report?.reportedUser?.banned === true ||
            report?.reportedUser?.accountStatus === "banned" ||
            report?.status === "action_taken";

          return (
            <View key={report.id} style={card}>
              <Text style={{ fontSize: 20, fontWeight: "900" }}>
                Reported: {report.reportedUser?.name || "Unknown user"}
              </Text>

              <Text style={{ color: "#666", marginTop: 6 }}>
                Reporter: {report.reporterUser?.name || "Unknown reporter"}
              </Text>

              <Text style={{ color: "#111", marginTop: 10, fontWeight: "800" }}>
                Reason: {report.reason || "No reason"}
              </Text>

              <Text
                style={{
                  color: alreadyHandled ? "#18c964" : "#999",
                  marginTop: 8,
                  fontWeight: "800",
                }}
              >
                Status: {report.status || "pending"}
              </Text>

              {alreadyBanned ? (
                <View style={disabledFullButton}>
                  <Text style={disabledButtonText}>Action Taken ✅</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={() => markReviewed(report)}
                    disabled={alreadyHandled}
                    style={[
                      smallButton,
                      { backgroundColor: alreadyHandled ? "#bbb" : "#111" },
                    ]}
                  >
                    <Text style={smallButtonText}>
                      {alreadyHandled ? "Reviewed ✅" : "Reviewed"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => banReportedUser(report)}
                    style={[smallButton, { backgroundColor: "#d11a2a" }]}
                  >
                    <Text style={smallButtonText}>Ban User</Text>
                  </TouchableOpacity>
                </View>
              )}
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

const disabledFullButton = {
  marginTop: 14,
  backgroundColor: "#e5e5e5",
  borderRadius: 999,
  paddingVertical: 13,
  alignItems: "center",
};

const disabledButtonText = {
  color: "#555",
  fontWeight: "900",
};