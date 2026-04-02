import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EC4899';

type FeedType = 'breast' | 'bottle' | 'solid';
type DiaperType = 'wet' | 'dirty' | 'both';

type FeedLog = { id: string; type: FeedType; time: string; date: string; amount: string; note: string };
type DiaperLog = { id: string; type: DiaperType; time: string; date: string; note: string };
type SleepLog = { id: string; start: string; end: string; date: string };
type Milestone = { id: string; title: string; date: string; note: string };
type BabyProfile = { name: string; dob: string; gender: string };
type BabyCareData = {
  feeds: FeedLog[];
  diapers: DiaperLog[];
  sleeps: SleepLog[];
  milestones: Milestone[];
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function babyAge(dob: string): string {
  if (!dob) return '';
  const birth = new Date(dob + 'T00:00:00');
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) return '';
  if (months < 1) {
    const days = Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? 's' : ''} old`;
  }
  if (months < 24) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m old` : `${years} year${years !== 1 ? 's' : ''} old`;
}

const FEED_CONFIG: Record<FeedType, { label: string; icon: string; color: string }> = {
  breast: { label: 'Breast', icon: 'heart-outline', color: '#EC4899' },
  bottle: { label: 'Bottle', icon: 'water-outline', color: '#3B82F6' },
  solid: { label: 'Solid', icon: 'restaurant-outline', color: '#F59E0B' },
};

const DIAPER_CONFIG: Record<DiaperType, { label: string; icon: string; color: string }> = {
  wet: { label: 'Wet', icon: 'water-outline', color: '#3B82F6' },
  dirty: { label: 'Dirty', icon: 'ellipse', color: '#92400E' },
  both: { label: 'Both', icon: 'git-merge-outline', color: '#8B5CF6' },
};

type TabId = 'feed' | 'diaper' | 'sleep' | 'milestones';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', icon: 'water-outline' },
  { id: 'diaper', label: 'Diaper', icon: 'layers-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'milestones', label: 'Milestones', icon: 'star-outline' },
];

const PRESET_MILESTONES = [
  'First smile', 'First laugh', 'Rolled over', 'Sat up alone', 'First tooth',
  'First crawl', 'First steps', 'First word', 'Slept through night', 'First solid food',
];

