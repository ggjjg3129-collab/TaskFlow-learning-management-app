export interface Lesson {
  id: string;
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  duration: number;
  completed?: boolean;
}

export interface Course {
  id: string;
  title: string;
  titleAr: string;
  category: string;
  categoryAr: string;
  instructor: string;
  instructorAr: string;
  description: string;
  descriptionAr: string;
  level: string;
  image: string;
  lessons: Lesson[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
}

export const seedCourses: Course[] = [
  {
    id: "ux-foundations",
    title: "Foundations of User Experience",
    titleAr: "أساسيات تجربة المستخدم",
    category: "Design",
    categoryAr: "التصميم",
    instructor: "Maya Chen",
    instructorAr: "مايا تشين",
    description: "Learn to understand people, frame problems, and design clear digital experiences through research and thoughtful iteration.",
    descriptionAr: "تعلّم فهم احتياجات الناس وصياغة المشكلات وتصميم تجارب رقمية واضحة بالبحث والتطوير المدروس.",
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=82",
    lessons: [
      { id: "ux-1", title: "Start with people", titleAr: "ابدأ بالناس", content: "Distinguish assumptions from evidence and identify useful research questions. Open-ended conversations can reveal needs that a checklist might miss.", contentAr: "ميّز بين الافتراضات والأدلة وحدّد أسئلة بحث مفيدة. قد تكشف المحادثات المفتوحة احتياجات لا تظهر في قائمة أسئلة جاهزة.", duration: 12 },
      { id: "ux-2", title: "Map the journey", titleAr: "ارسم رحلة المستخدم", content: "Capture the learner’s goal, key touchpoints, friction, and moments of confidence before proposing a solution.", contentAr: "سجّل هدف المستخدم ونقاط التفاعل والعوائق ولحظات الثقة قبل اقتراح الحل.", duration: 16 },
      { id: "ux-3", title: "Prototype and learn", titleAr: "أنشئ نموذجاً وتعلّم", content: "Test one important assumption at a time and use what you learn to refine the next iteration.", contentAr: "اختبر افتراضاً مهماً واحداً في كل مرة واستخدم ما تعلّمته لتحسين النسخة التالية.", duration: 18 },
    ],
  },
  {
    id: "public-writing",
    title: "Writing for the Public Good",
    titleAr: "الكتابة من أجل الصالح العام",
    category: "Research",
    categoryAr: "البحث",
    instructor: "Samira Haddad",
    instructorAr: "سميرة حداد",
    description: "Build a practical toolkit for clear, compassionate writing in public-interest and community settings.",
    descriptionAr: "ابنِ أدوات عملية للكتابة الواضحة والمتعاطفة في المبادرات العامة والمجتمعية.",
    level: "Intermediate",
    image: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1000&q=82",
    lessons: [
      { id: "writing-1", title: "Clarity as a public service", titleAr: "الوضوح خدمة عامة", content: "Put the main point first, choose familiar words, and explain what someone can do next. Clarity makes useful information easier to act on.", contentAr: "ابدأ بالفكرة الأساسية واختر كلمات مألوفة واشرح الخطوة التالية الممكنة. يجعل الوضوح المعلومات المفيدة أسهل في العمل بها.", duration: 14 },
      { id: "writing-2", title: "Structure for scanning", titleAr: "نظّم النص لسهولة التصفّح", content: "Descriptive headings and short sections help readers find what matters without oversimplifying the subject.", contentAr: "تساعد العناوين الوصفية والفقرات القصيرة القراء على العثور على المهم دون تبسيط مخلّ.", duration: 11 },
      { id: "writing-3", title: "Edit with care", titleAr: "حرّر بعناية", content: "Revise for accuracy as well as ease, and make clear what is known and what remains uncertain.", contentAr: "راجع الدقة والوضوح معاً، وبيّن ما نعرفه وما لا يزال غير مؤكّد.", duration: 13 },
    ],
  },
  {
    id: "data-literacy",
    title: "Data Literacy for Everyday Decisions",
    titleAr: "الثقافة البيانية للقرارات اليومية",
    category: "Technology",
    categoryAr: "التقنية",
    instructor: "Omar Rahman",
    instructorAr: "عمر رحمن",
    description: "Read charts with care, ask better questions of evidence, and communicate what data can—and cannot—tell us.",
    descriptionAr: "اقرأ الرسوم البيانية بعناية، واطرح أسئلة أفضل حول الأدلة، واشرح ما يمكن للبيانات قوله وما لا يمكنها قوله.",
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=82",
    lessons: [
      { id: "data-1", title: "Ask before you count", titleAr: "اسأل قبل أن تحصي", content: "Begin with the decision you need to make. Good measurement starts with a human question, not a dashboard.", contentAr: "ابدأ بالقرار الذي تحتاج إلى اتخاذه. يبدأ القياس الجيد بسؤال إنساني، لا بلوحة مؤشرات.", duration: 10 },
      { id: "data-2", title: "Read a chart honestly", titleAr: "اقرأ الرسم البياني بإنصاف", content: "Check the units, time period, source, and scale before comparing values or drawing a conclusion.", contentAr: "تحقق من الوحدات والفترة الزمنية والمصدر والمقياس قبل مقارنة القيم أو استخلاص نتيجة.", duration: 15 },
      { id: "data-3", title: "Share uncertainty", titleAr: "عبّر عن عدم اليقين", content: "Separate observations from inferences, state limitations plainly, and describe which new evidence could change your view.", contentAr: "افصل الملاحظة عن الاستنتاج، واذكر القيود بوضوح، وحدّد الأدلة الجديدة التي قد تغيّر رأيك.", duration: 12 },
    ],
  },
  {
    id: "community-history",
    title: "Listening to Local Histories",
    titleAr: "الإصغاء إلى التاريخ المحلي",
    category: "Humanities",
    categoryAr: "العلوم الإنسانية",
    instructor: "Noura Al-Khatib",
    instructorAr: "نورة الخطيب",
    description: "Explore ethical oral-history practice and the small details that make community stories vivid.",
    descriptionAr: "اكتشف أخلاقيات التاريخ الشفهي والتفاصيل الصغيرة التي تمنح قصص المجتمع حيويتها.",
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=1000&q=82",
    lessons: [
      { id: "history-1", title: "Prepare to listen", titleAr: "استعد للإصغاء", content: "Ask for informed consent, create a comfortable setting, and invite a narrator to help shape the conversation.", contentAr: "اطلب الموافقة المستنيرة، وهيئ مكاناً مريحاً، وادعُ الراوي للمشاركة في توجيه الحوار.", duration: 12 },
      { id: "history-2", title: "Ask open questions", titleAr: "اطرح أسئلة مفتوحة", content: "Leave room for memory and meaning, follow the narrator’s language, and allow thoughtful pauses.", contentAr: "اترك مساحة للذاكرة والمعنى، وتابع لغة الراوي، واسمح بفواصل للتأمل.", duration: 16 },
      { id: "history-3", title: "Care for the story", titleAr: "صُن القصة", content: "Agree on boundaries and discuss clearly how a story may be shared; the narrator’s trust remains part of the work.", contentAr: "اتفق على الحدود وناقش بوضوح كيفية مشاركة القصة؛ فثقة الراوي جزء من العمل.", duration: 14 },
    ],
  },
];
