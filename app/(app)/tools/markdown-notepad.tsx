import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { useAppTheme } from '@/components/ThemeProvider';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
type MdFile = {
  id: string;
  name: string;
  content: string;
  defaultContent: string;
  updatedAt: number;
};

type TabMode = 'edit' | 'preview';

// ── Markdown parser (unchanged) ───────────────────────────────────────────────
type MdNode =
  | { t: 'h1' | 'h2' | 'h3'; text: string }
  | { t: 'p'; parts: MdPart[] }
  | { t: 'li'; parts: MdPart[] }
  | { t: 'blockquote'; text: string }
  | { t: 'code'; text: string }
  | { t: 'hr' };

type MdPart = { kind: 'bold' | 'italic' | 'code' | 'link' | 'text'; text: string; href?: string };

function parseInline(line: string): MdPart[] {
  const parts: MdPart[] = [];
  let rest = line;
  while (rest.length > 0) {
    const boldM   = rest.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    const italicM = rest.match(/^(.*?)\*(.+?)\*(.*)/s);
    const codeM   = rest.match(/^(.*?)`([^`]+)`(.*)/s);
    const linkM   = rest.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
    const cands: { idx: number; type: string; m: RegExpMatchArray }[] = [];
    if (boldM)   cands.push({ idx: boldM[1].length,   type: 'bold',   m: boldM });
    if (italicM) cands.push({ idx: italicM[1].length, type: 'italic', m: italicM });
    if (codeM)   cands.push({ idx: codeM[1].length,   type: 'code',   m: codeM });
    if (linkM)   cands.push({ idx: linkM[1].length,   type: 'link',   m: linkM });
    if (!cands.length) { parts.push({ kind: 'text', text: rest }); break; }
    cands.sort((a, b) => a.idx - b.idx);
    const w = cands[0];
    if (w.m[1]) parts.push({ kind: 'text', text: w.m[1] });
    if (w.type === 'bold')   parts.push({ kind: 'bold',   text: w.m[2] });
    else if (w.type === 'italic') parts.push({ kind: 'italic', text: w.m[2] });
    else if (w.type === 'code')   parts.push({ kind: 'code',   text: w.m[2] });
    else if (w.type === 'link')   parts.push({ kind: 'link',   text: w.m[2], href: w.m[3] });
    rest = w.type === 'link' ? w.m[4] : w.m[3];
  }
  return parts;
}

function parseMarkdown(src: string): MdNode[] {
  const lines = src.split('\n');
  const nodes: MdNode[] = [];
  let codeBlock = false;
  let codeLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (codeBlock) { nodes.push({ t: 'code', text: codeLines.join('\n') }); codeLines = []; codeBlock = false; }
      else codeBlock = true;
      continue;
    }
    if (codeBlock) { codeLines.push(line); continue; }
    if (line.startsWith('### ')) { nodes.push({ t: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## '))  { nodes.push({ t: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# '))   { nodes.push({ t: 'h1', text: line.slice(2) }); continue; }
    if (line.startsWith('> '))   { nodes.push({ t: 'blockquote', text: line.slice(2) }); continue; }
    if (line === '---')           { nodes.push({ t: 'hr' }); continue; }
    if (line.startsWith('- ') || line.startsWith('* ')) { nodes.push({ t: 'li', parts: parseInline(line.slice(2)) }); continue; }
    if (line.trim()) nodes.push({ t: 'p', parts: parseInline(line) });
  }
  return nodes;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES = [
  `# Welcome to Markdown Notepad

Write **bold**, *italic*, or \`inline code\` here.

## Features
- Live preview as you type
- Auto-saved to device
- Multiple files supported

> Blockquotes work too!

### Code Block
\`\`\`
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

---

[Example Link](https://example.com)`,

  `# Meeting Notes

**Date:** —  **Attendees:** —

## Agenda
- Item 1
- Item 2
- Item 3

## Discussion

> Key decisions made here.

## Action Items
- Task 1 — Owner
- Task 2 — Owner

---

*Next meeting: —*`,

  `# Project Notes

## Overview

Brief description of the project.

## Goals
- Goal 1
- Goal 2

## Implementation

### Step 1
\`\`\`
npm install
npm run start
\`\`\`

### Step 2

Details here.

---

*Last updated: —*`,

  `# Daily Journal

**Date:** —

## Today's Focus
1.
2.
3.

## Notes

> What went well today?

## Tomorrow
-

---

*Mood: — | Energy: —*`,

  `# Recipe

**Prep:** — | **Cook:** — | **Serves:** —

## Ingredients
- Ingredient 1
- Ingredient 2
- Ingredient 3

## Instructions
1. Step one.
2. Step two.
3. Step three.

> *Chef's tip: —*

---

*Difficulty: —*`,
];

