import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F97316';
const STORAGE_KEY = 'uk_recipes';

type Recipe = { id: string; title: string; category: string; servings: number; prepTime: string; cookTime: string; ingredients: string[]; instructions: string; favorite: boolean; createdAt: string };

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function RecipeBookScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [instructions, setInstructions] = useState('');

  useEffect(() => { loadJSON<Recipe[]>(STORAGE_KEY, []).then(setRecipes); }, []);
  const persist = useCallback((d: Recipe[]) => { setRecipes(d); saveJSON(STORAGE_KEY, d); }, []);

  const resetForm = () => {
    setTitle(''); setCategory('Other'); setServings('4'); setPrepTime(''); setCookTime('');
    setIngredients(['']); setInstructions(''); setEditId(null); setShowForm(false);
  };

  const saveRecipe = () => {
    if (!title.trim()) return;
    const recipe: Recipe = {
      id: editId ?? uid(), title: title.trim(), category, servings: parseInt(servings) || 1,
      prepTime: prepTime.trim(), cookTime: cookTime.trim(),
      ingredients: ingredients.filter(i => i.trim()), instructions: instructions.trim(),
      favorite: editId ? recipes.find(r => r.id === editId)?.favorite ?? false : false,
      createdAt: editId ? recipes.find(r => r.id === editId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };
    persist(editId ? recipes.map(r => r.id === editId ? recipe : r) : [recipe, ...recipes]);
    resetForm();
  };

  const editRecipe = (r: Recipe) => {
    setEditId(r.id); setTitle(r.title); setCategory(r.category); setServings(String(r.servings));
    setPrepTime(r.prepTime); setCookTime(r.cookTime); setIngredients(r.ingredients.length > 0 ? r.ingredients : ['']);
    setInstructions(r.instructions); setShowForm(true); setViewId(null);
  };

  const toggleFav = (id: string) => persist(recipes.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r));
  const deleteRecipe = (id: string) => { persist(recipes.filter(r => r.id !== id)); if (viewId === id) setViewId(null); };

  const addIngredient = () => setIngredients([...ingredients, '']);
  const updateIngredient = (i: number, val: string) => setIngredients(ingredients.map((ing, idx) => idx === i ? val : ing));
  const removeIngredient = (i: number) => setIngredients(ingredients.filter((_, idx) => idx !== i));

  const filtered = useMemo(() => {
    let list = recipes;
    if (filter !== 'All') list = list.filter(r => filter === 'Favorites' ? r.favorite : r.category === filter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(r => r.title.toLowerCase().includes(q)); }
    return list;
  }, [recipes, filter, search]);

  const viewing = viewId ? recipes.find(r => r.id === viewId) : null;

  // Detail view
  if (viewing) {
    return (
      <ScreenShell title="Recipe Book" accentColor={ACCENT}>
        <TouchableOpacity onPress={() => setViewId(null)} style={styles.backRow}>
          <Ionicons name="arrow-back" size={18} color={ACCENT} />
          <Text style={[styles.backText, { color: ACCENT }]}>All Recipes</Text>
        </TouchableOpacity>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.detailHeader}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{viewing.title}</Text>
            <TouchableOpacity onPress={() => toggleFav(viewing.id)}>
              <Ionicons name={viewing.favorite ? 'heart' : 'heart-outline'} size={22} color={viewing.favorite ? ACCENT : colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailMeta}>
            <View style={[styles.catBadge, { backgroundColor: ACCENT + '18' }]}><Text style={[styles.catBadgeText, { color: ACCENT }]}>{viewing.category}</Text></View>
            {viewing.servings > 0 && <Text style={[styles.metaText, { color: colors.textMuted }]}>{viewing.servings} servings</Text>}
            {viewing.prepTime ? <Text style={[styles.metaText, { color: colors.textMuted }]}>Prep: {viewing.prepTime}</Text> : null}
            {viewing.cookTime ? <Text style={[styles.metaText, { color: colors.textMuted }]}>Cook: {viewing.cookTime}</Text> : null}
          </View>
        </View>

        {viewing.ingredients.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Ingredients</Text>
            {viewing.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow}>
                <View style={[styles.ingDot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.ingText, { color: colors.text }]}>{ing}</Text>
              </View>
            ))}
          </View>
        )}

        {viewing.instructions ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Instructions</Text>
            <Text style={[styles.instrText, { color: colors.text }]}>{viewing.instructions}</Text>
          </View>
        ) : null}

        <View style={styles.detailActions}>
          <TouchableOpacity style={[styles.editBtn, { borderColor: ACCENT }]} onPress={() => editRecipe(viewing)}>
            <Ionicons name="create-outline" size={16} color={ACCENT} />
            <Text style={[styles.editText, { color: ACCENT }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.deleteBtn, { borderColor: '#EF4444' }]} onPress={() => deleteRecipe(viewing.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={[styles.deleteText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Recipe Book" accentColor={ACCENT}>
      {/* Search */}
      <TextInput style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={search} onChangeText={setSearch} placeholder="Search recipes..." placeholderTextColor={colors.textMuted} />

      {/* Filter + Add */}
      <View style={styles.filterRow}>
        {['All', 'Favorites', ...CATEGORIES].map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, { backgroundColor: filter === f ? ACCENT+'22' : colors.glass, borderColor: filter === f ? ACCENT : colors.border }]} onPress={() => setFilter(f)}>
            {f === 'Favorites' ? <Ionicons name="heart" size={10} color={filter === f ? ACCENT : colors.textMuted} /> : null}
            <Text style={[styles.filterText, { color: filter === f ? ACCENT : colors.textMuted }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.addRow, { backgroundColor: ACCENT }]} onPress={() => { resetForm(); setShowForm(true); }}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addText}>Add Recipe</Text>
      </TouchableOpacity>

      {/* Form */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{editId ? 'Edit Recipe' : 'New Recipe'}</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={title} onChangeText={setTitle} placeholder="Recipe name" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, { backgroundColor: category === c ? ACCENT+'22' : colors.glass, borderColor: category === c ? ACCENT : colors.border }]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, { color: category === c ? ACCENT : colors.textMuted }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.metaInputRow}>
            <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Servings</Text><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={servings} onChangeText={setServings} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Prep Time</Text><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={prepTime} onChangeText={setPrepTime} placeholder="15 min" placeholderTextColor={colors.textMuted} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Cook Time</Text><TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={cookTime} onChangeText={setCookTime} placeholder="30 min" placeholderTextColor={colors.textMuted} /></View>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Ingredients</Text>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingInputRow}>
              <TextInput style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={ing} onChangeText={v => updateIngredient(i, v)} placeholder={`Ingredient ${i+1}`} placeholderTextColor={colors.textMuted} />
              {ingredients.length > 1 && <TouchableOpacity onPress={() => removeIngredient(i)}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity>}
            </View>
          ))}
          <TouchableOpacity onPress={addIngredient} style={styles.addIngBtn}><Ionicons name="add-circle-outline" size={18} color={ACCENT} /><Text style={[styles.addIngText, { color: ACCENT }]}>Add Ingredient</Text></TouchableOpacity>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Instructions</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, minHeight: 80, textAlignVertical: 'top' }]} value={instructions} onChangeText={setInstructions} placeholder="Step-by-step instructions..." placeholderTextColor={colors.textMuted} multiline />
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}><Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={saveRecipe}><Text style={styles.saveBtnText}>{editId ? 'Update' : 'Save'}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recipe list */}
      {filtered.map(r => (
        <TouchableOpacity key={r.id} style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setViewId(r.id)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.recipeTitle, { color: colors.text }]}>{r.title}</Text>
            <View style={styles.recipeMeta}>
              <View style={[styles.catBadge, { backgroundColor: ACCENT+'15' }]}><Text style={[styles.catBadgeText, { color: ACCENT }]}>{r.category}</Text></View>
              {r.servings > 0 && <Text style={[styles.metaText, { color: colors.textMuted }]}>{r.servings} srv</Text>}
              {r.prepTime ? <Text style={[styles.metaText, { color: colors.textMuted }]}>{r.prepTime}</Text> : null}
              {r.ingredients.length > 0 && <Text style={[styles.metaText, { color: colors.textMuted }]}>{r.ingredients.length} items</Text>}
            </View>
          </View>
          <TouchableOpacity onPress={() => toggleFav(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={r.favorite ? 'heart' : 'heart-outline'} size={18} color={r.favorite ? ACCENT : colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {filtered.length === 0 && !showForm && (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={48} color={ACCENT+'40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recipes yet. Add your favorite recipes!</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },
    searchInput: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.md },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    filterText: { fontSize: 11, fontFamily: Fonts.medium },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    addText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    chipText: { fontSize: 11, fontFamily: Fonts.medium },
    metaInputRow: { flexDirection: 'row', gap: Spacing.sm },
    ingInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    addIngBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
    addIngText: { fontSize: 12, fontFamily: Fonts.medium },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    recipeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    recipeTitle: { fontSize: 15, fontFamily: Fonts.bold },
    recipeMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4, alignItems: 'center' },
    catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.sm },
    catBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
    metaText: { fontSize: 11, fontFamily: Fonts.regular },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
    backText: { fontSize: 13, fontFamily: Fonts.semibold },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    detailTitle: { fontSize: 20, fontFamily: Fonts.bold, flex: 1, marginRight: Spacing.md },
    detailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
    ingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    ingDot: { width: 6, height: 6, borderRadius: 3 },
    ingText: { fontSize: 14, fontFamily: Fonts.regular },
    instrText: { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 22 },
    detailActions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
    editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1 },
    editText: { fontSize: 13, fontFamily: Fonts.semibold },
    deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1 },
    deleteText: { fontSize: 13, fontFamily: Fonts.semibold },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
