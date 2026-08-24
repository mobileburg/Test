import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'nearby' | 'friends' | 'profile';
type Neighbor = {
  id: number;
  name: string;
  age: number;
  distance: string;
  bio: string;
  interests: string[];
  initials: string;
  colors: readonly [string, string];
  online?: boolean;
};

const neighbors: Neighbor[] = [
  {
    id: 1,
    name: 'Алина',
    age: 27,
    distance: '120 м',
    bio: 'Недавно переехала. Ищу компанию для прогулок и кофе по выходным.',
    interests: ['☕ Кофе', '🐕 Собаки', '🎨 Искусство'],
    initials: 'А',
    colors: ['#FF9D76', '#FF6B8B'],
    online: true,
  },
  {
    id: 2,
    name: 'Михаил',
    age: 31,
    distance: '350 м',
    bio: 'Бегаю по утрам, играю в настолки и знаю лучшие места в районе.',
    interests: ['🏃 Бег', '🎲 Настолки', '🍕 Еда'],
    initials: 'М',
    colors: ['#71D7C8', '#41A9A2'],
  },
  {
    id: 3,
    name: 'Саша',
    age: 25,
    distance: '680 м',
    bio: 'Дизайнер и начинающий велосипедист. Всегда за новые знакомства.',
    interests: ['🚲 Велосипед', '🎵 Музыка', '📷 Фото'],
    initials: 'С',
    colors: ['#9B8AFB', '#6D5CE7'],
    online: true,
  },
];

const interests = ['Все', 'Прогулки', 'Спорт', 'Настолки', 'Животные'];

