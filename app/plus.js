import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import COLORS from "../constants/colors";
import { auth } from "../firebaseConfig";
import {
  getCliqzeePlusPackages,
  getRevenueCatSetupMessage,
  purchaseCliqzeePlus,
  restoreCliqzeePlus,
} from "../services/subscriptionService";

const FALLBACK_PLANS = [
  {
    id: "cliqzee_plus_monthly",
    title: "Monthly",
    price: "$4.99",
    detail: "Billed monthly",
  },
  {
    id: "cliqzee_plus_yearly",
    title: "Yearly",
    price: "$49.99",
    detail: "Best value",
  },
];

const BENEFITS = [
  "See more people who said Yeah to you",
  "Open full profiles before matching",
  "Use premium discovery filters",
  "Restore purchases from your Apple ID",
];

function getPackageProductId(subscriptionPackage) {
  return (
    subscriptionPackage?.product?.identifier ||
    subscriptionPackage?.identifier ||
    ""
  );
}

function getPlanTitle(productId, fallbackTitle) {
  if (productId.includes("year")) return "Yearly";
  if (productId.includes("month")) return "Monthly";
  return fallbackTitle || "Cliqzee Plus";
}

function PlanCard({ plan, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        flex: 1,
        minHeight: 128,
        backgroundColor: selected ? COLORS.pinkSoft : COLORS.softCard,
        borderColor: selected ? COLORS.rose : COLORS.softBorder,
        borderWidth: 1.5,
        borderRadius: 24,
        padding: 16,
        marginRight: plan.title === "Monthly" ? 10 : 0,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: COLORS.black, fontSize: 18, fontWeight: "900" }}>
          {plan.title}
        </Text>

        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? COLORS.rose : COLORS.softBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: COLORS.rose,
              }}
            />
          ) : null}
        </View>
      </View>

      <Text
        style={{
          color: COLORS.black,
          fontSize: 28,
          fontWeight: "900",
          marginTop: 18,
        }}
      >
        {plan.price}
      </Text>

      <Text
        style={{
          color: selected ? COLORS.white : COLORS.darkBlueGray,
          marginTop: 5,
          fontWeight: "800",
        }}
      >
        {plan.detail}
      </Text>
    </TouchableOpacity>
  );
}

export default function CliqzeePlusScreen() {
  const [packages, setPackages] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("cliqzee_plus_yearly");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        if (!auth.currentUser?.uid) return;

        const availablePackages = await getCliqzeePlusPackages(
          auth.currentUser.uid
        );

        setPackages(Array.isArray(availablePackages) ? availablePackages : []);
      } catch (error) {
        console.log("Cliqzee Plus plans unavailable:", error.message);
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, []);

  const plans = useMemo(() => {
    if (!packages.length) return FALLBACK_PLANS;

    return packages.map((subscriptionPackage, index) => {
      const productId = getPackageProductId(subscriptionPackage);

      return {
        id: productId || subscriptionPackage.identifier || `plan-${index}`,
        title: getPlanTitle(productId, subscriptionPackage.identifier),
        price: subscriptionPackage?.product?.priceString || "",
        detail: productId.includes("year")
          ? "Best value"
          : productId.includes("month")
          ? "Billed monthly"
          : "Auto-renewing",
        package: subscriptionPackage,
      };
    });
  }, [packages]);

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ||
    plans.find((plan) => plan.id.includes("year")) ||
    plans[0];

  const handlePurchase = async () => {
    try {
      if (!auth.currentUser?.uid) {
        router.replace("/login");
        return;
      }

      setBusy(true);

      const active = await purchaseCliqzeePlus(
        auth.currentUser.uid,
        selectedPlan?.package || null
      );

      Alert.alert(
        active ? "Cliqzee Plus unlocked" : "Purchase not active",
        active
          ? "Your premium features are ready."
          : "We could not confirm an active subscription yet."
      );
    } catch (error) {
      Alert.alert("Plus unavailable", error?.message || getRevenueCatSetupMessage());
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    try {
      if (!auth.currentUser?.uid) return;

      setBusy(true);
      const active = await restoreCliqzeePlus(auth.currentUser.uid);

      Alert.alert(
        active ? "Restored" : "No subscription found",
        active
          ? "Cliqzee Plus is active."
          : "We could not find an active Cliqzee Plus subscription."
      );
    } catch (error) {
      Alert.alert("Restore failed", error?.message || getRevenueCatSetupMessage());
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, "#080B14", "#120613"]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          paddingTop: 58,
          paddingBottom: 44,
        }}
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
            marginTop: 26,
            letterSpacing: 0.8,
          }}
        >
          CLIQZEE PLUS
        </Text>

        <Text
          style={{
            color: COLORS.black,
            fontSize: 42,
            lineHeight: 46,
            fontWeight: "900",
            marginTop: 10,
          }}
        >
          Unlock more connections.
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
          See more Yeahs, open full profiles before matching, and discover more
          people with premium filters.
        </Text>

        <View
          style={{
            flexDirection: "row",
            marginTop: 28,
          }}
        >
          {plans.slice(0, 2).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onPress={() => setSelectedPlanId(plan.id)}
            />
          ))}
        </View>

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
          {BENEFITS.map((benefit) => (
            <View
              key={benefit}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: COLORS.blueSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="checkmark" size={17} color={COLORS.teal} />
              </View>

              <Text
                style={{
                  color: COLORS.black,
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "800",
                  lineHeight: 21,
                }}
              >
                {benefit}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handlePurchase}
          disabled={busy}
          activeOpacity={0.9}
          style={{
            marginTop: 26,
            borderRadius: 999,
            overflow: "hidden",
            opacity: busy ? 0.65 : 1,
          }}
        >
          <LinearGradient
            colors={[COLORS.rose, COLORS.teal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 58,
            }}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 17,
                  fontWeight: "900",
                }}
              >
                Start Cliqzee Plus
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRestore}
          disabled={busy}
          activeOpacity={0.85}
          style={{
            marginTop: 12,
            backgroundColor: COLORS.softCard,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.softBorder,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "900", fontSize: 15 }}>
            Restore Purchase
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: COLORS.darkBlueGray,
            fontSize: 12,
            lineHeight: 18,
            marginTop: 18,
            textAlign: "center",
          }}
        >
          Subscription renews automatically unless cancelled at least 24 hours
          before the end of the current period. Payment is charged to your Apple
          ID. Manage or cancel in your App Store account settings.
        </Text>

        {loadingPlans ? (
          <Text
            style={{
              color: COLORS.darkBlueGray,
              fontSize: 12,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Loading live prices...
          </Text>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}
