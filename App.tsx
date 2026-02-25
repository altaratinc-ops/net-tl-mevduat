import React, { useMemo, useState } from "react";
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
} from "react-native";

const STOPAJ_TL_UP_TO_6M = 17.5;
const STOPAJ_TL_UP_TO_1Y = 15;
const STOPAJ_TL_OVER_1Y = 10;

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseTrNumber(input: string): number {
  const raw = (input ?? "").trim();
  if (!raw) return 0;

  let s = raw.replace(/\./g, "").replace(",", ".");
  s = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatThousandsTR(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(/,/g, "");
  const digitsOnly = s.replace(/\D+/g, "");
  if (!digitsOnly) return "";
  const n = parseInt(digitsOnly, 10);
  return new Intl.NumberFormat("tr-TR").format(n);
}

function formatRateTR(input: string): string {
  let s = (input ?? "").toString();

  // Noktayı virgüle çevir
  s = s.replace(/\./g, ",");

  // Sadece rakam + virgül
  s = s.replace(/[^0-9,]/g, "");

  // Tek virgül
  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    const before = s.slice(0, firstComma + 1);
    const after = s.slice(firstComma + 1).replace(/,/g, "");
    s = before + after;
  }

  if (s.startsWith(",")) s = "0" + s;

  return s;
}

function getStopajPct(days: number) {
  if (days <= 180) return STOPAJ_TL_UP_TO_6M;
  if (days <= 365) return STOPAJ_TL_UP_TO_1Y;
  return STOPAJ_TL_OVER_1Y;
}

function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export default function App() {
  const [principalText, setPrincipalText] = useState("500.000");
  const [rateText, setRateText] = useState("42,5");
  const [daysText, setDaysText] = useState("32");

  const result = useMemo(() => {
    const P = parseTrNumber(principalText);
    const r = parseTrNumber(rateText) / 100;
    const d = parseInt(daysText) || 0;

    const gross = P * r * (d / 365);
    const stopaj = gross * (getStopajPct(d) / 100);
    const net = gross - stopaj;

    return { gross, stopaj, net };
  }, [principalText, rateText, daysText]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ height: Platform.OS === "android" ? StatusBar.currentHeight : 0 }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.title}>Net TL Mevduat</Text>

          <Text style={styles.label}>Anapara (TL)</Text>
          <TextInput
            value={principalText}
            onChangeText={(t) => setPrincipalText(formatThousandsTR(t))}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Faiz Oranı (%)</Text>
          <TextInput
            value={rateText}
            onChangeText={(t) => setRateText(formatRateTR(t))}
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.hint}>Ondalık için virgül kullanın (örn: 37,5)</Text>

          <Text style={styles.label}>Vade (Gün)</Text>
          <TextInput
            value={daysText}
            onChangeText={(t) => setDaysText(t.replace(/\D/g, ""))}
            keyboardType="numeric"
            style={styles.input}
          />

          <View style={{ marginTop: 30, alignItems: "center" }}>
            <Text style={styles.net}>
              + {formatTL(result.net)} TL
            </Text>
            <Text style={{ color: "#6b7280" }}>Net Kazanç</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    fontWeight: "700",
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  net: {
    fontSize: 36,
    fontWeight: "900",
    color: "#166534",
  },
});