function AppContent() {
  const [started, setStarted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [area, setArea] = useState('Хамовники');
  const [locationNote, setLocationNote] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('nearby');
  const [activeInterest, setActiveInterest] = useState('Все');
  const [requests, setRequests] = useState<number[]>([]);

  const filteredNeighbors = useMemo(() => {
    const matchingIds: Record<string, number[]> = {
      Прогулки: [1, 3],
      Спорт: [2, 3],
      Настолки: [2],
      Животные: [1],
    };
    const ids = matchingIds[activeInterest];
    return ids ? neighbors.filter((neighbor) => ids.includes(neighbor.id)) : neighbors;
  }, [activeInterest]);

  const requestLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationNote('Доступ к геолокации выключен — показан демо-район');
        setStarted(true);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      const detectedArea = place?.district || place?.subregion || place?.city;
      if (detectedArea) setArea(detectedArea);
      setLocationNote('Геолокация обновлена только на этом устройстве');
      setStarted(true);
    } catch {
      setLocationNote('Не удалось определить адрес — показан демо-район');
      setStarted(true);
    } finally {
      setLocating(false);
    }
  };

  const useDemo = () => {
    setLocationNote('Демо-режим — геолокация не используется');
    setStarted(true);
  };

  const toggleRequest = (id: number) => {
    setRequests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  if (!started) {
    return (
      <LinearGradient colors={['#EDF9F3', '#F8F7FF', '#FFF9F3']} style={styles.onboarding}>
        <SafeAreaView style={styles.onboardingSafe}>
          <View style={styles.brandRow}>
            <View style={styles.logoSmall}>
              <MaterialCommunityIcons name="home-heart" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.brand}>Соседи<Text style={styles.brandAccent}>24</Text></Text>
          </View>

          <View style={styles.hero}>
            <View style={styles.radar}>
              <View style={styles.radarRingLarge} />
              <View style={styles.radarRingSmall} />
              <View style={[styles.personBubble, styles.personOne]}>
                <Text style={styles.personEmoji}>👩🏻</Text>
              </View>
              <View style={[styles.personBubble, styles.personTwo]}>
                <Text style={styles.personEmoji}>👨🏼</Text>
              </View>
              <View style={[styles.personBubble, styles.personThree]}>
                <Text style={styles.personEmoji}>👩🏽</Text>
              </View>
              <LinearGradient colors={['#37C783', '#24A96D']} style={styles.pin}>
                <MaterialCommunityIcons name="map-marker" size={30} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>

          <View>
            <Text style={styles.onboardingTitle}>Свои люди{'\n'}совсем рядом</Text>
            <Text style={styles.onboardingText}>
              Знакомьтесь, общайтесь и находите друзей в своём районе.
            </Text>
          </View>

          <View style={styles.onboardingActions}>
            <Pressable
              disabled={locating}
              onPress={requestLocation}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              {locating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Найти соседей рядом</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={useDemo} style={styles.demoButton}>
              <Text style={styles.demoButtonText}>Посмотреть демо</Text>
            </Pressable>
            <View style={styles.privacyRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={17} color="#6E7C75" />
              <Text style={styles.privacyText}>
                Точный адрес скрыт. Вы сами решаете, с кем им поделиться.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.appShell}>
      <SafeAreaView edges={['top']} style={styles.mainSafe}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Добрый вечер 👋</Text>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={18} color="#2AB578" />
              <Text style={styles.locationText}>{area}</Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color="#58635E" />
            </View>
          </View>
          <Pressable style={styles.notificationButton}>
            <MaterialCommunityIcons name="bell-outline" size={23} color="#24322C" />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        {activeTab === 'nearby' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.titleRow}>
              <View>
                <Text style={styles.screenTitle}>Люди рядом</Text>
                <Text style={styles.screenSubtitle}>18 соседей в радиусе 1 км</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Сейчас</Text>
              </View>
            </View>

            {!!locationNote && (
              <View style={styles.locationNotice}>
                <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#218B62" />
                <Text style={styles.locationNoticeText}>{locationNote}</Text>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {interests.map((interest) => {
                const active = activeInterest === interest;
                return (
                  <Pressable
                    key={interest}
                    onPress={() => setActiveInterest(interest)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filteredNeighbors.map((neighbor) => (
              <NeighborCard
                key={neighbor.id}
                neighbor={neighbor}
                requested={requests.includes(neighbor.id)}
                onToggle={() => toggleRequest(neighbor.id)}
              />
            ))}
            <Text style={styles.endText}>Это все новые люди поблизости на сегодня</Text>
          </ScrollView>
        )}

        {activeTab === 'friends' && (
          <EmptyTab
            icon="account-multiple-check-outline"
            title="Будущие друзья"
            text={
              requests.length
                ? `Вы отправили ${requests.length} ${requests.length === 1 ? 'приглашение' : 'приглашения'}. Мы сообщим, когда соседи ответят.`
                : 'Отправляйте приглашения людям рядом — ответы появятся здесь.'
            }
            action="Найти соседей"
            onAction={() => setActiveTab('nearby')}
          />
        )}

        {activeTab === 'profile' && (
          <View style={styles.profile}>
            <LinearGradient colors={['#58D69A', '#24A96D']} style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>В</Text>
            </LinearGradient>
            <Text style={styles.profileName}>Вы</Text>
            <Text style={styles.profileArea}>{area} · профиль виден соседям</Text>
            <Pressable
              style={styles.profileAction}
              onPress={() =>
                Alert.alert('Настройки приватности', 'Точный адрес никогда не показывается другим пользователям.')
              }
            >
              <View style={styles.profileActionIcon}>
                <MaterialCommunityIcons name="shield-key-outline" size={22} color="#218B62" />
              </View>
              <View style={styles.profileActionText}>
                <Text style={styles.profileActionTitle}>Приватность и геолокация</Text>
                <Text style={styles.profileActionSubtitle}>Радиус поиска: 1 км</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#8B9691" />
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.tabBarSafe}>
        <View style={styles.tabBar}>
          <TabButton
            icon="map-marker-radius-outline"
            activeIcon="map-marker-radius"
            label="Рядом"
            active={activeTab === 'nearby'}
            onPress={() => setActiveTab('nearby')}
          />
          <TabButton
            icon="account-multiple-outline"
            activeIcon="account-multiple"
            label="Друзья"
            active={activeTab === 'friends'}
            badge={requests.length}
            onPress={() => setActiveTab('friends')}
          />
          <TabButton
            icon="account-circle-outline"
            activeIcon="account-circle"
            label="Профиль"
            active={activeTab === 'profile'}
            onPress={() => setActiveTab('profile')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function NeighborCard({
  neighbor,
  requested,
  onToggle,
}: {
  neighbor: Neighbor;
  requested: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <LinearGradient colors={neighbor.colors} style={styles.avatar}>
          <Text style={styles.avatarText}>{neighbor.initials}</Text>
          {neighbor.online && <View style={styles.onlineDot} />}
        </LinearGradient>
        <View style={styles.cardIdentity}>
          <Text style={styles.neighborName}>{neighbor.name}, {neighbor.age}</Text>
          <View style={styles.distanceRow}>
            <MaterialCommunityIcons name="walk" size={15} color="#74817B" />
            <Text style={styles.distance}>{neighbor.distance} от вас</Text>
          </View>
        </View>
        <Pressable
          style={styles.moreButton}
          onPress={() =>
            Alert.alert(neighbor.name, 'Что вы хотите сделать?', [
              { text: 'Скрыть профиль' },
              { text: 'Пожаловаться', style: 'destructive' },
              { text: 'Отмена', style: 'cancel' },
            ])
          }
        >
          <MaterialCommunityIcons name="dots-horizontal" size={23} color="#9AA39F" />
        </Pressable>
      </View>
      <Text style={styles.bio}>{neighbor.bio}</Text>
      <View style={styles.interestRow}>
        {neighbor.interests.map((interest) => (
          <View key={interest} style={styles.interestTag}>
            <Text style={styles.interestTagText}>{interest}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.friendButton,
          requested && styles.friendButtonRequested,
          pressed && styles.pressed,
        ]}
      >
        <MaterialCommunityIcons
          name={requested ? 'check' : 'account-plus-outline'}
          size={19}
          color={requested ? '#218B62' : '#FFFFFF'}
        />
        <Text style={[styles.friendButtonText, requested && styles.friendButtonTextRequested]}>
          {requested ? 'Приглашение отправлено' : 'Предложить дружить'}
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyTab({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyTab}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={43} color="#25AC72" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <Pressable onPress={onAction} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function TabButton({
  icon,
  activeIcon,
  label,
  active,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  activeIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      <View>
        <MaterialCommunityIcons
          name={active ? activeIcon : icon}
          size={25}
          color={active ? '#25AC72' : '#909A95'}
        />
        {!!badge && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#F6F8F7' },
  mainSafe: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#F6F8F7',
  },
  onboarding: { flex: 1 },
  onboardingSafe: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  logoSmall: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#25AC72',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#138153',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  brand: { fontSize: 23, fontWeight: '800', color: '#21312A', letterSpacing: -0.6 },
  brandAccent: { color: '#25AC72' },
  hero: { alignItems: 'center', justifyContent: 'center', minHeight: 280 },
  radar: {
    width: 245,
    height: 245,
    borderRadius: 123,
    backgroundColor: 'rgba(55,199,131,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRingLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(37,172,114,0.19)',
  },
  radarRingSmall: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(37,172,114,0.25)',
  },
  pin: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D9A64',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  personBubble: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#28483A',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  personOne: { top: 15, right: 31 },
  personTwo: { bottom: 18, left: 30 },
  personThree: { bottom: 31, right: 5 },
  personEmoji: { fontSize: 29 },
  onboardingTitle: {
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: '#1E2D27',
  },
  onboardingText: {
    marginTop: 13,
    fontSize: 17,
    lineHeight: 25,
    color: '#65726C',
    maxWidth: 350,
  },
  onboardingActions: { paddingTop: 22 },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#25AC72',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#158555',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  demoButton: { alignItems: 'center', paddingVertical: 14 },
  demoButtonText: { color: '#27845D', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  privacyText: { color: '#6E7C75', fontSize: 11.5, lineHeight: 16, maxWidth: 290 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  hello: { color: '#7C8983', fontSize: 13, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 17, fontWeight: '700', color: '#24322C', maxWidth: 220 },
  notificationButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#F2F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF6F61',
    borderWidth: 1.5,
    borderColor: '#F2F5F3',
  },
  scrollContent: { paddingBottom: 26 },
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#1E2D27', letterSpacing: -0.7 },
  screenSubtitle: { marginTop: 4, fontSize: 13.5, color: '#7C8983' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#E4F7ED',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25AC72' },
  liveText: { color: '#218B62', fontSize: 12, fontWeight: '700' },
  locationNotice: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#EAF7F0',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationNoticeText: { flex: 1, color: '#35765A', fontSize: 12, lineHeight: 17 },
  filters: { paddingHorizontal: 20, paddingBottom: 18, gap: 8 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E9E6',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterChipActive: { backgroundColor: '#263A31', borderColor: '#263A31' },
  filterText: { color: '#68756F', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#263A31',
    shadowOpacity: Platform.OS === 'android' ? 0.08 : 0.055,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#39C985',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  cardIdentity: { flex: 1, marginLeft: 12 },
  neighborName: { color: '#24322C', fontSize: 17, fontWeight: '700' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  distance: { color: '#74817B', fontSize: 12.5 },
  moreButton: { padding: 7 },
  bio: { color: '#56635D', fontSize: 13.5, lineHeight: 20, marginTop: 14 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  interestTag: {
    borderRadius: 10,
    backgroundColor: '#F4F6F5',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  interestTagText: { color: '#5B6761', fontSize: 11.5, fontWeight: '500' },
  friendButton: {
    height: 45,
    borderRadius: 14,
    backgroundColor: '#25AC72',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 15,
  },
  friendButtonRequested: { backgroundColor: '#E6F7EE' },
  friendButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  friendButtonTextRequested: { color: '#218B62' },
  endText: { textAlign: 'center', color: '#97A19C', fontSize: 12, marginTop: 5 },
  tabBarSafe: { backgroundColor: '#FFFFFF' },
  tabBar: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    height: 67,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EDF0EE',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#909A95' },
  tabLabelActive: { color: '#25AC72' },
  tabBadge: {
    position: 'absolute',
    right: -10,
    top: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#FF7166',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  emptyTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F6F8F7',
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 29,
    backgroundColor: '#E5F7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  emptyTitle: { fontSize: 25, color: '#24322C', fontWeight: '800' },
  emptyText: {
    marginTop: 10,
    color: '#74817B',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 22,
    backgroundColor: '#25AC72',
    borderRadius: 15,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  profile: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 42,
    backgroundColor: '#F6F8F7',
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { color: '#FFFFFF', fontSize: 42, fontWeight: '800' },
  profileName: { marginTop: 17, color: '#24322C', fontSize: 25, fontWeight: '800' },
  profileArea: { marginTop: 6, color: '#7C8983', fontSize: 13.5 },
  profileAction: {
    width: '100%',
    marginTop: 32,
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileActionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#E8F7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionText: { flex: 1, marginLeft: 12 },
  profileActionTitle: { color: '#2A3832', fontSize: 14, fontWeight: '700' },
  profileActionSubtitle: { marginTop: 3, color: '#8B9691', fontSize: 12 },
});