function randomTemplate(): string {
  return TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
}

function newFile(name = 'Untitled', content?: string): MdFile {
  const c = content ?? randomTemplate();
  return { id: Date.now().toString(36), name, content: c, defaultContent: c, updatedAt: Date.now() };
}

// ── Editor view ───────────────────────────────────────────────────────────────
type Colors = ReturnType<typeof useAppTheme>['colors'];

// ── Markdown cheat sheet data ─────────────────────────────────────────────────
const MD_CHEATSHEET: { title: string; syntax: string; rendered: string }[] = [
  { title: 'Heading 1',      syntax: '# Heading',           rendered: 'Large title' },
  { title: 'Heading 2',      syntax: '## Heading',          rendered: 'Medium title' },
  { title: 'Heading 3',      syntax: '### Heading',         rendered: 'Small title' },
  { title: 'Bold',           syntax: '**bold text**',       rendered: 'bold text' },
  { title: 'Italic',         syntax: '*italic text*',       rendered: 'italic text' },
  { title: 'Inline code',    syntax: '`code`',              rendered: 'code' },
  { title: 'Link',           syntax: '[title](url)',        rendered: 'title (clickable)' },
  { title: 'Bullet list',    syntax: '- item',              rendered: '• item' },
  { title: 'Blockquote',     syntax: '> quote text',        rendered: '│ quote text' },
  { title: 'Code block',     syntax: '```\ncode\n```',      rendered: 'code block' },
  { title: 'Horizontal rule',syntax: '---',                 rendered: '────────' },
  { title: 'Line break',     syntax: '(empty line)',        rendered: 'New paragraph' },
];

