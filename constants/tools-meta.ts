export type ToolMeta = {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  accent: string;
  badge: string;
};

export const TOOLS: ToolMeta[] = [
  /* ── Flagship / Daily Use ── */
  { id: 'doc-vault', label: 'Doc Vault', description: 'Secure document & image storage', icon: 'lock-closed-outline', route: '/tools/doc-vault', accent: '#2563EB', badge: 'Utility' },
  { id: 'expense', label: 'Expense Tracker', description: 'Track spending & budgets', icon: 'wallet-outline', route: '/tools/expense-tracker', accent: '#6366F1', badge: 'Finance' },
  { id: 'todo', label: 'Todo Manager', description: 'Colorful planner with priorities', icon: 'checkbox-outline', route: '/tools/todo-manager', accent: '#F97360', badge: 'Tasks' },
  { id: 'notes', label: 'Note Cards', description: 'Colorful notes with PIN lock', icon: 'reader-outline', route: '/tools/notes', accent: '#F59E0B', badge: 'Notes' },
  { id: 'grocery-list', label: 'Grocery List', description: 'Categorized shopping with favorites', icon: 'cart-outline', route: '/tools/grocery-list', accent: '#059669', badge: 'Life' },
  { id: 'habit-tracker', label: 'Habit Tracker', description: 'Build daily habits & streaks', icon: 'trending-up-outline', route: '/tools/habit-tracker', accent: '#8B5CF6', badge: 'Life' },
  { id: 'subscription-manager', label: 'Subscriptions', description: 'Track recurring subscriptions & costs', icon: 'card-outline', route: '/tools/subscription-manager', accent: '#EC4899', badge: 'Finance' },
  { id: 'reminder', label: 'Reminders', description: 'Set reminders & alerts', icon: 'notifications-outline', route: '/tools/reminder', accent: '#A855F7', badge: 'Life' },

  /* ── Finance ── */
  { id: 'house-bill-tracker', label: 'House Bills', description: 'Track rent, utilities & payments', icon: 'receipt-outline', route: '/tools/house-bill-tracker', accent: '#059669', badge: 'Finance' },
  { id: 'electricity-bill', label: 'Electricity Bill', description: 'Units, cost & monthly trends', icon: 'flash-outline', route: '/tools/electricity-bill', accent: '#F59E0B', badge: 'Finance' },
  { id: 'investment', label: 'Investment Calc', description: 'SIP, lumpsum, returns & compare', icon: 'trending-up-outline', route: '/tools/investment-calculator', accent: '#10B981', badge: 'Finance' },
  { id: 'emi-calc', label: 'EMI Calculator', description: 'Loan EMI & schedule', icon: 'cash-outline', route: '/tools/emi-calculator', accent: '#6366F1', badge: 'Finance' },
  { id: 'currency-converter', label: 'Currency Convert', description: 'Real-time exchange rates', icon: 'logo-usd', route: '/tools/currency-converter', accent: '#059669', badge: 'Finance' },
  { id: 'savings-goal', label: 'Savings Goal', description: 'Track progress toward savings', icon: 'trophy-outline', route: '/tools/savings-goal', accent: '#16A34A', badge: 'Finance' },
  { id: 'loan-comparison', label: 'Loan Compare', description: 'Compare multiple loans side-by-side', icon: 'git-compare-outline', route: '/tools/loan-comparison', accent: '#7C3AED', badge: 'Finance' },
  { id: 'fuel-cost', label: 'Fuel Cost', description: 'Trip fuel, reserve buffer & split cost planner', icon: 'speedometer-outline', route: '/tools/fuel-cost', accent: '#EA580C', badge: 'Finance' },
  { id: 'unit-price', label: 'Price Compare', description: 'Colorful unit-price comparison by true best deal', icon: 'pricetag-outline', route: '/tools/unit-price', accent: '#9333EA', badge: 'Finance' },
  { id: 'tip-calc', label: 'Tip Calculator', description: 'Service presets, smart splits & round-up tips', icon: 'restaurant-outline', route: '/tools/tip-calculator', accent: '#F59E0B', badge: 'Finance' },

  /* ── Health & Wellness ── */
  { id: 'water', label: 'Water Tracker', description: 'Daily hydration goals', icon: 'water-outline', route: '/tools/water-tracker', accent: '#0EA5E9', badge: 'Health' },
  { id: 'calorie-counter', label: 'Calorie Counter', description: 'Quick daily calorie tracking', icon: 'flame-outline', route: '/tools/calorie-counter', accent: '#EF4444', badge: 'Health' },
  { id: 'sleep-tracker', label: 'Sleep Tracker', description: 'Log sleep & see trends', icon: 'moon-outline', route: '/tools/sleep-tracker', accent: '#6366F1', badge: 'Health' },
  { id: 'gym', label: 'Gym Calendar', description: 'Track your workout days', icon: 'barbell-outline', route: '/tools/gym-calendar', accent: '#F97316', badge: 'Health' },
  { id: 'mood-journal', label: 'Mood Journal', description: 'Track daily mood & patterns', icon: 'happy-outline', route: '/tools/mood-journal', accent: '#F59E0B', badge: 'Health' },
  { id: 'breathing', label: 'Breathing', description: 'Guided breathing exercises', icon: 'leaf-outline', route: '/tools/breathing', accent: '#059669', badge: 'Health' },
  { id: 'bmi-calc', label: 'BMI Calculator', description: 'Body mass index', icon: 'body-outline', route: '/tools/bmi-calculator', accent: '#06B6D4', badge: 'Health' },
  { id: 'period-tracker', label: 'Period Tracker', description: 'Menstrual cycle & symptom tracker', icon: 'flower-outline', route: '/tools/period-tracker', accent: '#E11D77', badge: 'Health' },

  /* ── Productivity & Time ── */
  { id: 'pomodoro', label: 'Pomodoro', description: 'Focus timer with work/break cycles', icon: 'hourglass-outline', route: '/tools/pomodoro', accent: '#EF4444', badge: 'Productivity' },
  { id: 'routine-tracker', label: 'Routine Tracker', description: 'Daily routines with streaks', icon: 'time-outline', route: '/tools/routine-tracker', accent: '#8B5CF6', badge: 'Life' },
  { id: 'stopwatch', label: 'Stopwatch & Timer', description: 'Laps & countdown', icon: 'timer-outline', route: '/tools/stopwatch-timer', accent: '#F97316', badge: 'Time' },
  { id: 'world-clock', label: 'World Clock', description: 'Capitals, global timezones and watch-face clocks', icon: 'globe-outline', route: '/tools/world-clock', accent: '#3B82F6', badge: 'Time' },
  { id: 'event-countdown', label: 'Event Countdown', description: 'Countdown to important dates', icon: 'hourglass-outline', route: '/tools/event-countdown', accent: '#E11D48', badge: 'Date' },

  /* ── Life & Documents ── */
  { id: 'document-expiry', label: 'Doc Expiry', description: 'Track document expiry dates', icon: 'document-outline', route: '/tools/document-expiry', accent: '#D946EF', badge: 'Life' },
  { id: 'vehicle-service', label: 'Vehicle Service', description: 'Vehicle service history & reminders', icon: 'car-outline', route: '/tools/vehicle-service', accent: '#0891B2', badge: 'Life' },
  { id: 'birthday', label: 'Birthday Tracker', description: 'Color-coded birthdays, notes & age previews', icon: 'gift-outline', route: '/tools/birthday-tracker', accent: '#F43F5E', badge: 'Life' },
  { id: 'travel-tracker', label: 'Travel Tracker', description: 'Log trips, budgets & destinations', icon: 'airplane-outline', route: '/tools/travel-tracker', accent: '#0891B2', badge: 'Life' },
  { id: 'baby-care', label: 'Baby Care', description: 'Feed, diaper, sleep & milestones', icon: 'heart-outline', route: '/tools/baby-care', accent: '#EC4899', badge: 'Life' },

  /* ── Live & Media ── */
  { id: 'weather', label: 'Weather', description: 'Live weather & 7-day forecast', icon: 'partly-sunny-outline', route: '/tools/weather', accent: '#3B82F6', badge: 'Live' },
  { id: 'news-reader', label: 'News Reader', description: 'Browse top headlines worldwide', icon: 'newspaper-outline', route: '/tools/news-reader', accent: '#1D4ED8', badge: 'Live' },
  { id: 'translate', label: 'Translate', description: 'Translate text between languages', icon: 'language-outline', route: '/tools/translate', accent: '#D946EF', badge: 'Language' },
  { id: 'wallpaper-browse', label: 'Wallpapers', description: 'Browse & save beautiful photos', icon: 'images-outline', route: '/tools/wallpaper-browse', accent: '#E11D48', badge: 'Fun' },

  /* ── Calendar & Dates ── */
  { id: 'holiday', label: 'Holiday Calendar', description: 'Holidays & custom events', icon: 'flag-outline', route: '/tools/holiday-calendar', accent: '#8B5CF6', badge: 'Calendar' },
  { id: 'date-calculator', label: 'Date Calculator', description: 'Days between dates & add/subtract', icon: 'calendar-number-outline', route: '/tools/date-calculator', accent: '#0D9488', badge: 'Date' },
  { id: 'age-calc', label: 'Age Calculator', description: 'Exact age, totals & next birthday', icon: 'calendar-outline', route: '/tools/age-calculator', accent: '#84CC16', badge: 'Date' },

  /* ── Notes & Writing ── */
  { id: 'markdown', label: 'Markdown Notepad', description: 'Write & preview notes', icon: 'document-text-outline', route: '/tools/markdown-notepad', accent: '#64748B', badge: 'Notes' },

  /* ── Calculators & Math ── */
  { id: 'basic-calc', label: 'Calculator', description: 'Live preview, history & clean keypad', icon: 'calculator-outline', route: '/tools/basic-calculator', accent: '#3B82F6', badge: 'Math' },
  { id: 'sci-calc', label: 'Scientific Calc', description: 'Trig, powers, logs & live preview', icon: 'flask-outline', route: '/tools/scientific-calculator', accent: '#2563EB', badge: 'Math' },
  { id: 'percentage-calc', label: 'Percentage Calc', description: 'Percent studio for discounts, shares & change', icon: 'analytics-outline', route: '/tools/percentage-calculator', accent: '#F97316', badge: 'Math' },
  { id: 'matrix-calc', label: 'Matrix Calculator', description: 'Add, multiply, determinant & inverse', icon: 'grid-outline', route: '/tools/matrix-calculator', accent: '#4F46E5', badge: 'Math' },

  /* ── Convert & Utility ── */
  { id: 'unit-conv', label: 'Unit Converter', description: 'Length, weight, temp…', icon: 'swap-horizontal-outline', route: '/tools/unit-converter', accent: '#14B8A6', badge: 'Convert' },
  { id: 'text-tools', label: 'Text Tools', description: 'Word count, case convert & more', icon: 'text-outline', route: '/tools/text-tools', accent: '#14B8A6', badge: 'Convert' },
  { id: 'qr-generator', label: 'QR Generator', description: 'Generate QR codes from text & URLs', icon: 'qr-code-outline', route: '/tools/qr-generator', accent: '#1E293B', badge: 'Utility' },
  { id: 'password', label: 'Password Gen', description: 'Secure random passwords', icon: 'key-outline', route: '/tools/password-generator', accent: '#EF4444', badge: 'Security' },
  { id: 'compass', label: 'Compass', description: 'Digital compass with heading', icon: 'compass-outline', route: '/tools/compass', accent: '#DC2626', badge: 'Utility' },
  { id: 'ruler', label: 'Ruler', description: 'On-screen ruler in cm & inches', icon: 'resize-outline', route: '/tools/ruler', accent: '#CA8A04', badge: 'Utility' },
  { id: 'tally-counter', label: 'Tally Counter', description: 'Tap to count anything', icon: 'add-circle-outline', route: '/tools/tally-counter', accent: '#0891B2', badge: 'Utility' },

  /* ── Home Service Trackers ── */
  { id: 'maintenance-tracker', label: 'Maintenance', description: 'Appliance service tracker', icon: 'construct-outline', route: '/tools/maintenance-tracker', accent: '#E67E22', badge: 'Home' },
  { id: 'cook-tracker', label: 'Cook Tracker', description: 'Cook attendance & payment log', icon: 'restaurant-outline', route: '/tools/cook-tracker', accent: '#D97706', badge: 'Home' },
  { id: 'maid-tracker', label: 'Maid Tracker', description: 'Maid attendance & payment log', icon: 'home-outline', route: '/tools/maid-tracker', accent: '#7C3AED', badge: 'Home' },
  { id: 'milk-tracker', label: 'Milk Tracker', description: 'Daily milk delivery log', icon: 'water-outline', route: '/tools/milk-tracker', accent: '#0284C7', badge: 'Home' },
  { id: 'water-can-tracker', label: 'Water Can', description: 'Water can delivery log', icon: 'water-outline', route: '/tools/water-can-tracker', accent: '#0891B2', badge: 'Home' },
  { id: 'flower-tracker', label: 'Flower Tracker', description: 'Daily flower delivery log', icon: 'flower-outline', route: '/tools/flower-tracker', accent: '#E11D48', badge: 'Home' },
  { id: 'driver-tracker', label: 'Driver Tracker', description: 'Driver attendance & pay', icon: 'car-sport-outline', route: '/tools/driver-tracker', accent: '#2563EB', badge: 'Home' },
  { id: 'newspaper-tracker', label: 'Paper Tracker', description: 'Newspaper delivery log', icon: 'newspaper-outline', route: '/tools/newspaper-tracker', accent: '#64748B', badge: 'Home' },
  { id: 'office-boy-tracker', label: 'Office Boy', description: 'Office boy attendance & pay', icon: 'person-outline', route: '/tools/office-boy-tracker', accent: '#0D9488', badge: 'Home' },

  /* ── Learning ── */
  { id: 'flashcards', label: 'Flashcards', description: 'Study cards with flip & decks', icon: 'albums-outline', route: '/tools/flashcards', accent: '#A855F7', badge: 'Learning' },
  { id: 'assignment-tracker', label: 'Assignments', description: 'Track homework & due dates', icon: 'school-outline', route: '/tools/assignment-tracker', accent: '#2563EB', badge: 'Learning' },
  { id: 'gpa-calc', label: 'GPA Calculator', description: 'Calculate GPA from grades', icon: 'school-outline', route: '/tools/gpa-calculator', accent: '#2563EB', badge: 'Learning' },

  /* ── Dev Tools ── */
  { id: 'json-formatter', label: 'JSON Formatter', description: 'Format, validate & minify JSON', icon: 'code-slash-outline', route: '/tools/json-formatter', accent: '#0EA5E9', badge: 'Dev' },
  { id: 'base-converter', label: 'Base Converter', description: 'Live base convert with bit and ASCII insights', icon: 'git-branch-outline', route: '/tools/base-converter', accent: '#7C3AED', badge: 'Dev' },
  { id: 'color-tools', label: 'Color Tools', description: 'HEX ↔ RGB ↔ HSL', icon: 'color-palette-outline', route: '/tools/color-tools', accent: '#EC4899', badge: 'Design' },

  /* ── Fun ── */
  { id: 'dice-coin', label: 'Dice & Coin', description: 'Roll dice & flip coins', icon: 'dice-outline', route: '/tools/dice-coin', accent: '#F59E0B', badge: 'Fun' },
  { id: 'random-picker', label: 'Random Picker', description: 'List draws, multi-pick winners & number ranges', icon: 'shuffle-outline', route: '/tools/random-picker', accent: '#D946EF', badge: 'Fun' },
  { id: 'tic-tac-toe', label: 'Tic-Tac-Toe', description: 'Classic X & O game vs AI or friend', icon: 'game-controller-outline', route: '/tools/tic-tac-toe', accent: '#3B82F6', badge: 'Fun' },
  { id: 'memory-match', label: 'Memory Match', description: 'Flip cards & find matching pairs', icon: 'copy-outline', route: '/tools/memory-match', accent: '#8B5CF6', badge: 'Fun' },
  { id: 'game-2048', label: '2048', description: 'Slide & merge tiles to reach 2048', icon: 'apps-outline', route: '/tools/game-2048', accent: '#F59E0B', badge: 'Fun' },
  { id: 'snake-game', label: 'Snake', description: 'Classic snake game with levels', icon: 'game-controller-outline', route: '/tools/snake-game', accent: '#10B981', badge: 'Fun' },
  { id: 'word-scramble', label: 'Word Scramble', description: 'Unscramble words against the clock', icon: 'text-outline', route: '/tools/word-scramble', accent: '#EC4899', badge: 'Fun' },
  { id: 'sudoku', label: 'Sudoku', description: 'Number puzzle with 3 difficulty levels', icon: 'keypad-outline', route: '/tools/sudoku', accent: '#6366F1', badge: 'Fun' },
  { id: 'minesweeper', label: 'Minesweeper', description: 'Find mines without triggering them', icon: 'flag-outline', route: '/tools/minesweeper', accent: '#64748B', badge: 'Fun' },
  { id: 'quiz-trivia', label: 'Quiz Trivia', description: 'Test your knowledge across topics', icon: 'help-circle-outline', route: '/tools/quiz-trivia', accent: '#F97316', badge: 'Fun' },

  /* ── New Health & Wellness ── */
  { id: 'bp-log', label: 'Blood Pressure', description: 'Track BP readings & trends', icon: 'heart-outline', route: '/tools/bp-log', accent: '#EF4444', badge: 'Health' },
  { id: 'medication-tracker', label: 'Medications', description: 'Track meds, doses & adherence', icon: 'medkit-outline', route: '/tools/medication-tracker', accent: '#06B6D4', badge: 'Health' },
  { id: 'gratitude-journal', label: 'Gratitude', description: 'Daily gratitude journal & streaks', icon: 'sunny-outline', route: '/tools/gratitude-journal', accent: '#F59E0B', badge: 'Health' },
  { id: 'step-counter', label: 'Step Counter', description: 'Daily step tracking & goals', icon: 'footsteps-outline', route: '/tools/step-counter', accent: '#10B981', badge: 'Health' },

  /* ── New Life & Lifestyle ── */
  { id: 'book-tracker', label: 'Book Tracker', description: 'Track your reading list', icon: 'book-outline', route: '/tools/book-tracker', accent: '#8B5CF6', badge: 'Life' },
  { id: 'wish-list', label: 'Wish List', description: 'Track things you want to buy', icon: 'star-outline', route: '/tools/wish-list', accent: '#EC4899', badge: 'Life' },
  { id: 'recipe-book', label: 'Recipe Book', description: 'Save & organize recipes', icon: 'restaurant-outline', route: '/tools/recipe-book', accent: '#F97316', badge: 'Life' },
  { id: 'plant-care', label: 'Plant Care', description: 'Track plant watering schedules', icon: 'leaf-outline', route: '/tools/plant-care', accent: '#059669', badge: 'Life' },
  { id: 'pet-care', label: 'Pet Care', description: 'Pet health, vet & feeding log', icon: 'paw-outline', route: '/tools/pet-care', accent: '#F43F5E', badge: 'Life' },
  { id: 'parking-saver', label: 'Parking Saver', description: 'Save where you parked', icon: 'car-outline', route: '/tools/parking-saver', accent: '#3B82F6', badge: 'Utility' },
  { id: 'daily-quote', label: 'Daily Quote', description: 'Inspirational quotes & favorites', icon: 'chatbubble-outline', route: '/tools/daily-quote', accent: '#F59E0B', badge: 'Life' },

  /* ── New Finance ── */
  { id: 'loan-book', label: 'Loan Book', description: 'Track money lent & borrowed', icon: 'cash-outline', route: '/tools/loan-book', accent: '#7C3AED', badge: 'Finance' },
  { id: 'discount-calculator', label: 'Discount Calc', description: 'Discounts, tax & deals', icon: 'pricetag-outline', route: '/tools/discount-calculator', accent: '#E11D48', badge: 'Finance' },

  /* ── New Utility ── */
  { id: 'morse-code', label: 'Morse Code', description: 'Text to Morse translator', icon: 'radio-outline', route: '/tools/morse-code', accent: '#64748B', badge: 'Utility' },
  { id: 'roman-numeral', label: 'Roman Numerals', description: 'Convert to/from Roman numerals', icon: 'text-outline', route: '/tools/roman-numeral', accent: '#9333EA', badge: 'Convert' },
  { id: 'aspect-ratio', label: 'Aspect Ratio', description: 'Calculate & compare ratios', icon: 'resize-outline', route: '/tools/aspect-ratio', accent: '#0891B2', badge: 'Utility' },
  { id: 'metronome', label: 'Metronome', description: 'BPM tempo & tap timing', icon: 'musical-notes-outline', route: '/tools/metronome', accent: '#D946EF', badge: 'Utility' },

  /* ── New Productivity ── */
  { id: 'meeting-planner', label: 'Meeting Planner', description: 'Find times across timezones', icon: 'people-outline', route: '/tools/meeting-planner', accent: '#2563EB', badge: 'Productivity' },
  { id: 'kanban-board', label: 'Kanban Board', description: 'Task board with columns', icon: 'clipboard-outline', route: '/tools/kanban-board', accent: '#6366F1', badge: 'Productivity' },
];
