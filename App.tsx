// SADECE değişen kısmı değil FULL dosyayı veriyorum

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
} from "react-native";

const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

function formatTL(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

function parseNumber(text: string): number {
  const s = text.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function copyToClipboard(text: string) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
}

export default function App() {
  const [principal, setPrincipal] = useState("500.000");
  const [rate, setRate] = useState("42,5");
  const [days, setDays] = useState(32);
  const [copied, setCopied] = useState(false);

  const principalNum = parseNumber(principal);
  const rateNum = parseNumber(rate);

  const net = useMemo(() => {
    if (!principalNum || !rateNum) return 0;
    const gross = principalNum * (rateNum / 100) * (days / 365);
    const stopaj = gross * 0.175;
    return gross - stopaj;
  }, [principalNum, rateNum, days]);

  async function handleCopy() {
    if (!net) return;
    await copyToClipboard(`Net kazanç: ${formatTL(net)} TL`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ height: Platform.OS === "android" ? StatusBar.currentHeight : 0 }} />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Net TL Mevduat</Text>

        <View style={styles.netCard}>
          {/* ✅ Sağ üst ikon */}
          <Pressable onPress={handleCopy} style={styles.copyButton}>
            <Text style={styles.copyIcon}>{copied ? "✓" : "📋"}</Text>
          </Pressable>

          <Text style={styles.netValue}>+ {formatTL(net)} TL</Text>
          <Text style={styles.netLabel}>Net Kazanç</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  container: { padding: 20 },

  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
  },

  netCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    position: "relative",
    alignItems: "center",
  },

  copyButton: {
    position: "absolute",
    right: 14,
    top: 14,
  },

  copyIcon: {
    fontSize: 18,
  },

  netValue: {
    fontSize: 40,
    fontWeight: "900",
    color: "#166534",
  },

  netLabel: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
});