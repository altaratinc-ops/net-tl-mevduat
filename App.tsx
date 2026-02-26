import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";

const STOPAJ_SHORT = 17.5;   // <=180 gün
const STOPAJ_MID = 15;       // 181-365 gün
const STOPAJ_LONG = 10;      // 365+ gün

const MARKET_RANGES = {
  32: "32 gün: %38 – %51",
  92: "92 gün: %37 – %45",
  180: "180 gün: %35 – %43",
};

function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

function parseNumber(text: string) {
  if (!text) return 0;
  return parseFloat(text.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
}

function formatInputTL(text: string) {
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("tr-TR").format(parseInt(digits));
}

export default function App() {
  const [principalText, setPrincipalText] = useState("500.000");
  const [rateText, setRateText] = useState("42,5");
  const [days, setDays] = useState(32);
  const [marketOpen, setMarketOpen] = useState(false);
  const [tcmbOpen, setTcmbOpen] = useState(false);

  const principal = useMemo(() => parseNumber(principalText), [principalText]);
  const rate = useMemo(() => parseNumber(rateText) / 100, [rateText]);

  const stopaj = useMemo(() => {
    if (days <= 180) return STOPAJ_SHORT;
    if (days <= 365) return STOPAJ_MID;
    return STOPAJ_LONG;
  }, [days]);

  const result = useMemo(() => {
    const gross = principal * rate * (days / 365);
    const withholding = gross * (stopaj / 100);
    const net = gross - withholding;
    return { gross, withholding, net };
  }, [principal, rate, days, stopaj]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ height: Platform.OS === "android" ? StatusBar.currentHeight : 0 }} />
      <ScrollView contentContainerStyle={styles.container}>

        {/* HEADER */}
        <Text style={styles.title}>Net Mevduat</Text>
        <Text style={styles.subtitle}>Vadeli Mevduat Hesaplama</Text>

        {/* ÜST MENÜ */}
        <View style={styles.menuRow}>
          <Pressable style={styles.menuBtn} onPress={() => setMarketOpen(!marketOpen)}>
            <Text style={styles.menuText}>Piyasa</Text>
          </Pressable>

          <Pressable style={styles.menuBtn} onPress={() => setTcmbOpen(!tcmbOpen)}>
            <Text style={styles.menuText}>Faiz Kararı</Text>
          </Pressable>
        </View>

        {/* PİYASA PANEL */}
        {marketOpen && (
          <View style={styles.panel}>
            <Text style={styles.panelText}>{MARKET_RANGES[32]}</Text>
            <Text style={styles.panelText}>{MARKET_RANGES[92]}</Text>
            <Text style={styles.panelText}>{MARKET_RANGES[180]}</Text>
          </View>
        )}

        {/* TCMB PANEL */}
        {tcmbOpen && (
          <View style={styles.panel}>
            <Text style={styles.panelText}>TCMB Politika Faizi: %37</Text>
            <Text style={styles.panelText}>Son Karar: 22 Ocak 2026</Text>
            <Text style={styles.panelText}>Sonraki Toplantı: 12 Mart 2026</Text>
          </View>
        )}

        {/* NET KAZANÇ */}
        <View style={styles.netCard}>
          <Text style={styles.netLabel}>Elinize geçecek net TL</Text>
          <Text style={styles.netValue}>+ {formatTL(result.net)} TL</Text>
          <Text style={styles.meta}>
            Vade: {days} gün | Stopaj: %{stopaj}
          </Text>
        </View>

        {/* INPUTLAR */}
        <Text style={styles.label}>Anapara (TL)</Text>
        <TextInput
          value={principalText}
          onChangeText={(t) => setPrincipalText(formatInputTL(t))}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Faiz Oranı (%)</Text>
        <TextInput
          value={rateText}
          onChangeText={(t) => setRateText(t.replace(".", ","))}
          keyboardType="numeric"
          style={styles.input}
        />

        <Text style={styles.label}>Vade (Gün)</Text>
        <View style={styles.pills}>
          {[32, 92, 180].map((d) => (
            <Pressable
              key={d}
              onPress={() => setDays(d)}
              style={[styles.pill, days === d && styles.pillActive]}
            >
              <Text style={styles.pillText}>{d}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f1c" },
  container: { padding: 20 },

  title: { fontSize: 26, fontWeight: "900", color: "#fff" },
  subtitle: { fontSize: 12, color: "#9aa3c7", marginBottom: 15 },

  menuRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  menuBtn: {
    flex: 1,
    backgroundColor: "#121a2f",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  menuText: { color: "#fff", fontWeight: "800" },

  panel: {
    backgroundColor: "#121a2f",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  panelText: { color: "#cfd6ff", fontSize: 12, marginBottom: 5 },

  netCard: {
    backgroundColor: "#061d16",
    padding: 15,
    borderRadius: 16,
    marginVertical: 15,
    alignItems: "center",
  },
  netLabel: { color: "#9aa3c7", fontSize: 12 },
  netValue: { fontSize: 36, fontWeight: "900", color: "#40F7B2", marginVertical: 5 },
  meta: { color: "#9aa3c7", fontSize: 12 },

  label: { color: "#9aa3c7", marginTop: 10, fontSize: 12 },
  input: {
    backgroundColor: "#121a2f",
    padding: 12,
    borderRadius: 12,
    color: "#fff",
    fontSize: 16,
  },

  pills: { flexDirection: "row", gap: 10, marginTop: 10 },
  pill: {
    backgroundColor: "#121a2f",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillActive: { backgroundColor: "#1e6a56" },
  pillText: { color: "#fff", fontWeight: "800" },
});