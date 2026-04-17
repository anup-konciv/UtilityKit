import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F97316';

// ── Categories ──────────────────────────────────────────────────────────────
type Category = 'General Knowledge' | 'Science' | 'History' | 'Geography' | 'Entertainment' | 'Sports';
const CATEGORIES: Category[] = ['General Knowledge', 'Science', 'History', 'Geography', 'Entertainment', 'Sports'];
const CATEGORY_ICONS: Record<Category, string> = {
  'General Knowledge': 'bulb-outline',
  Science: 'flask-outline',
  History: 'time-outline',
  Geography: 'globe-outline',
  Entertainment: 'film-outline',
  Sports: 'football-outline',
};

// ── Question type ───────────────────────────────────────────────────────────
type Question = {
  question: string;
  options: [string, string, string, string];
  correct: number; // 0-3
  category: Category;
};

// ── 66 trivia questions ─────────────────────────────────────────────────────
const QUESTIONS: Question[] = [
  // ── General Knowledge (11) ──
  { question: 'What is the hardest natural substance on Earth?', options: ['Gold', 'Iron', 'Diamond', 'Platinum'], correct: 2, category: 'General Knowledge' },
  { question: 'How many keys are on a standard piano?', options: ['76', '88', '92', '100'], correct: 1, category: 'General Knowledge' },
  { question: 'What is the most widely spoken language in the world by native speakers?', options: ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], correct: 2, category: 'General Knowledge' },
  { question: 'What color is the "black box" flight recorder actually painted?', options: ['Black', 'Orange', 'Red', 'Yellow'], correct: 1, category: 'General Knowledge' },
  { question: 'How many sides does a dodecagon have?', options: ['10', '11', '12', '14'], correct: 2, category: 'General Knowledge' },
  { question: 'What is the currency of Japan?', options: ['Yuan', 'Won', 'Yen', 'Ringgit'], correct: 2, category: 'General Knowledge' },
  { question: 'Which company created the iPhone?', options: ['Microsoft', 'Samsung', 'Google', 'Apple'], correct: 3, category: 'General Knowledge' },
  { question: 'What does "HTTP" stand for?', options: ['HyperText Transfer Protocol', 'High Tech Transfer Process', 'Hybrid Text Transformation Protocol', 'HyperText Transition Program'], correct: 0, category: 'General Knowledge' },
  { question: 'What is the smallest prime number?', options: ['0', '1', '2', '3'], correct: 2, category: 'General Knowledge' },
  { question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correct: 2, category: 'General Knowledge' },
  { question: 'Which blood type is known as the universal donor?', options: ['A+', 'B-', 'AB+', 'O-'], correct: 3, category: 'General Knowledge' },

  // ── Science (11) ──
  { question: 'What planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], correct: 2, category: 'Science' },
  { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correct: 2, category: 'Science' },
  { question: 'What is the chemical symbol for gold?', options: ['Go', 'Gd', 'Au', 'Ag'], correct: 2, category: 'Science' },
  { question: 'How many bones are in the adult human body?', options: ['186', '206', '226', '256'], correct: 1, category: 'Science' },
  { question: 'What is the speed of light approximately in km/s?', options: ['150,000', '200,000', '300,000', '400,000'], correct: 2, category: 'Science' },
  { question: 'Which element has the atomic number 1?', options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], correct: 1, category: 'Science' },
  { question: 'What is the largest organ in the human body?', options: ['Liver', 'Brain', 'Heart', 'Skin'], correct: 3, category: 'Science' },
  { question: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism', 'Friction', 'Gravity', 'Inertia'], correct: 2, category: 'Science' },
  { question: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi Body'], correct: 2, category: 'Science' },
  { question: 'What temperature does water boil at in Celsius at sea level?', options: ['90', '95', '100', '110'], correct: 2, category: 'Science' },
  { question: 'Which planet has the most moons in our solar system?', options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correct: 1, category: 'Science' },

  // ── History (11) ──
  { question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correct: 2, category: 'History' },
  { question: 'Who was the first President of the United States?', options: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'], correct: 1, category: 'History' },
  { question: 'Which ancient civilization built the pyramids at Giza?', options: ['Roman', 'Greek', 'Mesopotamian', 'Egyptian'], correct: 3, category: 'History' },
  { question: 'In which year did the Titanic sink?', options: ['1905', '1912', '1918', '1923'], correct: 1, category: 'History' },
  { question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], correct: 2, category: 'History' },
  { question: 'What year did the Berlin Wall fall?', options: ['1987', '1988', '1989', '1990'], correct: 2, category: 'History' },
  { question: 'Which empire was ruled by Genghis Khan?', options: ['Ottoman', 'Roman', 'Mongol', 'Persian'], correct: 2, category: 'History' },
  { question: 'Who discovered penicillin?', options: ['Marie Curie', 'Louis Pasteur', 'Alexander Fleming', 'Joseph Lister'], correct: 2, category: 'History' },
  { question: 'In which country did the Renaissance begin?', options: ['France', 'England', 'Germany', 'Italy'], correct: 3, category: 'History' },
  { question: 'What year did India gain independence from Britain?', options: ['1945', '1947', '1950', '1952'], correct: 1, category: 'History' },
  { question: 'Who was the first person to walk on the Moon?', options: ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'Michael Collins'], correct: 2, category: 'History' },

  // ── Geography (11) ──
  { question: 'What is the longest river in the world?', options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correct: 1, category: 'Geography' },
  { question: 'Which country has the largest population?', options: ['India', 'United States', 'China', 'Indonesia'], correct: 0, category: 'Geography' },
  { question: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correct: 2, category: 'Geography' },
  { question: 'Which is the smallest country in the world by area?', options: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], correct: 1, category: 'Geography' },
  { question: 'Mount Everest is located on the border of which two countries?', options: ['India & China', 'Nepal & China', 'Nepal & India', 'Bhutan & China'], correct: 1, category: 'Geography' },
  { question: 'What is the largest desert in the world?', options: ['Sahara', 'Arabian', 'Gobi', 'Antarctic'], correct: 3, category: 'Geography' },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correct: 2, category: 'Geography' },
  { question: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], correct: 2, category: 'Geography' },
  { question: 'In which continent is the Amazon Rainforest?', options: ['Africa', 'Asia', 'South America', 'Central America'], correct: 2, category: 'Geography' },
  { question: 'Which African country was formerly known as Abyssinia?', options: ['Kenya', 'Nigeria', 'Ethiopia', 'Somalia'], correct: 2, category: 'Geography' },
  { question: 'What is the deepest point in the world\'s oceans?', options: ['Tonga Trench', 'Mariana Trench', 'Java Trench', 'Puerto Rico Trench'], correct: 1, category: 'Geography' },

  // ── Entertainment (11) ──
  { question: 'Who directed the movie "Inception"?', options: ['Steven Spielberg', 'James Cameron', 'Christopher Nolan', 'Ridley Scott'], correct: 2, category: 'Entertainment' },
  { question: 'Which band released the album "Abbey Road"?', options: ['The Rolling Stones', 'The Beatles', 'Led Zeppelin', 'Pink Floyd'], correct: 1, category: 'Entertainment' },
  { question: 'What is the highest-grossing film of all time (unadjusted)?', options: ['Avengers: Endgame', 'Avatar', 'Titanic', 'Star Wars: The Force Awakens'], correct: 1, category: 'Entertainment' },
  { question: 'In the Harry Potter series, what is the name of Harry\'s owl?', options: ['Errol', 'Hedwig', 'Pigwidgeon', 'Scabbers'], correct: 1, category: 'Entertainment' },
  { question: 'Which TV show features a character named Walter White?', options: ['The Wire', 'Better Call Saul', 'Breaking Bad', 'Ozark'], correct: 2, category: 'Entertainment' },
  { question: 'What is the name of the fictional continent in Game of Thrones?', options: ['Middle-earth', 'Narnia', 'Westeros', 'Tamriel'], correct: 2, category: 'Entertainment' },
  { question: 'Who played Jack in the movie "Titanic"?', options: ['Brad Pitt', 'Johnny Depp', 'Tom Cruise', 'Leonardo DiCaprio'], correct: 3, category: 'Entertainment' },
  { question: 'Which video game franchise features a character named Mario?', options: ['Sonic', 'Zelda', 'Mario', 'Mega Man'], correct: 2, category: 'Entertainment' },
  { question: 'What year was the first "Star Wars" movie released?', options: ['1975', '1977', '1979', '1981'], correct: 1, category: 'Entertainment' },
  { question: 'Who wrote the novel "1984"?', options: ['Aldous Huxley', 'Ray Bradbury', 'George Orwell', 'H.G. Wells'], correct: 2, category: 'Entertainment' },
  { question: 'What is the name of the wizarding school in Harry Potter?', options: ['Durmstrang', 'Beauxbatons', 'Hogwarts', 'Ilvermorny'], correct: 2, category: 'Entertainment' },

  // ── Sports (11) ──
  { question: 'How many players are on a soccer team on the field?', options: ['9', '10', '11', '12'], correct: 2, category: 'Sports' },
  { question: 'In which sport is the term "love" used to mean zero?', options: ['Badminton', 'Tennis', 'Table Tennis', 'Squash'], correct: 1, category: 'Sports' },
  { question: 'Which country has won the most FIFA World Cup titles?', options: ['Germany', 'Argentina', 'Italy', 'Brazil'], correct: 3, category: 'Sports' },
  { question: 'How many rings are on the Olympic flag?', options: ['4', '5', '6', '7'], correct: 1, category: 'Sports' },
  { question: 'In which sport would you perform a "slam dunk"?', options: ['Volleyball', 'Basketball', 'Tennis', 'Cricket'], correct: 1, category: 'Sports' },
  { question: 'What is the maximum score in a single frame of bowling?', options: ['10', '20', '30', '50'], correct: 2, category: 'Sports' },
  { question: 'Which country originated the sport of cricket?', options: ['Australia', 'India', 'England', 'South Africa'], correct: 2, category: 'Sports' },
  { question: 'How long is a marathon in kilometers (approximately)?', options: ['36.2', '40.2', '42.2', '45.2'], correct: 2, category: 'Sports' },
  { question: 'Who holds the record for most Grand Slam tennis titles (men)?', options: ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'], correct: 2, category: 'Sports' },
  { question: 'In which sport is the "Vince Lombardi Trophy" awarded?', options: ['Baseball', 'Basketball', 'Ice Hockey', 'American Football'], correct: 3, category: 'Sports' },
  { question: 'What is the diameter of a basketball hoop in inches?', options: ['16', '18', '20', '22'], correct: 1, category: 'Sports' },
];

