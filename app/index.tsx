/*
Prüfungsplan-Tracker v2 — Expo React Native app (iOS + Android)

Purpose: For each subject (row), highlight a student's exams relative to a moving "current index" pointer.

Google Sheet structure (template below):
| Subject | CurrentIndex | Slot1 | Slot2 | Slot3 | Slot4 | ... |
|----------|---------------|-------|-------|-------|-------|
| Math     | 2             | 101   | 102   | 101   | 104   |
| English  | 1             | 101   | 103   | 101   | 102   |

- Column 0 → Subject name
- Column 1 → Current index (integer, indicating which slot is the current one)
- Columns 2..n → Exam slots, each cell containing a student ID (number)

Color coding:
- Student ID < current index → grey (past)
- Student ID == first one after current index → bright red (next exam)
- Student ID > next exam → light red (future)

Quick start:
1. Create a Google Sheet using the template above.
2. File → Publish to the web → select sheet → format: CSV → copy URL.
3. Replace SHEET_CSV_URL below with your published CSV link.
4. Run with Expo as usual (npm start, open in Expo Go).
*/

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCpYHJ5EOeGyUg6sET_YJistgpIu867JnfTkKB4ybgnqt5FGvZErt0vzLu7dBNJMInZjsJIX71DnLN/pub?gid=0&single=true&output=csv';

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map(line => line.split(',').map(c => c.trim()));
  return rows;
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentID, setStudentID] = useState('');
  const [indices, setIndices] = useState({});


  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(SHEET_CSV_URL);
      const text = await res.text();
      const rows = parseCSV(text);
      setData(rows);

      const initial = {};
      rows.slice(1).forEach((row, i) => {
        const parsed = parseInt(row[1]);
        initial[i] = Number.isFinite(parsed) && !isNaN(parsed) ? parsed : 0;
      });
      setIndices(initial);
    } catch (e) {
      Alert.alert('Fehler', 'Konnte Daten nicht laden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // change index for a row (rowIndex corresponds to data.slice(1) index)
  const changeIndex = (rowIndex, delta, slotsLength) => {
    setIndices(prev => {
      const cur = prev[rowIndex] || 0;
      // clamp between 0 and slotsLength (0 meaning nothing done yet)
      const next = Math.max(0, Math.min(slotsLength, cur + delta));
      return { ...prev, [rowIndex]: next };
    });
  };

  /* Helper: determine highlighting for a given slot */
  function getSlotStyle(slotId, slotOrdinal, currentIndex, studentID) {
    // slotOrdinal: 1-based within the slots (first slot = 1)
    // currentIndex: 1-based pointer (as agreed)
    const base = { width: 60, height: 40, borderWidth: 1, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center' };
    // No student ID entered -> do not color student matches
    if (!studentID) return base;

    if (slotId !== studentID) return base;

    // Treat slotOrdinal == currentIndex as "past" (grey)
    if (slotOrdinal <= currentIndex) return { ...base, backgroundColor: '#ccc' };

    // Find if this is the first match after currentIndex will be handled at render time
    // For simplicity, caller will override bright red for the exact "next" slot.
    return { ...base, backgroundColor: '#ffcccc' };
  }

  const renderRow = (row, rowIndex) => {
    const subject = row[0] || '';
    // CurrentIndex stored as 1-based slot ordinal. If invalid -> 0 (meaning nothing completed yet).
    const parsed = parseInt(row[1]);
    const csvCurrentIndex = Number.isFinite(parsed) && !isNaN(parsed) ? parsed : 0;
    const slots = row.slice(2);

    // Use local override if present; fallback to CSV value
    const currentIndex = indices[rowIndex] !== undefined ? indices[rowIndex] : csvCurrentIndex;

    // Find all matching slot ordinals for the entered studentID
    const matches = [];
    if (studentID) {
      slots.forEach((id, i) => { if (id === studentID) matches.push(i + 1); });
    }

    // Determine which of the matches is the "next" (first > currentIndex)
    let nextMatchOrdinal = null;
    if (matches.length) {
      for (let m of matches) {
        if (m >= currentIndex) { nextMatchOrdinal = m; break; }
      }
    }

    return (
      <View key={rowIndex} style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 4 }}>{subject}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700', marginBottom: 4 }}>{subject}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => changeIndex(rowIndex, -1, slots.length)}
              style={{ paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 6, marginRight: 6 }}
            >
              <Text>{'‹'}</Text>
            </TouchableOpacity>

            <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 6 }}>
              <Text style={{ fontWeight: '700' }}>{currentIndex}</Text>
            </View>

            <TouchableOpacity
              onPress={() => changeIndex(rowIndex, +1, slots.length)}
              style={{ paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 6, marginLeft: 6 }}
            >
              <Text>{'›'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal contentContainerStyle={{ alignItems: 'flex-start' }}>
          {/* render header markers above slots: small CURRENT label if this slot is the current position */}
          <View style={{ flexDirection: 'column' }}>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {slots.map((_, i) => {
                const slotOrdinal = i + 1; // 1-based
                const isCurrent = slotOrdinal === currentIndex && currentIndex >= 1;
                return (
                  <View key={i} style={{ width: 66, alignItems: 'center' }}>
                    {isCurrent ? (
                      <View style={{ borderWidth: 0, borderColor: '#2b6ef6', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700' }}>CURRENT</Text>
                      </View>
                    ) : <View style={{ height: 18 }} />}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row' }}>
              {slots.map((id, i) => {
                const slotOrdinal = i + 1; // 1-based

                // Base style and simple coloring
                let style = getSlotStyle(id, slotOrdinal, currentIndex, studentID);

                // If this slot is the "next" match, force bright red
                if (studentID && nextMatchOrdinal === slotOrdinal && id === studentID) {
                  style = { ...style, backgroundColor: '#ff3333' };
                }

                // Additionally, if this column is the "current" column, draw a bold outline around it
                const isCurrent = slotOrdinal === currentIndex && currentIndex >= 1;
                const containerStyle = isCurrent ? { padding: 2, borderWidth: 2, borderColor: '#2b6ef6', borderRadius: 6, marginRight: 6 } : { marginRight: 6 };

                return (
                  <View key={i} style={containerStyle}>
                    <View style={style}>
                      <Text>{id}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Lade Prüfungsplan…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Prüfungsplan Tracker</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <TextInput
          placeholder="Schüler-ID"
          value={studentID}
          onChangeText={setStudentID}
          keyboardType="numeric"
          style={{ borderWidth: 1, padding: 8, width: 180 }}
        />
        <TouchableOpacity onPress={() => setStudentID('')} style={{ marginLeft: 8, padding: 10, borderWidth: 1, borderRadius: 6 }}>
          <Text>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRefresh} style={{ marginLeft: 8, padding: 10, borderWidth: 1, borderRadius: 6 }}>
          <Text>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data.slice(1)} // skip header if present
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => renderRow(item, index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}
