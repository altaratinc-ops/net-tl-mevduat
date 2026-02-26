// 👇 BURAYA TÜM KODU KOY (MEVCUT DOSYAYI TAMAMEN SİLİP)

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  Modal,
  LayoutChangeEvent,
} from "react-native";

/* -------------------- SABİTLER -------------------- */

const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

/* -------------------- YARDIMCI FONKSİYONLAR -------------------- */

function clamp(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

function parsePrincipal(v: string) {
  const digits = v.replace(/\D+/g, "");
  return parseInt(digits || "0", 10);
}

function parseRate(v: string) {
  const cleaned = v.replace(",", ".").replace(/[^0-9.]/g, "");
  return parseFloat(cleaned || "0");
}

/* -------------------- ANA COMPONENT -------------------- */

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  const scrollRef = useRef<ScrollView | null>(null);
  const netY = useRef(0);

  const [principalText, setPrincipalText] = useState(
    formatTL(DEFAULT_PRINCIPAL)
  );
  const [rateText, setRateText] = useState(
    DEFAULT_RATE.toString().replace(".", ",")
  );
  const [daysText, setDaysText] = useState(String(DEFAULT_DAYS));

  const principal = useMemo(
    () => parsePrincipal(principalText),
    [principalText]
  );
  const rate = useMemo(() => parseRate(rateText), [rateText]);
  const days = useMemo(
    () => parseInt(daysText.replace(/\D+/g, "") || "0", 10),
    [daysText]
  );

  const gross = principal * (rate / 100) * (days / 365);
  const net = gross * 0.825; // örnek stopaj %17.5

  const scrollToNet = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, netY.current - 20),
        animated: true,
      });
    });
  };

  const t = isDark ? dark : light;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View
        style={{
          height: Platform.OS === "android"
            ? StatusBar.currentHeight ?? 0
            : 0,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={(r) => (scrollRef.current = r)}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, { borderColor: t.border }]}>

            {/* GLOWLAR - EN ARKADA */}
            <View
              pointerEvents="none"
              style={[
                styles.heroGlow,
                {
                  backgroundColor: isDark
                    ? "rgba(64,247,178,0.06)"
                    : "rgba(11,143,90,0.10)",
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.heroGlow2,
                {
                  backgroundColor: isDark
                    ? "rgba(64,247,178,0.04)"
                    : "rgba(11,143,90,0.06)",
                },
              ]}
            />

            {/* İÇERİK - ÜSTTE */}
            <View style={styles.heroContent}>

              {/* HEADER */}
              <View style={styles.topBar}>
                <View>
                  <Text style={[styles.brand, { color: t.text }]}>
                    Net Mevduat
                  </Text>
                  <Text style={[styles.tagline, { color: t.muted }]}>
                    TL vadeli mevduat net getiri hesaplama
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setTheme((p) => (p === "dark" ? "light" : "dark"))
                  }
                  style={[
                    styles.themeBtn,
                    { backgroundColor: t.card, borderColor: t.border },
                  ]}
                >
                  <Text style={{ color: t.text }}>
                    {isDark ? "🌙" : "☀️"}
                  </Text>
                </Pressable>
              </View>

              {/* NET CARD */}
              <View
                onLayout={(e: LayoutChangeEvent) =>
                  (netY.current = e.nativeEvent.layout.y)
                }
                style={[
                  styles.netCard,
                  { backgroundColor: t.netBg, borderColor: t.border },
                ]}
              >
                <Text style={[styles.netTitle, { color: t.muted }]}>
                  Elinize geçecek net TL
                </Text>
                <Text style={[styles.netValue, { color: t.accent }]}>
                  + {formatTL(net)} TL
                </Text>
              </View>

              {/* INPUTS */}
              <View
                style={[
                  styles.inputs,
                  { backgroundColor: t.card, borderColor: t.border },
                ]}
              >
                <TextInput
                  value={principalText}
                  onChangeText={(v) =>
                    setPrincipalText(formatTL(parsePrincipal(v)))
                  }
                  placeholder="Anapara"
                  placeholderTextColor={t.muted}
                  style={[
                    styles.input,
                    { backgroundColor: t.inputBg, color: t.text },
                  ]}
                  keyboardType="numeric"
                />

                <TextInput
                  value={rateText}
                  onChangeText={setRateText}
                  placeholder="Faiz (%)"
                  placeholderTextColor={t.muted}
                  style={[
                    styles.input,
                    { backgroundColor: t.inputBg, color: t.text },
                  ]}
                  keyboardType="numeric"
                />

                <TextInput
                  value={daysText}
                  onChangeText={setDaysText}
                  placeholder="Vade (gün)"
                  placeholderTextColor={t.muted}
                  style={[
                    styles.input,
                    { backgroundColor: t.inputBg, color: t.text },
                  ]}
                  keyboardType="numeric"
                />

                <Pressable
                  onPress={scrollToNet}
                  style={[
                    styles.cta,
                    { backgroundColor: t.accent },
                  ]}
                >
                  <Text style={{ color: isDark ? "#062217" : "#fff" }}>
                    Hemen Hesapla
                  </Text>
                </Pressable>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* -------------------- STYLES -------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 18 },

  hero: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    overflow: "hidden",
    position: "relative",
  },

  heroGlow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 999,
    top: -200,
    left: -180,
    zIndex: 0,
  },

  heroGlow2: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 999,
    bottom: -200,
    right: -180,
    zIndex: 0,
  },

  heroContent: { zIndex: 2 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  brand: { fontSize: 26, fontWeight: "900" },
  tagline: { fontSize: 12, marginTop: 4 },

  themeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  netCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
  },

  netTitle: { fontSize: 12 },
  netValue: { fontSize: 38, fontWeight: "900", marginTop: 6 },

  inputs: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },

  input: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  cta: {
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
});

/* -------------------- TEMALAR -------------------- */

const dark = {
  bg: "#070A12",
  card: "#0B1020",
  inputBg: "#0E1630",
  text: "#EAF0FF",
  muted: "#8A93AA",
  border: "#1B2442",
  accent: "#40F7B2",
  netBg: "#071B14",
};

const light = {
  bg: "#F7F8FB",
  card: "#FFFFFF",
  inputBg: "#FFFFFF",
  text: "#0B1220",
  muted: "#4A5879",
  border: "#E4E8F2",
  accent: "#0B8F5A",
  netBg: "#ECFDF5",
};