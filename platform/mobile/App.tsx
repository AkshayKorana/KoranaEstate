import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, Text, View } from 'react-native'

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f1e8' }}>
      <View style={{ padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '700' }}>Korana Estate Mobile</Text>
        <Text>Android + iOS app consuming backend API only.</Text>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  )
}
