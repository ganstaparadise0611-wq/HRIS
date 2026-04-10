import React, { useState } from 'react';
import { Button, Text, TextInput, TouchableOpacity, View } from 'react-native';
// If using Expo, you may need to install @react-native-community/datetimepicker or use a custom picker
// import DateTimePicker from '@react-native-community/datetimepicker';

const shifts = [
  { label: 'SHIFTSPV [08:00-17:00]', value: 'SHIFTSPV' },
  // Add more shifts as needed
];

export default function AttendanceCorrection() {
  const [selectedShift, setSelectedShift] = useState(shifts[0].value);
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  // const [showStartPicker, setShowStartPicker] = useState(false);
  // const [showEndPicker, setShowEndPicker] = useState(false);

  const handleSubmit = () => {
    // TODO: Connect to backend API
    alert('Attendance correction submitted!');
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>Attendance Correction</Text>
      <Text style={{ marginBottom: 8 }}>Shift</Text>
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 16 }}
        onPress={() => { /* TODO: Show shift picker */ }}
      >
        <Text>{shifts.find(s => s.value === selectedShift)?.label}</Text>
      </TouchableOpacity>
      <Text style={{ marginBottom: 8 }}>Reason</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 16 }}
        placeholder="Enter reason"
        value={reason}
        onChangeText={setReason}
      />
      <Text style={{ marginBottom: 8 }}>Start Time</Text>
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 16 }}
        // onPress={() => setShowStartPicker(true)}
      >
        <Text>{startTime.toLocaleString()}</Text>
      </TouchableOpacity>
      {/* {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowStartPicker(false);
            if (date) setStartTime(date);
          }}
        />
      )} */}
      <Text style={{ marginBottom: 8 }}>End Time</Text>
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 16 }}
        // onPress={() => setShowEndPicker(true)}
      >
        <Text>{endTime.toLocaleString()}</Text>
      </TouchableOpacity>
      {/* {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowEndPicker(false);
            if (date) setEndTime(date);
          }}
        />
      )} */}
      <Button title="Submit Correction" onPress={handleSubmit} />
    </View>
  );
}