export default function BabyCareScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<BabyProfile>({ name: 'Baby', dob: '', gender: '' });
  const [data, setData] = useState<BabyCareData>({ feeds: [], diapers: [], sleeps: [], milestones: [] });
  const [tab, setTab] = useState<TabId>('feed');
  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Profile form
  const [pName, setPName] = useState('');
  const [pDob, setPDob] = useState('');
  const [pGender, setPGender] = useState('');

  // Feed form
  const [feedType, setFeedType] = useState<FeedType>('bottle');
  const [feedTime, setFeedTime] = useState(nowTime());
  const [feedAmount, setFeedAmount] = useState('');
  const [feedNote, setFeedNote] = useState('');

  // Diaper form
  const [diaperType, setDiaperType] = useState<DiaperType>('wet');
  const [diaperTime, setDiaperTime] = useState(nowTime());
  const [diaperNote, setDiaperNote] = useState('');

  // Sleep form
  const [sleepStart, setSleepStart] = useState('');
  const [sleepEnd, setSleepEnd] = useState('');

  // Milestone form
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState(todayISO());
  const [msNote, setMsNote] = useState('');

  useEffect(() => {
    loadJSON<BabyProfile>(KEYS.babyProfile, { name: 'Baby', dob: '', gender: '' }).then(p => {
      setProfile(p);
      setPName(p.name);
      setPDob(p.dob);
      setPGender(p.gender);
    });
    loadJSON<BabyCareData>(KEYS.babyCare, { feeds: [], diapers: [], sleeps: [], milestones: [] }).then(setData);
  }, []);

  const persistProfile = useCallback((p: BabyProfile) => {
    setProfile(p);
    saveJSON(KEYS.babyProfile, p);
  }, []);

  const persistData = useCallback((d: BabyCareData) => {
    setData(d);
    saveJSON(KEYS.babyCare, d);
  }, []);

  const saveProfile = () => {
    persistProfile({ name: pName.trim() || 'Baby', dob: pDob, gender: pGender });
    setShowProfile(false);
  };

  const openAdd = () => {
    setFeedTime(nowTime());
    setFeedAmount('');
    setFeedNote('');
    setDiaperTime(nowTime());
    setDiaperNote('');
    setSleepStart(nowTime());
    setSleepEnd('');
    setMsTitle('');
    setMsDate(todayISO());
    setMsNote('');
    setShowAdd(true);
  };

  const addFeed = () => {
    const entry: FeedLog = { id: uid(), type: feedType, time: feedTime, date: todayISO(), amount: feedAmount.trim(), note: feedNote.trim() };
    persistData({ ...data, feeds: [entry, ...data.feeds] });
    setShowAdd(false);
  };

  const addDiaper = () => {
    const entry: DiaperLog = { id: uid(), type: diaperType, time: diaperTime, date: todayISO(), note: diaperNote.trim() };
    persistData({ ...data, diapers: [entry, ...data.diapers] });
    setShowAdd(false);
  };

  const addSleep = () => {
    if (!sleepStart || !sleepEnd) return;
    const entry: SleepLog = { id: uid(), start: sleepStart, end: sleepEnd, date: todayISO() };
    persistData({ ...data, sleeps: [entry, ...data.sleeps] });
    setShowAdd(false);
  };

  const addMilestone = () => {
    if (!msTitle.trim()) return;
    const entry: Milestone = { id: uid(), title: msTitle.trim(), date: msDate, note: msNote.trim() };
    persistData({ ...data, milestones: [entry, ...data.milestones] });
    setShowAdd(false);
  };

  const deleteItem = (type: keyof BabyCareData, id: string) => {
    Alert.alert('Delete', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        persistData({ ...data, [type]: (data[type] as any[]).filter((e: any) => e.id !== id) });
      }},
    ]);
  };

  const today = todayISO();
  const todayFeeds = data.feeds.filter(f => f.date === today);
  const todayDiapers = data.diapers.filter(d => d.date === today);
  const todaySleeps = data.sleeps.filter(s => s.date === today);

  const calcSleepDuration = (start: string, end: string): string => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const timeSinceLastFeed = useMemo(() => {
    if (data.feeds.length === 0) return null;
    const last = data.feeds[0];
    const [h, m] = last.time.split(':').map(Number);
    const now = new Date();
    const feedDate = new Date(last.date + 'T00:00:00');
    feedDate.setHours(h, m, 0);
    const diffMins = Math.floor((now.getTime() - feedDate.getTime()) / 60000);
    if (diffMins < 0) return null;
    if (diffMins < 60) return `${diffMins}m ago`;
    const hrs = Math.floor(diffMins / 60);
    return `${hrs}h ${diffMins % 60}m ago`;
  }, [data.feeds]);

  const quickLog = (type: 'feed' | 'diaper') => {
    if (type === 'feed') {
      const entry: FeedLog = { id: uid(), type: 'bottle', time: nowTime(), date: todayISO(), amount: '', note: '' };
      persistData({ ...data, feeds: [entry, ...data.feeds] });
    } else {
      const entry: DiaperLog = { id: uid(), type: 'wet', time: nowTime(), date: todayISO(), note: '' };
      persistData({ ...data, diapers: [entry, ...data.diapers] });
    }
  };

  return (
    <ScreenShell
      title={profile.name}
      accentColor={ACCENT}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={openAdd}>
            <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPName(profile.name); setPDob(profile.dob); setPGender(profile.gender); setShowProfile(true); }}>
            <Ionicons name="settings-outline" size={24} color={ACCENT} />
          </TouchableOpacity>
        </View>
      }
    >
      {/* Hero Card */}
      <LinearGradient
        colors={['#831843', '#EC4899', '#F9A8D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>BABY CARE</Text>
            <Text style={styles.heroTitle}>{profile.name}</Text>
            {profile.dob ? <Text style={styles.heroSub}>{babyAge(profile.dob)}{profile.gender ? ` · ${profile.gender === 'boy' ? '👦 Boy' : '👧 Girl'}` : ''}</Text> : null}
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{todayFeeds.length}</Text>
            <Text style={styles.heroStatLabel}>FEEDS</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{todayDiapers.length}</Text>
            <Text style={styles.heroStatLabel}>DIAPERS</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{todaySleeps.length}</Text>
            <Text style={styles.heroStatLabel}>NAPS</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{data.milestones.length}</Text>
            <Text style={styles.heroStatLabel}>MILESTONES</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions & Last Feed */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => quickLog('feed')}>
          <Ionicons name="water-outline" size={18} color="#EC4899" />
          <Text style={[styles.quickBtnText, { color: colors.text }]}>Quick Feed</Text>
          {timeSinceLastFeed && <Text style={[styles.quickMeta, { color: colors.textMuted }]}>{timeSinceLastFeed}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => quickLog('diaper')}>
          <Ionicons name="layers-outline" size={18} color="#8B5CF6" />
          <Text style={[styles.quickBtnText, { color: colors.text }]}>Quick Diaper</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tabBtn, tab === t.id && { backgroundColor: ACCENT + '20' }]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon as any} size={16} color={tab === t.id ? ACCENT : colors.textMuted} />
            <Text style={[styles.tabText, { color: tab === t.id ? ACCENT : colors.textMuted }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'feed' && (
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Feeds</Text>
          {data.feeds.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No feeds logged yet</Text>
          ) : data.feeds.slice(0, 20).map(f => {
            const cfg = FEED_CONFIG[f.type];
            return (
              <TouchableOpacity key={f.id} style={[styles.logRow, { borderBottomColor: colors.border }]} onLongPress={() => deleteItem('feeds', f.id)}>
                <View style={[styles.logIcon, { backgroundColor: cfg.color + '20' }]}>
                  <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logTitle, { color: colors.text }]}>{cfg.label}{f.amount ? ` — ${f.amount}` : ''}</Text>
                  <Text style={[styles.logMeta, { color: colors.textMuted }]}>{f.date} at {f.time}</Text>
                  {f.note ? <Text style={[styles.logNote, { color: colors.textMuted }]}>{f.note}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {tab === 'diaper' && (
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Diapers</Text>
          {data.diapers.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No diapers logged yet</Text>
          ) : data.diapers.slice(0, 20).map(d => {
            const cfg = DIAPER_CONFIG[d.type];
            return (
              <TouchableOpacity key={d.id} style={[styles.logRow, { borderBottomColor: colors.border }]} onLongPress={() => deleteItem('diapers', d.id)}>
                <View style={[styles.logIcon, { backgroundColor: cfg.color + '20' }]}>
                  <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logTitle, { color: colors.text }]}>{cfg.label}</Text>
                  <Text style={[styles.logMeta, { color: colors.textMuted }]}>{d.date} at {d.time}</Text>
                  {d.note ? <Text style={[styles.logNote, { color: colors.textMuted }]}>{d.note}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {tab === 'sleep' && (
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Sleep Logs</Text>
          {data.sleeps.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sleep logged yet</Text>
          ) : data.sleeps.slice(0, 20).map(s => (
            <TouchableOpacity key={s.id} style={[styles.logRow, { borderBottomColor: colors.border }]} onLongPress={() => deleteItem('sleeps', s.id)}>
              <View style={[styles.logIcon, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="moon-outline" size={16} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logTitle, { color: colors.text }]}>{s.start} — {s.end}</Text>
                <Text style={[styles.logMeta, { color: colors.textMuted }]}>{s.date} • {calcSleepDuration(s.start, s.end)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {tab === 'milestones' && (
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Milestones</Text>
          {data.milestones.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No milestones recorded yet</Text>
          ) : data.milestones.map(m => (
            <TouchableOpacity key={m.id} style={[styles.logRow, { borderBottomColor: colors.border }]} onLongPress={() => deleteItem('milestones', m.id)}>
              <View style={[styles.logIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="star" size={16} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logTitle, { color: colors.text }]}>{m.title}</Text>
                <Text style={[styles.logMeta, { color: colors.textMuted }]}>{m.date}</Text>
                {m.note ? <Text style={[styles.logNote, { color: colors.textMuted }]}>{m.note}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Profile Modal */}
      <Modal visible={showProfile} transparent animationType="fade" onRequestClose={() => setShowProfile(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Baby Profile</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={pName} onChangeText={setPName} placeholder="Baby's name" placeholderTextColor={colors.textMuted} autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date of Birth</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={pDob} onChangeText={setPDob} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Gender</Text>
            <View style={styles.genderRow}>
              {[{ k: 'boy', emoji: '👦', label: 'Boy' }, { k: 'girl', emoji: '👧', label: 'Girl' }].map(g => (
                <TouchableOpacity
                  key={g.k}
                  style={[styles.genderOption, pGender === g.k && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
                  onPress={() => setPGender(g.k)}
                >
                  <Text style={{ fontSize: 18 }}>{g.emoji}</Text>
                  <Text style={[styles.genderLabel, { color: pGender === g.k ? ACCENT : colors.textMuted }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowProfile(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveProfile}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Log {tab === 'feed' ? 'Feed' : tab === 'diaper' ? 'Diaper' : tab === 'sleep' ? 'Sleep' : 'Milestone'}
            </Text>

            {tab === 'feed' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Type</Text>
                <View style={styles.typeRow}>
                  {(['breast', 'bottle', 'solid'] as FeedType[]).map(t => {
                    const cfg = FEED_CONFIG[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeOption, feedType === t && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}
                        onPress={() => setFeedType(t)}
                      >
                        <Ionicons name={cfg.icon as any} size={16} color={feedType === t ? cfg.color : colors.textMuted} />
                        <Text style={[styles.typeLabel, { color: feedType === t ? cfg.color : colors.textMuted }]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Time</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={feedTime} onChangeText={setFeedTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount (optional)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={feedAmount} onChangeText={setFeedAmount} placeholder="e.g. 120ml, 5 mins" placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={feedNote} onChangeText={setFeedNote} placeholder="Optional note" placeholderTextColor={colors.textMuted}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addFeed}>
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Log Feed</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {tab === 'diaper' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Type</Text>
                <View style={styles.typeRow}>
                  {(['wet', 'dirty', 'both'] as DiaperType[]).map(t => {
                    const cfg = DIAPER_CONFIG[t];
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeOption, diaperType === t && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}
                        onPress={() => setDiaperType(t)}
                      >
                        <Ionicons name={cfg.icon as any} size={16} color={diaperType === t ? cfg.color : colors.textMuted} />
                        <Text style={[styles.typeLabel, { color: diaperType === t ? cfg.color : colors.textMuted }]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Time</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={diaperTime} onChangeText={setDiaperTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={diaperNote} onChangeText={setDiaperNote} placeholder="Optional note" placeholderTextColor={colors.textMuted}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addDiaper}>
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Log Diaper</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {tab === 'sleep' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Sleep Start</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={sleepStart} onChangeText={setSleepStart} placeholder="HH:MM" placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Sleep End</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={sleepEnd} onChangeText={setSleepEnd} placeholder="HH:MM" placeholderTextColor={colors.textMuted}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addSleep}>
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Log Sleep</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {tab === 'milestones' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Milestone</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={msTitle} onChangeText={setMsTitle} placeholder="First word, first step..." placeholderTextColor={colors.textMuted} autoFocus
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                  {PRESET_MILESTONES.filter(p => !data.milestones.some(m => m.title === p)).map(p => (
                    <TouchableOpacity key={p} style={[styles.presetBtn, { borderColor: colors.border }]} onPress={() => setMsTitle(p)}>
                      <Text style={[styles.presetText, { color: colors.textMuted }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={msDate} onChangeText={setMsDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={msNote} onChangeText={setMsNote} placeholder="Optional note" placeholderTextColor={colors.textMuted}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addMilestone}>
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
    heroLabel: { fontSize: 10, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 4 },
    heroTitle: { fontSize: 26, fontFamily: Fonts.bold, color: '#fff', marginBottom: 2 },
    heroSub: { fontSize: 13, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.8)' },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    heroStat: { alignItems: 'center' },
    heroStatVal: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    heroStatLabel: { fontSize: 9, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginTop: 2 },
    heroDivider: { width: 1, height: 30 },
    quickRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
    quickBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: Spacing.md, borderRadius: Radii.xl, borderWidth: 1 },
    quickBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    quickMeta: { fontSize: 10, fontFamily: Fonts.medium },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    tabBar: { flexDirection: 'row', borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xs, marginBottom: Spacing.lg, gap: 3 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: Radii.md },
    tabText: { fontSize: 11, fontFamily: Fonts.semibold },
    listCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
    logIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    logTitle: { fontSize: 14, fontFamily: Fonts.semibold },
    logMeta: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 1 },
    logNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2, fontStyle: 'italic' },
    emptyText: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center', paddingVertical: Spacing.xl },
    typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    typeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.md, borderWidth: 1, borderColor: c.border },
    typeLabel: { fontSize: 12, fontFamily: Fonts.semibold },
    genderRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    genderOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radii.md, borderWidth: 1, borderColor: c.border },
    genderLabel: { fontSize: 14, fontFamily: Fonts.semibold },
    presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, marginRight: 8 },
    presetText: { fontSize: 12, fontFamily: Fonts.medium },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
