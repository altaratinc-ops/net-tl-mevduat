import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

export default function App() {
  const [anaPara, setAnaPara] = useState("500000");
  const [faiz, setFaiz] = useState("42,5");
  const [vade, setVade] = useState(32);

  const parseNumber = (val: string) => {
    return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
  };

  const hesapla = () => {
    const anaparaNum = parseNumber(anaPara);
    const faizNum = parseNumber(faiz);

    let stopaj = 0.15;
    if (vade <= 180) stopaj = 0.15;
    if (vade > 180 && vade <= 365) stopaj = 0.12;
    if (vade > 365) stopaj = 0.10;

    const brut = (anaparaNum * faizNum * vade) / 36500;
    const stopajKesinti = brut * stopaj;
    const net = brut - stopajKesinti;

    return {
      brut: brut.toFixed(2),
      stopaj: stopajKesinti.toFixed(2),
      net: net.toFixed(2),
      stopajOran: stopaj * 100,
    };
  };

  const sonuc = hesapla();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Net Mevduat Hesaplama</Text>

      <Text>Ana Para (TL)</Text>
      <TextInput
        style={styles.input}
        value={anaPara}
        onChangeText={setAnaPara}
        keyboardType="numeric"
      />

      <Text>Faiz Oranı (%)</Text>
      <TextInput
        style={styles.input}
        value={faiz}
        onChangeText={(text) => setFaiz(text.replace(".", ","))}
        keyboardType="numeric"
      />

      <Text>Vade (Gün)</Text>
      <View style={styles.vadeContainer}>
        {[32, 92, 180].map((gun) => (
          <TouchableOpacity
            key={gun}
            style={[
              styles.vadeButton,
              vade === gun && styles.activeVade,
            ]}
            onPress={() => setVade(gun)}
          >
            <Text style={vade === gun ? styles.activeText : styles.vadeText}>
              {gun} Gün
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.resultBox}>
        <Text style={styles.resultTitle}>Net Kazanç</Text>
        <Text style={styles.netText}>{sonuc.net} TL</Text>
        <Text>Brüt Getiri: {sonuc.brut} TL</Text>
        <Text>
          Stopaj Kesintisi (%{sonuc.stopajOran}): {sonuc.stopaj} TL
        </Text>
      </View>

      <View style={styles.rangeBox}>
        <Text style={styles.rangeTitle}>Şubat 26, 2026 Faiz Aralıkları</Text>
        <Text>32 Gün: %38 – %51</Text>
        <Text>92 Gün: %37 – %45</Text>
        <Text>180 Gün: %35 – %43</Text>
        <Text style={{ marginTop: 10 }}>
          180 gün üzeri için net bir aralık bulunmamaktadır.
        </Text>
      </View>

      {/* SEO BLOĞU */}
      <View style={styles.seoBox}>
        <Text style={styles.seoTitle}>Vadeli Mevduat Nedir?</Text>
        <Text style={styles.seoText}>
          Vadeli mevduat, bankaya belirli bir süre için yatırılan paranın faiz getirisi elde etmesini sağlayan bir tasarruf ürünüdür.
          NetMevduat.net üzerinden brüt ve net faiz getirilerinizi stopaj kesintisi dahil hesaplayabilirsiniz.
        </Text>

        <Text style={styles.seoTitle}>Stopaj Oranları Nasıl Hesaplanır?</Text>
        <Text style={styles.seoText}>
          Türkiye'de vadeli mevduat stopaj oranları vadeye göre değişiklik gösterir.
          Hesaplama aracımız güncel mevzuata göre net kazancı otomatik olarak hesaplar.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 15,
    borderRadius: 8,
  },
  vadeContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  vadeButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginRight: 10,
  },
  activeVade: {
    backgroundColor: "#000",
  },
  vadeText: {
    color: "#000",
  },
  activeText: {
    color: "#fff",
  },
  resultBox: {
    padding: 15,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  netText: {
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 10,
  },
  rangeBox: {
    padding: 15,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    marginBottom: 20,
  },
  rangeTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  seoBox: {
    padding: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 40,
  },
  seoTitle: {
    fontWeight: "bold",
    marginTop: 15,
  },
  seoText: {
    marginTop: 5,
    lineHeight: 20,
  },
});