const QUESTIONS_PER_ROUND = 10;
const TIME_PER_QUESTION = 15; // seconds
const BONUS_THRESHOLD = 5; // seconds remaining to earn bonus
const CORRECT_POINTS = 10;
const BONUS_POINTS = 5;
const ANSWER_DELAY = 1500; // ms
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

type GamePhase = 'start' | 'playing' | 'result';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function QuizTriviaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('start');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [roundQuestions, setRoundQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, { correct: number; total: number }>>({});
  const [highScore, setHighScore] = useState(0);

  // Per-question state
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'playing' || hasAnswered) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, hasAnswered]);

  const handleTimeout = useCallback(() => {
    setTimedOut(true);
    setHasAnswered(true);
    setSkippedCount((prev) => prev + 1);

    const q = roundQuestions[currentIndex];
    if (q) {
      setCategoryBreakdown((prev) => {
        const cat = q.category;
        const existing = prev[cat] ?? { correct: 0, total: 0 };
        return { ...prev, [cat]: { correct: existing.correct, total: existing.total + 1 } };
      });
    }

    nextTimerRef.current = setTimeout(() => advanceQuestion(), ANSWER_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, roundQuestions]);

  const startGame = useCallback(() => {
    const pool = selectedCategory === 'All'
      ? QUESTIONS
      : QUESTIONS.filter((q) => q.category === selectedCategory);

    const selected = shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
    setRoundQuestions(selected);
    setCurrentIndex(0);
    setScore(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSkippedCount(0);
    setCategoryBreakdown({});
    setTimeLeft(TIME_PER_QUESTION);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setTimedOut(false);
    setPhase('playing');
  }, [selectedCategory]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (hasAnswered) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedAnswer(optionIndex);
    setHasAnswered(true);

    const q = roundQuestions[currentIndex];
    const isCorrect = optionIndex === q.correct;
    const bonusEarned = timeLeft > (TIME_PER_QUESTION - BONUS_THRESHOLD);

    if (isCorrect) {
      const pts = CORRECT_POINTS + (bonusEarned ? BONUS_POINTS : 0);
      setScore((prev) => prev + pts);
      setCorrectCount((prev) => prev + 1);
    } else {
      setWrongCount((prev) => prev + 1);
    }

    setCategoryBreakdown((prev) => {
      const cat = q.category;
      const existing = prev[cat] ?? { correct: 0, total: 0 };
      return {
        ...prev,
        [cat]: {
          correct: existing.correct + (isCorrect ? 1 : 0),
          total: existing.total + 1,
        },
      };
    });

    nextTimerRef.current = setTimeout(() => advanceQuestion(), ANSWER_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnswered, roundQuestions, currentIndex, timeLeft]);

  const advanceQuestion = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= roundQuestions.length) {
        setPhase('result');
        setScore((s) => {
          setHighScore((hs) => Math.max(hs, s));
          return s;
        });
        return prev;
      }
      setTimeLeft(TIME_PER_QUESTION);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setTimedOut(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return next;
    });
  }, [roundQuestions.length]);

  const currentQuestion = roundQuestions[currentIndex] ?? null;
  const progressPercent = roundQuestions.length > 0 ? ((currentIndex + 1) / roundQuestions.length) * 100 : 0;
  const timerPercent = (timeLeft / TIME_PER_QUESTION) * 100;

  // ── Start screen ──────────────────────────────────────────────────────────
  if (phase === 'start') {
    return (
      <ScreenShell title="Quiz Trivia" accentColor={ACCENT}>
        {/* Hero area */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroContent}>
            <View style={[styles.heroBadge, { backgroundColor: ACCENT + '20' }]}>
              <Ionicons name="help-circle" size={48} color={ACCENT} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Quiz Trivia</Text>
            <Text style={[styles.heroSub, { color: colors.textMuted }]}>
              Test your knowledge across 6 categories with 10 questions per round. Answer fast for bonus points!
            </Text>
          </View>
        </View>

        {/* Category filter */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SELECT CATEGORY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            style={[
              styles.chip,
              { borderColor: selectedCategory === 'All' ? ACCENT : colors.border, backgroundColor: selectedCategory === 'All' ? ACCENT + '18' : colors.card },
            ]}
            onPress={() => setSelectedCategory('All')}
            activeOpacity={0.7}
          >
            <Ionicons name="apps-outline" size={14} color={selectedCategory === 'All' ? ACCENT : colors.textMuted} />
            <Text style={[styles.chipText, { color: selectedCategory === 'All' ? ACCENT : colors.textMuted }]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                { borderColor: selectedCategory === cat ? ACCENT : colors.border, backgroundColor: selectedCategory === cat ? ACCENT + '18' : colors.card },
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.7}
            >
              <Ionicons name={CATEGORY_ICONS[cat] as any} size={14} color={selectedCategory === cat ? ACCENT : colors.textMuted} />
              <Text style={[styles.chipText, { color: selectedCategory === cat ? ACCENT : colors.textMuted }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Rules card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rulesTitle, { color: colors.text }]}>How to Play</Text>
          <View style={styles.ruleRow}>
            <Ionicons name="timer-outline" size={18} color={ACCENT} />
            <Text style={[styles.ruleText, { color: colors.textMuted }]}>15 seconds per question</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
            <Text style={[styles.ruleText, { color: colors.textMuted }]}>+10 points for correct answer</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="flash-outline" size={18} color="#FBBF24" />
            <Text style={[styles.ruleText, { color: colors.textMuted }]}>+5 bonus if answered within 5 seconds</Text>
          </View>
          <View style={styles.ruleRow}>
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            <Text style={[styles.ruleText, { color: colors.textMuted }]}>0 points for wrong or timed out</Text>
          </View>
        </View>

        {/* High score */}
        {highScore > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.highScoreRow}>
              <Ionicons name="trophy-outline" size={22} color="#FBBF24" />
              <Text style={[styles.highScoreLabel, { color: colors.textMuted }]}>High Score</Text>
              <Text style={[styles.highScoreValue, { color: '#FBBF24' }]}>{highScore}</Text>
            </View>
          </View>
        )}

        {/* Start button */}
        <TouchableOpacity style={styles.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Ionicons name="play" size={22} color="#fff" />
          <Text style={styles.startBtnText}>Start Quiz</Text>
        </TouchableOpacity>
      </ScreenShell>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────
  if (phase === 'result') {
    const totalPossible = QUESTIONS_PER_ROUND * (CORRECT_POINTS + BONUS_POINTS);
    const percentage = Math.round((score / totalPossible) * 100);
    const isNewHigh = score >= highScore && score > 0;

    const getGrade = () => {
      if (percentage >= 90) return { label: 'Excellent!', icon: 'trophy', color: '#FBBF24' };
      if (percentage >= 70) return { label: 'Great Job!', icon: 'ribbon', color: '#10B981' };
      if (percentage >= 50) return { label: 'Good Effort!', icon: 'thumbs-up', color: ACCENT };
      if (percentage >= 30) return { label: 'Keep Trying!', icon: 'fitness', color: '#3B82F6' };
      return { label: 'Better Luck Next Time', icon: 'refresh-circle', color: '#EF4444' };
    };
    const grade = getGrade();

    return (
      <ScreenShell title="Quiz Trivia" accentColor={ACCENT}>
        {/* Result hero */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroContent}>
            <View style={[styles.heroBadge, { backgroundColor: grade.color + '20' }]}>
              <Ionicons name={grade.icon as any} size={48} color={grade.color} />
            </View>
            <Text style={[styles.heroTitle, { color: grade.color }]}>{grade.label}</Text>
            {isNewHigh && (
              <View style={[styles.newHighBadge, { backgroundColor: '#FBBF24' + '20' }]}>
                <Ionicons name="star" size={14} color="#FBBF24" />
                <Text style={[styles.newHighText, { color: '#FBBF24' }]}>New High Score!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Score card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scoreBig, { color: colors.text }]}>{score}</Text>
          <Text style={[styles.scoreOut, { color: colors.textMuted }]}>out of {totalPossible} points</Text>
          <View style={[styles.scoreBarBg, { backgroundColor: colors.glass }]}>
            <View style={[styles.scoreBarFill, { width: `${percentage}%`, backgroundColor: grade.color }]} />
          </View>
          <Text style={[styles.percentText, { color: grade.color }]}>{percentage}%</Text>
        </View>

        {/* Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rulesTitle, { color: colors.text }]}>Breakdown</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.breakdownValue, { color: '#10B981' }]}>{correctCount}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>Correct</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>{wrongCount}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>Wrong</Text>
            </View>
            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: '#FBBF24' }]} />
              <Text style={[styles.breakdownValue, { color: '#FBBF24' }]}>{skippedCount}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>Timed Out</Text>
            </View>
          </View>
        </View>

        {/* Category breakdown (only if "All" was selected) */}
        {selectedCategory === 'All' && Object.keys(categoryBreakdown).length > 1 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rulesTitle, { color: colors.text }]}>By Category</Text>
            {Object.entries(categoryBreakdown).map(([cat, data]) => (
              <View key={cat} style={styles.catRow}>
                <Ionicons name={CATEGORY_ICONS[cat as Category] as any} size={16} color={ACCENT} />
                <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>{cat}</Text>
                <Text style={[styles.catScore, { color: data.correct === data.total ? '#10B981' : colors.textMuted }]}>
                  {data.correct}/{data.total}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* High score */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.highScoreRow}>
            <Ionicons name="trophy-outline" size={22} color="#FBBF24" />
            <Text style={[styles.highScoreLabel, { color: colors.textMuted }]}>High Score</Text>
            <Text style={[styles.highScoreValue, { color: '#FBBF24' }]}>{highScore}</Text>
          </View>
        </View>

        {/* Play Again */}
        <TouchableOpacity style={styles.startBtn} onPress={() => setPhase('start')} activeOpacity={0.8}>
          <Ionicons name="refresh" size={22} color="#fff" />
          <Text style={styles.startBtnText}>Play Again</Text>
        </TouchableOpacity>
      </ScreenShell>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <ScreenShell title="Quiz Trivia" accentColor={ACCENT} scrollable={false}>
      <ScrollView
        ref={scrollRef}
        style={styles.playScroll}
        contentContainerStyle={styles.playScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
              Question {currentIndex + 1} of {roundQuestions.length}
            </Text>
            <Text style={[styles.scoreInline, { color: ACCENT }]}>
              Score: {score}
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.glass }]}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: ACCENT }]} />
          </View>
        </View>

        {/* Timer bar */}
        <View style={styles.timerSection}>
          <View style={styles.timerLabelRow}>
            <Ionicons
              name="timer-outline"
              size={16}
              color={timeLeft <= 5 ? '#EF4444' : colors.textMuted}
            />
            <Text style={[styles.timerText, { color: timeLeft <= 5 ? '#EF4444' : colors.textMuted }]}>
              {timeLeft}s
            </Text>
          </View>
          <View style={[styles.timerBarBg, { backgroundColor: colors.glass }]}>
            <View
              style={[
                styles.timerBarFill,
                {
                  width: `${timerPercent}%`,
                  backgroundColor: timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#FBBF24' : '#10B981',
                },
              ]}
            />
          </View>
        </View>

        {/* Category badge */}
        {currentQuestion && (
          <View style={styles.catBadgeRow}>
            <View style={[styles.catBadge, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '40' }]}>
              <Ionicons name={CATEGORY_ICONS[currentQuestion.category] as any} size={14} color={ACCENT} />
              <Text style={[styles.catBadgeText, { color: ACCENT }]}>{currentQuestion.category}</Text>
            </View>
          </View>
        )}

        {/* Question card */}
        {currentQuestion && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              {currentQuestion.question}
            </Text>
          </View>
        )}

        {/* Answer options */}
        {currentQuestion && currentQuestion.options.map((option, idx) => {
          const isCorrect = idx === currentQuestion.correct;
          const isSelected = selectedAnswer === idx;
          const showResult = hasAnswered;

          let optionBg = colors.card;
          let optionBorder = colors.border;
          let labelColor = colors.textMuted;
          let textColor = colors.text;

          if (showResult) {
            if (isCorrect) {
              optionBg = '#10B98120';
              optionBorder = '#10B981';
              labelColor = '#10B981';
              textColor = '#10B981';
            } else if (isSelected && !isCorrect) {
              optionBg = '#EF444420';
              optionBorder = '#EF4444';
              labelColor = '#EF4444';
              textColor = '#EF4444';
            } else if (timedOut && !isCorrect) {
              // leave as default for non-correct options on timeout
            }
          }

          // Timeout highlight on the correct answer is already handled above

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.optionCard,
                {
                  backgroundColor: optionBg,
                  borderColor: optionBorder,
                },
              ]}
              onPress={() => handleAnswer(idx)}
              disabled={hasAnswered}
              activeOpacity={0.7}
            >
              <View style={[styles.optionLabel, { backgroundColor: showResult && isCorrect ? '#10B981' : showResult && isSelected && !isCorrect ? '#EF4444' : ACCENT, borderColor: 'transparent' }]}>
                <Text style={styles.optionLabelText}>{OPTION_LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, { color: textColor }]} numberOfLines={3}>
                {option}
              </Text>
              {showResult && isCorrect && (
                <Ionicons name="checkmark-circle" size={22} color="#10B981" style={styles.optionIcon} />
              )}
              {showResult && isSelected && !isCorrect && (
                <Ionicons name="close-circle" size={22} color="#EF4444" style={styles.optionIcon} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Feedback message after answering */}
        {hasAnswered && (
          <View style={styles.feedbackRow}>
            {timedOut ? (
              <View style={[styles.feedbackBadge, { backgroundColor: '#FBBF2420' }]}>
                <Ionicons name="time-outline" size={16} color="#FBBF24" />
                <Text style={[styles.feedbackText, { color: '#FBBF24' }]}>Time's up!</Text>
              </View>
            ) : selectedAnswer === currentQuestion?.correct ? (
              <View style={[styles.feedbackBadge, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                <Text style={[styles.feedbackText, { color: '#10B981' }]}>
                  Correct! +{CORRECT_POINTS + (timeLeft > (TIME_PER_QUESTION - BONUS_THRESHOLD) ? BONUS_POINTS : 0)} pts
                </Text>
              </View>
            ) : (
              <View style={[styles.feedbackBadge, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                <Text style={[styles.feedbackText, { color: '#EF4444' }]}>Wrong answer</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </ScreenShell>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Card
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },

    // Hero / start screen
    heroContent: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    heroBadge: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    heroTitle: {
      fontFamily: Fonts.bold,
      fontSize: 26,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    heroSub: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: Spacing.sm,
    },

    // Section label
    sectionLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
    },

    // Category chips
    chipRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingBottom: Spacing.lg,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
    },

    // Rules
    rulesTitle: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    ruleText: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      flex: 1,
    },

    // High score
    highScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    highScoreLabel: {
      fontFamily: Fonts.medium,
      fontSize: 14,
      flex: 1,
    },
    highScoreValue: {
      fontFamily: Fonts.bold,
      fontSize: 22,
    },

    // Start button
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: ACCENT,
      paddingVertical: Spacing.lg,
      borderRadius: Radii.md,
      marginBottom: Spacing.xxl,
    },
    startBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 17,
      color: '#fff',
    },

    // New high badge
    newHighBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radii.pill,
      marginTop: Spacing.sm,
    },
    newHighText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },

    // Result score
    scoreBig: {
      fontFamily: Fonts.bold,
      fontSize: 48,
      textAlign: 'center',
    },
    scoreOut: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    scoreBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: Spacing.sm,
    },
    scoreBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    percentText: {
      fontFamily: Fonts.bold,
      fontSize: 16,
      textAlign: 'center',
    },

    // Breakdown
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    breakdownItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    breakdownDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: Spacing.xs,
    },
    breakdownValue: {
      fontFamily: Fonts.bold,
      fontSize: 24,
    },
    breakdownLabel: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },
    breakdownDivider: {
      width: 1,
      height: 36,
    },

    // Category breakdown
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.glass,
    },
    catName: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      flex: 1,
    },
    catScore: {
      fontFamily: Fonts.bold,
      fontSize: 14,
    },

    // Playing screen
    playScroll: {
      flex: 1,
    },
    playScrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.huge,
    },

    // Progress
    progressSection: {
      marginBottom: Spacing.md,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    progressLabel: {
      fontFamily: Fonts.medium,
      fontSize: 13,
    },
    scoreInline: {
      fontFamily: Fonts.bold,
      fontSize: 14,
    },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },

    // Timer
    timerSection: {
      marginBottom: Spacing.lg,
    },
    timerLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    timerText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    timerBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    timerBarFill: {
      height: '100%',
      borderRadius: 4,
    },

    // Category badge
    catBadgeRow: {
      flexDirection: 'row',
      marginBottom: Spacing.md,
    },
    catBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    catBadgeText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
    },

    // Question
    questionText: {
      fontFamily: Fonts.semibold,
      fontSize: 18,
      lineHeight: 26,
    },

    // Option cards
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      marginBottom: Spacing.sm,
    },
    optionLabel: {
      width: 32,
      height: 32,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabelText: {
      fontFamily: Fonts.bold,
      fontSize: 14,
      color: '#fff',
    },
    optionText: {
      fontFamily: Fonts.medium,
      fontSize: 15,
      flex: 1,
    },
    optionIcon: {
      marginLeft: Spacing.xs,
    },

    // Feedback
    feedbackRow: {
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    feedbackBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.pill,
    },
    feedbackText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
  });
