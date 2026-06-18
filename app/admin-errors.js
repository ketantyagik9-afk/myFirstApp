import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import COLORS from "../constants/colors";
import { auth } from "../firebaseConfig";
import { getAdminAppErrors } from "../services/errorService";

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatErrorTime(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Unknown time";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminErrorsScreen() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const loadErrors = useCallback(async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      setLoading(true);
      const result = await getAdminAppErrors(auth.currentUser.uid);
      setErrors(Array.isArray(result) ? result : []);
    } catch (error) {
      Alert.alert("Crash logs error", error?.message || "Something went wrong.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadErrors();
    }, [loadErrors])
  );

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 58,
          paddingBottom: 60,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.black} />
          <Text style={{ color: COLORS.black, fontWeight: "900" }}>Back</Text>
        </TouchableOpacity>

        <Text
          style={{
            marginTop: 20,
            color: COLORS.black,
            fontSize: 34,
            fontWeight: "900",
          }}
        >
          Crash Logs
        </Text>

        <Text
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 6,
            lineHeight: 21,
            fontWeight: "700",
          }}
        >
          Recent app errors from live users and testers.
        </Text>

        {loading ? (
          <View style={{ marginTop: 80, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.rose} />
            <Text
              style={{
                marginTop: 12,
                color: COLORS.black,
                fontWeight: "900",
              }}
            >
              Loading crash logs...
            </Text>
          </View>
        ) : errors.length === 0 ? (
          <View
            style={{
              marginTop: 24,
              backgroundColor: COLORS.softCard,
              borderRadius: 28,
              padding: 24,
              borderWidth: 1,
              borderColor: COLORS.softBorder,
            }}
          >
            <Text
              style={{
                color: COLORS.black,
                fontSize: 22,
                fontWeight: "900",
              }}
            >
              No errors logged
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 8,
                lineHeight: 21,
                fontWeight: "700",
              }}
            >
              That is exactly what we like to see.
            </Text>
          </View>
        ) : (
          errors.map((item) => (
            <View
              key={item.id}
              style={{
                marginTop: 16,
                backgroundColor: COLORS.softCard,
                borderRadius: 24,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.softBorder,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: COLORS.pinkSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="warning" size={19} color={COLORS.rose} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: COLORS.black,
                      fontSize: 17,
                      fontWeight: "900",
                    }}
                  >
                    {item.name || "Error"}
                  </Text>

                  <Text
                    style={{
                      color: COLORS.darkBlueGray,
                      marginTop: 2,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {formatErrorTime(item.createdAt)} · {item.platform || "app"}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: COLORS.black,
                  marginTop: 12,
                  lineHeight: 20,
                  fontWeight: "700",
                }}
              >
                {item.message || "No message"}
              </Text>

              {item.context ? (
                <Text
                  style={{
                    color: COLORS.darkBlueGray,
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {JSON.stringify(item.context)}
                </Text>
              ) : null}

              {item.userEmail || item.userId ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#94A3B8",
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: "800",
                  }}
                >
                  {item.userEmail || item.userId}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}