function Editor({
  file,
  colors,
  onBack,
  onDelete,
}: {
  file: MdFile;
  colors: Colors;
  onBack: (updated: MdFile) => void;
  onDelete: (id: string) => void;
}) {
  const s = useMemo(() => editorStyles(colors), [colors]);
  const [name, setName]       = useState(file.name);
  const [content, setContent] = useState(file.content);
  const [tab, setTab]         = useState<TabMode>('edit');
  const [editName, setEditName] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodes = useMemo(() => parseMarkdown(content), [content]);

  const save = useCallback((n: string, c: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onBack({ ...file, name: n.trim() || 'Untitled', content: c, updatedAt: Date.now() });
    }, 600);
  }, [file, onBack]);

  const handleContent = (c: string) => { setContent(c); save(name, c); };
  const handleName    = (n: string) => { setName(n);    save(n, content); };

  const confirmDelete = () =>
    Alert.alert('Delete File', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(file.id) },
    ]);

  const confirmReset = () =>
    Alert.alert('Reset to Default', 'Restore the original template content? Your changes will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => handleContent(file.defaultContent ?? '') },
    ]);

  const confirmClear = () =>
    Alert.alert('Clear Content', 'Remove all content from this file?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => handleContent('') },
    ]);

  const renderParts = (parts: MdPart[]) =>
    parts.map((p, i) => {
      if (p.kind === 'bold')   return <Text key={i} style={{ fontFamily: Fonts.bold }}>{p.text}</Text>;
      if (p.kind === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{p.text}</Text>;
      if (p.kind === 'code')   return <Text key={i} style={[s.inlineCode, { backgroundColor: colors.glass, color: colors.accent }]}>{p.text}</Text>;
      if (p.kind === 'link')   return <Text key={i} style={{ color: colors.accent, textDecorationLine: 'underline' }}>{p.text}</Text>;
      return <Text key={i}>{p.text}</Text>;
    });

  const renderNode = (node: MdNode, i: number) => {
    switch (node.t) {
      case 'h1': return <Text key={i} style={[s.h1, { color: colors.text }]}>{node.text}</Text>;
      case 'h2': return <Text key={i} style={[s.h2, { color: colors.text }]}>{node.text}</Text>;
      case 'h3': return <Text key={i} style={[s.h3, { color: colors.text }]}>{node.text}</Text>;
      case 'p':  return <Text key={i} style={[s.p, { color: colors.textSub }]}>{renderParts(node.parts)}</Text>;
      case 'li': return (
        <View key={i} style={s.liRow}>
          <Text style={[s.liBullet, { color: colors.accent }]}>•</Text>
          <Text style={[s.liText, { color: colors.textSub }]}>{renderParts(node.parts)}</Text>
        </View>
      );
      case 'blockquote': return (
        <View key={i} style={[s.blockquote, { borderLeftColor: colors.accent, backgroundColor: colors.glass }]}>
          <Text style={[s.p, { color: colors.textSub }]}>{node.text}</Text>
        </View>
      );
      case 'code': return (
        <View key={i} style={[s.codeBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.codeText, { color: colors.text }]}>{node.text}</Text>
        </View>
      );
      case 'hr': return <View key={i} style={[s.hr, { backgroundColor: colors.border }]} />;
      default:   return null;
    }
  };

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => onBack({ ...file, name: name.trim() || 'Untitled', content, updatedAt: Date.now() })}
          style={[s.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {editName ? (
          <TextInput
            style={[s.nameInput, { color: colors.text, borderBottomColor: colors.accent }]}
            value={name}
            onChangeText={handleName}
            onBlur={() => setEditName(false)}
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={() => setEditName(false)}
          />
        ) : (
          <TouchableOpacity style={s.nameBtn} onPress={() => setEditName(true)}>
            <Text style={[s.nameText, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => setShowHelp(true)} style={[s.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Ionicons name="help-circle-outline" size={20} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={[s.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[s.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['edit', 'preview'] as TabMode[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && { backgroundColor: '#64748B' }]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'edit' ? 'create-outline' : 'eye-outline'}
              size={15}
              color={tab === t ? '#fff' : colors.textMuted}
            />
            <Text style={[s.tabText, { color: tab === t ? '#fff' : colors.textMuted }]}>
              {t === 'edit' ? 'Editor' : 'Preview'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {tab === 'edit' ? (
        <TextInput
          style={[s.editor, { backgroundColor: colors.inputBg, color: colors.text }]}
          value={content}
          onChangeText={handleContent}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          placeholder="Start writing markdown…"
          placeholderTextColor={colors.textMuted}
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.previewContent} showsVerticalScrollIndicator={false}>
          {nodes.length > 0 ? nodes.map(renderNode) : (
            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
              Nothing to preview yet.
            </Text>
          )}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={[s.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[s.footerText, { color: colors.textMuted }]}>
          {wordCount(content)} words · {content.length} chars
        </Text>
        <View style={s.footerActions}>
          <TouchableOpacity style={[s.footerBtn, { borderColor: colors.border }]} onPress={confirmReset}>
            <Ionicons name="refresh-outline" size={13} color={colors.textMuted} />
            <Text style={[s.footerBtnText, { color: colors.textMuted }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.footerBtn, { borderColor: colors.error + '60' }]} onPress={confirmClear}>
            <Ionicons name="trash-outline" size={13} color={colors.error} />
            <Text style={[s.footerBtnText, { color: colors.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Markdown Cheat Sheet Modal ── */}
      <KeyboardAwareModal visible={showHelp} transparent animationType="slide" onRequestClose={() => setShowHelp(false)}>
        <View style={s.helpOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setShowHelp(false)} />
          <View style={[s.helpSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.helpHandle, { backgroundColor: colors.border }]} />
            <View style={s.helpHeader}>
              <Text style={[s.helpTitle, { color: colors.text }]}>Markdown Cheat Sheet</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[s.helpSub, { color: colors.textMuted }]}>
              Tap any row to insert it into your note.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {MD_CHEATSHEET.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.helpRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    // Insert the syntax at the end of the current content
                    const insert = item.syntax.includes('\n') ? `\n${item.syntax}\n` : `\n${item.syntax}`;
                    handleContent(content + insert);
                    setShowHelp(false);
                    setTab('edit');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.helpRowTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[s.helpRowSyntax, { color: colors.accent, backgroundColor: colors.glass }]}>
                      {item.syntax}
                    </Text>
                  </View>
                  <Text style={[s.helpRowRendered, { color: colors.textMuted }]}>{item.rendered}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>
    </SafeAreaView>
  );
}

const editorStyles = (c: Colors) => StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  iconBtn:      { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  nameBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameText:     { flex: 1, fontFamily: Fonts.bold, fontSize: 16 },
  nameInput:    { flex: 1, fontFamily: Fonts.bold, fontSize: 16, borderBottomWidth: 1.5, paddingBottom: 2 },
  tabs:         { flexDirection: 'row', margin: Spacing.lg, marginBottom: 0, borderRadius: Radii.pill, padding: 3, gap: 4, borderWidth: 1 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: Radii.pill, gap: 5 },
  tabText:      { fontSize: 13, fontFamily: Fonts.semibold },
  editor:       { flex: 1, fontFamily: 'monospace', fontSize: 13, padding: Spacing.lg, lineHeight: 22, margin: Spacing.lg, marginTop: Spacing.sm, borderRadius: Radii.lg },
  previewContent: { padding: Spacing.lg, paddingBottom: Spacing.huge },
  h1:           { fontSize: 22, fontFamily: Fonts.bold, marginTop: 14, marginBottom: 6 },
  h2:           { fontSize: 18, fontFamily: Fonts.bold, marginTop: 12, marginBottom: 5 },
  h3:           { fontSize: 15, fontFamily: Fonts.semibold, marginTop: 10, marginBottom: 4 },
  p:            { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 22, marginBottom: 8 },
  liRow:        { flexDirection: 'row', gap: 8, marginBottom: 5 },
  liBullet:     { fontSize: 16, lineHeight: 22 },
  liText:       { flex: 1, fontSize: 14, fontFamily: Fonts.regular, lineHeight: 22 },
  blockquote:   { borderLeftWidth: 3, paddingLeft: Spacing.md, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
  codeBlock:    { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.md, marginBottom: 8 },
  codeText:     { fontFamily: 'monospace', fontSize: 12, lineHeight: 20 },
  inlineCode:   { fontFamily: 'monospace', fontSize: 12, borderRadius: 4, paddingHorizontal: 4 },
  hr:           { height: 1, marginVertical: 12 },
  footer:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1 },
  footerText:       { fontSize: 11, fontFamily: Fonts.regular },
  footerActions:    { flexDirection: 'row', gap: 6 },
  footerBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
  footerBtnText:    { fontSize: 11, fontFamily: Fonts.medium },
  // Help modal
  helpOverlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  helpSheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.lg, paddingBottom: 36 },
  helpHandle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
  helpHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  helpTitle:        { fontSize: 18, fontFamily: Fonts.bold },
  helpSub:          { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.md },
  helpRow:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  helpRowTitle:     { fontSize: 13, fontFamily: Fonts.semibold, marginBottom: 3 },
  helpRowSyntax:    { fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', overflow: 'hidden' },
  helpRowRendered:  { fontSize: 12, fontFamily: Fonts.medium, maxWidth: 100, textAlign: 'right' },
});

// ── File list screen ──────────────────────────────────────────────────────────
export default function MarkdownNotepadScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [files, setFiles]       = useState<MdFile[]>([]);
  const [openFile, setOpenFile] = useState<MdFile | null>(null);

  useEffect(() => {
    loadJSON<MdFile[]>(KEYS.mdFiles, []).then(setFiles);
  }, []);

  const persist = useCallback((next: MdFile[]) => {
    setFiles(next);
    saveJSON(KEYS.mdFiles, next);
  }, []);

  const createFile = () => {
    const f = newFile(`Untitled ${files.length + 1}`);
    const next = [f, ...files];
    persist(next);
    setOpenFile(f);
  };

  const handleBack = useCallback((updated: MdFile) => {
    setOpenFile(updated);
    setFiles((prev) => {
      const next = prev.some((f) => f.id === updated.id)
        ? prev.map((f) => (f.id === updated.id ? updated : f))
        : [updated, ...prev];
      saveJSON(KEYS.mdFiles, next);
      return next;
    });
  }, []);

  const handleClose = () => setOpenFile(null);

  const handleDelete = useCallback((id: string) => {
    setOpenFile(null);
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveJSON(KEYS.mdFiles, next);
      return next;
    });
  }, []);

  // ── Editor mode ──
  if (openFile) {
    return (
      <Editor
        file={openFile}
        colors={colors}
        onBack={(updated) => { handleBack(updated); handleClose(); }}
        onDelete={handleDelete}
      />
    );
  }

  // ── File list mode ──
  return (
    <ScreenShell
      title="Markdown Notepad"
      accentColor="#64748B"
      scrollable={false}
      rightAction={
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#64748B' }]} onPress={createFile}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      }
    >
      <FlatList
        data={files}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No files yet</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Tap + to create your first markdown file
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const preview = item.content.split('\n').find((l) => l.trim()) ?? '';
          const wc = wordCount(item.content);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.cardTouchable}
                onPress={() => setOpenFile(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.cardIcon, { backgroundColor: '#64748B18' }]}>
                  <Ionicons name="document-text-outline" size={22} color="#64748B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.cardPreview, { color: colors.textMuted }]} numberOfLines={1}>
                    {preview || 'Empty file'}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>{wc} words</Text>
                    <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>{fmtDate(item.updatedAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: colors.error + '50' }]}
                onPress={() =>
                  Alert.alert('Delete File', `Delete "${item.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </ScreenShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (c: Colors) => StyleSheet.create({
  addBtn:       { width: 34, height: 34, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  list:         { paddingBottom: Spacing.huge },
  empty:        { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:   { fontFamily: Fonts.bold, fontSize: 18 },
  emptySub:     { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card:         { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
  cardTouchable:{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  cardIcon:     { width: 44, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  cardName:     { fontFamily: Fonts.semibold, fontSize: 15, marginBottom: 2 },
  cardPreview:  { fontFamily: Fonts.regular, fontSize: 13, marginBottom: 4 },
  deleteBtn:    { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:     { fontFamily: Fonts.regular, fontSize: 11 },
  metaDot:      { fontFamily: Fonts.regular, fontSize: 11 },
});
