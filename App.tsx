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

type CalcResult = {
  gross: number;
  withholding: number;
  net: number;
  eay: number;
  stopajPctUsed: number;
};

const INFO_LAST_UPDATED = "2026-02-25";

const STOPAJ_TL_UP_TO_6M = 17.5;
const STOPAJ_TL_UP_TO_1Y = 15;
const STOPAJ_TL_OVER_1Y = 10;

const TCMB_POLICY_RATE_PCT = 37;
const TCMB_POLICY_RATE_NOTE_DATE = "2026-01-22";

const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatTL(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n || 0));
}

function parsePrincipalInt(input: string): number {
  const digits = (input ?? "").replace(/\D+/g, "");
  return parseInt(digits, 10) || 0;
}

function formatThousandsTR(input: string): string {
  const digits = (input ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("tr-TR").format(parseInt(digits, 10));
}

function digitsOnly(text: string): string {
  return (text ?? "").replace(/\D+/g, "");
}

function formatRateTR(input: string): string {
  let s = (input ?? "").replace(/\./g, ",");
  s = s.replace(/[^0-9,]/g, "");
  const i = s.indexOf(",");
  if (i !== -1) {
    const before = s.slice(0, i + 1);
    const after = s.slice(i + 1).replace(/,/g, "");
    s = before + after;
  }
  if (s.startsWith(",")) s = "0" + s;
  return s;
}

function parseRateNumber(input: string): number {
  const s = (input ?? "").replace(",", ".").replace(/[^0-9.]/g, "");
  return parseFloat(s) || 0;
}

function getStopaj(days: number) {
  if (days <= 180) return STOPAJ_TL_UP_TO_6M;
  if (days <= 365) return STOPAJ_TL_UP_TO_1Y;
  return STOPAJ_TL_OVER_1Y;
}

function calc(principal: number, rate: number, days: number) {
  const r = rate / 100;
  const stopajPct = getStopaj(days);
  const gross = principal * r * (days / 365);
  const withholding = gross * (stopajPct / 100);
  const net = gross - withholding;
  const eay = principal > 0 ? (net / principal) * (365 / days) * 100 : 0;

  return { gross, withholding, net, eay, stopajPct };
}

export default function App() {
  const [principalText, setPrincipalText] = useState(
    new Intl.NumberFormat("tr-TR").format(DEFAULT_PRINCIPAL)
  );
  const [rateText, setRateText] = useState("42,5");
  const [days, setDays] = useState(DEFAULT_DAYS);

  const result = useMemo(() => {
    const principal = parsePrincipalInt(principalText);
    const rate = parseRateNumber(rateText);
    return calc(principal, rate, days);
  }, [principalText, rateText, days]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Net TL Mevduat</Text>

        {/* ✅ NET HERO ALANI EN ÜSTTE */}
        <View style={styles.hero}>
          <Text style={styles.netValue}>+ {formatTL(result.net)} TL</Text>
          <Text style={styles.netLabel}>Net Kazanç</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Anapara</Text>
          <TextInput
            value={principalText}
            onChangeText={(t) => setPrincipalText(formatThousandsTR(t))}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Faiz (%)</Text>
          <TextInput
            value={rateText}
            onChangeText={(t) => setRateText(formatRateTR(t))}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Vade (Gün)</Text>
          <View style={styles.pills}>
            {[32, 92, 180].map((d) => (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                style={[
                  styles.pill,
                  days === d && styles.pillActive,
                ]}
              >
                <Text>{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ✅ DETAYLAR */}
        <View style={styles.breakdown}>
          <Text>Brüt Getiri: {formatTL(result.gross)} TL</Text>
          <Text>Stopaj Kesintisi: {formatTL(result.withholding)} TL</Text>
          <Text style={styles.subDetail}>
            Vade: {days} gün — Uygulanan Stopaj: %{result.stopajPct}
          </Text>
          <Text>Efektif Yıllık: {result.eay.toFixed(1)}%</Text>
        </View>

        {/* ✅ BİLGİ KARTI EN AŞAĞIDA */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Bilgi</Text>
          <Text>TCMB Politika Faizi: %{TCMB_POLICY_RATE_PCT}</Text>
          <Text>Not Tarihi: {TCMB_POLICY_RATE_NOTE_DATE}</Text>
          <Text>Güncelleme: {INFO_LAST_UPDATED}</Text>
          <Text style={styles.disclaimer}>
            Bu araç bilgilendirme amaçlıdır. Nihai getiri ve vergi uygulamaları ilgili finans kuruluşu tarafından belirlenir.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20 },

  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  hero: {
    marginTop: 20,
    alignItems: "center",
  },

  netValue: {
    fontSize: 40,
    fontWeight: "900",
    color: "#166534",
  },

  netLabel: {
    fontSize: 14,
    color: "#6B7280",
  },

  form: { marginTop: 20, gap: 8 },

  label: { fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
  },

  pills: { flexDirection: "row", gap: 10, marginTop: 5 },

  pill: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 20,
  },

  pillActive: {
    backgroundColor: "#ddd",
  },

  breakdown: {
    marginTop: 20,
    gap: 6,
  },

  subDetail: {
    fontSize: 12,
    color: "#374151",
  },

  infoCard: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
  },

  infoTitle: {
    fontWeight: "800",
    marginBottom: 5,
  },

  disclaimer: {
    marginTop: 8,
    fontSize: 12,
    color: "#555",
  },
});