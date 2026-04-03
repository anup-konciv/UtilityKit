import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
  FlatList, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#D946EF';

/* ───── Types ───── */

type Document = {
  id: string;
  name: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  documentNumber: string;
  issuedBy: string;
  notes: string;
  createdAt: string;
};

type StatusInfo = { label: string; color: string; bgColor: string; icon: string };
type FilterKey = 'all' | 'expired' | 'expiring' | 'valid';

/* ───── Categories ───── */

const CATEGORIES: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'id', label: 'ID', icon: 'id-card-outline', color: '#3B82F6' },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline', color: '#0891B2' },
  { id: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline', color: '#10B981' },
  { id: 'vehicle', label: 'Vehicle', icon: 'car-outline', color: '#F97316' },
  { id: 'medical', label: 'Medical', icon: 'medkit-outline', color: '#EF4444' },
  { id: 'education', label: 'Education', icon: 'school-outline', color: '#8B5CF6' },
  { id: 'financial', label: 'Financial', icon: 'card-outline', color: '#F59E0B' },
  { id: 'property', label: 'Property', icon: 'home-outline', color: '#059669' },
  { id: 'other', label: 'Other', icon: 'document-outline', color: '#64748B' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

/* ───── Presets ───── */

const PRESETS: { name: string; category: string }[] = [
  { name: 'Passport', category: 'travel' },
  { name: 'Driving License', category: 'id' },
  { name: 'Aadhaar Card', category: 'id' },
  { name: 'PAN Card', category: 'financial' },
  { name: 'Health Insurance', category: 'insurance' },
  { name: 'Car Insurance', category: 'vehicle' },
  { name: 'Vehicle Registration (RC)', category: 'vehicle' },
  { name: 'Pollution Certificate (PUC)', category: 'vehicle' },
  { name: 'Visa', category: 'travel' },
  { name: 'Lease Agreement', category: 'property' },
];

/* ───── Helpers ───── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  if (!iso) return '\u2014';
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntilExpiry(doc: Document): number {
  const expiry = new Date(doc.expiryDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatus(doc: Document): StatusInfo {
  const days = daysUntilExpiry(doc);
  if (days < 0) return { label: 'Expired', color: '#DC2626', bgColor: '#FEE2E2', icon: 'alert-circle' };
  if (days <= 30) return { label: 'Expiring Soon', color: '#D97706', bgColor: '#FEF3C7', icon: 'warning' };
  if (days <= 90) return { label: 'Upcoming', color: '#2563EB', bgColor: '#DBEAFE', icon: 'time' };
  return { label: 'Valid', color: '#059669', bgColor: '#D1FAE5', icon: 'checkmark-circle' };
}

function getValidityProgress(doc: Document): number {
  const issue = new Date(doc.issueDate + 'T00:00:00').getTime();
  const expiry = new Date(doc.expiryDate + 'T00:00:00').getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const total = expiry - issue;
  if (total <= 0) return 1;
  const elapsed = now.getTime() - issue;
  return Math.min(1, Math.max(0, elapsed / total));
}

function getCategoryInfo(catId: string) {
  return CATEGORY_MAP[catId] || CATEGORY_MAP['other'];
}

/* ───── Component ───── */

export default function DocumentExpiryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('id');
  const [formIssueDate, setFormIssueDate] = useState(todayISO());
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formDocNumber, setFormDocNumber] = useState('');
  const [formIssuedBy, setFormIssuedBy] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    loadJSON<Document[]>(KEYS.documentExpiry, []).then(setDocuments);
  }, []);

  const persist = useCallback((docs: Document[]) => {
    setDocuments(docs);
    saveJSON(KEYS.documentExpiry, docs);
  }, []);

  /* ───── Stats ───── */

  const stats = useMemo(() => {
    let expired = 0;
    let expiring = 0;
    let valid = 0;
    for (const doc of documents) {
      const days = daysUntilExpiry(doc);
      if (days < 0) expired++;
      else if (days <= 30) expiring++;
      else valid++;
    }
    return { expired, expiring, valid, total: documents.length };
  }, [documents]);

  /* ───── Filtered & sorted list ───── */

  const sortedDocuments = useMemo(() => {
    let list = [...documents];
    list.sort((a, b) => daysUntilExpiry(a) - daysUntilExpiry(b));
    if (filter === 'expired') list = list.filter(d => daysUntilExpiry(d) < 0);
    else if (filter === 'expiring') list = list.filter(d => { const days = daysUntilExpiry(d); return days >= 0 && days <= 30; });
    else if (filter === 'valid') list = list.filter(d => daysUntilExpiry(d) > 30);
    return list;
  }, [documents, filter]);

  /* ───── Detail document ───── */

  const detailDoc = documents.find(d => d.id === showDetailModal);

  /* ───── Form helpers ───── */

  const resetForm = () => {
    setFormName('');
    setFormCategory('id');
    setFormIssueDate(todayISO());
    setFormExpiryDate('');
    setFormDocNumber('');
    setFormIssuedBy('');
    setFormNotes('');
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (doc: Document) => {
    setFormName(doc.name);
    setFormCategory(doc.category);
    setFormIssueDate(doc.issueDate);
    setFormExpiryDate(doc.expiryDate);
    setFormDocNumber(doc.documentNumber);
    setFormIssuedBy(doc.issuedBy);
    setFormNotes(doc.notes);
    setEditingId(doc.id);
    setShowDetailModal(null);
    setShowAddModal(true);
  };

  const selectPreset = (preset: typeof PRESETS[0]) => {
    setFormName(preset.name);
    setFormCategory(preset.category);
  };

  const saveDocument = () => {
    if (!formName.trim() || !formExpiryDate.trim()) return;
    if (editingId) {
      const updated = documents.map(d =>
        d.id === editingId
          ? {
              ...d,
              name: formName.trim(),
              category: formCategory,
              issueDate: formIssueDate,
              expiryDate: formExpiryDate,
              documentNumber: formDocNumber.trim(),
              issuedBy: formIssuedBy.trim(),
              notes: formNotes.trim(),
            }
          : d
      );
      persist(updated);
    } else {
      const newDoc: Document = {
        id: uid(),
        name: formName.trim(),
        category: formCategory,
        issueDate: formIssueDate,
        expiryDate: formExpiryDate,
        documentNumber: formDocNumber.trim(),
        issuedBy: formIssuedBy.trim(),
        notes: formNotes.trim(),
        createdAt: todayISO(),
      };
      persist([...documents, newDoc]);
    }
    setShowAddModal(false);
    resetForm();
  };

  const deleteDocument = (id: string) => {
    Alert.alert('Delete Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          persist(documents.filter(d => d.id !== id));
          setShowDetailModal(null);
        },
      },
    ]);
  };

  /* ───── Render: Summary cards ───── */

  const renderSummary = () => (
    <View style={styles.summaryRow}>
      {[
        { key: 'expired' as FilterKey, val: stats.expired, label: 'Expired', color: '#DC2626', bg: '#FEE2E2', ic: 'alert-circle' },
        { key: 'expiring' as FilterKey, val: stats.expiring, label: 'Expiring', color: '#D97706', bg: '#FEF3C7', ic: 'warning' },
        { key: 'valid' as FilterKey, val: stats.valid, label: 'Valid', color: '#059669', bg: '#D1FAE5', ic: 'checkmark-circle' },
      ].map(s => (
        <TouchableOpacity
          key={s.key}
          style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: filter === s.key ? s.color : colors.border }]}
          onPress={() => setFilter(filter === s.key ? 'all' : s.key)}
          activeOpacity={0.7}
        >
          <View style={[styles.summaryIconWrap, { backgroundColor: s.bg }]}>
            <Ionicons name={s.ic as any} size={18} color={s.color} />
          </View>
          <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{s.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /* ───── Render: Filter pills ───── */

  const renderFilterPills = () => (
    <View style={styles.filterRow}>
      {([
        { key: 'all' as FilterKey, label: `All (${stats.total})` },
        { key: 'expired' as FilterKey, label: `Expired (${stats.expired})` },
        { key: 'expiring' as FilterKey, label: `Expiring Soon (${stats.expiring})` },
        { key: 'valid' as FilterKey, label: `Valid (${stats.valid})` },
      ]).map(f => (
        <TouchableOpacity
          key={f.key}
          style={[
            styles.filterPill,
            {
              backgroundColor: filter === f.key ? ACCENT : colors.card,
              borderColor: filter === f.key ? ACCENT : colors.border,
            },
          ]}
          onPress={() => setFilter(f.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterPillText, { color: filter === f.key ? '#fff' : colors.textSub }]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /* ───── Render: Document card ───── */

  const renderDocCard = ({ item }: { item: Document }) => {
    const status = getStatus(item);
    const days = daysUntilExpiry(item);
    const cat = getCategoryInfo(item.category);
    const progress = getValidityProgress(item);
    const barColor = progress > 0.9 ? '#DC2626' : progress > 0.75 ? '#D97706' : progress > 0.5 ? '#2563EB' : '#059669';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowDetailModal(item.id)}
        activeOpacity={0.7}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: cat.color + '18' }]}>
            <Ionicons name={cat.icon as any} size={22} color={cat.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            {item.documentNumber ? (
              <Text style={[styles.cardDocNum, { color: colors.textMuted }]} numberOfLines={1}>{item.documentNumber}</Text>
            ) : (
              <Text style={[styles.cardDocNum, { color: colors.textMuted }]}>{cat.label}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: colors.textSub }]}>Expires: {formatDate(item.expiryDate)}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: days < 0 ? '#DC2626' : days <= 30 ? '#D97706' : colors.textSub }]}>
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Expires today' : `${days}d left`}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
        </View>
      </TouchableOpacity>
    );
  };

  /* ───── Render: Empty state ───── */

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="document-text-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Documents Yet</Text>
      <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
        Track your important documents{'\n'}and never miss an expiry date
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: ACCENT }]} onPress={openAddModal} activeOpacity={0.7}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Add First Document</Text>
      </TouchableOpacity>
    </View>
  );

  /* ───── Render: Add / Edit modal ───── */

  const renderAddEditModal = () => {
    const isEditing = !!editingId;
    const canSave = formName.trim() && formExpiryDate.trim();

    return (
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => { setShowAddModal(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{isEditing ? 'Edit Document' : 'Add Document'}</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {/* Presets - only when adding */}
              {!isEditing && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Quick Add</Text>
                  <View style={styles.presetGrid}>
                    {PRESETS.filter(p => !documents.some(d => d.name === p.name)).map(p => (
                      <TouchableOpacity
                        key={p.name}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: formName === p.name ? ACCENT + '18' : colors.card,
                            borderColor: formName === p.name ? ACCENT : colors.border,
                          },
                        ]}
                        onPress={() => selectPreset(p)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={getCategoryInfo(p.category).icon as any} size={14} color={formName === p.name ? ACCENT : getCategoryInfo(p.category).color} />
                        <Text style={[styles.presetText, { color: formName === p.name ? ACCENT : colors.text }]} numberOfLines={1}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {PRESETS.filter(p => !documents.some(d => d.name === p.name)).length > 0 && (
                    <View style={styles.dividerRow}>
                      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.dividerText, { color: colors.textMuted }]}>or add custom</Text>
                      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>
                  )}
                </>
              )}

              {/* Category picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryScrollContent}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: formCategory === cat.id ? cat.color + '18' : colors.card,
                        borderColor: formCategory === cat.id ? cat.color : colors.border,
                      },
                    ]}
                    onPress={() => setFormCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cat.icon as any} size={16} color={formCategory === cat.id ? cat.color : colors.textMuted} />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: formCategory === cat.id ? cat.color : colors.textSub },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Name */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Document Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Passport"
                placeholderTextColor={colors.textMuted}
              />

              {/* Document number */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Document Number (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formDocNumber}
                onChangeText={setFormDocNumber}
                placeholder="e.g. A1234567"
                placeholderTextColor={colors.textMuted}
              />

              {/* Issued by */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Issued By (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formIssuedBy}
                onChangeText={setFormIssuedBy}
                placeholder="e.g. Government of India"
                placeholderTextColor={colors.textMuted}
              />

              {/* Issue date */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Issue Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formIssueDate}
                onChangeText={setFormIssueDate}
                placeholder={todayISO()}
                placeholderTextColor={colors.textMuted}
              />

              {/* Expiry date */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Expiry Date (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formExpiryDate}
                onChangeText={setFormExpiryDate}
                placeholder="e.g. 2030-12-31"
                placeholderTextColor={colors.textMuted}
              />

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: ACCENT, opacity: canSave ? 1 : 0.5 }]}
              onPress={saveDocument}
              disabled={!canSave}
              activeOpacity={0.7}
            >
              <Ionicons name={isEditing ? 'checkmark-circle' : 'add-circle'} size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{isEditing ? 'Save Changes' : 'Add Document'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  /* ───── Render: Detail modal ───── */

  const renderDetailModal = () => {
    if (!detailDoc) return null;
    const status = getStatus(detailDoc);
    const days = daysUntilExpiry(detailDoc);
    const cat = getCategoryInfo(detailDoc.category);
    const progress = getValidityProgress(detailDoc);

    return (
      <Modal visible={!!showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '88%' }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={[styles.detailIconWrap, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>{detailDoc.name}</Text>
              </View>
              <View style={styles.detailActions}>
                <TouchableOpacity onPress={() => openEditModal(detailDoc)} style={[styles.smallBtn, { backgroundColor: colors.card }]}>
                  <Ionicons name="create-outline" size={16} color={colors.textSub} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowDetailModal(null)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status banner */}
              <View style={[styles.detailStatus, { backgroundColor: status.bgColor, borderColor: status.color + '30' }]}>
                <Ionicons name={status.icon as any} size={24} color={status.color} />
                <View style={styles.detailStatusInfo}>
                  <Text style={[styles.detailStatusLabel, { color: status.color }]}>{status.label}</Text>
                  <Text style={[styles.detailStatusSub, { color: status.color + 'CC' }]}>
                    {days < 0
                      ? `${Math.abs(days)} days since expired`
                      : days === 0
                        ? 'Expires today!'
                        : `${days} days remaining`}
                  </Text>
                </View>
                <View style={styles.detailDaysBig}>
                  <Text style={[styles.detailDaysNum, { color: status.color }]}>{Math.abs(days)}</Text>
                  <Text style={[styles.detailDaysUnit, { color: status.color + 'CC' }]}>{days < 0 ? 'overdue' : 'days'}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.detailProgressSection}>
                <View style={styles.detailProgressLabels}>
                  <Text style={[styles.detailProgressLabel, { color: colors.textMuted }]}>Validity consumed</Text>
                  <Text style={[styles.detailProgressPct, { color: colors.textSub }]}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={[styles.detailProgressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.detailProgressFill,
                      {
                        width: `${progress * 100}%`,
                        backgroundColor: progress > 0.9 ? '#DC2626' : progress > 0.75 ? '#D97706' : '#059669',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Info grid */}
              <View style={styles.infoGrid}>
                <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Category</Text>
                  <View style={styles.infoCellRow}>
                    <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                    <Text style={[styles.infoCellValue, { color: colors.text }]}>{cat.label}</Text>
                  </View>
                </View>

                {detailDoc.documentNumber ? (
                  <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Document No.</Text>
                    <Text style={[styles.infoCellValue, { color: colors.text }]} numberOfLines={1}>{detailDoc.documentNumber}</Text>
                  </View>
                ) : null}

                <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Issue Date</Text>
                  <Text style={[styles.infoCellValue, { color: colors.text }]}>{formatDate(detailDoc.issueDate)}</Text>
                </View>

                <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Expiry Date</Text>
                  <Text style={[styles.infoCellValue, { color: colors.text }]}>{formatDate(detailDoc.expiryDate)}</Text>
                </View>

                {detailDoc.issuedBy ? (
                  <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Issued By</Text>
                    <Text style={[styles.infoCellValue, { color: colors.text }]} numberOfLines={1}>{detailDoc.issuedBy}</Text>
                  </View>
                ) : null}

                <View style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>Added On</Text>
                  <Text style={[styles.infoCellValue, { color: colors.text }]}>{formatDate(detailDoc.createdAt)}</Text>
                </View>
              </View>

              {/* Notes */}
              {detailDoc.notes ? (
                <View style={[styles.notesSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.notesSectionHeader}>
                    <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.notesSectionTitle, { color: colors.textSub }]}>Notes</Text>
                  </View>
                  <Text style={[styles.notesText, { color: colors.text }]}>{detailDoc.notes}</Text>
                </View>
              ) : null}

              {/* Delete button */}
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: '#DC262640' }]}
                onPress={() => deleteDocument(detailDoc.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.deleteBtnText}>Delete Document</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  /* ───── Render: FAB ───── */

  const renderFab = () => (
    <TouchableOpacity onPress={openAddModal} style={styles.fab} activeOpacity={0.7}>
      <View style={styles.fabInner}>
        <Ionicons name="add" size={28} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  /* ───── Main return ───── */

  return (
    <ScreenShell title="Document Expiry" accentColor={ACCENT} scrollable={false}>
      {documents.length === 0 ? renderEmpty() : (
        <FlatList
          data={sortedDocuments}
          keyExtractor={item => item.id}
          renderItem={renderDocCard}
          ListHeaderComponent={
            <>
              {renderSummary()}
              {renderFilterPills()}
            </>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Ionicons name="funnel-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No documents in this filter</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {documents.length > 0 && renderFab()}
      {renderAddEditModal()}
      {renderDetailModal()}
    </ScreenShell>
  );
}

/* ═══════ STYLES ═══════ */

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    /* Summary */
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
    summaryCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5 },
    summaryIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    summaryVal: { fontSize: 22, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 1 },

    /* Filter row */
    filterRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    filterPill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterPillText: { fontSize: 12, fontFamily: Fonts.medium },

    /* Card */
    card: { borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontFamily: Fonts.semibold },
    cardDocNum: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    statusText: { fontSize: 11, fontFamily: Fonts.semibold },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, flexWrap: 'wrap', gap: 4 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { fontSize: 11, fontFamily: Fonts.regular },
    progressTrack: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },
    progressFill: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },

    /* Empty */
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingTop: 60 },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
    emptyTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
    emptyDesc: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.pill },
    emptyBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold },

    /* Modal common */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalTitle: { fontSize: 20, fontFamily: Fonts.bold, flex: 1 },

    /* Presets */
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 13, fontFamily: Fonts.medium },

    /* Divider */
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 12, fontFamily: Fonts.regular },

    /* Category scroll */
    categoryScroll: { marginBottom: Spacing.sm },
    categoryScrollContent: { gap: Spacing.sm, paddingVertical: Spacing.xs },
    categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    categoryChipText: { fontSize: 13, fontFamily: Fonts.medium },

    /* Form */
    sectionLabel: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
    fieldLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4, marginTop: Spacing.md },
    input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15, fontFamily: Fonts.regular },
    textArea: { minHeight: 72, textAlignVertical: 'top' },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg, marginTop: Spacing.xl },
    primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semibold },

    /* Detail modal */
    detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    detailIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    detailActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    smallBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    detailStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.lg },
    detailStatusInfo: { flex: 1 },
    detailStatusLabel: { fontSize: 16, fontFamily: Fonts.bold },
    detailStatusSub: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 2 },
    detailDaysBig: { alignItems: 'center' },
    detailDaysNum: { fontSize: 28, fontFamily: Fonts.bold },
    detailDaysUnit: { fontSize: 10, fontFamily: Fonts.medium, marginTop: -2 },

    /* Detail progress */
    detailProgressSection: { marginBottom: Spacing.lg },
    detailProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    detailProgressLabel: { fontSize: 12, fontFamily: Fonts.medium },
    detailProgressPct: { fontSize: 12, fontFamily: Fonts.semibold },
    detailProgressTrack: { height: 6, borderRadius: 3 },
    detailProgressFill: { height: 6, borderRadius: 3 },

    /* Info grid */
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    infoCell: { width: '48%' as any, flexGrow: 1, flexBasis: '46%', padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, gap: 3 },
    infoCellLabel: { fontSize: 10, fontFamily: Fonts.medium },
    infoCellRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    infoCellValue: { fontSize: 14, fontFamily: Fonts.semibold },

    /* Notes section */
    notesSection: { padding: Spacing.lg, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    notesSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    notesSectionTitle: { fontSize: 13, fontFamily: Fonts.semibold },
    notesText: { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 20 },

    /* Delete */
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.xl, marginBottom: Spacing.xxl },
    deleteBtnText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.semibold },

    /* No results */
    noResults: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
    noResultsText: { fontSize: 14, fontFamily: Fonts.medium },

    /* FAB */
    fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl },
    fabInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#D946EF',
      elevation: 6,
      shadowColor: '#D946EF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
  });
